import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/en";
import { es } from "../../src/i18n/es";
import { formatLocaleDate, translate } from "../../src/i18n";

describe("translations", () => {
  it("keeps English and Spanish keys in sync", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it("returns translated labels and formats dates for the selected locale", () => {
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
    expect(translate("es", "nav.dashboard")).toBe("Panel");
    expect(formatLocaleDate("2026-11-23", "es")).toContain("2026");
    expect(formatLocaleDate("2026-11-23", "en")).toContain("2026");
  });
});
