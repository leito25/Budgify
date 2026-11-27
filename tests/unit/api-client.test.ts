import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../../src/api/client";
import { SignedOutError } from "../../src/auth/session";

function answer(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

function makeClient(getToken = () => Promise.resolve("token-1")) {
  const onSignedOut = vi.fn();
  return { client: new ApiClient({ getToken, onSignedOut }), onSignedOut };
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("sends the bearer token and a JSON body", async () => {
    const fetchMock = vi.fn(() => answer(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { client } = makeClient();

    expect(await client.request("POST", "/api/loans", { name: "A" })).toEqual({
      ok: true,
    });

    const [path, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe("/api/loans");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer token-1",
      "Content-Type": "application/json",
    });
    expect(init.body).toBe('{"name":"A"}');
  });

  it("returns nothing for an empty answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => answer(204)),
    );
    expect(
      await makeClient().client.request("DELETE", "/api/loans/x"),
    ).toBeUndefined();
  });

  it("signs the person out on a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => answer(401, { detail: "Sign in" })),
    );
    const { client, onSignedOut } = makeClient();
    await expect(client.request("GET", "/api/workspace")).rejects.toMatchObject(
      { status: 401 },
    );
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("signs the person out when the session cannot continue", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { client, onSignedOut } = makeClient(() =>
      Promise.reject(new SignedOutError()),
    );
    await expect(client.request("GET", "/api/me")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message for a failure instead of hiding it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => answer(409, { detail: "Already settled." })),
    );
    const { client, onSignedOut } = makeClient();
    await expect(client.request("POST", "/api/x", {})).rejects.toMatchObject({
      message: "Already settled.",
      status: 409,
    });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("reports a missing connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    await expect(
      makeClient().client.request("GET", "/api/me"),
    ).rejects.toMatchObject({ status: null });
  });

  it("falls back to a plain message when the failure has no detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => answer(500, "oops")),
    );
    await expect(
      makeClient().client.request("GET", "/api/me"),
    ).rejects.toMatchObject({ message: "The server answered 500." });
  });
});
