import { describe, expect, it, vi } from "vitest";
import {
  cacheExchangeRate,
  fetchExchangeRate,
  getCachedExchangeRate,
} from "../../src/domain/exchange-rates";

describe("exchange rates", () => {
  it("accepts a valid live rate", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: "success",
          rates: { USD: 0.00025, COP: 4000 },
        }),
        { status: 200 },
      ),
    );
    await expect(fetchExchangeRate("COP", "USD", fetchImpl)).resolves.toBe(
      0.00025,
    );
  });

  it("returns null for failed, invalid, and blocked live responses", async () => {
    await expect(
      fetchExchangeRate(
        "COP",
        "USD",
        vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
      ),
    ).resolves.toBeNull();
    await expect(
      fetchExchangeRate(
        "COP",
        "USD",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("bad", { status: 500 })),
      ),
    ).resolves.toBeNull();
    await expect(
      fetchExchangeRate(
        "COP",
        "USD",
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify({ result: "error", rates: null }), {
            status: 200,
          }),
        ),
      ),
    ).resolves.toBeNull();
    await expect(
      fetchExchangeRate(
        "COP",
        "USD",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ result: "success", rates: { USD: -1 } }),
              { status: 200 },
            ),
          ),
      ),
    ).resolves.toBeNull();
  });

  it("uses a cached direct or inverse rate and rejects unusable values", async () => {
    const direct = cacheExchangeRate({}, "COP", "USD", 0.00025);
    expect(getCachedExchangeRate(direct, "COP", "USD")).toBe(0.00025);
    expect(getCachedExchangeRate(direct, "USD", "COP")).toBe(4000);
    expect(getCachedExchangeRate({}, "USD", "COP")).toBeNull();
    expect(getCachedExchangeRate({}, "USD", "USD")).toBe(1);
    expect(cacheExchangeRate({}, "USD", "USD", 1)).toEqual({});
    expect(cacheExchangeRate({}, "USD", "COP", 0)).toEqual({});
    expect(getCachedExchangeRate({ "EUR:COP": 4000 }, "COP", "COP")).toBe(1);
    expect(getCachedExchangeRate({ "COP:USD": -1 }, "COP", "USD")).toBeNull();
    expect(getCachedExchangeRate({ "COP:USD": 0 }, "COP", "USD")).toBeNull();
    expect(
      getCachedExchangeRate({ "COP:USD": Number.NaN }, "COP", "USD"),
    ).toBeNull();
    expect(
      getCachedExchangeRate(
        { "COP:USD": Number.POSITIVE_INFINITY },
        "COP",
        "USD",
      ),
    ).toBeNull();
    expect(cacheExchangeRate({ "COP:USD": 0.00025 }, "COP", "USD", 1)).toEqual({
      "COP:USD": 1,
    });
    await fetchExchangeRate("USD", "USD").then((rate) => expect(rate).toBe(1));
  });
});
