import type { GameProgress, WorkspaceMode } from "../types";

export interface GameScenario {
  mode: WorkspaceMode;
  months: number;
  challenges: string[];
  choiceIds: string[];
}

const CHOICE_IDS = [
  "pay_high_interest",
  "avoid_installment",
  "build_buffer",
  "unnecessary_installment",
];

export function createGameScenario(mode: WorkspaceMode): GameScenario {
  return {
    mode,
    months: 6,
    challenges: [
      `${mode}-challenge-2`,
      `${mode}-challenge-4`,
      `${mode}-challenge-6`,
    ],
    choiceIds: [...CHOICE_IDS],
  };
}

export function createGameProgress(mode: WorkspaceMode): GameProgress {
  return {
    mode,
    month: 1,
    cashMinor: 500_000,
    debtMinor: 1_000_000,
    bufferMinor: 0,
    interestAvoidedMinor: 0,
    completedChallengeIds: [],
    decisions: [],
  };
}

export function applyGameChoice(
  progress: GameProgress,
  choiceId: string,
): GameProgress {
  if (!CHOICE_IDS.includes(choiceId)) {
    throw new RangeError(`Unknown quest choice: ${choiceId}`);
  }
  if (progress.month > createGameScenario(progress.mode).months) {
    throw new RangeError("This quest scenario is already complete.");
  }

  const next = {
    ...progress,
    month: progress.month + 1,
    decisions: [...progress.decisions, choiceId],
  };
  switch (choiceId) {
    case "pay_high_interest":
      next.cashMinor = Math.max(0, next.cashMinor - 100_000);
      next.debtMinor = Math.max(0, next.debtMinor - 150_000);
      next.interestAvoidedMinor += 50_000;
      break;
    case "avoid_installment":
      next.cashMinor += 20_000;
      break;
    case "build_buffer":
      next.cashMinor = Math.max(0, next.cashMinor - 25_000);
      next.bufferMinor += 25_000;
      break;
    case "unnecessary_installment":
      next.cashMinor = Math.max(0, next.cashMinor - 20_000);
      next.debtMinor += 100_000;
      break;
  }

  const completedChallenge = createGameScenario(progress.mode).challenges.find(
    (challenge) => challenge.endsWith(`-${progress.month}`),
  );
  if (
    completedChallenge &&
    !next.completedChallengeIds.includes(completedChallenge)
  ) {
    next.completedChallengeIds.push(completedChallenge);
  }
  return next;
}

export function getGameScore(progress: GameProgress): number {
  return (
    progress.cashMinor +
    progress.bufferMinor -
    progress.debtMinor +
    progress.interestAvoidedMinor +
    Math.round(progress.bufferMinor * 0.25)
  );
}
