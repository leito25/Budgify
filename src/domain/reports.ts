import { estimateLateInterest } from "./late-interest";
import { decimalPlaces } from "./money";
import { generateSchedule } from "./schedule";
import type { Language } from "../i18n";
import type { Currency, Loan, Payment } from "./types";

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function amount(amountMinor: number, currency: Currency): string {
  return (amountMinor / 10 ** decimalPlaces(currency)).toFixed(decimalPlaces(currency));
}

export function buildAmortizationCsv(
  loans: Loan[],
  payments: Payment[],
  currency: Currency,
  language: Language,
  asOfDate = new Date().toISOString().slice(0, 10),
): string {
  const headers = language === "es"
    ? ["Préstamo", "Descripción", "Cuota", "Fecha de pago", `Pago (${currency})`, `Capital (${currency})`,
      `Interés (${currency})`, `Capital pendiente (${currency})`, "Fecha pagada",
      `Interés por mora (${currency})`]
    : ["Loan", "Description", "Installment", "Due date", `Payment (${currency})`, `Principal (${currency})`,
      `Interest (${currency})`, `Remaining principal (${currency})`, "Paid date",
      `Late interest (${currency})`];
  const rows = [headers.map(csvCell).join(",")];

  for (const loan of loans) {
    const loanPayments = new Map(
      payments
        .filter((payment) => payment.loanId === loan.id)
        .map((payment) => [payment.installmentIndex, payment]),
    );
    for (const installment of generateSchedule(loan, currency)) {
      const payment = loanPayments.get(installment.index);
      const lateInterest = payment
        ? payment.penaltyMinor
        : estimateLateInterest(installment, loan.penaltyRateAnnual, asOfDate).penaltyMinor;
      rows.push([
        loan.name,
        loan.description,
        installment.index,
        installment.dueDate,
        amount(installment.amountMinor, currency),
        amount(installment.principalMinor, currency),
        amount(installment.interestMinor, currency),
        amount(installment.remainingPrincipalMinor, currency),
        payment?.paidDate ?? "",
        amount(lateInterest, currency),
      ].map(csvCell).join(","));
    }
  }
  return rows.join("\r\n");
}
