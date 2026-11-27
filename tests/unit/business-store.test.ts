import { describe, expect, it, vi } from "vitest";
import { BusinessStore } from "../../src/api/business-store";
import type { ApiClient } from "../../src/api/client";
import type { IncomeEntry, Loan, Payment } from "../../src/domain/types";
import { makeLoan } from "../fixtures/loans";

const ana = { id: "p1", name: "Ana Test", email: "ana@budgify.ng" };

function makeStore(answer: unknown = undefined) {
  const request = vi.fn(() => Promise.resolve(answer));
  const store = new BusinessStore({ request } as unknown as ApiClient);
  return { store, request };
}

const savedLoan: Loan = {
  ...makeLoan({ id: "server-id" }),
  createdAt: "2026-11-23T12:00:00+00:00",
  addedBy: ana,
  addedAt: "2026-11-23T12:00:00+00:00",
  changedBy: ana,
  changedAt: "2026-11-23T12:00:00+00:00",
};

describe("business store", () => {
  it("maps the workspace the API returns to the app's shape", async () => {
    const { store, request } = makeStore({
      region: "CO",
      baseCurrency: "COP",
      loans: [savedLoan],
      payments: [],
      income: [],
    });
    const data = await store.load();
    expect(request).toHaveBeenCalledWith("GET", "/api/workspace");
    expect(data.region).toBe("CO");
    expect(data.baseCurrency).toBe("COP");
    expect(data.loans[0]).toMatchObject({
      id: "server-id",
      createdAt: "2026-11-23",
      addedBy: ana,
    });
  });

  it("creates a loan without sending its id or audit fields", async () => {
    const { store, request } = makeStore(savedLoan);
    const saved = await store.createLoan({ ...savedLoan, id: "local-id" });
    const [method, path, body] = request.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect([method, path]).toEqual(["POST", "/api/loans"]);
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("addedBy");
    expect(body).toMatchObject({ name: "Test loan", principalMinor: 100_000 });
    expect(saved.id).toBe("server-id");
    expect(saved.createdAt).toBe("2026-11-23");
  });

  it("edits and deletes a loan by its id", async () => {
    const { store, request } = makeStore(savedLoan);
    await store.updateLoan(savedLoan);
    await store.deleteLoan("server-id");
    expect(request.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ["PUT", "/api/loans/server-id"],
      ["DELETE", "/api/loans/server-id"],
    ]);
  });

  it("settles an installment and returns the saved payment", async () => {
    const payment: Payment = {
      loanId: "server-id",
      installmentIndex: 2,
      paidDate: "2026-11-23",
      scheduledAmountMinor: 10,
      penaltyMinor: 1,
      totalPaidMinor: 11,
    };
    const saved = { ...payment, settledBy: ana };
    const { store, request } = makeStore(saved);
    expect(await store.settle(payment)).toEqual(saved);
    expect(request).toHaveBeenCalledWith(
      "POST",
      "/api/loans/server-id/payments",
      {
        installmentIndex: 2,
        paidDate: "2026-11-23",
        scheduledAmountMinor: 10,
        penaltyMinor: 1,
        totalPaidMinor: 11,
      },
    );
  });

  it("creates, edits and deletes income through the right routes", async () => {
    const entry: IncomeEntry = {
      id: "i1",
      source: "Sales",
      description: "",
      amountMinor: 5,
      dateReceived: "2026-11-01",
      frequency: "recurring",
    };
    const { store, request } = makeStore({ ...entry, addedBy: ana });
    expect((await store.createIncome(entry)).addedBy).toEqual(ana);
    await store.updateIncome(entry);
    await store.deleteIncome("i1");
    expect(request.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ["POST", "/api/income"],
      ["PUT", "/api/income/i1"],
      ["DELETE", "/api/income/i1"],
    ]);
  });

  it("passes failures on so the app can show them", async () => {
    const request = vi.fn(() => Promise.reject(new Error("down")));
    const store = new BusinessStore({ request } as unknown as ApiClient);
    await expect(store.createLoan(savedLoan)).rejects.toThrow("down");
    await expect(store.load()).rejects.toThrow("down");
    await expect(store.deleteIncome("i1")).rejects.toThrow("down");
  });
});
