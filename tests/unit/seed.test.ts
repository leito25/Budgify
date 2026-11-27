import { describe, expect, it } from "vitest";
import { createInitialState, resetState } from "../../src/storage/seed";
import { aggregateWorkspace } from "../../src/domain/aggregates";

describe("seed data", () => {
  it("creates Personal sample data only, with useful relative dates", () => {
    const today = "2026-11-23";
    const state = createInitialState(today);
    const personal = state.workspaces.personal;
    const business = state.workspaces.business;

    expect(personal.baseCurrency).toBe("USD");
    expect(personal.displayCurrency).toBe("USD");
    expect(business.baseCurrency).toBe("COP");
    expect(business.displayCurrency).toBe("COP");
    expect(personal.displayCurrency).not.toBe(business.displayCurrency);
    expect(
      personal.loans.some((loan) =>
        loan.name.toLowerCase().includes("grocery"),
      ),
    ).toBe(true);
    expect(
      personal.income.some((entry) => entry.frequency === "one_time"),
    ).toBe(true);
    expect(business.loans).toEqual([]);
    expect(business.income).toEqual([]);
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

describe("reset state", () => {
  it("restores Personal sample data and leaves Small Business to the server", () => {
    const state = resetState("2026-11-23");
    expect(state.workspaces.personal.loans).not.toEqual([]);
    expect(state.workspaces.business.loans).toEqual([]);
    expect(state.workspaces.business.payments).toEqual([]);
    expect(state.hasChosenWorkspace).toBe(false);
  });
});
