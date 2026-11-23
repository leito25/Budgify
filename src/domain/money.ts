import type { Currency } from "./types";

export function decimalPlaces(currency: Currency): number {
  return currency === "COP" ? 0 : 2;
}

export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Money values must be finite.");
  }

  const magnitude = Math.abs(value);
  const rounded = Math.floor(magnitude + 0.5 + Number.EPSILON * magnitude);
  return Math.sign(value) * rounded;
}

export function toMinorUnits(amount: number, currency: Currency): number {
  return roundHalfUp(amount * 10 ** decimalPlaces(currency));
}

export function distributeMinorUnits(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(count) || count < 1) {
    throw new RangeError("A safe integer total and positive installment count are required.");
  }

  const base = Math.trunc(total / count);
  const installments = Array<number>(count).fill(base);
  installments[count - 1] = total - base * (count - 1);
  return installments;
}

export function formatMoney(
  amountMinor: number,
  currency: Currency,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimalPlaces(currency),
    maximumFractionDigits: decimalPlaces(currency),
  }).format(amountMinor / 10 ** decimalPlaces(currency));
}
