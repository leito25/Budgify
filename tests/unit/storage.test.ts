import { describe, expect, it } from "vitest";
import {
  RecoveryRequiredError,
  StorageRepository,
  StorageWriteError,
  type StorageBackend,
} from "../../src/storage/repository";
import { MemoryStorageBackend } from "../../src/storage/fallback";
import { createInitialState } from "../../src/storage/seed";
import type { AppState } from "../../src/storage/model";

class TestBackend implements StorageBackend {
  private readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;
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
    this.values.delete(key);
  }
}

describe("storage repository", () => {
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
    await expect(repository.update((state) => {
      state.userName = "Not saved";
      return state;
    })).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()?.userName).toBeNull();
  });

  it("falls back to localStorage and then memory when a backend fails", async () => {
    const broken = new TestBackend("indexeddb");
    broken.failWrites = true;
    const local = new TestBackend("localstorage");
    const memory = new MemoryStorageBackend();
    const repository = new StorageRepository([broken, local, memory]);
    await repository.load(createInitialState("2026-11-23"));
    expect(repository.mode).toBe("localstorage");

    local.failWrites = true;
    await repository.update((state) => ({ ...state, userName: "Alex" }));
    expect(repository.mode).toBe("memory");
    expect(repository.getState()?.userName).toBe("Alex");
    expect(repository.warnings.length).toBeGreaterThan(0);
  });

  it("backs up an old schema before migrating and preserves it when migration fails", async () => {
    const backend = new TestBackend("indexeddb");
    const oldState = createInitialState("2026-11-23");
    const original = JSON.stringify({ schemaVersion: 0, data: oldState });
    await backend.set("budgify-state", original);
    const repository = new StorageRepository([backend]);

    await expect(repository.load(oldState)).rejects.toBeInstanceOf(RecoveryRequiredError);
    expect(await backend.get("budgify-state")).toBe(original);
    expect(await backend.get("budgify-state-backup-v0")).toBe(original);
  });

  it("does not allow a failed reset write to appear successful", async () => {
    const backend = new TestBackend("indexeddb");
    const repository = new StorageRepository([backend]);
    const initial: AppState = createInitialState("2026-11-23");
    await repository.load(initial);
    backend.failWrites = true;
    await expect(repository.reset(createInitialState("2026-11-23"))).rejects.toBeInstanceOf(StorageWriteError);
    expect(repository.getState()).toEqual(initial);
  });
});
