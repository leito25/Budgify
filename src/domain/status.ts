import { daysBetween, parseDateOnly } from "./dates";
import type { Installment, LoanStatus, Payment } from "./types";

export function deriveInstallmentStatus(
  dueDate: string,
  paidDate: string | undefined,
  asOfDate: string,
): LoanStatus {
  parseDateOnly(asOfDate);
  if (paidDate) {
    parseDateOnly(paidDate);
    return "Paid";
  }

  const daysPastDue = daysBetween(dueDate, asOfDate);
  if (daysPastDue > 5) return "Overdue";
  if (daysPastDue >= 0) return "In grace";
  return "Active";
}

export function deriveLoanStatus(
  schedule: Installment[],
  payments: Payment[],
  asOfDate: string,
): LoanStatus {
  if (
    schedule.length > 0 &&
    schedule.every((row) =>
      payments.some((payment) => payment.installmentIndex === row.index),
    )
  ) {
    return "Paid";
  }

  const paymentByInstallment = new Map(
    payments.map((payment) => [payment.installmentIndex, payment.paidDate]),
  );
  const statuses = schedule.map((row) =>
    deriveInstallmentStatus(
      row.dueDate,
      paymentByInstallment.get(row.index),
      asOfDate,
    ),
  );
  if (statuses.includes("Overdue")) return "Overdue";
  if (statuses.includes("In grace")) return "In grace";
  return "Active";
}
