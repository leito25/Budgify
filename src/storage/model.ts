import type { GameProgress, Workspace, WorkspaceMode } from "../domain/types";
import type { Language } from "../i18n";

export const CURRENT_SCHEMA_VERSION = 3;

export type Theme = "light" | "dark";

export interface AppState {
  schemaVersion: number;
  userName: string | null;
  isSignedIn: boolean;
  hasSignedIn: boolean;
  activeMode: WorkspaceMode;
  language: Language;
  theme: Theme;
  workspaces: Record<WorkspaceMode, Workspace>;
  gameProgress: Partial<Record<WorkspaceMode, GameProgress>>;
}
