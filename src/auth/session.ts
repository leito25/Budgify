import type { AuthConfig } from "./config";
import {
  InvalidCredentialsError,
  refreshSession,
  signInWithPassword,
  type Session,
} from "./supabase-auth";

const SESSION_KEY = "budgify-session";
const REFRESH_MARGIN_MS = 60_000;

export class SignedOutError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "SignedOutError";
  }
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Partial<Session>;
  return (
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.expiresAt === "number" &&
    typeof session.user?.id === "string" &&
    typeof session.user.email === "string"
  );
}

function readSaved(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSaved(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // The session still works for this page when storage is unavailable.
  }
}

/** Keeps the signed-in session, restores it after a reload and refreshes its token. */
export class SessionManager {
  private session: Session | null = readSaved();
  private refreshing: Promise<Session> | null = null;

  constructor(
    private readonly config: AuthConfig,
    private readonly clock: () => number = Date.now,
  ) {}

  current(): Session | null {
    return this.session;
  }

  async signIn(email: string, password: string): Promise<Session> {
    const session = await signInWithPassword(
      this.config,
      email,
      password,
      this.clock(),
    );
    this.save(session);
    return session;
  }

  signOut(): void {
    this.save(null);
  }

  /** The saved session with a fresh token, or null when there is none to restore. */
  async restore(): Promise<Session | null> {
    if (!this.session) return null;
    try {
      await this.accessToken();
    } catch (error) {
      if (error instanceof SignedOutError) return null;
      // No connection: keep the session and let the next request report it.
    }
    return this.session;
  }

  /** A token that is valid now. Throws SignedOutError when the session cannot continue. */
  async accessToken(): Promise<string> {
    const session = this.session;
    if (!session) throw new SignedOutError();
    if (session.expiresAt - this.clock() > REFRESH_MARGIN_MS)
      return session.accessToken;
    return (await this.refresh(session)).accessToken;
  }

  private refresh(session: Session): Promise<Session> {
    if (this.refreshing) return this.refreshing;
    const pending: Promise<Session> = refreshSession(
      this.config,
      session.refreshToken,
      this.clock(),
    )
      .then((next) => this.applyRefreshed(session, next))
      .catch((error: unknown) => {
        if (error instanceof InvalidCredentialsError) {
          // Only the session that was refused ends; a newer sign-in carries on.
          if (this.session !== session && this.session) return this.session;
          this.save(null);
          throw new SignedOutError();
        }
        throw error;
      })
      .finally(() => {
        if (this.refreshing === pending) this.refreshing = null;
      });
    this.refreshing = pending;
    return pending;
  }

  /** Keeps a refreshed session only when the session it was started from is still current. */
  private applyRefreshed(started: Session, next: Session): Session {
    if (this.session === started) {
      this.save(next);
      return next;
    }
    // The user signed out or in while the refresh ran: drop its result.
    if (this.session) return this.session;
    throw new SignedOutError();
  }

  private save(session: Session | null): void {
    this.refreshing = null;
    this.session = session;
    writeSaved(session);
  }
}
