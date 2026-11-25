import {
  useEffect,
  useRef,
  useState,
  cloneElement,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { DataTable, type DataColumn } from "./components/DataTable";
import { aggregateWorkspace } from "./domain/aggregates";
import { canCreateActiveLoan } from "./domain/business-limit";
import {
  createGameProgress,
  createGameScenario,
  applyGameChoice,
  getGameScore,
} from "./domain/game/engine";
import { settleInstallment } from "./domain/late-interest";
import { formatMoney, toMinorUnits, decimalPlaces } from "./domain/money";
import { buildAmortizationCsv } from "./domain/reports";
import { rateToMonthly } from "./domain/rates";
import { generateSchedule } from "./domain/schedule";
import { deriveLoanStatus } from "./domain/status";
import type {
  Currency,
  IncomeEntry,
  Loan,
  LoanStatus,
  Region,
  Workspace,
  WorkspaceMode,
} from "./domain/types";
import { referenceRates } from "./data/reference-rates";
import {
  formatLocaleDate,
  localeFor,
  translate,
  type Language,
  type TranslationKey,
} from "./i18n";
import type { ValidationIssue } from "./domain/validation";
import { validateIncome, validateLoan } from "./domain/validation";
import { createInitialState, resetState } from "./storage/seed";
import type { AppState } from "./storage/model";
import {
  createBrowserRepository,
  RecoveryRequiredError,
  StorageRepository,
  type StorageMode,
} from "./storage/repository";

type ViewName =
  "dashboard" | "loans" | "income" | "calendar" | "quest" | "reports";
type LoanDraftFields = {
  name: string;
  description: string;
  principal: string;
  termMonths: string;
  ratePercent: string;
  rateBasis: Loan["rateBasis"];
  interestType: Loan["interestType"];
  penaltyRatePercent: string;
  firstDueDate: string;
};
type IncomeDraftFields = {
  source: string;
  description: string;
  amount: string;
  dateReceived: string;
  frequency: IncomeEntry["frequency"];
};

const navigation: { view: ViewName; label: TranslationKey; icon: string }[] = [
  { view: "dashboard", label: "nav.dashboard", icon: "◫" },
  { view: "loans", label: "nav.loans", icon: "▤" },
  { view: "income", label: "nav.income", icon: "◌" },
  { view: "calendar", label: "nav.calendar", icon: "▦" },
  { view: "quest", label: "nav.quest", icon: "✧" },
];

const statusLabels: Record<LoanStatus, TranslationKey> = {
  Active: "calendar.active",
  "In grace": "calendar.grace",
  Overdue: "calendar.overdueStatus",
  Paid: "calendar.paid",
};

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getViewFromHash(): ViewName {
  const route = window.location.hash.slice(1);
  return navigation.some((item) => item.view === route) || route === "reports"
    ? (route as ViewName)
    : "dashboard";
}

function amountFromMinor(amountMinor: number, currency: Currency): string {
  return (amountMinor / 10 ** decimalPlaces(currency)).toFixed(
    decimalPlaces(currency),
  );
}

function minorUnitsFromInput(value: string, currency: Currency): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? toMinorUnits(amount, currency) : 0;
}

function makeId(): string {
  return crypto.randomUUID();
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialog && !dialog.open) {
      dialog.showModal();
      dialog
        .querySelector<HTMLElement>("[data-dialog-autofocus]")
        ?.focus({ preventScroll: true });
    }
    return () => {
      if (dialog?.open) dialog.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={(node) => {
        dialogRef.current = node;
      }}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-actions">{footer}</div>}
    </dialog>
  );
}

function statusBadge(status: LoanStatus, label: string) {
  const css =
    status === "Overdue"
      ? "overdue"
      : status === "Paid"
        ? "paid"
        : status === "In grace"
          ? "grace"
          : "active";
  const symbol =
    status === "Overdue"
      ? "!"
      : status === "Paid"
        ? "✓"
        : status === "In grace"
          ? "◷"
          : "•";
  return (
    <span className={`status-badge ${css}`}>
      <span aria-hidden="true">{symbol}</span>
      {label}
    </span>
  );
}

function validationMessage(
  issue: ValidationIssue,
  t: (key: TranslationKey) => string,
): string {
  switch (issue.code) {
    case "required":
      return t("common.required");
    case "invalid_date":
      return t("common.invalidDate");
    case "must_be_positive":
      return t("common.mustBePositive");
    case "must_be_positive_integer":
      return t("common.invalidTerm");
    case "must_be_nonnegative":
      return t("common.invalidRate");
    case "invalid_value":
      return t("common.invalidRate");
    case "derived_only":
      return t("common.status");
  }
}

function LedgerPage({
  state,
  workspace,
  view,
  onAddLoan,
  onEditLoan,
  onDeleteLoan,
  onAddIncome,
  onEditIncome,
  onDeleteIncome,
  t,
}: {
  state: AppState;
  workspace: Workspace;
  view: "loans" | "income";
  onAddLoan: () => void;
  onEditLoan: (loan: Loan) => void;
  onDeleteLoan: (loan: Loan) => void;
  onAddIncome: () => void;
  onEditIncome: (entry: IncomeEntry) => void;
  onDeleteIncome: (entry: IncomeEntry) => void;
  t: (key: TranslationKey) => string;
}) {
  const currency = workspace.currency;
  const locale = localeFor(state.language, currency);
  const aggregate = aggregateWorkspace(
    workspace.loans,
    workspace.payments,
    workspace.income,
    currency,
    todayDate(),
  );

  if (view === "loans") {
    const rows = workspace.loans.map((loan) => {
      const schedule = generateSchedule(loan, currency);
      const payments = workspace.payments.filter(
        (payment) => payment.loanId === loan.id,
      );
      const status = deriveLoanStatus(schedule, payments, todayDate());
      const paid = new Set(payments.map((payment) => payment.installmentIndex));
      return {
        loan,
        status,
        remaining: schedule.reduce(
          (sum, item) => sum + (paid.has(item.index) ? 0 : item.principalMinor),
          0,
        ),
        next: schedule.find((item) => !paid.has(item.index)),
        payment: schedule[0]?.amountMinor ?? 0,
      };
    });
    const columns: DataColumn<(typeof rows)[number]>[] = [
      { key: "name", label: t("loans.name"), value: (row) => row.loan.name },
      {
        key: "status",
        label: t("common.status"),
        value: (row) => row.status,
        render: (row) => statusBadge(row.status, t(statusLabels[row.status])),
      },
      {
        key: "principal",
        label: t("loans.principal"),
        value: (row) => row.remaining,
        render: (row) => formatMoney(row.remaining, currency, locale),
      },
      {
        key: "payment",
        label: t("loans.payment"),
        value: (row) => row.payment,
        render: (row) => formatMoney(row.payment, currency, locale),
      },
      {
        key: "next",
        label: t("common.dueDate"),
        value: (row) => row.next?.dueDate ?? "",
        render: (row) =>
          row.next
            ? formatLocaleDate(row.next.dueDate, state.language)
            : t("calendar.paid"),
      },
    ];

    return (
      <section className="page-section">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {currency} · {t("app.estimateNotice")}
            </p>
            <h1>{t("loans.title")}</h1>
          </div>
          <button type="button" className="button primary" onClick={onAddLoan}>
            {t("loans.add")}
          </button>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.loan.id}
          searchLabel={t("loans.search")}
          actionsLabel={t("common.actions")}
          recordsLabel={t("common.records")}
          searchText={(row) =>
            `${row.loan.name} ${row.loan.description} ${row.status}`
          }
          emptyText={t("common.empty")}
          actions={(row) => (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => onEditLoan(row.loan)}
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                className="text-button danger-text"
                onClick={() => onDeleteLoan(row.loan)}
              >
                {t("common.delete")}
              </button>
            </>
          )}
        />
      </section>
    );
  }

  const rows = workspace.income.map((entry) => ({
    entry,
    frequency:
      entry.frequency === "recurring"
        ? t("income.recurring")
        : t("income.oneTime"),
  }));
  const columns: DataColumn<(typeof rows)[number]>[] = [
    {
      key: "source",
      label: t("income.source"),
      value: (row) => row.entry.source,
    },
    {
      key: "frequency",
      label: t("income.frequency"),
      value: (row) => row.frequency,
    },
    {
      key: "amount",
      label: t("income.amount"),
      value: (row) => row.entry.amountMinor,
      render: (row) => formatMoney(row.entry.amountMinor, currency, locale),
    },
    {
      key: "date",
      label: t("income.date"),
      value: (row) => row.entry.dateReceived,
      render: (row) => formatLocaleDate(row.entry.dateReceived, state.language),
    },
  ];

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{currency}</p>
          <h1>{t("income.title")}</h1>
        </div>
        <button type="button" className="button primary" onClick={onAddIncome}>
          {t("income.add")}
        </button>
      </div>
      <div className="metric-grid three">
        <Metric
          label={t("income.monthlyIncome")}
          value={formatMoney(aggregate.recurringIncomeMinor, currency, locale)}
        />
        <Metric
          label={t("income.oneTimeSnapshot")}
          value={formatMoney(aggregate.oneTimeIncomeMinor, currency, locale)}
        />
        <Metric
          label={t("income.debtToIncome")}
          value={
            aggregate.debtToIncomePercent === null
              ? t("dashboard.noIncome")
              : `${aggregate.debtToIncomePercent.toFixed(1)}%`
          }
        />
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.entry.id}
        searchLabel={t("common.search")}
        actionsLabel={t("common.actions")}
        recordsLabel={t("common.records")}
        searchText={(row) =>
          `${row.entry.source} ${row.entry.description} ${row.frequency}`
        }
        emptyText={t("common.empty")}
        actions={(row) => (
          <>
            <button
              type="button"
              className="text-button"
              onClick={() => onEditIncome(row.entry)}
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              className="text-button danger-text"
              onClick={() => onDeleteIncome(row.entry)}
            >
              {t("common.delete")}
            </button>
          </>
        )}
      />
    </section>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className="metric-card">
      <p className="eyebrow">{label}</p>
      <strong className="metric-value">{value}</strong>
      {note && <span className="small muted">{note}</span>}
    </article>
  );
}

function Dashboard({
  state,
  workspace,
  t,
  go,
}: {
  state: AppState;
  workspace: Workspace;
  t: (key: TranslationKey) => string;
  go: (view: ViewName) => void;
}) {
  const currency = workspace.currency;
  const locale = localeFor(state.language, currency);
  const aggregate = aggregateWorkspace(
    workspace.loans,
    workspace.payments,
    workspace.income,
    currency,
    todayDate(),
  );
  const activeDebtMinor =
    aggregate.principalRemainingMinor + aggregate.interestRemainingMinor;
  const principalShare =
    activeDebtMinor === 0
      ? 0
      : aggregate.principalRemainingMinor / activeDebtMinor;
  const unpaidPayments = aggregate.calendarEntries.filter(
    (entry) => entry.status !== "Paid",
  );
  const nextPayments = unpaidPayments.slice(0, 6);
  const money = (amount: number) => {
    const formatted = formatMoney(amount, currency, locale);
    return formatted.includes(currency)
      ? formatted
      : `${formatted} ${currency}`;
  };
  const highestRateLoan = [...workspace.loans].sort(
    (left, right) =>
      rateToMonthly(right.rate, right.rateBasis) -
      rateToMonthly(left.rate, left.rateBasis),
  )[0];
  const statusGroups: {
    status: LoanStatus[];
    label: string;
    className: string;
  }[] = [
    {
      status: ["Active", "In grace"],
      label: t("calendar.active"),
      className: "lane-active",
    },
    {
      status: ["Overdue"],
      label: t("calendar.overdueStatus"),
      className: "lane-overdue",
    },
    { status: ["Paid"], label: t("calendar.paid"), className: "lane-paid" },
  ];

  function remainingForLoan(loan: Loan): number {
    const paid = new Set(
      workspace.payments
        .filter((payment) => payment.loanId === loan.id)
        .map((payment) => payment.installmentIndex),
    );
    return generateSchedule(loan, currency).reduce(
      (sum, installment) =>
        sum + (paid.has(installment.index) ? 0 : installment.principalMinor),
      0,
    );
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {formatLocaleDate(todayDate(), state.language)} · {currency}
          </p>
          <h1>{t("dashboard.title")}</h1>
          <p className="muted">
            {" "}
            {state.userName ? `${state.userName}, ` : ""}
            {t("app.estimateNotice")}
          </p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => go("loans")}
        >
          {t("loans.title")} ↓
        </button>
      </div>
      <div className="dashboard-grid">
        <article className="hero-card">
          <p className="eyebrow">{t("dashboard.netBalance")}</p>
          <strong className="hero-value">
            {money(aggregate.monthlyNetBalanceMinor)}
          </strong>
          <p className="small muted">{t("dashboard.balanceDescription")}</p>
          <div className="hero-details">
            <span>
              {t("dashboard.recurringIncome")}
              <strong>{money(aggregate.recurringIncomeMinor)}</strong>
            </span>
            <span>
              {t("dashboard.monthlyPayments")}
              <strong>{money(aggregate.monthlyObligationsMinor)}</strong>
            </span>
          </div>
        </article>
        <article className="panel-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">{t("dashboard.debtBreakdown")}</p>
              <h2>{money(activeDebtMinor)}</h2>
            </div>
            <span className="tag">{t("dashboard.estimate")}</span>
          </div>
          <svg
            className="breakdown-chart"
            viewBox="0 0 300 18"
            role="img"
            aria-labelledby="breakdown-title"
          >
            <title id="breakdown-title">
              {t("dashboard.debtBreakdown")}:{" "}
              {formatMoney(aggregate.principalRemainingMinor, currency, locale)}{" "}
              {t("dashboard.principal")},{" "}
              {formatMoney(aggregate.interestRemainingMinor, currency, locale)}{" "}
              {t("dashboard.interest")}
            </title>
            <rect
              x="0"
              y="0"
              width={300 * principalShare}
              height="18"
              rx="8"
              fill="#06D6A0"
            />
            <rect
              x={300 * principalShare}
              y="0"
              width={300 * (1 - principalShare)}
              height="18"
              rx="8"
              fill="#FFC145"
            />
          </svg>
          <table className="chart-table">
            <tbody>
              <tr>
                <th>{t("dashboard.principal")}</th>
                <td>{money(aggregate.principalRemainingMinor)}</td>
              </tr>
              <tr>
                <th>{t("dashboard.totalInterest")}</th>
                <td>{money(aggregate.interestRemainingMinor)}</td>
              </tr>
            </tbody>
          </table>
        </article>
        <article className="panel-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">{t("dashboard.timeline")}</p>
              <h2>{money(aggregate.monthlyObligationsMinor)}</h2>
            </div>
            <span className="small muted">{t("dashboard.scheduled")}</span>
          </div>
          <PaymentTimeline
            entries={unpaidPayments}
            currency={currency}
            language={state.language}
            locale={locale}
            detailsLabel={t("dashboard.timelineDetails")}
          />
        </article>
      </div>
      {aggregate.overdueCount > 0 && (
        <div className="attention-banner" role="status">
          <div>
            <strong>
              {aggregate.overdueCount} · {t("dashboard.overdue")}
            </strong>
            <p>
              {
                nextPayments.find((entry) => entry.status === "Overdue")
                  ?.loanName
              }{" "}
              · {t("calendar.lateInterest")}:{" "}
              {formatMoney(
                nextPayments.find((entry) => entry.status === "Overdue")
                  ?.lateInterestMinor ?? 0,
                currency,
                locale,
              )}
            </p>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => go("calendar")}
          >
            {t("nav.calendar")} →
          </button>
        </div>
      )}
      <div className="board-heading">
        <div>
          <p className="eyebrow">
            {t("common.loans")} · <span>{currency}</span>
          </p>
          <h2>{t("dashboard.statusBoard")}</h2>
          <p className="small muted">{t("dashboard.boardCaption")}</p>
        </div>
        <span>
          {workspace.loans.length} {t("common.loans")}
        </span>
      </div>
      <div className="status-board">
        {statusGroups.map((group) => {
          const rows = workspace.loans.filter((loan) =>
            group.status.includes(aggregate.loanStatuses[loan.id] ?? "Active"),
          );
          return (
            <section
              className={`status-lane ${group.className}`}
              key={group.label}
            >
              <h3>
                {group.label}
                <span className="lane-count">{rows.length}</span>
              </h3>
              {rows.map((loan) => {
                const status = aggregate.loanStatuses[loan.id] ?? "Active";
                const next = aggregate.calendarEntries.find(
                  (entry) =>
                    entry.loanId === loan.id && entry.status !== "Paid",
                );
                return (
                  <article className="loan-card" key={loan.id}>
                    <div className="card-heading">
                      <strong>{loan.name}</strong>
                      {statusBadge(status, t(statusLabels[status]))}
                    </div>
                    {loan.description && (
                      <p className="loan-description">{loan.description}</p>
                    )}
                    <div className="loan-card-details">
                      <span>
                        <small>{t("dashboard.activeDebt")}</small>
                        <strong>{money(remainingForLoan(loan))}</strong>
                      </span>
                      <span>
                        <small>{t("common.dueDate")}</small>
                        <strong>
                          {next
                            ? `${formatLocaleDate(next.installment.dueDate, state.language)} · ${money(next.installment.amountMinor)}`
                            : t("calendar.paid")}
                        </strong>
                      </span>
                    </div>
                  </article>
                );
              })}
              {rows.length === 0 && (
                <p className="small muted">{t("common.empty")}</p>
              )}
            </section>
          );
        })}
      </div>
      <div className="bottom-grid">
        <section className="panel-card">
          <div className="card-heading payment-heading">
            <div>
              <p className="eyebrow">{t("dashboard.upcoming")}</p>
              <h2>{t("dashboard.paymentDates")}</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => go("calendar")}
            >
              {t("dashboard.viewDates")} →
            </button>
          </div>
          <div className="payment-list">
            {nextPayments.slice(0, 3).map((entry) => (
              <div
                className="payment-row"
                key={`${entry.loanId}-${entry.installment.index}`}
              >
                <span>
                  {formatLocaleDate(entry.installment.dueDate, state.language)}{" "}
                  · {t(statusLabels[entry.status])}
                </span>
                <strong>{entry.loanName}</strong>
                <b>{money(entry.installment.amountMinor)}</b>
              </div>
            ))}
            {nextPayments.length === 0 && (
              <p className="muted">{t("calendar.empty")}</p>
            )}
          </div>
        </section>
        <section className="quest-promo">
          <span aria-hidden="true" className="quest-icon">
            ✧
          </span>
          <div>
            <p className="eyebrow">{t("dashboard.tips")}</p>
            <h2>
              {highestRateLoan ? highestRateLoan.name : t("dashboard.tips")}
            </h2>
            <p>{highestRateLoan ? t("loans.helperText") : t("common.empty")}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => go("quest")}
            >
              {t("nav.quest")} →
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function PaymentTimeline({
  entries,
  currency,
  language,
  locale,
  detailsLabel,
}: {
  entries: ReturnType<typeof aggregateWorkspace>["calendarEntries"];
  currency: Currency;
  language: Language;
  locale: string;
  detailsLabel: string;
}) {
  const months = new Map<string, number>();
  for (const entry of entries) {
    const month = entry.installment.dueDate.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + entry.installment.amountMinor);
  }
  const rows = [...months.entries()].slice(0, 6);
  const max = Math.max(1, ...rows.map(([, amount]) => amount));
  return (
    <div>
      <svg
        className="timeline-chart"
        viewBox={`0 0 ${Math.max(1, rows.length) * 48} 100`}
        role="img"
        aria-label={rows
          .map(
            ([month, amount]) =>
              `${month}: ${formatMoney(amount, currency, locale)}`,
          )
          .join("; ")}
      >
        {rows.map(([month, amount], index) => {
          const height = (amount / max) * 64;
          const label = new Intl.DateTimeFormat(
            language === "es" ? "es-CO" : "en-US",
            { month: "short", timeZone: "UTC" },
          ).format(new Date(`${month}-01T00:00:00Z`));
          return (
            <g key={month}>
              <rect
                x={index * 48 + 8}
                y={72 - height}
                width="28"
                height={height}
                rx="5"
                fill={
                  [
                    "#B9EBE0",
                    "#06D6A0",
                    "#FFC145",
                    "#F78C6B",
                    "#A9D8E2",
                    "#DCEBED",
                  ][index % 6]
                }
              />
              <text x={index * 48 + 22} y="94" textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="timeline-details">
        <summary>{detailsLabel}</summary>
        <table className="chart-table">
          <thead>
            <tr>
              <th>{language === "es" ? "Mes" : "Month"}</th>
              <th>{language === "es" ? "Pagos" : "Payments"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([month, amount]) => (
              <tr key={month}>
                <th>{month}</th>
                <td>{formatMoney(amount, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function LoanEditor({
  loan,
  locked,
  workspace,
  language,
  t,
  onSave,
  onClose,
}: {
  loan?: Loan;
  locked: boolean;
  workspace: Workspace;
  language: Language;
  t: (key: TranslationKey) => string;
  onSave: (loan: Loan) => Promise<boolean>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<LoanDraftFields>(() =>
    loan
      ? {
          name: loan.name,
          description: loan.description,
          principal: amountFromMinor(loan.principalMinor, workspace.currency),
          termMonths: String(loan.termMonths),
          ratePercent: String(loan.rate * 100),
          rateBasis: loan.rateBasis,
          interestType: loan.interestType,
          penaltyRatePercent: String(loan.penaltyRateAnnual * 100),
          firstDueDate: loan.firstDueDate,
        }
      : {
          name: "",
          description: "",
          principal: "",
          termMonths: "3",
          ratePercent: "0",
          rateBasis: workspace.region === "CO" ? "effective_annual" : "apr",
          interestType: "compound",
          penaltyRatePercent: "0",
          firstDueDate: todayDate(),
        },
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [helperOpen, setHelperOpen] = useState(false);
  const update = <Key extends keyof LoanDraftFields>(
    key: Key,
    value: LoanDraftFields[Key],
  ) => setFields((current) => ({ ...current, [key]: value }));
  const loanDraft: Loan = {
    id: loan?.id ?? "preview",
    name: fields.name,
    description: fields.description,
    principalMinor: minorUnitsFromInput(fields.principal, workspace.currency),
    termMonths: Number(fields.termMonths),
    rate: Number(fields.ratePercent) / 100,
    rateBasis: fields.rateBasis,
    interestType: fields.interestType,
    penaltyRateAnnual: Number(fields.penaltyRatePercent) / 100,
    firstDueDate: fields.firstDueDate,
    createdAt: loan?.createdAt ?? todayDate(),
  };
  const validationIssues = validateLoan(loanDraft);
  const preview =
    validationIssues.length === 0
      ? generateSchedule(loanDraft, workspace.currency)
      : [];
  const totalInterest = preview.reduce(
    (sum, installment) => sum + installment.interestMinor,
    0,
  );
  const errors = new Map(
    issues.map((issue) => [issue.field, validationMessage(issue, t)]),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIssues = validateLoan(loanDraft);
    setIssues(nextIssues);
    if (nextIssues.length > 0) return;
    if (await onSave(loanDraft)) onClose();
  }

  function applyPreset(rate: number, basis: Loan["rateBasis"]) {
    update("ratePercent", String(rate * 100));
    setFields((current) => ({ ...current, rateBasis: basis }));
  }

  return (
    <Dialog
      title={loan ? t("loans.edit") : t("loans.add")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="loan-editor-form"
            className="button primary"
          >
            {t("common.save")}
          </button>
        </>
      }
    >
      <form
        id="loan-editor-form"
        className="form-grid"
        onSubmit={submit}
        noValidate
      >
        <Field label={t("loans.name")} error={errors.get("name")}>
          <input
            id="loan-name"
            data-dialog-autofocus
            required
            value={fields.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(errors.get("name"))}
          />
        </Field>
        <Field label={t("loans.description")}>
          <input
            id="loan-description"
            value={fields.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </Field>
        <Field
          label={t("loans.principal")}
          error={errors.get("principalMinor")}
        >
          <input
            id="loan-principal"
            type="number"
            min="0"
            step={workspace.currency === "COP" ? "1" : "0.01"}
            value={fields.principal}
            disabled={locked}
            onChange={(event) => update("principal", event.target.value)}
            aria-invalid={Boolean(errors.get("principalMinor"))}
          />
        </Field>
        <Field label={t("loans.term")} error={errors.get("termMonths")}>
          <input
            id="loan-term"
            type="number"
            min="1"
            step="1"
            value={fields.termMonths}
            disabled={locked}
            onChange={(event) => update("termMonths", event.target.value)}
            aria-invalid={Boolean(errors.get("termMonths"))}
          />
        </Field>
        <Field label={t("loans.rate")} error={errors.get("rate")}>
          <input
            id="loan-rate"
            type="number"
            min="0"
            step="0.01"
            value={fields.ratePercent}
            disabled={locked}
            onChange={(event) => update("ratePercent", event.target.value)}
            aria-invalid={Boolean(errors.get("rate"))}
          />
        </Field>
        <Field label={t("loans.rateBasis")} error={errors.get("rateBasis")}>
          <select
            id="loan-rate-basis"
            value={fields.rateBasis}
            disabled={locked}
            onChange={(event) =>
              update(
                "rateBasis",
                event.target.value as LoanDraftFields["rateBasis"],
              )
            }
          >
            <option value="monthly_nominal">{t("loans.monthlyRate")}</option>
            <option value="effective_annual">
              {t("loans.effectiveAnnual")}
            </option>
            <option value="apr">{t("loans.apr")}</option>
          </select>
        </Field>
        <Field label={t("loans.interestType")}>
          <select
            id="loan-interest-type"
            value={fields.interestType}
            disabled={locked}
            onChange={(event) =>
              update(
                "interestType",
                event.target.value as LoanDraftFields["interestType"],
              )
            }
          >
            <option value="simple">{t("loans.simple")}</option>
            <option value="compound">{t("loans.compound")}</option>
          </select>
        </Field>
        <Field
          label={t("loans.penaltyRate")}
          error={errors.get("penaltyRateAnnual")}
        >
          <input
            id="loan-penalty-rate"
            type="number"
            min="0"
            step="0.01"
            value={fields.penaltyRatePercent}
            disabled={locked}
            onChange={(event) =>
              update("penaltyRatePercent", event.target.value)
            }
            aria-invalid={Boolean(errors.get("penaltyRateAnnual"))}
          />
        </Field>
        <Field
          label={t("loans.firstDueDate")}
          error={errors.get("firstDueDate")}
        >
          <input
            id="loan-first-due-date"
            type="date"
            value={fields.firstDueDate}
            disabled={locked}
            onChange={(event) => update("firstDueDate", event.target.value)}
            aria-invalid={Boolean(errors.get("firstDueDate"))}
          />
        </Field>
        {locked && <p className="form-note wide">{t("loans.lockedTerms")}</p>}
        <div className="preview-card wide">
          <span>{t("loans.payment")}</span>
          <strong>
            {preview[0]
              ? formatMoney(
                  preview[0].amountMinor,
                  workspace.currency,
                  localeFor(language, workspace.currency),
                )
              : "—"}
          </strong>
          <span>
            {t("loans.totalInterest")}:{" "}
            {formatMoney(
              totalInterest,
              workspace.currency,
              localeFor(language, workspace.currency),
            )}
          </span>
        </div>
        {!locked && (
          <div className="helper-block wide">
            <button
              type="button"
              className="text-button"
              aria-expanded={helperOpen}
              onClick={() => setHelperOpen((open) => !open)}
            >
              {t("loans.rateHelper")}
            </button>
            {helperOpen && (
              <div className="helper-panel">
                <p>{t("loans.helperText")}</p>
                <p className="small">
                  <strong>{t("loans.rateDisclaimer")}</strong>
                </p>
                {referenceRates
                  .filter((preset) => preset.region === workspace.region)
                  .map((preset) => (
                    <button
                      type="button"
                      className="button secondary"
                      key={preset.id}
                      onClick={() => applyPreset(preset.rate, preset.rateBasis)}
                    >
                      {t(
                        preset.region === "CO"
                          ? "loans.rateColombia"
                          : "loans.rateUnitedStates",
                      )}
                      : {(preset.rate * 100).toFixed(2)}% ·{" "}
                      {preset.asOf.slice(0, 7)}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
        {issues.length > 0 && (
          <div className="validation-summary wide" role="alert">
            {issues.map((issue) => (
              <p key={issue.field}>{validationMessage(issue, t)}</p>
            ))}
          </div>
        )}
      </form>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = children.props.id;
  const control =
    error && id
      ? cloneElement(children, { "aria-describedby": `${id}-error` })
      : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {error && (
        <span
          id={id ? `${id}-error` : undefined}
          className="field-error"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}

function IncomeEditor({
  entry,
  workspace,
  t,
  onSave,
  onClose,
}: {
  entry?: IncomeEntry;
  workspace: Workspace;
  t: (key: TranslationKey) => string;
  onSave: (entry: IncomeEntry) => Promise<boolean>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<IncomeDraftFields>(() =>
    entry
      ? {
          source: entry.source,
          description: entry.description,
          amount: amountFromMinor(entry.amountMinor, workspace.currency),
          dateReceived: entry.dateReceived,
          frequency: entry.frequency,
        }
      : {
          source: "",
          description: "",
          amount: "",
          dateReceived: todayDate(),
          frequency: "recurring",
        },
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const amountMinor = minorUnitsFromInput(fields.amount, workspace.currency);
  const [validation] = [validateIncome({ ...fields, amountMinor })];
  const errors = new Map(
    issues.map((issue) => [issue.field, validationMessage(issue, t)]),
  );
  function update<Key extends keyof IncomeDraftFields>(
    key: Key,
    value: IncomeDraftFields[Key],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIssues = validateIncome({ ...fields, amountMinor });
    setIssues(nextIssues);
    if (nextIssues.length > 0) return;
    const saved = await onSave({
      id: entry?.id ?? makeId(),
      ...fields,
      amountMinor,
    });
    if (saved) onClose();
  }

  return (
    <Dialog
      title={entry ? t("common.edit") : t("income.add")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="income-editor-form"
            className="button primary"
          >
            {t("common.save")}
          </button>
        </>
      }
    >
      <form
        id="income-editor-form"
        className="form-grid"
        onSubmit={submit}
        noValidate
      >
        <Field label={t("income.source")} error={errors.get("source")}>
          <input
            id="income-source"
            data-dialog-autofocus
            value={fields.source}
            onChange={(event) => update("source", event.target.value)}
            aria-invalid={Boolean(errors.get("source"))}
          />
        </Field>
        <Field label={t("income.description")}>
          <input
            id="income-description"
            value={fields.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </Field>
        <Field label={t("income.amount")} error={errors.get("amountMinor")}>
          <input
            id="income-amount"
            type="number"
            min="0"
            step={workspace.currency === "COP" ? "1" : "0.01"}
            value={fields.amount}
            onChange={(event) => update("amount", event.target.value)}
            aria-invalid={Boolean(errors.get("amountMinor"))}
          />
        </Field>
        <Field label={t("income.date")} error={errors.get("dateReceived")}>
          <input
            id="income-date"
            type="date"
            value={fields.dateReceived}
            onChange={(event) => update("dateReceived", event.target.value)}
            aria-invalid={Boolean(errors.get("dateReceived"))}
          />
        </Field>
        <Field label={t("income.frequency")} error={errors.get("frequency")}>
          <select
            id="income-frequency"
            value={fields.frequency}
            onChange={(event) =>
              update(
                "frequency",
                event.target.value as IncomeDraftFields["frequency"],
              )
            }
          >
            <option value="recurring">{t("income.recurring")}</option>
            <option value="one_time">{t("income.oneTime")}</option>
          </select>
        </Field>
        {validation.length > 0 && issues.length > 0 && (
          <div className="validation-summary wide" role="alert">
            {issues.map((issue) => (
              <p key={issue.field}>{validationMessage(issue, t)}</p>
            ))}
          </div>
        )}
      </form>
    </Dialog>
  );
}

export default function App() {
  const [repository, setRepository] = useState<StorageRepository | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("memory");
  const [view, setView] = useState<ViewName>(getViewFromHash);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [loanDialog, setLoanDialog] = useState<Loan | "new" | null>(null);
  const [incomeDialog, setIncomeDialog] = useState<IncomeEntry | "new" | null>(
    null,
  );
  const [upgradePrompt, setUpgradePrompt] = useState(false);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const setup = await createBrowserRepository();
      if (!active) return;
      setRepository(setup.repository);
      const initialState = createInitialState(todayDate());
      try {
        const stored = await setup.repository.load(initialState);
        if (active) {
          setState(stored);
          setStorageMode(setup.repository.mode);
          setLoading(false);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof RecoveryRequiredError
              ? caught.message
              : errorText(caught),
          );
          setRecovery(caught instanceof RecoveryRequiredError);
          setLoading(false);
        }
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const language = state?.language ?? "en";
  const t = (key: TranslationKey) => translate(language, key);
  const workspace = state ? state.workspaces[state.activeMode] : null;
  const aggregate = workspace
    ? aggregateWorkspace(
        workspace.loans,
        workspace.payments,
        workspace.income,
        workspace.currency,
        todayDate(),
      )
    : null;

  async function persist(
    update: (current: AppState) => AppState,
  ): Promise<boolean> {
    if (!repository) return false;
    try {
      const next = await repository.update(update);
      setState(next);
      setStorageMode(repository.mode);
      setError("");
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `${t("storage.writeError")} ${errorText(caught)}`
          : t("storage.writeError"),
      );
      setStorageMode(repository.mode);
      return false;
    }
  }

  async function go(nextView: ViewName) {
    window.location.hash = nextView;
    setView(nextView);
  }

  async function signIn(name: string, region: Region, mode: WorkspaceMode) {
    if (!state || !repository) return;
    if (!state.hasSignedIn) {
      const seeded = createInitialState(todayDate(), { [mode]: region });
      seeded.userName = name.trim();
      seeded.isSignedIn = true;
      seeded.activeMode = mode;
      seeded.language = state.language;
      seeded.hasSignedIn = true;
      await persist(() => seeded);
      return;
    }
    await persist((current) => ({
      ...current,
      userName: current.userName ?? name.trim(),
      isSignedIn: true,
      activeMode: mode,
    }));
  }

  async function switchMode(mode: WorkspaceMode) {
    if (state?.activeMode !== mode)
      await persist((current) => ({ ...current, activeMode: mode }));
  }

  async function saveLoan(loan: Loan): Promise<boolean> {
    if (!workspace || !state) return false;
    const existing = workspace.loans.find((item) => item.id === loan.id);
    if (!existing) {
      const limit = canCreateActiveLoan(
        state.activeMode,
        workspace.loans,
        workspace.membershipUpgraded,
        workspace.payments,
      );
      if (!limit.allowed) {
        setUpgradePrompt(true);
        return false;
      }
    }
    return persist((current) => {
      const activeWorkspace = current.workspaces[current.activeMode];
      const record = existing
        ? { ...loan, id: existing.id, createdAt: existing.createdAt }
        : { ...loan, id: makeId() };
      return {
        ...current,
        workspaces: {
          ...current.workspaces,
          [current.activeMode]: {
            ...activeWorkspace,
            loans: existing
              ? activeWorkspace.loans.map((item) =>
                  item.id === existing.id ? record : item,
                )
              : [...activeWorkspace.loans, record],
          },
        },
      };
    });
  }

  async function deleteLoan(loan: Loan) {
    if (!workspace) return;
    const paidCount = workspace.payments.filter(
      (payment) => payment.loanId === loan.id,
    ).length;
    const message = t("loans.deleteConfirm").replace(
      "{count}",
      String(paidCount),
    );
    if (!window.confirm(message)) return;
    await persist((current) => {
      const currentWorkspace = current.workspaces[current.activeMode];
      return {
        ...current,
        workspaces: {
          ...current.workspaces,
          [current.activeMode]: {
            ...currentWorkspace,
            loans: currentWorkspace.loans.filter((item) => item.id !== loan.id),
            payments: currentWorkspace.payments.filter(
              (payment) => payment.loanId !== loan.id,
            ),
          },
        },
      };
    });
  }

  async function saveIncome(entry: IncomeEntry): Promise<boolean> {
    return persist((current) => {
      const activeWorkspace = current.workspaces[current.activeMode];
      const exists = activeWorkspace.income.some(
        (item) => item.id === entry.id,
      );
      return {
        ...current,
        workspaces: {
          ...current.workspaces,
          [current.activeMode]: {
            ...activeWorkspace,
            income: exists
              ? activeWorkspace.income.map((item) =>
                  item.id === entry.id ? entry : item,
                )
              : [...activeWorkspace.income, entry],
          },
        },
      };
    });
  }

  async function deleteIncome(entry: IncomeEntry) {
    if (!window.confirm(t("income.deleteConfirm"))) return;
    await persist((current) => ({
      ...current,
      workspaces: {
        ...current.workspaces,
        [current.activeMode]: {
          ...current.workspaces[current.activeMode],
          income: current.workspaces[current.activeMode].income.filter(
            (item) => item.id !== entry.id,
          ),
        },
      },
    }));
  }

  async function markPaid(loanId: string, installmentIndex: number) {
    if (!workspace) return;
    const loan = workspace.loans.find((item) => item.id === loanId);
    if (!loan) return;
    const installment = generateSchedule(loan, workspace.currency).find(
      (item) => item.index === installmentIndex,
    );
    if (!installment) return;
    const payment = settleInstallment(
      loan.id,
      installment,
      todayDate(),
      loan.penaltyRateAnnual,
    );
    await persist((current) => {
      const currentWorkspace = current.workspaces[current.activeMode];
      if (
        currentWorkspace.payments.some(
          (item) =>
            item.loanId === loan.id &&
            item.installmentIndex === installmentIndex,
        )
      )
        return current;
      return {
        ...current,
        workspaces: {
          ...current.workspaces,
          [current.activeMode]: {
            ...currentWorkspace,
            payments: [...currentWorkspace.payments, payment],
          },
        },
      };
    });
  }

  async function resetApp() {
    if (!state || !repository || !window.confirm(t("common.resetConfirm")))
      return;
    try {
      const next = await repository.reset(resetState(todayDate()));
      setState(next);
      setStorageMode(repository.mode);
      setError("");
      void go("dashboard");
    } catch (caught) {
      setError(`${t("storage.writeError")} ${errorText(caught)}`);
    }
  }

  async function signOut() {
    await persist((current) => ({ ...current, isSignedIn: false }));
  }

  async function updateLanguage(nextLanguage: Language) {
    await persist((current) => ({ ...current, language: nextLanguage }));
  }

  async function acceptUpgrade() {
    const accepted = await persist((current) => ({
      ...current,
      workspaces: {
        ...current.workspaces,
        [current.activeMode]: {
          ...current.workspaces[current.activeMode],
          membershipUpgraded: true,
        },
      },
    }));
    if (accepted) setUpgradePrompt(false);
  }

  async function chooseGame(choiceId: string) {
    if (!state) return;
    await persist((current) => {
      const currentProgress =
        current.gameProgress[current.activeMode] ??
        createGameProgress(current.activeMode);
      return {
        ...current,
        gameProgress: {
          ...current.gameProgress,
          [current.activeMode]: applyGameChoice(currentProgress, choiceId),
        },
      };
    });
  }

  async function restartGame() {
    if (!state) return;
    await persist((current) => ({
      ...current,
      gameProgress: {
        ...current.gameProgress,
        [current.activeMode]: createGameProgress(current.activeMode),
      },
    }));
  }

  function downloadCsv() {
    if (!workspace) return;
    const csv = buildAmortizationCsv(
      workspace.loans,
      workspace.payments,
      workspace.currency,
      language,
      todayDate(),
    );
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `budgify-${state?.activeMode ?? "workspace"}-amortization.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <main className="loading-screen" aria-live="polite">
        Budgify
      </main>
    );
  if (recovery)
    return (
      <main className="recovery-screen">
        <h1>{t("storage.recovery")}</h1>
        <p>{error}</p>
        <button
          className="button danger"
          onClick={() => {
            if (repository && window.confirm(t("common.resetConfirm")))
              void repository
                .reset(createInitialState(todayDate()))
                .then((next) => {
                  setState(next);
                  setStorageMode(repository.mode);
                  setError("");
                  setRecovery(false);
                  void go("dashboard");
                })
                .catch((caught: unknown) => setError(errorText(caught)));
          }}
        >
          {t("common.reset")}
        </button>
      </main>
    );
  if (!state || !repository)
    return (
      <main className="recovery-screen" role="alert">
        {error}
      </main>
    );
  if (!state.isSignedIn || !state.userName)
    return (
      <SignIn
        state={state}
        storageMode={storageMode}
        onSignIn={signIn}
        onLanguage={updateLanguage}
        t={t}
        error={error}
      />
    );
  if (!workspace || !aggregate)
    return (
      <main className="recovery-screen" role="alert">
        {t("storage.recovery")}
      </main>
    );

  const activeWorkspace = workspace;
  function renderContent() {
    if (!state || !aggregate) return null;
    return (
      <>
        {storageMode !== "indexeddb" && (
          <div className={`storage-banner ${storageMode}`} role="status">
            {t(
              storageMode === "localstorage"
                ? "storage.localstorage"
                : "storage.memory",
            )}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {view === "dashboard" && (
          <Dashboard
            state={state}
            workspace={activeWorkspace}
            t={t}
            go={(next) => void go(next)}
          />
        )}
        {(view === "loans" || view === "income") && (
          <LedgerPage
            state={state}
            workspace={activeWorkspace}
            view={view}
            onAddLoan={() => setLoanDialog("new")}
            onEditLoan={setLoanDialog}
            onDeleteLoan={(loan) => void deleteLoan(loan)}
            onAddIncome={() => setIncomeDialog("new")}
            onEditIncome={setIncomeDialog}
            onDeleteIncome={(entry) => void deleteIncome(entry)}
            t={t}
          />
        )}
        {view === "calendar" && (
          <CalendarPage
            state={state}
            workspace={activeWorkspace}
            onMarkPaid={(loanId, index) => void markPaid(loanId, index)}
            t={t}
          />
        )}
        {view === "quest" && (
          <QuestPage
            state={state}
            onChoice={(choice) => void chooseGame(choice)}
            onRestart={() => void restartGame()}
            t={t}
          />
        )}
        {view === "reports" && (
          <ReportsPage
            state={state}
            workspace={activeWorkspace}
            aggregate={aggregate}
            onCsv={downloadCsv}
            onPrint={() => window.print()}
            t={t}
          />
        )}
        <footer className="app-footer">
          <span>{t("app.estimateNotice")}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => void resetApp()}
          >
            {t("common.reset")}
          </button>
        </footer>
      </>
    );
  }

  function renderDialogs() {
    return (
      <>
        {loanDialog && (
          <LoanEditor
            loan={loanDialog === "new" ? undefined : loanDialog}
            locked={
              loanDialog !== "new" &&
              activeWorkspace.payments.some(
                (payment) => payment.loanId === loanDialog.id,
              )
            }
            workspace={activeWorkspace}
            language={language}
            t={t}
            onSave={saveLoan}
            onClose={() => setLoanDialog(null)}
          />
        )}
        {incomeDialog && (
          <IncomeEditor
            entry={incomeDialog === "new" ? undefined : incomeDialog}
            workspace={activeWorkspace}
            t={t}
            onSave={saveIncome}
            onClose={() => setIncomeDialog(null)}
          />
        )}
        {upgradePrompt && (
          <Dialog
            title={t("loans.businessLimit")}
            onClose={() => setUpgradePrompt(false)}
            footer={
              <>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setUpgradePrompt(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => void acceptUpgrade()}
                >
                  {t("loans.upgrade")}
                </button>
              </>
            }
          >
            <p className="dialog-copy">{t("loans.businessLimit")}</p>
          </Dialog>
        )}
      </>
    );
  }

  function renderHeader() {
    if (!state) return null;
    return (
      <header className="top-bar">
        <a className="wordmark" href="#dashboard">
          {t("app.name")}{" "}
          <span>
            /{" "}
            {t(
              navigation.find((item) => item.view === view)?.label ??
                "nav.dashboard",
            )}
          </span>
        </a>
        <div className="toolbar-controls">
          <label className="visually-group">
            <span className="sr-only">{t("signin.mode")}</span>
            <select
              aria-label={t("signin.mode")}
              value={state.activeMode}
              onChange={(event) =>
                void switchMode(event.target.value as WorkspaceMode)
              }
            >
              <option value="personal">
                {t("workspace.personal")} · {state.workspaces.personal.currency}
              </option>
              <option value="business">
                {t("workspace.business")} · {state.workspaces.business.currency}
              </option>
            </select>
          </label>
          <label className="visually-group">
            <span className="sr-only">
              {language === "en" ? "Language" : "Idioma"}
            </span>
            <select
              aria-label={language === "en" ? "Language" : "Idioma"}
              value={language}
              onChange={(event) =>
                void updateLanguage(event.target.value as Language)
              }
            >
              <option value="en">{t("language.english")}</option>
              <option value="es">{t("language.spanish")}</option>
            </select>
          </label>
          <button
            type="button"
            className="text-button hide-small"
            onClick={() => void signOut()}
          >
            {t("nav.signOut")}
          </button>
        </div>
      </header>
    );
  }

  return (
    <div className="app-shell">
      <aside className="navigation-rail">
        <a
          className="brand-mark"
          href="#dashboard"
          aria-label="b. Budgify home"
        >
          b.
        </a>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.view}
              href={`#${item.view}`}
              aria-label={t(item.label)}
              aria-current={view === item.view ? "page" : undefined}
              title={t(item.label)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{t(item.label)}</span>
            </a>
          ))}
          <a
            href="#reports"
            aria-label={t("nav.reports")}
            aria-current={view === "reports" ? "page" : undefined}
            title={t("nav.reports")}
          >
            <span aria-hidden="true">▧</span>
            <span className="nav-label">{t("nav.reports")}</span>
          </a>
        </nav>
        <div className="rail-user" title={state.userName}>
          {state.userName.slice(0, 1).toUpperCase()}
        </div>
      </aside>
      <main className="main-content">
        {renderHeader()}
        <div className="content-wrap">{renderContent()}</div>
      </main>
      {renderDialogs()}
    </div>
  );
}

function SignIn({
  state,
  storageMode,
  onSignIn,
  onLanguage,
  t,
  error,
}: {
  state: AppState;
  storageMode: StorageMode;
  onSignIn: (
    name: string,
    region: Region,
    mode: WorkspaceMode,
  ) => Promise<void>;
  onLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
  error: string;
}) {
  const [name, setName] = useState(state.userName ?? "");
  const [region, setRegion] = useState<Region>(
    state.workspaces[state.activeMode].region,
  );
  const [mode, setMode] = useState<WorkspaceMode>(state.activeMode);
  return (
    <main className="signin-screen">
      <form
        className="signin-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void onSignIn(name, region, mode);
        }}
      >
        <div className="brand-mark">b.</div>
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("signin.title")}</h1>
        <label>
          {t("signin.name")}
          <input
            required
            readOnly={state.userName !== null}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          {t("workspace.region")}
          <select
            value={region}
            disabled={state.hasSignedIn}
            onChange={(event) => setRegion(event.target.value as Region)}
          >
            <option value="CO">{t("workspace.colombia")}</option>
            <option value="US">{t("workspace.us")}</option>
          </select>
        </label>
        {!state.hasSignedIn && (
          <p className="small muted">{t("signin.regionNote")}</p>
        )}
        <label>
          {t("signin.mode")}
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as WorkspaceMode)}
          >
            <option value="personal">{t("workspace.personal")}</option>
            <option value="business">{t("workspace.business")}</option>
          </select>
        </label>
        <p className="privacy-note">{t("signin.privacy")}</p>
        {storageMode !== "indexeddb" && (
          <div className={`storage-banner ${storageMode}`} role="status">
            {t(
              storageMode === "localstorage"
                ? "storage.localstorage"
                : "storage.memory",
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" className="button primary">
          {t("signin.continue")}
        </button>
        <label className="language-signin">
          {t("language.english")} / {t("language.spanish")}
          <select
            value={state.language}
            onChange={(event) =>
              void onLanguage(event.target.value as Language)
            }
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </form>
    </main>
  );
}

function CalendarPage({
  state,
  workspace,
  onMarkPaid,
  t,
}: {
  state: AppState;
  workspace: Workspace;
  onMarkPaid: (loanId: string, index: number) => void;
  t: (key: TranslationKey) => string;
}) {
  const locale = localeFor(state.language, workspace.currency);
  const aggregate = aggregateWorkspace(
    workspace.loans,
    workspace.payments,
    workspace.income,
    workspace.currency,
    todayDate(),
  );
  const entries = aggregate.calendarEntries;
  const columns: DataColumn<(typeof entries)[number]>[] = [
    { key: "loan", label: t("loans.name"), value: (entry) => entry.loanName },
    {
      key: "date",
      label: t("common.dueDate"),
      value: (entry) => entry.installment.dueDate,
      render: (entry) =>
        formatLocaleDate(entry.installment.dueDate, state.language),
    },
    {
      key: "amount",
      label: t("common.amount"),
      value: (entry) => entry.installment.amountMinor,
      render: (entry) =>
        formatMoney(entry.installment.amountMinor, workspace.currency, locale),
    },
    {
      key: "principal",
      label: t("common.principal"),
      value: (entry) => entry.installment.principalMinor,
      render: (entry) =>
        formatMoney(
          entry.installment.principalMinor,
          workspace.currency,
          locale,
        ),
    },
    {
      key: "interest",
      label: t("common.interest"),
      value: (entry) => entry.installment.interestMinor,
      render: (entry) =>
        formatMoney(
          entry.installment.interestMinor,
          workspace.currency,
          locale,
        ),
    },
    {
      key: "late",
      label: t("calendar.lateInterest"),
      value: (entry) => entry.lateInterestMinor,
      render: (entry) =>
        formatMoney(entry.lateInterestMinor, workspace.currency, locale),
    },
    {
      key: "status",
      label: t("common.status"),
      value: (entry) => entry.status,
      render: (entry) =>
        statusBadge(entry.status, t(statusLabels[entry.status])),
    },
  ];
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {workspace.currency} · {t("app.estimateNotice")}
          </p>
          <h1>{t("calendar.title")}</h1>
        </div>
      </div>
      <DataTable
        rows={entries}
        columns={columns}
        rowKey={(entry) => `${entry.loanId}-${entry.installment.index}`}
        searchLabel={t("common.search")}
        actionsLabel={t("common.actions")}
        recordsLabel={t("common.records")}
        searchText={(entry) =>
          `${entry.loanName} ${entry.status} ${entry.installment.dueDate}`
        }
        emptyText={t("calendar.empty")}
        actions={(entry) =>
          entry.status !== "Paid" ? (
            <button
              type="button"
              className="button small-button"
              onClick={() => onMarkPaid(entry.loanId, entry.installment.index)}
            >
              {t("calendar.markPaid")}
            </button>
          ) : (
            <span className="small muted">{entry.paidDate}</span>
          )
        }
      />
    </section>
  );
}
function QuestPage({
  state,
  onChoice,
  onRestart,
  t,
}: {
  state: AppState;
  onChoice: (choice: string) => void;
  onRestart: () => void;
  t: (key: TranslationKey) => string;
}) {
  const progress =
    state.gameProgress[state.activeMode] ??
    createGameProgress(state.activeMode);
  const scenario = createGameScenario(state.activeMode);
  const locale = localeFor(
    state.language,
    state.workspaces[state.activeMode].currency,
  );
  const choices: { id: string; label: TranslationKey }[] = [
    { id: "pay_high_interest", label: "quest.payHigh" },
    { id: "avoid_installment", label: "quest.avoidInstallment" },
    { id: "build_buffer", label: "quest.buildBuffer" },
    { id: "unnecessary_installment", label: "quest.unnecessary" },
  ];
  const complete = progress.month > scenario.months;
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {t(
              state.activeMode === "personal"
                ? "workspace.personal"
                : "workspace.business",
            )}
          </p>
          <h1>{t("quest.title")}</h1>
          <p className="muted">{t("quest.notice")}</p>
        </div>
        <button type="button" className="button secondary" onClick={onRestart}>
          {t("quest.restart")}
        </button>
      </div>
      <div className="metric-grid four">
        <Metric
          label={t("quest.cash")}
          value={formatMoney(
            progress.cashMinor,
            state.workspaces[state.activeMode].currency,
            locale,
          )}
        />
        <Metric
          label={t("quest.debt")}
          value={formatMoney(
            progress.debtMinor,
            state.workspaces[state.activeMode].currency,
            locale,
          )}
        />
        <Metric
          label={t("quest.buffer")}
          value={formatMoney(
            progress.bufferMinor,
            state.workspaces[state.activeMode].currency,
            locale,
          )}
        />
        <Metric
          label={t("quest.score")}
          value={formatMoney(
            getGameScore(progress),
            state.workspaces[state.activeMode].currency,
            locale,
          )}
        />
      </div>
      <div className="quest-card">
        <p className="eyebrow">
          {complete
            ? t("quest.challenge")
            : t("quest.month")
                .replace("{month}", String(progress.month))
                .replace("{total}", String(scenario.months))}
        </p>
        <h2>{complete ? t("quest.title") : t("dashboard.tips")}</h2>
        {!complete && (
          <div className="choice-grid">
            {choices.map((choice) => (
              <button
                type="button"
                className="choice-card"
                key={choice.id}
                onClick={() => onChoice(choice.id)}
              >
                {t(choice.label)}
              </button>
            ))}
          </div>
        )}
        <div className="challenge-list">
          <h3>{t("quest.challenge")}</h3>
          {scenario.challenges.map((challenge, index) => (
            <span
              className={
                progress.completedChallengeIds.includes(challenge)
                  ? "challenge done"
                  : "challenge"
              }
              key={challenge}
            >
              {progress.completedChallengeIds.includes(challenge)
                ? "✓"
                : index + 1}{" "}
              {challenge
                .replace(`${state.activeMode}-`, "")
                .replaceAll("-", " ")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportsPage({
  state,
  workspace,
  aggregate,
  onCsv,
  onPrint,
  t,
}: {
  state: AppState;
  workspace: Workspace;
  aggregate: ReturnType<typeof aggregateWorkspace>;
  onCsv: () => void;
  onPrint: () => void;
  t: (key: TranslationKey) => string;
}) {
  const locale = localeFor(state.language, workspace.currency);
  const nextFive = aggregate.calendarEntries
    .filter((entry) => entry.status !== "Paid")
    .slice(0, 5);
  return (
    <section className="page-section">
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">{workspace.currency}</p>
          <h1>{t("reports.title")}</h1>
        </div>
        <div className="report-actions">
          <button type="button" className="button secondary" onClick={onCsv}>
            {t("reports.downloadCsv")}
          </button>
          <button type="button" className="button primary" onClick={onPrint}>
            {t("reports.print")}
          </button>
        </div>
      </div>
      <article className="print-summary">
        <div className="print-header">
          <div className="brand-mark">b.</div>
          <div>
            <p className="eyebrow">
              {t("app.name")} · {workspace.currency}
            </p>
            <h1>{t("reports.title")}</h1>
            <p>
              {formatLocaleDate(todayDate(), state.language)} ·{" "}
              {t("app.estimateNotice")}
            </p>
          </div>
        </div>
        <div className="metric-grid three">
          <Metric
            label={t("dashboard.principal")}
            value={formatMoney(
              aggregate.principalRemainingMinor,
              workspace.currency,
              locale,
            )}
          />
          <Metric
            label={t("dashboard.totalInterest")}
            value={formatMoney(
              aggregate.interestRemainingMinor,
              workspace.currency,
              locale,
            )}
          />
          <Metric
            label={t("dashboard.monthlyPayments")}
            value={formatMoney(
              aggregate.monthlyObligationsMinor,
              workspace.currency,
              locale,
            )}
          />
        </div>
        <h2>{t("reports.nextPayments")}</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>{t("loans.name")}</th>
              <th>{t("common.dueDate")}</th>
              <th>{t("common.amount")}</th>
              <th>{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {nextFive.map((entry) => (
              <tr key={`${entry.loanId}-${entry.installment.index}`}>
                <td>{entry.loanName}</td>
                <td>
                  {formatLocaleDate(entry.installment.dueDate, state.language)}
                </td>
                <td>
                  {formatMoney(
                    entry.installment.amountMinor,
                    workspace.currency,
                    locale,
                  )}
                </td>
                <td>{t(statusLabels[entry.status])}</td>
              </tr>
            ))}
            {nextFive.length === 0 && (
              <tr>
                <td colSpan={4}>{t("common.empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="small muted">{t("reports.fullSchedule")}</p>
      </article>
      <p className="no-print muted">{t("reports.fullSchedule")}</p>
    </section>
  );
}
