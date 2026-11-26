import { describe, expect, it } from "vitest";
import {
  formatMoney,
  decimalPlaces,
  convertMinorUnits,
  distributeMinorUnits,
  roundHalfUp,
  toMinorUnits,
} from "../../src/domain/money";

describe("money", () => {
  it("rejects non-finite rounding values and formats both supported currencies", () => {
    expect(() => roundHalfUp(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => distributeMinorUnits(1.5, 2)).toThrow(RangeError);
    expect(() => distributeMinorUnits(10, 0)).toThrow(RangeError);
    expect(formatMoney(270000, "COP", "es-CO")).toContain("270");
    expect(formatMoney(1250, "USD", "en-US")).toContain("12");
  });
  it("uses the currency's minor unit precision", () => {
    expect(decimalPlaces("COP")).toBe(0);
    expect(decimalPlaces("USD")).toBe(2);
    expect(toMinorUnits(1250.5, "COP")).toBe(1251);
    expect(toMinorUnits(12.345, "USD")).toBe(1235);
  });

  it("rounds half up and assigns remainder to the final installment", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(distributeMinorUnits(100, 3)).toEqual([33, 33, 34]);
    expect(
      distributeMinorUnits(1, 4).reduce((sum, value) => sum + value, 0),
    ).toBe(1);
  });

  it("converts displayed values across currency precision without mutating source values", () => {
    const copMinor = 270_000;
    expect(convertMinorUnits(copMinor, "COP", "USD", 0.00025)).toBe(6750);
    expect(copMinor).toBe(270_000);
    expect(convertMinorUnits(6750, "USD", "COP", 4000)).toBe(270_000);
    expect(convertMinorUnits(100, "USD", "USD", 1)).toBe(100);
    expect(() => convertMinorUnits(100, "USD", "COP", 0)).toThrow(RangeError);
  });
});
