import { describe, expect, it } from "vitest";
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
    expect(loaded.workspaces.business.income).not.toEqual([]);

    backend.failWrites = true;
    await expect(
      repository.update((state) => {
        state.userName = "Not saved";
        return state;
      }),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()?.userName).toBeNull();
    expect(repository.getState()?.isSignedIn).toBe(false);
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
      repository.update((state) => ({
        ...state,
        userName: "Alex",
        hasSignedIn: true,
        isSignedIn: true,
      })),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()?.userName).toBeNull();
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

  it.each([
    { name: "Alex", active: true },
    { name: null, active: false },
  ])(
    "migrates a legacy profile with name $name without changing its data",
    async ({ name, active }) => {
      const backend = new TestBackend("indexeddb");
      const { isSignedIn: _isSignedIn, ...legacy } =
        createInitialState("2026-11-23");
      expect(_isSignedIn).toBe(false);
      legacy.schemaVersion = 1;
      legacy.userName = name;
      legacy.hasSignedIn = true;
      legacy.workspaces.personal.income[0].source = "Saved income";
      const original = JSON.stringify({ schemaVersion: 1, data: legacy });
      await backend.set("budgify-state", original);

      const repository = new StorageRepository([backend]);
      const loaded = await repository.load(createInitialState("2026-11-23"));
      expect(loaded.userName).toBe(name);
      expect(loaded.isSignedIn).toBe(active);
      expect(loaded.hasSignedIn).toBe(true);
      expect(loaded.workspaces).toEqual(legacy.workspaces);
      expect(await backend.get("budgify-state-backup-v1")).toBe(original);
      expect(
        await new StorageRepository([backend]).load(
          createInitialState("2026-11-23"),
        ),
      ).toEqual(loaded);
    },
  );

  it("migrates schema-v2 data to light mode and round-trips the chosen theme", async () => {
    const backend = new TestBackend("indexeddb");
    const { theme: _theme, ...schemaV2 } = createInitialState("2026-11-23");
    expect(_theme).toBe("light");
    schemaV2.schemaVersion = 2;
    schemaV2.userName = "Alex";
    schemaV2.hasSignedIn = true;
    schemaV2.workspaces.personal.income[0].source = "Saved income";
    const original = JSON.stringify({ schemaVersion: 2, data: schemaV2 });
    await backend.set("budgify-state", original);

    const repository = new StorageRepository([backend]);
    const loaded = await repository.load(createInitialState("2026-11-23"));
    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.theme).toBe("light");
    expect(loaded.userName).toBe("Alex");
    expect(loaded).toMatchObject({
      hasSignedIn: true,
      isSignedIn: false,
      activeMode: schemaV2.activeMode,
      language: schemaV2.language,
      workspaces: schemaV2.workspaces,
      gameProgress: schemaV2.gameProgress,
    });
    expect(await backend.get("budgify-state-backup-v2")).toBe(original);

    await repository.update((state) => {
      state.theme = "dark";
      return state;
    });
    const restored = await new StorageRepository([backend]).load(
      createInitialState("2026-11-23"),
    );
    expect(restored.theme).toBe("dark");
    expect(restored.workspaces).toEqual(loaded.workspaces);
  });

  it("preserves a profile and its data when the session is ended and restored", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    await repository.load(createInitialState("2026-11-23"));
    await repository.update((state) => ({
      ...state,
      userName: "Alex",
      hasSignedIn: true,
      isSignedIn: true,
    }));
    await repository.update((state) => {
      state.workspaces.personal.income[0].source = "Saved income";
      state.isSignedIn = false;
      return state;
    });

    const restored = new StorageRepository([backend]);
    const signedOut = await restored.load(createInitialState("2026-11-23"));
    expect(signedOut.userName).toBe("Alex");
    expect(signedOut.isSignedIn).toBe(false);
    expect(signedOut.workspaces.personal.income[0].source).toBe("Saved income");
    const signedIn = await restored.update((state) => ({
      ...state,
      isSignedIn: true,
    }));
    expect(signedIn.workspaces).toEqual(signedOut.workspaces);
    const reset = await restored.reset(resetState("2026-11-23"));
    expect(reset.userName).toBeNull();
    expect(reset.isSignedIn).toBe(false);
    expect(reset.hasSignedIn).toBe(false);
    expect(reset.workspaces).toEqual(
      createInitialState("2026-11-23").workspaces,
    );
  });

  it("removes migration backups containing the old profile on reset", async () => {
    const backend = new TestBackend("indexeddb");
    const fallback = new TestBackend("localstorage");
    const { isSignedIn: _isSignedIn, ...legacy } =
      createInitialState("2026-11-23");
    expect(_isSignedIn).toBe(false);
    legacy.schemaVersion = 1;
    legacy.userName = "Alex";
    legacy.hasSignedIn = true;
    await backend.set(
      "budgify-state",
      JSON.stringify({ schemaVersion: 1, data: legacy }),
    );
    await fallback.set("budgify-state", "old profile");
    await fallback.set("budgify-state-backup-v1", "old backup");
    const repository = new StorageRepository([backend, fallback]);
    await repository.load(createInitialState("2026-11-23"));
    expect(await backend.get("budgify-state-backup-v1")).not.toBeNull();
    await repository.reset(resetState("2026-11-23"));
    expect(await backend.get("budgify-state-backup-v1")).toBeNull();
    expect(await fallback.get("budgify-state")).toBeNull();
    expect(await fallback.get("budgify-state-backup-v1")).toBeNull();
  });

  it("reports backup removal failure without replacing the current profile", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    const initial: AppState = {
      ...createInitialState("2026-11-23"),
      userName: "Alex",
      isSignedIn: true,
      hasSignedIn: true,
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
      userName: "Alex",
      isSignedIn: true,
      hasSignedIn: true,
    };
    await repository.load(initial);
    backend.failWrites = true;
    await expect(
      repository.reset(resetState("2026-11-23")),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()).toEqual(initial);
  });
});
