import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbStorageBackend } from "../../src/storage/db";
import {
  RecoveryRequiredError,
  StorageRepository,
  StorageWriteError,
  type StorageBackend,
} from "../../src/storage/repository";
import { MemoryStorageBackend } from "../../src/storage/fallback";
import { createInitialState, resetState } from "../../src/storage/seed";
import type { AppState } from "../../src/storage/model";
import { makeLoan, testPerson } from "../fixtures/loans";

class TestBackend implements StorageBackend {
  private readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  failRemoves = false;
  readonly mode: StorageBackend["mode"];

  constructor(mode: StorageBackend["mode"]) {
    this.mode = mode;
  }

  async get(key: string): Promise<string | null> {
    if (this.failReads) throw new Error("read failed");
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error("write failed");
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    if (this.failRemoves) throw new Error("remove failed");
    this.values.delete(key);
  }
}

describe("storage repository", () => {
  it("round-trips and removes IndexedDB records", async () => {
    const previous = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      value: new IDBFactory(),
      configurable: true,
    });
    try {
      const backend = await IndexedDbStorageBackend.open("unit-storage");
      expect(await backend.get("missing")).toBeNull();
      await backend.set("profile", "saved");
      expect(await backend.get("profile")).toBe("saved");
      await backend.remove("profile");
      expect(await backend.get("profile")).toBeNull();
    } finally {
      if (previous === undefined)
        delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      else
        Object.defineProperty(globalThis, "indexedDB", {
          value: previous,
          configurable: true,
        });
    }
  });
  it("round-trips separate workspaces and persists only after a successful write", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    const initial = createInitialState("2026-11-23");
    await repository.load(initial);
    await repository.update((state) => {
      state.workspaces.personal.income = [];
      return state;
    });

    const restored = new StorageRepository([backend]);
    const loaded = await restored.load(initial);
    expect(loaded.workspaces.personal.income).toEqual([]);
    expect(loaded.workspaces.personal.loans).not.toEqual([]);

    backend.failWrites = true;
    await expect(
      repository.update((state) => {
        state.language = "es";
        return state;
      }),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()?.language).toBe("en");
  });

  it("serializes concurrent writes and resets without losing saved changes", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    const initial = createInitialState("2026-11-23");
    await repository.load(initial);
    let release = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const set = backend.set.bind(backend);
    vi.spyOn(backend, "set").mockImplementationOnce(async (key, value) => {
      await blocked;
      await set(key, value);
    });

    const theme = repository.update((state) => ({ ...state, theme: "dark" }));
    const setup = repository.update((state) => ({
      ...state,
      hasChosenWorkspace: true,
    }));
    release();
    expect((await theme).theme).toBe("dark");
    const saved = await setup;
    expect(saved).toMatchObject({ theme: "dark", hasChosenWorkspace: true });
    expect(await new StorageRepository([backend]).load(initial)).toEqual(saved);

    const update = repository.update((state) => ({ ...state, theme: "light" }));
    const reset = repository.reset(initial);
    await update;
    expect(await reset).toEqual(initial);
    expect(await new StorageRepository([backend]).load(initial)).toEqual(
      initial,
    );
  });

  it("reports a failed queued write and allows a later write to use saved data", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    await repository.load(createInitialState("2026-11-23"));
    vi.spyOn(backend, "set").mockRejectedValueOnce(new Error("write failed"));

    const failed = repository.update((state) => ({ ...state, theme: "dark" }));
    const saved = repository.update((state) => ({
      ...state,
      language: "es",
    }));
    await expect(failed).rejects.toBeInstanceOf(StorageWriteError);
    expect(await saved).toMatchObject({ theme: "light", language: "es" });
  });

  it("falls back to localStorage and then memory when initial storage is unavailable", async () => {
    const broken = new TestBackend("indexeddb");
    broken.failWrites = true;
    const local = new TestBackend("localstorage");
    const memory = new MemoryStorageBackend();
    const repository = new StorageRepository([broken, local, memory]);
    await repository.load(createInitialState("2026-11-23"));
    expect(repository.mode).toBe("localstorage");

    const brokenLocal = new TestBackend("localstorage");
    brokenLocal.failWrites = true;
    const memoryRepository = new StorageRepository([
      broken,
      brokenLocal,
      memory,
    ]);
    await memoryRepository.load(createInitialState("2026-11-23"));
    expect(memoryRepository.mode).toBe("memory");
    expect(repository.warnings.length).toBeGreaterThan(0);
  });

  it("reports failed writes rather than switching to storage hidden by an older profile", async () => {
    const primary = new TestBackend("indexeddb");
    const fallback = new TestBackend("localstorage");
    const repository = new StorageRepository([primary, fallback]);
    await repository.load(createInitialState("2026-11-23"));
    primary.failWrites = true;
    await expect(
      repository.update((state) => ({ ...state, hasChosenWorkspace: true })),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()?.hasChosenWorkspace).toBe(false);
    expect(await fallback.get("budgify-state")).toBeNull();
  });

  it("backs up an old schema before migrating and preserves it when migration fails", async () => {
    const backend = new TestBackend("indexeddb");
    const oldState = createInitialState("2026-11-23");
    const original = JSON.stringify({ schemaVersion: 0, data: oldState });
    await backend.set("budgify-state", original);
    const repository = new StorageRepository([backend]);

    await expect(repository.load(oldState)).rejects.toBeInstanceOf(
      RecoveryRequiredError,
    );
    expect(await backend.get("budgify-state")).toBe(original);
    expect(await backend.get("budgify-state-backup-v0")).toBe(original);
  });

  it("migrates a schema-4 profile by dropping it and keeping Personal data", async () => {
    const backend = new TestBackend("indexeddb");
    const state = createInitialState("2026-11-23");
    const schemaV4 = {
      ...state,
      schemaVersion: 4,
      userName: "Alex",
      isSignedIn: true,
      hasSignedIn: true,
      workspaces: {
        personal: state.workspaces.personal,
        business: {
          ...state.workspaces.business,
          displayCurrency: "USD",
          loans: [state.workspaces.personal.loans[0]],
          income: [state.workspaces.personal.income[0]],
        },
      },
    } as Record<string, unknown>;
    delete schemaV4.hasChosenWorkspace;
    const original = JSON.stringify({ schemaVersion: 4, data: schemaV4 });
    await backend.set("budgify-state", original);

    const repository = new StorageRepository([backend]);
    const loaded = await repository.load(createInitialState("2026-11-23"));

    expect(loaded.schemaVersion).toBe(5);
    expect(loaded).not.toHaveProperty("userName");
    expect(loaded).not.toHaveProperty("isSignedIn");
    expect(loaded).not.toHaveProperty("hasSignedIn");
    expect(loaded.hasChosenWorkspace).toBe(true);
    expect(loaded.workspaces.personal).toEqual(state.workspaces.personal);
    expect(loaded.workspaces.business).toMatchObject({
      displayCurrency: "USD",
      loans: [],
      payments: [],
      income: [],
    });
    expect(await backend.get("budgify-state-backup-v4")).toBe(original);
    expect(
      await new StorageRepository([backend]).load(
        createInitialState("2026-11-23"),
      ),
    ).toEqual(loaded);
  });

  it("migrates a legacy profile through every step to schema 5", async () => {
    const backend = new TestBackend("indexeddb");
    const state = createInitialState("2026-11-23");
    const legacy: Record<string, unknown> = {
      ...state,
      schemaVersion: 1,
      userName: "Alex",
      hasSignedIn: true,
    };
    for (const key of ["theme", "exchangeRateCache", "hasChosenWorkspace"])
      delete legacy[key];
    const original = JSON.stringify({ schemaVersion: 1, data: legacy });
    await backend.set("budgify-state", original);

    const loaded = await new StorageRepository([backend]).load(state);
    expect(loaded.schemaVersion).toBe(5);
    expect(loaded.theme).toBe("light");
    expect(loaded.hasChosenWorkspace).toBe(true);
    expect(loaded.workspaces.personal.income[0].source).toBe("Monthly salary");
    expect(await backend.get("budgify-state-backup-v1")).toBe(original);
  });

  it("accepts the system theme", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    await repository.load(createInitialState("2026-11-23"));
    await repository.update((state) => ({ ...state, theme: "system" }));
    const restored = await new StorageRepository([backend]).load(
      createInitialState("2026-11-23"),
    );
    expect(restored.theme).toBe("system");
  });

  it("keeps audit fields on loans, payments and income through a save", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    await repository.load(createInitialState("2026-11-23"));
    const audit = {
      addedBy: testPerson,
      addedAt: "2026-11-20T10:00:00Z",
      changedBy: testPerson,
      changedAt: "2026-11-21T10:00:00Z",
    };
    await repository.update((state) => {
      const business = state.workspaces.business;
      business.loans = [makeLoan(audit)];
      business.payments = [
        {
          loanId: "loan-1",
          installmentIndex: 1,
          paidDate: "2026-11-22",
          scheduledAmountMinor: 100,
          penaltyMinor: 0,
          totalPaidMinor: 100,
          ...audit,
          settledBy: testPerson,
          settledAt: "2026-11-22T10:00:00Z",
        },
      ];
      business.income = [
        {
          id: "income-1",
          source: "Sales",
          description: "",
          amountMinor: 500,
          dateReceived: "2026-11-22",
          frequency: "one_time",
          ...audit,
        },
      ];
      return state;
    });

    const loaded = await new StorageRepository([backend]).load(
      createInitialState("2026-11-23"),
    );
    const business = loaded.workspaces.business;
    expect(business.loans[0]).toMatchObject(audit);
    expect(business.payments[0]).toMatchObject({
      ...audit,
      settledBy: testPerson,
      settledAt: "2026-11-22T10:00:00Z",
    });
    expect(business.income[0]).toMatchObject(audit);
  });

  it("migrates schema-v3 currency data without rewriting base monetary values", async () => {
    const backend = new TestBackend("indexeddb");
    const state = createInitialState("2026-11-23");
    const schemaV3 = {
      ...state,
      schemaVersion: 3,
      userName: null,
      hasSignedIn: false,
      exchangeRateCache: undefined,
      workspaces: {
        personal: {
          ...state.workspaces.personal,
          currency: "COP",
        },
        business: {
          ...state.workspaces.business,
          currency: "USD",
        },
      },
    } as unknown as Record<string, unknown>;
    delete schemaV3.exchangeRateCache;
    delete (schemaV3.workspaces as Record<string, Record<string, unknown>>)
      .personal.baseCurrency;
    delete (schemaV3.workspaces as Record<string, Record<string, unknown>>)
      .personal.displayCurrency;
    delete (schemaV3.workspaces as Record<string, Record<string, unknown>>)
      .business.baseCurrency;
    delete (schemaV3.workspaces as Record<string, Record<string, unknown>>)
      .business.displayCurrency;
    const personalPrincipal = state.workspaces.personal.loans[0].principalMinor;
    const original = JSON.stringify({ schemaVersion: 3, data: schemaV3 });
    await backend.set("budgify-state", original);

    const repository = new StorageRepository([backend]);
    const loaded = await repository.load(createInitialState("2026-11-23"));

    expect(loaded.schemaVersion).toBe(5);
    expect(loaded.exchangeRateCache).toEqual({});
    expect(loaded.workspaces.personal.baseCurrency).toBe("COP");
    expect(loaded.workspaces.personal.displayCurrency).toBe("COP");
    expect(loaded.workspaces.business.baseCurrency).toBe("USD");
    expect(loaded.workspaces.business.displayCurrency).toBe("USD");
    expect(loaded.workspaces.personal.loans[0].principalMinor).toBe(
      personalPrincipal,
    );
    expect(await backend.get("budgify-state-backup-v3")).toBe(original);
  });

  it("resets to Personal sample data only and asks for the workspace choice again", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    await repository.load(createInitialState("2026-11-23"));
    await repository.update((state) => {
      state.hasChosenWorkspace = true;
      state.workspaces.personal.income[0].source = "Saved income";
      return state;
    });

    const restored = new StorageRepository([backend]);
    const saved = await restored.load(createInitialState("2026-11-23"));
    expect(saved.workspaces.personal.income[0].source).toBe("Saved income");
    const reset = await restored.reset(resetState("2026-11-23"));
    expect(reset.hasChosenWorkspace).toBe(false);
    expect(reset.workspaces.personal.income[0].source).toBe("Monthly salary");
    expect(reset.workspaces.business.loans).toEqual([]);
  });

  it("removes migration backups containing the old profile on reset", async () => {
    const backend = new TestBackend("indexeddb");
    const fallback = new TestBackend("localstorage");
    const legacy: Record<string, unknown> = {
      ...createInitialState("2026-11-23"),
      userName: "Alex",
      hasSignedIn: true,
    };
    delete legacy.hasChosenWorkspace;
    await backend.set(
      "budgify-state",
      JSON.stringify({ schemaVersion: 4, data: legacy }),
    );
    await fallback.set("budgify-state", "old profile");
    await fallback.set("budgify-state-backup-v4", "old backup");
    const repository = new StorageRepository([backend, fallback]);
    await repository.load(createInitialState("2026-11-23"));
    expect(await backend.get("budgify-state-backup-v4")).not.toBeNull();
    await repository.reset(resetState("2026-11-23"));
    expect(await backend.get("budgify-state-backup-v4")).toBeNull();
    expect(await fallback.get("budgify-state")).toBeNull();
    expect(await fallback.get("budgify-state-backup-v4")).toBeNull();
  });

  it("reports backup removal failure without replacing the current profile", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    const initial: AppState = {
      ...createInitialState("2026-11-23"),
      hasChosenWorkspace: true,
    };
    await repository.load(initial);
    backend.failRemoves = true;
    await expect(
      repository.reset(resetState("2026-11-23")),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()).toEqual(initial);
  });

  it("does not allow a failed reset write to appear successful", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    const initial: AppState = {
      ...createInitialState("2026-11-23"),
      hasChosenWorkspace: true,
    };
    await repository.load(initial);
    backend.failWrites = true;
    await expect(
      repository.reset(resetState("2026-11-23")),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()).toEqual(initial);
  });
});
