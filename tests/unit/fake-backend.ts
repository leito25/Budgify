import { vi } from "vitest";

const SAMPLE_PERSON = {
  id: "sample-person",
  name: "Sample Team",
  email: "team@sample-business.ng",
};
export const ANA = {
  id: "test-person-ana",
  name: "Ana Test",
  email: "ana@budgify.ng",
};
export const TEST_PASSWORD = "test-password";
const NOW = "2026-11-23T12:00:00+00:00";

type Json = Record<string, unknown>;

function audit(person: typeof ANA | typeof SAMPLE_PERSON) {
  return {
    addedBy: person,
    addedAt: NOW,
    changedBy: person,
    changedAt: NOW,
  };
}

function sampleLoan(
  key: string,
  name: string,
  principalMinor: number,
  due: string,
) {
  return {
    id: `business-${key}`,
    name,
    description: "",
    principalMinor,
    termMonths: 12,
    rate: 0.22,
    rateBasis: "effective_annual",
    interestType: "compound",
    penaltyRateAnnual: 0.12,
    firstDueDate: due,
    createdAt: NOW,
    ...audit(SAMPLE_PERSON),
  };
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
  });
}

/** An in-memory copy of the app's API and Supabase sign-in, for unit tests. */
export class FakeBackend {
  region = "CO";
  baseCurrency = "COP";
  loans: Json[] = [
    sampleLoan("cafe", "Coffee equipment", 18_000_000, "2026-11-28"),
    sampleLoan("bakery", "Bakery oven", 12_500_000, "2026-12-08"),
    sampleLoan("delivery", "Delivery equipment", 9_000_000, "2026-12-18"),
  ];
  payments: Json[] = [];
  income: Json[] = [
    {
      id: "business-sales",
      source: "Monthly sales",
      description: "",
      amountMinor: 60_000_000,
      dateReceived: "2026-11-23",
      frequency: "recurring",
      ...audit(SAMPLE_PERSON),
    },
    {
      id: "business-order",
      source: "Panadería seasonal order",
      description: "",
      amountMinor: 4_000_000,
      dateReceived: "2026-11-23",
      frequency: "one_time",
      ...audit(SAMPLE_PERSON),
    },
  ];
  failWrites = false;
  requests: string[] = [];
  private counter = 0;

  async handle(url: string, init: RequestInit = {}): Promise<Response | null> {
    const path = new URL(url, "http://app.test");
    const method = init.method ?? "GET";
    if (path.pathname === "/config.json")
      return json(200, {
        supabaseUrl: "",
        supabasePublishableKey: "sb_publishable_test",
      });
    if (path.pathname === "/auth/v1/token") return this.token(init);
    if (!path.pathname.startsWith("/api/")) return null;
    this.requests.push(`${method} ${path.pathname}${path.search}`);
    const headers = new Headers(init.headers);
    if (!headers.get("Authorization")?.startsWith("Bearer "))
      return json(401, { detail: "Sign in required." });
    const body = init.body ? (JSON.parse(init.body as string) as Json) : {};
    if (method !== "GET" && this.failWrites)
      return json(500, { detail: "The database is down." });
    return this.route(method, path, body);
  }

  private token(init: RequestInit): Response {
    const body = JSON.parse(init.body as string) as Json;
    if (body.password !== TEST_PASSWORD && !body.refresh_token)
      return json(400, { msg: "Invalid login credentials" });
    return json(200, {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      user: {
        id: ANA.id,
        email: ANA.email,
        user_metadata: { full_name: ANA.name },
      },
    });
  }

  private route(method: string, path: URL, body: Json): Response {
    const parts = path.pathname.split("/").slice(2);
    const [collection, id, child] = parts;
    if (collection === "workspace")
      return json(200, {
        region: this.region,
        baseCurrency: this.baseCurrency,
        loans: this.loans,
        payments: this.payments,
        income: this.income,
      });
    if (collection === "search") return json(200, this.search(path));
    if (collection === "loans" && child === "payments") {
      const saved = {
        loanId: id,
        ...body,
        ...audit(ANA),
        settledBy: ANA,
        settledAt: NOW,
      };
      this.payments.push(saved);
      return json(201, saved);
    }
    if (collection === "loans") return this.write(this.loans, method, id, body);
    if (collection === "income")
      return this.write(this.income, method, id, body);
    return json(404, { detail: "Not found." });
  }

  private write(
    list: Json[],
    method: string,
    id: string | undefined,
    body: Json,
  ) {
    if (method === "DELETE") {
      this.payments = this.payments.filter((item) => item.loanId !== id);
      list.splice(
        list.findIndex((item) => item.id === id),
        1,
      );
      return json(204);
    }
    if (method === "POST") {
      this.counter += 1;
      const created = {
        id: `server-${this.counter}`,
        ...body,
        createdAt: NOW,
        ...audit(ANA),
      };
      list.push(created);
      return json(201, created);
    }
    const index = list.findIndex((item) => item.id === id);
    list[index] = { ...list[index], ...body, changedBy: ANA, changedAt: NOW };
    return json(200, list[index]);
  }

  private search(path: URL) {
    const text = (path.searchParams.get("q") ?? "").toLowerCase();
    if (!text) return [];
    const hit = (kind: string, id: unknown, name: unknown) => ({
      kind,
      id,
      name,
    });
    return [
      ...this.loans
        .filter((loan) => String(loan.name).toLowerCase().includes(text))
        .map((loan) => hit("loan", loan.id, loan.name)),
      ...this.income
        .filter((entry) => String(entry.source).toLowerCase().includes(text))
        .map((entry) => hit("income", entry.id, entry.source)),
    ];
  }
}

type Fetch = typeof fetch;

/**
 * Replaces fetch with the fake backend. Anything that is not the backend,
 * such as an exchange-rate request, goes to `other`, or fails as if offline.
 */
export function stubFetch(
  other?: Fetch | ReturnType<typeof vi.fn>,
  backend = new FakeBackend(),
): FakeBackend {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const answer = await backend.handle(url, init);
      if (answer) return answer;
      if (other) return (other as Fetch)(input, init);
      throw new TypeError("offline");
    }),
  );
  return backend;
}

/** A saved session, so a test starts signed in. */
export function seedSession(): void {
  localStorage.setItem(
    "budgify-session",
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 3_600_000,
      user: { id: ANA.id, email: ANA.email, name: ANA.name },
    }),
  );
}
