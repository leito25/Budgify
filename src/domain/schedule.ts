import { distributeMinorUnits, roundHalfUp } from "./money";
import { parseDateOnly } from "./dates";
import { rateToMonthly } from "./rates";
import type { Currency, Installment, Loan } from "./types";

export function addMonthsClamped(
  dateValue: string,
  monthOffset: number,
): string {
  const date = parseDateOnly(dateValue);
  if (!Number.isSafeInteger(monthOffset)) {
    throw new RangeError("Month offset must be an integer.");
  }

  const originalDay = date.getUTCDate();
  const targetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1),
  );
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(originalDay, lastDay));
  return targetMonth.toISOString().slice(0, 10);
}

export function generateSchedule(
  loan: Loan,
  currency: Currency,
): Installment[] {
  // Amounts are already in minor units; retain the currency argument for callers.
  void currency;
  if (!Number.isSafeInteger(loan.principalMinor) || loan.principalMinor <= 0) {
    throw new RangeError(
      "Principal must be a positive integer number of minor units.",
    );
  }
  if (!Number.isSafeInteger(loan.termMonths) || loan.termMonths <= 0) {
    throw new RangeError("Installment count must be a positive integer.");
  }
  parseDateOnly(loan.firstDueDate);

  const monthlyRate = rateToMonthly(loan.rate, loan.rateBasis);
  if (!Number.isFinite(loan.penaltyRateAnnual) || loan.penaltyRateAnnual < 0) {
    throw new RangeError("Penalty rate must be finite and nonnegative.");
  }

  const principalParts =
    loan.interestType === "simple" && monthlyRate > 0
      ? distributeMinorUnits(loan.principalMinor, loan.termMonths)
      : [];
  const simpleInterestParts =
    loan.interestType === "simple" && monthlyRate > 0
      ? distributeMinorUnits(
          roundHalfUp(loan.principalMinor * monthlyRate * loan.termMonths),
          loan.termMonths,
        )
      : [];

  let remaining = loan.principalMinor;
  const regularPaymentMinor =
    monthlyRate === 0
      ? 0
      : (loan.principalMinor *
          monthlyRate *
          (1 + monthlyRate) ** loan.termMonths) /
        ((1 + monthlyRate) ** loan.termMonths - 1);
  const roundedRegularPayment = roundHalfUp(regularPaymentMinor);

  return Array.from({ length: loan.termMonths }, (_, offset) => {
    const index = offset + 1;
    let principalMinor: number;
    let interestMinor: number;

    if (monthlyRate === 0) {
      principalMinor = distributeMinorUnits(
        loan.principalMinor,
        loan.termMonths,
      )[offset];
      interestMinor = 0;
    } else if (loan.interestType === "simple") {
      principalMinor = principalParts[offset];
      interestMinor = simpleInterestParts[offset];
    } else {
      interestMinor = roundHalfUp(remaining * monthlyRate);
      principalMinor =
        index === loan.termMonths
          ? remaining
          : Math.min(remaining, roundedRegularPayment - interestMinor);
    }

    const amountMinor = principalMinor + interestMinor;
    remaining -= principalMinor;
    if (index === loan.termMonths) remaining = 0;

    return {
      index,
      dueDate: addMonthsClamped(loan.firstDueDate, offset),
      amountMinor,
      principalMinor,
      interestMinor,
      remainingPrincipalMinor: remaining,
    };
  });
}
