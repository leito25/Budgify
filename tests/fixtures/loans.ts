import type { Loan, PersonRef } from "../../src/domain/types";

export const testPerson: PersonRef = {
  id: "person-1",
  name: "Ada Test",
  email: "ada@example.ng",
};

export function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    name: "Test loan",
    description: "",
    principalMinor: 100_000,
    termMonths: 3,
    rate: 0.01,
    rateBasis: "monthly_nominal",
    interestType: "compound",
    penaltyRateAnnual: 0.12,
    firstDueDate: "2026-01-31",
    createdAt: "2026-01-01",
    ...overrides,
  };
}
