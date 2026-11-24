import { describe, expect, it } from "vitest";
import {
  aggregateWorkspace,
  getReportTotals,
} from "../../src/domain/aggregates";
import { generateSchedule } from "../../src/domain/schedule";
import { makeLoan } from "../fixtures/loans";
import type { Payment } from "../../src/domain/types";

describe("workspace aggregates", () => {
  const loan = makeLoan({ firstDueDate: "2026-01-01" });

  it("uses the same schedule for dashboard, report, and calendar totals", () => {
    const result = aggregateWorkspace([loan], [], [], "COP", "2026-01-07");
    const report = getReportTotals(result);
    expect(report.principalRemainingMinor).toBe(result.principalRemainingMinor);
    expect(report.interestRemainingMinor).toBe(result.interestRemainingMinor);
    expect(result.overdueCount).toBe(1);
    expect(
      result.calendarEntries.find((entry) => entry.status === "Overdue")
        ?.loanId,
    ).toBe(loan.id);
  });

  it("reduces remaining principal and due obligations after a full installment settles", () => {
    const installment = generateSchedule(loan, "COP")[0];
    const payment: Payment = {
      loanId: loan.id,
      installmentIndex: 1,
      paidDate: "2026-01-07",
      scheduledAmountMinor: installment.amountMinor,
      penaltyMinor: 11,
      totalPaidMinor: installment.amountMinor + 11,
    };
    const result = aggregateWorkspace(
      [loan],
      [payment],
      [],
      "COP",
      "2026-01-07",
    );
    expect(result.principalRemainingMinor).toBe(
      100_000 - installment.principalMinor,
    );
    expect(result.overdueCount).toBe(0);
    expect(result.monthlyObligationsMinor).toBe(0);
    expect(result.calendarEntries[0].status).toBe("Paid");
    expect(result.calendarEntries[0].lateInterestMinor).toBe(11);
  });
});
