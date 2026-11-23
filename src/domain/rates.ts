export type RateBasis = "monthly_nominal" | "effective_annual" | "apr";

function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError("Rates must be finite and nonnegative.");
  }
}

export function annualEffectiveToMonthly(rate: number): number {
  assertRate(rate);
  return Math.pow(1 + rate, 1 / 12) - 1;
}

export function monthlyToEffectiveAnnual(rate: number): number {
  assertRate(rate);
  return Math.pow(1 + rate, 12) - 1;
}

export function monthlyToApr(rate: number): number {
  assertRate(rate);
  return rate * 12;
}

export function rateToMonthly(rate: number, basis: RateBasis): number {
  assertRate(rate);
  switch (basis) {
    case "monthly_nominal":
      return rate;
    case "effective_annual":
      return annualEffectiveToMonthly(rate);
    case "apr":
      return rate / 12;
  }
}
