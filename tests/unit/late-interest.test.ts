import { describe, expect, it } from "vitest";
import { estimateLateInterest, settleInstallment } from "../../src/domain/late-interest";
import type { Installment } from "../../src/domain/types";

const installment: Installment = {
  index: 1,
  dueDate: "2026-01-01",
  amountMinor: 1_000_000,
  principalMinor: 900_000,
  interestMinor: 100_000,
  remainingPrincipalMinor: 100_000,
};

describe("late interest", () => {
  it("does not accrue on the due date or during the five-day grace period", () => {
    expect(estimateLateInterest(installment, 0.365, "2026-01-01").penaltyMinor).toBe(0);
    expect(estimateLateInterest(installment, 0.365, "2026-01-06").penaltyMinor).toBe(0);
    expect(estimateLateInterest(installment, 0.365, "2026-01-07").penaltyMinor).toBe(1_000);
  });

  it("is simple, linear in days, and remains zero at a zero penalty rate", () => {
    expect(estimateLateInterest(installment, 0.365, "2026-01-11").penaltyMinor).toBe(5_000);
    expect(estimateLateInterest(installment, 0.365, "2026-01-16").penaltyMinor).toBe(10_000);
    expect(estimateLateInterest(installment, 0, "2026-02-01").penaltyMinor).toBe(0);
  });

  it("stores the paid date, scheduled amount, and penalty snapshot", () => {
    expect(settleInstallment("loan-1", installment, "2026-01-07", 0.365)).toEqual({
      loanId: "loan-1",
      installmentIndex: 1,
      paidDate: "2026-01-07",
      scheduledAmountMinor: 1_000_000,
      penaltyMinor: 1_000,
      totalPaidMinor: 1_001_000,
    });
  });
});
