import { describe, expect, it } from "vitest";
import {
  applyGameChoice,
  createGameProgress,
  createGameScenario,
  getGameScore,
} from "../../src/domain/game/engine";

describe("Financial Quest", () => {
  it("uses a deterministic 6–12 month scenario with three challenges per mode", () => {
    for (const mode of ["personal", "business"] as const) {
      const scenario = createGameScenario(mode);
      expect(scenario.months).toBeGreaterThanOrEqual(6);
      expect(scenario.months).toBeLessThanOrEqual(12);
      expect(scenario.challenges).toHaveLength(3);
    }

    const start = createGameProgress("personal");
    const choices = ["pay_high_interest", "avoid_installment", "build_buffer"];
    expect(
      choices.reduce(
        (progress, choice) => applyGameChoice(progress, choice),
        start,
      ),
    ).toEqual(
      choices.reduce(
        (progress, choice) => applyGameChoice(progress, choice),
        start,
      ),
    );
  });

  it("rewards high-interest debt focus and emergency savings, and penalizes an unnecessary installment", () => {
    const start = createGameProgress("personal");
    expect(
      getGameScore(applyGameChoice(start, "pay_high_interest")),
    ).toBeGreaterThan(getGameScore(start));
    expect(
      getGameScore(applyGameChoice(start, "avoid_installment")),
    ).toBeGreaterThan(getGameScore(start));
    expect(
      getGameScore(applyGameChoice(start, "unnecessary_installment")),
    ).toBeLessThan(getGameScore(start));
    expect(applyGameChoice(start, "build_buffer").bufferMinor).toBeGreaterThan(
      start.bufferMinor,
    );
  });

  it("advances months and records challenge completion deterministically", () => {
    let progress = createGameProgress("business");
    progress = applyGameChoice(progress, "avoid_installment");
    expect(progress.month).toBe(2);
    for (let month = 2; month < 6; month += 1) {
      progress = applyGameChoice(progress, "build_buffer");
    }
    expect(progress.completedChallengeIds.length).toBeGreaterThan(0);
    expect(progress.decisions).toHaveLength(5);
  });
});
