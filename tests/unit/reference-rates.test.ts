import { describe, expect, it } from "vitest";
import {
  isReferenceRateStale,
  referenceRates,
} from "../../src/data/reference-rates";

describe("bundled reference rates", () => {
  it("includes dated, sourced regional presets and the verification disclaimer", () => {
    expect(referenceRates.map((preset) => preset.region).sort()).toEqual([
      "CO",
      "US",
    ]);
    for (const preset of referenceRates) {
      expect(preset.sourceUrl).toMatch(/^https:\/\//);
      expect(preset.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(preset.disclaimer.toLowerCase()).toContain(
        "verify with your bank",
      );
      expect(isReferenceRateStale(preset, "2026-11-23")).toBe(false);
    }
  });

  it("flags references after their review threshold", () => {
    expect(isReferenceRateStale(referenceRates[0], "2027-03-01")).toBe(true);
  });
});
