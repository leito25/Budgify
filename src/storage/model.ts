import type { GameProgress, Workspace, WorkspaceMode } from "../domain/types";
import type { Language } from "../i18n";

export interface AppState {
  schemaVersion: number;
  userName: string | null;
  hasSignedIn: boolean;
  activeMode: WorkspaceMode;
  language: Language;
  workspaces: Record<WorkspaceMode, Workspace>;
  gameProgress: Partial<Record<WorkspaceMode, GameProgress>>;
}
