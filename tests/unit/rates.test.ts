import { describe, expect, it } from "vitest";
import {
  annualEffectiveToMonthly,
  monthlyToApr,
  monthlyToEffectiveAnnual,
  rateToMonthly,
} from "../../src/domain/rates";

describe("rate conversions", () => {
  it("converts monthly, effective annual, and nominal APR rates", () => {
    const monthly = 0.0125;
    expect(
      annualEffectiveToMonthly(monthlyToEffectiveAnnual(monthly)),
    ).toBeCloseTo(monthly, 12);
    expect(monthlyToApr(monthly)).toBeCloseTo(0.15, 12);
    expect(rateToMonthly(0.15, "apr")).toBeCloseTo(monthly, 12);
    expect(rateToMonthly(0.15, "effective_annual")).toBeCloseTo(
      Math.pow(1.15, 1 / 12) - 1,
      12,
    );
    expect(rateToMonthly(0, "effective_annual")).toBe(0);
  });
});
