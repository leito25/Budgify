import { describe, expect, it } from "vitest";
import { validateIncome, validateLoan } from "../../src/domain/validation";

describe("domain validation", () => {
  const validLoan = {
    name: "Equipment",
    description: "",
    principalMinor: 1_000,
    termMonths: 12,
    rate: 0.12,
    rateBasis: "effective_annual" as const,
    interestType: "compound" as const,
    penaltyRateAnnual: 0.1,
    firstDueDate: "2026-03-31",
  };

  it("rejects missing fields, invalid dates, nonpositive terms and negative rates", () => {
    expect(validateLoan({ ...validLoan, principalMinor: 0 })).toContainEqual({
      field: "principalMinor",
      code: "must_be_positive",
    });
    expect(validateLoan({ ...validLoan, termMonths: 1.5 })).toContainEqual({
      field: "termMonths",
      code: "must_be_positive_integer",
    });
    expect(validateLoan({ ...validLoan, rate: -0.01 })).toContainEqual({
      field: "rate",
      code: "must_be_nonnegative",
    });
    expect(validateLoan({ ...validLoan, firstDueDate: "2026-02-30" })).toContainEqual({
      field: "firstDueDate",
      code: "invalid_date",
    });
    expect(validateLoan({ ...validLoan, name: " " })).toContainEqual({
      field: "name",
      code: "required",
    });
  });

  it("rejects manual status and validates income values", () => {
    expect(validateLoan({ ...validLoan, status: "Paid" })).toContainEqual({
      field: "status",
      code: "derived_only",
    });
    expect(validateIncome({ source: "", amountMinor: -1, dateReceived: "bad", frequency: "yearly" }))
      .toEqual(expect.arrayContaining([
        { field: "source", code: "required" },
        { field: "amountMinor", code: "must_be_positive" },
        { field: "dateReceived", code: "invalid_date" },
        { field: "frequency", code: "invalid_value" },
      ]));
  });
});
