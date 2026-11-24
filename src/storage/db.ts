import type { StorageBackend } from "./repository";

const STORE_NAME = "records";

export class IndexedDbStorageBackend implements StorageBackend {
  readonly mode = "indexeddb" as const;

  private constructor(private readonly database: IDBDatabase) {}

  static open(databaseName = "budgify"): Promise<IndexedDbStorageBackend> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is unavailable."));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () =>
        resolve(new IndexedDbStorageBackend(request.result));
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open IndexedDB."));
      request.onblocked = () =>
        reject(new Error("IndexedDB upgrade is blocked by another tab."));
    });
  }

  get(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = this.database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(key);
      request.onsuccess = () =>
        resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not read IndexedDB."));
    });
  }

  set(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not write IndexedDB."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB write was aborted."));
    });
  }

  remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Could not remove IndexedDB data."),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("IndexedDB removal was aborted."),
        );
    });
  }
}
