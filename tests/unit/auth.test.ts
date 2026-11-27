// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig, ConfigError } from "../../src/auth/config";
import { SessionManager, SignedOutError } from "../../src/auth/session";
import {
  AuthConnectionError,
  InvalidCredentialsError,
} from "../../src/auth/supabase-auth";

const config = {
  supabaseUrl: "https://test.supabase.invalid",
  supabasePublishableKey: "sb_publishable_test",
};

function tokenResponse(
  access: string,
  refresh = "refresh-1",
  expiresIn = 3600,
) {
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: expiresIn,
    user: {
      id: "person-1",
      email: "pat@budgify.ng",
      user_metadata: { full_name: "Pat Test" },
    },
  };
}

function reply(status: number, body: unknown = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

let now = 1_000_000;
const clock = () => now;

beforeEach(() => {
  localStorage.clear();
  now = 1_000_000;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sign-in", () => {
  it("sends the email and password and keeps the session", async () => {
    const fetchMock = vi.fn(() => reply(200, tokenResponse("access-1")));
    vi.stubGlobal("fetch", fetchMock);
    const manager = new SessionManager(config, clock);

    const session = await manager.signIn("pat@budgify.ng", "secret-pass");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://test.supabase.invalid/auth/v1/token?grant_type=password",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      email: "pat@budgify.ng",
      password: "secret-pass",
    });
    expect(init.headers).toMatchObject({ apikey: "sb_publishable_test" });
    expect(session.user).toEqual({
      id: "person-1",
      email: "pat@budgify.ng",
      name: "Pat Test",
    });
    expect(manager.current()?.accessToken).toBe("access-1");
  });

  it("gives one message for a wrong email or a wrong password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(400, { msg: "Invalid login credentials" })),
    );
    const manager = new SessionManager(config, clock);
    const wrongEmail = await manager
      .signIn("who@budgify.ng", "x")
      .catch((e) => e);
    const wrongPassword = await manager
      .signIn("pat@budgify.ng", "y")
      .catch((e) => e);
    expect(wrongEmail).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongPassword.message).toBe(wrongEmail.message);
    expect(manager.current()).toBeNull();
  });

  it("reports a connection failure differently from wrong credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    const manager = new SessionManager(config, clock);
    await expect(manager.signIn("a@b.ng", "x")).rejects.toBeInstanceOf(
      AuthConnectionError,
    );
  });
});

describe("session", () => {
  async function signedIn() {
    const fetchMock = vi.fn(() => reply(200, tokenResponse("access-1")));
    vi.stubGlobal("fetch", fetchMock);
    const manager = new SessionManager(config, clock);
    await manager.signIn("pat@budgify.ng", "secret-pass");
    return { manager, fetchMock };
  }

  it("is restored after a reload", async () => {
    await signedIn();
    const reloaded = new SessionManager(config, clock);
    expect((await reloaded.restore())?.user.email).toBe("pat@budgify.ng");
    expect(await reloaded.accessToken()).toBe("access-1");
  });

  it("is cleared by signing out, including after a reload", async () => {
    const { manager } = await signedIn();
    manager.signOut();
    expect(manager.current()).toBeNull();
    expect(await new SessionManager(config, clock).restore()).toBeNull();
    await expect(manager.accessToken()).rejects.toBeInstanceOf(SignedOutError);
  });

  it("refreshes an expired token once, even for two requests", async () => {
    const { manager, fetchMock } = await signedIn();
    fetchMock.mockImplementation(() =>
      reply(200, tokenResponse("access-2", "refresh-2")),
    );
    now += 3_600_000;

    const tokens = await Promise.all([
      manager.accessToken(),
      manager.accessToken(),
    ]);

    expect(tokens).toEqual(["access-2", "access-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("grant_type=refresh_token");
    expect(JSON.parse(init.body as string)).toEqual({
      refresh_token: "refresh-1",
    });
  });

  it("signs out when the refresh token is refused", async () => {
    const { manager, fetchMock } = await signedIn();
    fetchMock.mockImplementation(() => reply(400, { msg: "expired" }));
    now += 3_600_000;
    await expect(manager.accessToken()).rejects.toBeInstanceOf(SignedOutError);
    expect(manager.current()).toBeNull();
  });

  it("keeps the session when the refresh fails only for lack of a connection", async () => {
    const { manager, fetchMock } = await signedIn();
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("offline")),
    );
    now += 3_600_000;
    expect((await manager.restore())?.user.id).toBe("person-1");
  });
});

describe("app settings", () => {
  it("loads the Supabase settings from the app's own backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(200, config)),
    );
    expect(await loadConfig()).toEqual(config);
  });

  it("fails clearly when the settings are missing or unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(500)),
    );
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigError);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(200, { nothing: true })),
    );
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigError);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigError);
  });
});
