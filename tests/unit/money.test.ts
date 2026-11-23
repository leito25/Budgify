import { describe, expect, it } from "vitest";
import {
  decimalPlaces,
  distributeMinorUnits,
  roundHalfUp,
  toMinorUnits,
} from "../../src/domain/money";

describe("money", () => {
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
    expect(distributeMinorUnits(1, 4).reduce((sum, value) => sum + value, 0)).toBe(1);
  });
});
