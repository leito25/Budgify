import { daysBetween, parseDateOnly } from "./dates";
import { estimateLateInterest } from "./late-interest";
import { generateSchedule } from "./schedule";
import { deriveInstallmentStatus } from "./status";
import type {
  Currency,
  IncomeEntry,
  Installment,
  Loan,
  LoanStatus,
  Payment,
} from "./types";

export interface CashflowSummary {
  recurringIncomeMinor: number;
  oneTimeIncomeMinor: number;
  monthlyNetBalanceMinor: number;
  debtToIncomePercent: number | null;
}

export interface CalendarEntry {
  loanId: string;
  loanName: string;
  installment: Installment;
  status: LoanStatus;
  lateInterestMinor: number;
  paidDate?: string;
}

export interface MonthlyObligations {
  amountMinor: number;
  installments: CalendarEntry[];
}

export function calculateCashflow(
  income: IncomeEntry[],
  monthlyObligationsMinor: number,
): CashflowSummary {
  const recurringIncomeMinor = income
    .filter((entry) => entry.frequency === "recurring")
    .reduce((sum, entry) => sum + entry.amountMinor, 0);
  const oneTimeIncomeMinor = income
    .filter((entry) => entry.frequency === "one_time")
    .reduce((sum, entry) => sum + entry.amountMinor, 0);

  return {
    recurringIncomeMinor,
    oneTimeIncomeMinor,
    monthlyNetBalanceMinor: recurringIncomeMinor - monthlyObligationsMinor,
    debtToIncomePercent:
      recurringIncomeMinor === 0
        ? null
        : (monthlyObligationsMinor / recurringIncomeMinor) * 100,
  };
}
export function buildCalendarEntries(
  loans: Loan[],
  payments: Payment[],
  currency: Currency,
  asOfDate: string,
): CalendarEntry[] {
  parseDateOnly(asOfDate);
  return loans
    .flatMap((loan) => {
      const loanPayments = payments.filter(
        (payment) => payment.loanId === loan.id,
      );
      const paymentMap = new Map(
        loanPayments.map((payment) => [payment.installmentIndex, payment]),
      );
      return generateSchedule(loan, currency).map((installment) => {
        const payment = paymentMap.get(installment.index);
        return {
          loanId: loan.id,
          loanName: loan.name,
          installment,
          status: deriveInstallmentStatus(
            installment.dueDate,
            payment?.paidDate,
            asOfDate,
          ),
          lateInterestMinor: payment
            ? payment.penaltyMinor
            : estimateLateInterest(
                installment,
                loan.penaltyRateAnnual,
                asOfDate,
              ).penaltyMinor,
          paidDate: payment?.paidDate,
        };
      });
    })
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));
}

export function calculateMonthlyObligations(
  loans: Loan[],
  payments: Payment[],
  currency: Currency,
  asOfDate: string,
): MonthlyObligations {
  const monthPrefix = asOfDate.slice(0, 7);
  const entries = buildCalendarEntries(
    loans,
    payments,
    currency,
    asOfDate,
  ).filter((entry) => {
    if (entry.status === "Paid") return false;
    const dueDate = entry.installment.dueDate;
    const overdue = daysBetween(dueDate, asOfDate) > 5;
    return overdue || dueDate.slice(0, 7) === monthPrefix;
  });

  return {
    amountMinor: entries.reduce(
      (sum, entry) => sum + entry.installment.amountMinor,
      0,
    ),
    installments: entries,
  };
}
