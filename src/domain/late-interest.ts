import { daysBetween, parseDateOnly } from "./dates";
import { roundHalfUp } from "./money";
import type { Installment, Payment } from "./types";

export interface LateInterestEstimate {
  lateDays: number;
  penaltyMinor: number;
}

export function estimateLateInterest(
  installment: Installment,
  penaltyRateAnnual: number,
  asOfDate: string,
): LateInterestEstimate {
  parseDateOnly(asOfDate);
  if (!Number.isFinite(penaltyRateAnnual) || penaltyRateAnnual < 0) {
    throw new RangeError("Penalty rate must be finite and nonnegative.");
  }

  const daysPastDue = Math.max(0, daysBetween(installment.dueDate, asOfDate));
  const lateDays = Math.max(0, daysPastDue - 5);
  return {
    lateDays,
    penaltyMinor: roundHalfUp(
      installment.amountMinor * penaltyRateAnnual * lateDays / 365,
    ),
  };
}

export function settleInstallment(
  loanId: string,
  installment: Installment,
  paidDate: string,
  penaltyRateAnnual: number,
): Payment {
  const { penaltyMinor } = estimateLateInterest(installment, penaltyRateAnnual, paidDate);
  return {
    loanId,
    installmentIndex: installment.index,
    paidDate,
    scheduledAmountMinor: installment.amountMinor,
    penaltyMinor,
    totalPaidMinor: installment.amountMinor + penaltyMinor,
  };
}
