import type { RateBasis, Region } from "../domain/types";

export interface ReferenceRate {
  id: string;
  region: Region;
  label: string;
  rate: number;
  rateBasis: RateBasis;
  asOf: string;
  source: string;
  sourceUrl: string;
  disclaimer: string;
}

export const referenceRates: ReferenceRate[] = [
  {
    id: "co-usury-2026-11",
    region: "CO",
    label: "Consumer and ordinary credit usury reference",
    rate: 0.2834,
    rateBasis: "effective_annual",
    asOf: "2026-11-01",
    source: "Superintendencia Financiera de Colombia, November 2026 certification",
    sourceUrl: "https://www.superfinanciera.gov.co/publicaciones/10829/sala-de-prensacomunicados-de-prensa-interes-bancario-corriente-10829/",
    disclaimer: "Reference only, verify with your bank.",
  },
  {
    id: "us-credit-card-2026-09",
    region: "US",
    label: "Credit-card accounts assessed interest, average APR",
    rate: 0.2236,
    rateBasis: "apr",
    asOf: "2026-09-01",
    source: "Federal Reserve G.19, September 2026; released November 6, 2026",
    sourceUrl: "https://www.federalreserve.gov/releases/g19/current/",
    disclaimer: "Reference only, verify with your bank.",
  },
];

export function isReferenceRateStale(
  preset: ReferenceRate,
  today: string,
  maxAgeMonths = 3,
): boolean {
  const [year, month] = preset.asOf.split("-").map(Number);
  const [currentYear, currentMonth] = today.split("-").map(Number);
  const ageInMonths = (currentYear - year) * 12 + currentMonth - month;
  return ageInMonths > maxAgeMonths;
}
