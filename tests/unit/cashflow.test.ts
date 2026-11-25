import { describe, expect, it } from "vitest";
import {
  calculateCashflow,
  calculateMonthlyObligations,
} from "../../src/domain/cashflow";
import { makeLoan } from "../fixtures/loans";
import type { IncomeEntry } from "../../src/domain/types";

const income: IncomeEntry[] = [
  {
    id: "r",
    source: "Salary",
    description: "",
    amountMinor: 500_000,
    dateReceived: "2026-01-01",
    frequency: "recurring",
  },
  {
    id: "o",
    source: "Gift",
    description: "",
    amountMinor: 250_000,
    dateReceived: "2026-01-01",
    frequency: "one_time",
  },
];

describe("cash flow", () => {
  it("uses recurring income for monthly balance and debt-to-income only", () => {
    expect(calculateCashflow(income, 200_000)).toEqual({
      recurringIncomeMinor: 500_000,
      oneTimeIncomeMinor: 250_000,
      monthlyNetBalanceMinor: 300_000,
      debtToIncomePercent: 40,
    });
  });

  it("does not divide by zero when recurring income is absent", () => {
    expect(
      calculateCashflow(income.slice(1), 200_000).debtToIncomePercent,
    ).toBeNull();
  });

  it("includes current-month installments and older overdue installments once", () => {
    const loan = makeLoan({
      firstDueDate: "2025-12-01",
      termMonths: 3,
      rate: 0,
    });
    const result = calculateMonthlyObligations([loan], [], "COP", "2026-01-07");
    expect(result.amountMinor).toBe(66_666);
    expect(
      result.installments.map((entry) => entry.installment.dueDate),
    ).toEqual(["2025-12-01", "2026-01-01"]);
  });
});
