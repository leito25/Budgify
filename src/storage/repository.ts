import { LocalStorageBackend, MemoryStorageBackend } from "./fallback";
import { IndexedDbStorageBackend } from "./db";
import { CURRENT_SCHEMA_VERSION, type AppState } from "./model";

export type StorageMode = "indexeddb" | "localstorage" | "memory";

export interface StorageBackend {
  readonly mode: StorageMode;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

type Migration = (data: unknown) => unknown;

export class StorageWriteError extends Error {
  constructor(message = "App data could not be saved.") {
    super(message);
    this.name = "StorageWriteError";
  }
}

export class RecoveryRequiredError extends Error {
  constructor(message = "Saved data needs recovery before it can be used.") {
    super(message);
    this.name = "RecoveryRequiredError";
  }
}

interface StoredEnvelope {
  schemaVersion: number;
  data: AppState;
}

export interface BrowserRepositorySetup {
  repository: StorageRepository;
  warnings: string[];
}

const STORAGE_KEY = "budgify-state";
function isLegacyAppState(
  value: unknown,
): value is Omit<AppState, "isSignedIn"> {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<Omit<AppState, "isSignedIn">>;
  return (
    typeof state.schemaVersion === "number" &&
    (state.userName === null || typeof state.userName === "string") &&
    typeof state.hasSignedIn === "boolean" &&
    (state.activeMode === "personal" || state.activeMode === "business") &&
    (state.language === "en" || state.language === "es") &&
    typeof state.workspaces === "object" &&
    state.workspaces !== null
  );
}

function isAppState(value: unknown): value is AppState {
  if (!isLegacyAppState(value) || !("isSignedIn" in value)) return false;
  return (
    typeof value.isSignedIn === "boolean" &&
    (value.theme === "light" || value.theme === "dark") &&
    (!value.isSignedIn ||
      (typeof value.userName === "string" && value.userName.trim().length > 0))
  );
}

const defaultMigrations: Record<number, Migration> = {
  1: (data) => {
    if (!isLegacyAppState(data))
      throw new Error("Legacy app data has an invalid structure.");
    return {
      ...data,
      isSignedIn:
        typeof data.userName === "string" && data.userName.trim().length > 0,
    };
  },
  2: (data) => {
    if (!isLegacyAppState(data))
      throw new Error("Legacy app data has an invalid structure.");
    return { ...data, theme: "light" };
  },
};

function encode(state: AppState): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: state,
  } satisfies StoredEnvelope);
}

export class StorageRepository {
  readonly warnings: string[] = [];
  private activeBackend: StorageBackend | undefined;
  private state: AppState | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly backends: StorageBackend[],
    private readonly key = STORAGE_KEY,
  ) {
    if (backends.length === 0)
      throw new RangeError("At least one storage backend is required.");
  }

  get mode(): StorageMode {
    return this.activeBackend?.mode ?? "memory";
  }

  getState(): AppState | undefined {
    return this.state;
  }

  async load(
    initialState: AppState,
    migrations: Record<number, Migration> = {},
  ): Promise<AppState> {
    for (const backend of this.backends) {
      let raw: string | null;
      try {
        raw = await backend.get(this.key);
      } catch (error) {
        this.warnings.push(`${backend.mode}: ${errorMessage(error)}`);
        continue;
      }
      if (raw === null) continue;
      this.activeBackend = backend;

      let envelope: unknown;
      try {
        envelope = JSON.parse(raw);
      } catch {
        throw new RecoveryRequiredError(
          "Saved app data is not valid JSON. Export or reset before continuing.",
        );
      }
      if (typeof envelope !== "object" || envelope === null) {
        throw new RecoveryRequiredError(
          "Saved app data has an invalid structure.",
        );
      }
      const record = envelope as Partial<StoredEnvelope>;
      const storedVersion = record.schemaVersion;
      if (
        typeof storedVersion !== "number" ||
        !Number.isSafeInteger(storedVersion) ||
        typeof record.data !== "object" ||
        record.data === null
      ) {
        throw new RecoveryRequiredError(
          "Saved app data has an invalid schema.",
        );
      }
      if (storedVersion > CURRENT_SCHEMA_VERSION) {
        throw new RecoveryRequiredError(
          "Saved app data was created by a newer version.",
        );
      }

      const data: unknown =
        storedVersion < CURRENT_SCHEMA_VERSION
          ? await this.migrate(
              backend,
              raw,
              record.data,
              storedVersion,
              migrations,
            )
          : record.data;
      if (!isAppState(data)) {
        throw new RecoveryRequiredError(
          "Saved app data does not match the expected structure.",
        );
      }
      this.activeBackend = backend;
      this.state = data;
      return data;
    }

    await this.persist(initialState);
    return this.state as AppState;
  }

  private async migrate(
    backend: StorageBackend,
    raw: string,
    initialData: unknown,
    storedVersion: number,
    migrations: Record<number, Migration>,
  ): Promise<AppState> {
    const backupKey = `${this.key}-backup-v${storedVersion}`;
    try {
      await backend.set(backupKey, raw);
    } catch (error) {
      throw new RecoveryRequiredError(
        `Could not create migration backup: ${errorMessage(error)}`,
      );
    }
    try {
      let data = initialData;
      let version = storedVersion;
      while (version < CURRENT_SCHEMA_VERSION) {
        const migration = migrations[version] ?? defaultMigrations[version];
        if (!migration)
          throw new Error(`No migration is defined for schema ${version}.`);
        data = migration(data);
        version += 1;
      }
      if (!isAppState(data))
        throw new Error("Migration produced invalid app data.");
      data.schemaVersion = CURRENT_SCHEMA_VERSION;
      await backend.set(this.key, encode(data));
      return data;
    } catch (error) {
      throw new RecoveryRequiredError(
        `Migration failed. A backup is available as ${backupKey}. ${errorMessage(error)}`,
      );
    }
  }

  async update(
    updateState: (current: AppState) => AppState,
  ): Promise<AppState> {
    return this.enqueueWrite(async () => {
      if (!this.state)
        throw new Error("Load the repository before writing app state.");
      const workingCopy = JSON.parse(JSON.stringify(this.state)) as AppState;
      const nextState = updateState(workingCopy);
      nextState.schemaVersion = CURRENT_SCHEMA_VERSION;
      await this.persist(nextState);
      return nextState;
    });
  }

  async reset(initialState: AppState): Promise<AppState> {
    return this.enqueueWrite(async () => {
      try {
        for (const backend of this.backends) {
          for (
            let version = 0;
            version < CURRENT_SCHEMA_VERSION;
            version += 1
          ) {
            await backend.remove(`${this.key}-backup-v${version}`);
          }
          if (backend !== this.activeBackend) await backend.remove(this.key);
        }
      } catch (error) {
        throw new StorageWriteError(
          `Could not clear previous app data: ${errorMessage(error)}`,
        );
      }
      await this.persist(initialState);
      return initialState;
    });
  }

  private enqueueWrite(operation: () => Promise<AppState>): Promise<AppState> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async persist(nextState: AppState): Promise<void> {
    const serialized = encode(nextState);
    let lastError: unknown;
    const backends = this.activeBackend ? [this.activeBackend] : this.backends;
    for (const backend of backends) {
      try {
        await backend.set(this.key, serialized);
        this.activeBackend = backend;
        this.state = nextState;
        return;
      } catch (error) {
        lastError = error;
        this.warnings.push(`${backend.mode}: ${errorMessage(error)}`);
      }
    }
    throw new StorageWriteError(
      lastError ? errorMessage(lastError) : undefined,
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createBrowserRepository(): Promise<BrowserRepositorySetup> {
  const backends: StorageBackend[] = [];
  const warnings: string[] = [];
  try {
    backends.push(await IndexedDbStorageBackend.open());
  } catch (error) {
    warnings.push(`IndexedDB unavailable: ${errorMessage(error)}`);
  }

  try {
    const storage = globalThis.localStorage;
    const backend = new LocalStorageBackend(storage);
    const probe = "budgify-storage-probe";
    await backend.set(probe, "ok");
    await backend.remove(probe);
    backends.push(backend);
  } catch (error) {
    warnings.push(`localStorage unavailable: ${errorMessage(error)}`);
  }
  backends.push(new MemoryStorageBackend());

  const repository = new StorageRepository(backends);
  repository.warnings.push(...warnings);
  return { repository, warnings };
}
