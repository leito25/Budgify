import { describe, expect, it } from "vitest";
import { addMonthsClamped, generateSchedule } from "../../src/domain/schedule";
import { makeLoan } from "../fixtures/loans";

describe("installment schedules", () => {
  it("generates flat simple interest with exact total and zero remaining balance", () => {
    const schedule = generateSchedule(makeLoan({ interestType: "simple" }), "COP");
    expect(schedule.map((row) => row.amountMinor)).toEqual([34_333, 34_333, 34_334]);
    expect(schedule.reduce((sum, row) => sum + row.interestMinor, 0)).toBe(3_000);
    expect(schedule.reduce((sum, row) => sum + row.principalMinor, 0)).toBe(100_000);
    expect(schedule.at(-1)?.remainingPrincipalMinor).toBe(0);
  });

  it.each(["COP", "USD"] as const)("matches the compound golden table for %s", (currency) => {
    const schedule = generateSchedule(makeLoan(), currency);
    expect(schedule.map((row) => row.amountMinor)).toEqual([34_002, 34_002, 34_003]);
    expect(schedule.map((row) => row.interestMinor)).toEqual([1_000, 670, 337]);
    expect(schedule.at(-1)?.remainingPrincipalMinor).toBe(0);
  });

  it("supports zero rates, a single installment, grocery and long schedules", () => {
    expect(generateSchedule(makeLoan({ rate: 0, termMonths: 3 }), "COP").map((row) => row.amountMinor))
      .toEqual([33_333, 33_333, 33_334]);
    expect(generateSchedule(makeLoan({ rate: 0, termMonths: 1 }), "COP")).toHaveLength(1);
    expect(generateSchedule(makeLoan({ termMonths: 3 }), "USD")).toHaveLength(3);
    expect(generateSchedule(makeLoan({ termMonths: 60 }), "USD")).toHaveLength(60);
  });

  it("anchors due dates to the original day and clamps month ends", () => {
    expect(generateSchedule(makeLoan(), "COP").map((row) => row.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-30", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-12-31", 1)).toBe("2027-01-31");
  });
});
