/**
 * Remembers an unfinished "List your property" form on this phone (text + photos),
 * so a seller who gets a call or closes the page can carry on later.
 * Stored only in this browser (IndexedDB); cleared after a successful submit.
 * Every call is best-effort: if storage is blocked (private mode), the form simply isn't remembered.
 */
const DB_NAME = "landfinder";
const STORE = "drafts";
const KEY = "sell";
const MAX_AGE_MS = 30 * 24 * 3600 * 1000; // forget drafts older than 30 days

export type SellDraft = {
  fields: Record<string, string>;
  state: Record<string, unknown>;
  photos: Blob[];
  savedAt: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    }).finally(() => db.close());
  } catch {
    return undefined;
  }
}

export async function loadDraft(): Promise<SellDraft | null> {
  const d = await run<SellDraft>("readonly", (s) => s.get(KEY));
  if (!d || Date.now() - d.savedAt > MAX_AGE_MS) return null;
  return d;
}

export const saveDraft = (d: Omit<SellDraft, "savedAt">) => run("readwrite", (s) => s.put({ ...d, savedAt: Date.now() }, KEY));

export const clearDraft = () => run("readwrite", (s) => s.delete(KEY));
