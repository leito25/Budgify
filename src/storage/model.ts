import type { GameProgress, Workspace, WorkspaceMode } from "../domain/types";
import type { Language } from "../i18n";

export const CURRENT_SCHEMA_VERSION = 5;

export type Theme = "light" | "dark" | "system";
export type ExchangeRateCache = Partial<Record<string, number>>;

export interface AppState {
  schemaVersion: number;
  /** True once the person has chosen a starting workspace and currency. */
  hasChosenWorkspace: boolean;
  activeMode: WorkspaceMode;
  language: Language;
  theme: Theme;
  exchangeRateCache: ExchangeRateCache;
  workspaces: Record<WorkspaceMode, Workspace>;
  gameProgress: Partial<Record<WorkspaceMode, GameProgress>>;
}
