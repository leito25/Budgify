import { isValidDateOnly } from "./dates";
import type { Loan } from "./types";

export interface ValidationIssue {
  field: string;
  code: "required" | "must_be_positive" | "must_be_positive_integer" | "must_be_nonnegative"
    | "invalid_date" | "invalid_value" | "derived_only";
}

type LoanDraft = Partial<Loan> & { status?: unknown };

export function validateLoan(input: LoanDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requireText = (field: "name") => {
    if (typeof input[field] !== "string" || input[field].trim() === "") {
      issues.push({ field, code: "required" });
    }
  };
  requireText("name");

  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    issues.push({ field: "status", code: "derived_only" });
  }
  if (typeof input.principalMinor !== "number" || !Number.isSafeInteger(input.principalMinor)
    || input.principalMinor <= 0) {
    issues.push({ field: "principalMinor", code: "must_be_positive" });
  }
  if (typeof input.termMonths !== "number" || !Number.isSafeInteger(input.termMonths)
    || input.termMonths <= 0) {
    issues.push({ field: "termMonths", code: "must_be_positive_integer" });
  }
  if (typeof input.rate !== "number" || !Number.isFinite(input.rate) || input.rate < 0) {
    issues.push({ field: "rate", code: "must_be_nonnegative" });
  }
  if (!["monthly_nominal", "effective_annual", "apr"].includes(String(input.rateBasis))) {
    issues.push({ field: "rateBasis", code: "invalid_value" });
  }
  if (input.interestType !== "simple" && input.interestType !== "compound") {
    issues.push({ field: "interestType", code: "invalid_value" });
  }
  if (typeof input.penaltyRateAnnual !== "number" || !Number.isFinite(input.penaltyRateAnnual)
    || input.penaltyRateAnnual < 0) {
    issues.push({ field: "penaltyRateAnnual", code: "must_be_nonnegative" });
  }
  if (!isValidDateOnly(input.firstDueDate)) {
    issues.push({ field: "firstDueDate", code: "invalid_date" });
  }
  return issues;
}

type IncomeDraft = Record<string, unknown>;

export function validateIncome(input: IncomeDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof input.source !== "string" || input.source.trim() === "") {
    issues.push({ field: "source", code: "required" });
  }
  if (typeof input.amountMinor !== "number" || !Number.isSafeInteger(input.amountMinor)
    || input.amountMinor <= 0) {
    issues.push({ field: "amountMinor", code: "must_be_positive" });
  }
  if (input.frequency !== "one_time" && input.frequency !== "recurring") {
    issues.push({ field: "frequency", code: "invalid_value" });
  }
  if (!isValidDateOnly(input.dateReceived)) {
    issues.push({ field: "dateReceived", code: "invalid_date" });
  }
  return issues;
}
