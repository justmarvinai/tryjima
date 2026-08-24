// Minimal IndexedDB blob store for user images. Keeps binary out of
// localStorage (which is string-only and small). Everything stays on-device.

const DB_NAME = "jima";
const STORE = "blobs";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onblocked = () => reject(new Error("indexedDB open blocked"));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("indexedDB tx failed"));
      // On abort (e.g. quota exceeded) `oncomplete` never fires; reject so the
      // caller can handle it, and always close the connection in `finally`.
      t.onabort = () => reject(t.error ?? new Error("indexedDB tx aborted"));
    });
  } finally {
    db.close();
  }
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await tx("readwrite", (s) => s.put(blob, key));
}

export async function getBlob(key: string): Promise<Blob | null> {
  const result = await tx<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
  return result ?? null;
}

export async function deleteBlob(key: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(key));
}

export async function clearBlobs(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
