import { describe, expect, it } from "vitest";
import {
  deriveInstallmentStatus,
  deriveLoanStatus,
} from "../../src/domain/status";
import { generateSchedule } from "../../src/domain/schedule";
import type { Payment } from "../../src/domain/types";
import { makeLoan } from "../fixtures/loans";

describe("derived payment and loan status", () => {
  const loan = makeLoan({ firstDueDate: "2026-01-01", termMonths: 3 });
  const schedule = generateSchedule(loan, "COP");

  it("distinguishes upcoming, grace, overdue, and paid dates", () => {
    expect(deriveInstallmentStatus("2026-01-10", undefined, "2026-01-09")).toBe(
      "Active",
    );
    expect(deriveInstallmentStatus("2026-01-01", undefined, "2026-01-06")).toBe(
      "In grace",
    );
    expect(deriveInstallmentStatus("2026-01-01", undefined, "2026-01-07")).toBe(
      "Overdue",
    );
    expect(
      deriveInstallmentStatus("2026-01-01", "2026-01-01", "2026-01-01"),
    ).toBe("Paid");
  });

  it("marks the loan paid only when every installment has a payment", () => {
    const paidOne: Payment = {
      loanId: loan.id,
      installmentIndex: 1,
      paidDate: "2025-12-20",
      scheduledAmountMinor: schedule[0].amountMinor,
      penaltyMinor: 0,
      totalPaidMinor: schedule[0].amountMinor,
    };
    expect(deriveLoanStatus(schedule, [paidOne], "2025-12-20")).toBe("Active");
    expect(
      deriveLoanStatus(
        schedule,
        schedule.map((row) => ({
          ...paidOne,
          installmentIndex: row.index,
          scheduledAmountMinor: row.amountMinor,
          totalPaidMinor: row.amountMinor,
        })),
        "2026-01-07",
      ),
    ).toBe("Paid");
  });

  it("prioritizes any overdue unpaid installment and supports early or out-of-order settlement", () => {
    const settledLast: Payment = {
      loanId: loan.id,
      installmentIndex: 3,
      paidDate: "2025-12-20",
      scheduledAmountMinor: schedule[2].amountMinor,
      penaltyMinor: 0,
      totalPaidMinor: schedule[2].amountMinor,
    };
    expect(deriveLoanStatus(schedule, [settledLast], "2026-01-07")).toBe(
      "Overdue",
    );
    expect(deriveLoanStatus(schedule, [], "2026-01-03")).toBe("In grace");
  });
});
