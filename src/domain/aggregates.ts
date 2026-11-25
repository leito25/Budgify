import {
  calculateCashflow,
  calculateMonthlyObligations,
  buildCalendarEntries,
} from "./cashflow";
import { deriveLoanStatus } from "./status";
import type { CalendarEntry, CashflowSummary } from "./cashflow";
import type { Currency, IncomeEntry, Loan, LoanStatus, Payment } from "./types";

export interface WorkspaceAggregate extends CashflowSummary {
  principalRemainingMinor: number;
  interestRemainingMinor: number;
  monthlyObligationsMinor: number;
  overdueCount: number;
  calendarEntries: CalendarEntry[];
  loanStatuses: Record<string, LoanStatus>;
}

export interface ReportTotals {
  principalRemainingMinor: number;
  interestRemainingMinor: number;
  monthlyObligationsMinor: number;
  overdueCount: number;
}

export function aggregateWorkspace(
  loans: Loan[],
  payments: Payment[],
  income: IncomeEntry[],
  currency: Currency,
  asOfDate: string,
): WorkspaceAggregate {
  const calendarEntries = buildCalendarEntries(
    loans,
    payments,
    currency,
    asOfDate,
  );
  const obligations = calculateMonthlyObligations(
    loans,
    payments,
    currency,
    asOfDate,
  );
  let principalRemainingMinor = 0;
  let interestRemainingMinor = 0;
  const loanStatuses: Record<string, LoanStatus> = {};

  for (const loan of loans) {
    const loanPayments = payments.filter(
      (payment) => payment.loanId === loan.id,
    );
    const schedule = calendarEntries
      .filter((entry) => entry.loanId === loan.id)
      .map((entry) => entry.installment);
    const paidIndices = new Set(
      loanPayments.map((payment) => payment.installmentIndex),
    );
    for (const installment of schedule) {
      if (!paidIndices.has(installment.index)) {
        principalRemainingMinor += installment.principalMinor;
        interestRemainingMinor += installment.interestMinor;
      }
    }
    loanStatuses[loan.id] = deriveLoanStatus(schedule, loanPayments, asOfDate);
  }

  return {
    ...calculateCashflow(income, obligations.amountMinor),
    principalRemainingMinor,
    interestRemainingMinor,
    monthlyObligationsMinor: obligations.amountMinor,
    overdueCount: calendarEntries.filter((entry) => entry.status === "Overdue")
      .length,
    calendarEntries,
    loanStatuses,
  };
}

export function getReportTotals(aggregate: WorkspaceAggregate): ReportTotals {
  return {
    principalRemainingMinor: aggregate.principalRemainingMinor,
    interestRemainingMinor: aggregate.interestRemainingMinor,
    monthlyObligationsMinor: aggregate.monthlyObligationsMinor,
    overdueCount: aggregate.overdueCount,
  };
}
