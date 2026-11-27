import type { AuthConfig } from "./config";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  user: SessionUser;
}

/** The email or password was wrong. Deliberately does not say which. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class AuthConnectionError extends Error {
  constructor() {
    super("The sign-in service could not be reached.");
    this.name = "AuthConnectionError";
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    user_metadata?: { full_name?: string; name?: string };
  };
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Partial<TokenResponse>;
  return (
    typeof body.access_token === "string" &&
    typeof body.refresh_token === "string" &&
    typeof body.expires_in === "number" &&
    typeof body.user?.id === "string" &&
    typeof body.user.email === "string"
  );
}

function toSession(body: TokenResponse, now: number): Session {
  const metadata = body.user.user_metadata ?? {};
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now + body.expires_in * 1000,
    user: {
      id: body.user.id,
      email: body.user.email,
      name: metadata.full_name || metadata.name || null,
    },
  };
}

async function requestToken(
  config: AuthConfig,
  grantType: "password" | "refresh_token",
  body: Record<string, string>,
  now: number,
): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`,
      {
        method: "POST",
        headers: {
          apikey: config.supabasePublishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new AuthConnectionError();
  }
  if (response.status === 400 || response.status === 401)
    throw new InvalidCredentialsError();
  if (!response.ok) throw new AuthConnectionError();
  const payload: unknown = await response.json().catch(() => null);
  if (!isTokenResponse(payload)) throw new AuthConnectionError();
  return toSession(payload, now);
}

export function signInWithPassword(
  config: AuthConfig,
  email: string,
  password: string,
  now = Date.now(),
): Promise<Session> {
  return requestToken(config, "password", { email, password }, now);
}

export function refreshSession(
  config: AuthConfig,
  refreshToken: string,
  now = Date.now(),
): Promise<Session> {
  return requestToken(
    config,
    "refresh_token",
    { refresh_token: refreshToken },
    now,
  );
}
