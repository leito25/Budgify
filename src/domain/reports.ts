import { estimateLateInterest } from "./late-interest";
import { convertMinorUnits, decimalPlaces } from "./money";
import { generateSchedule } from "./schedule";
import type { Language } from "../i18n";
import type { Currency, Loan, Payment } from "./types";

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function amount(amountMinor: number, currency: Currency): string {
  return (amountMinor / 10 ** decimalPlaces(currency)).toFixed(
    decimalPlaces(currency),
  );
}

export function buildAmortizationCsv(
  loans: Loan[],
  payments: Payment[],
  currency: Currency,
  language: Language,
  asOfDate = new Date().toISOString().slice(0, 10),
  conversion: { currency: Currency; rate: number } = { currency, rate: 1 },
): string {
  const displayCurrency = conversion.currency;
  const displayAmount = (value: number) =>
    amount(
      convertMinorUnits(value, currency, displayCurrency, conversion.rate),
      displayCurrency,
    );
  const headers =
    language === "es"
      ? [
          "Préstamo",
          "Descripción",
          "Cuota",
          "Fecha de pago",
          `Pago (${displayCurrency})`,
          `Capital (${displayCurrency})`,
          `Interés (${displayCurrency})`,
          `Capital pendiente (${displayCurrency})`,
          "Fecha pagada",
          `Interés por mora (${displayCurrency})`,
        ]
      : [
          "Loan",
          "Description",
          "Installment",
          "Due date",
          `Payment (${displayCurrency})`,
          `Principal (${displayCurrency})`,
          `Interest (${displayCurrency})`,
          `Remaining principal (${displayCurrency})`,
          "Paid date",
          `Late interest (${displayCurrency})`,
        ];
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
        : estimateLateInterest(installment, loan.penaltyRateAnnual, asOfDate)
            .penaltyMinor;
      rows.push(
        [
          loan.name,
          loan.description,
          installment.index,
          installment.dueDate,
          displayAmount(installment.amountMinor),
          displayAmount(installment.principalMinor),
          displayAmount(installment.interestMinor),
          displayAmount(installment.remainingPrincipalMinor),
          payment?.paidDate ?? "",
          displayAmount(lateInterest),
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return rows.join("\r\n");
}
