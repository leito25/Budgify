import { describe, expect, it } from "vitest";
import { createInitialState } from "../../src/storage/seed";
import { aggregateWorkspace } from "../../src/domain/aggregates";

describe("seed data", () => {
  it("creates independent workspaces with realistic records and useful relative dates", () => {
    const today = "2026-11-23";
    const state = createInitialState(today);
    const personal = state.workspaces.personal;
    const business = state.workspaces.business;

    expect(personal.currency).toBe("USD");
    expect(business.currency).toBe("COP");
    expect(
      personal.loans.some((loan) =>
        loan.name.toLowerCase().includes("grocery"),
      ),
    ).toBe(true);
    expect(
      personal.income.some((entry) => entry.frequency === "one_time"),
    ).toBe(true);
    expect(business.loans).toHaveLength(3);
    expect(business.loans.every((loan) => loan.firstDueDate >= today)).toBe(
      true,
    );
    expect(
      aggregateWorkspace(personal.loans, [], personal.income, "USD", today)
        .overdueCount,
    ).toBeGreaterThan(0);
    expect(
      personal.loans.every(
        (loan) =>
          loan.firstDueDate < "2026-10-01" || loan.firstDueDate > "2027-01-31",
      ),
    ).toBe(false);
  });
});
