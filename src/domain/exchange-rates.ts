import type { ExchangeRateCache } from "../storage/model";
import type { Currency } from "./types";

export function exchangeRatePair(base: Currency, quote: Currency): string {
  return `${base}:${quote}`;
}

export function getCachedExchangeRate(
  cache: ExchangeRateCache,
  base: Currency,
  quote: Currency,
): number | null {
  if (base === quote) return 1;
  const direct = cache[exchangeRatePair(base, quote)];
  if (Number.isFinite(direct) && (direct ?? 0) > 0) return direct ?? null;
  const inverse = cache[exchangeRatePair(quote, base)];
  if (Number.isFinite(inverse) && (inverse ?? 0) > 0)
    return 1 / (inverse as number);
  return null;
}

export async function fetchExchangeRate(
  base: Currency,
  quote: Currency,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  if (base === quote) return 1;
  try {
    const response = await fetchImpl(
      `https://open.er-api.com/v6/latest/${base}`,
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: unknown;
      rates?: Record<string, unknown>;
    };
    if (payload.result !== "success" || typeof payload.rates !== "object")
      return null;
    const rate = payload.rates[quote];
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0
      ? rate
      : null;
  } catch {
    return null;
  }
}

export function cacheExchangeRate(
  cache: ExchangeRateCache,
  base: Currency,
  quote: Currency,
  rate: number,
): ExchangeRateCache {
  if (base === quote || !Number.isFinite(rate) || rate <= 0)
    return { ...cache };
  return { ...cache, [exchangeRatePair(base, quote)]: rate };
}
