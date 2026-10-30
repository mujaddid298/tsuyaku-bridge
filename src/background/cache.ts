import { openDB, IDBPDatabase } from "idb";

interface CachedTranslation {
  text: string;
  createdAt: number;
  lastUsedAt: number;
  size: number;
}

const DB_NAME = "tx-cache";
const STORE_NAME = "translations";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME);
          store.createIndex("lastUsedAt", "lastUsedAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function getCached(hash: string, ttlDays = 30): Promise<string | null> {
  try {
    const db = await getDb();
    const entry = (await db.get(STORE_NAME, hash)) as CachedTranslation | undefined;
    if (!entry) return null;

    const ageMs = Date.now() - entry.createdAt;
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) {
      await db.delete(STORE_NAME, hash);
      return null;
    }

    // Update lastUsedAt
    entry.lastUsedAt = Date.now();
    await db.put(STORE_NAME, entry, hash);
    return entry.text;
  } catch {
    return null;
  }
}

export async function setCached(hash: string, text: string): Promise<void> {
  try {
    const db = await getDb();
    const now = Date.now();
    const entry: CachedTranslation = {
      text,
      createdAt: now,
      lastUsedAt: now,
      size: text.length,
    };
    await db.put(STORE_NAME, entry, hash);
  } catch {
    // Fail silently on cache write error
  }
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}

export async function getCacheStats(): Promise<{ count: number; totalChars: number }> {
  try {
    const db = await getDb();
    const all = (await db.getAll(STORE_NAME)) as CachedTranslation[];
    const totalChars = all.reduce((sum, item) => sum + (item.size || 0), 0);
    return { count: all.length, totalChars };
  } catch {
    return { count: 0, totalChars: 0 };
  }
}
