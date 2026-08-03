import type { SaveBlob } from '@dm/engine';

const DB_NAME = 'dread-majesty';
const DB_VERSION = 1;
const STORE = 'saves';
const SLOT = 'current';

/**
 * The save store.
 *
 * IndexedDB rather than localStorage: localStorage caps around 5MB, blocks the main
 * thread on every write, and this game autosaves while a frame loop is running.
 *
 * Every function here resolves rather than throws on an absent or unusable
 * database. A browser in private mode with storage denied is an expected absence,
 * not an error — the game must stay playable with persistence missing, it just
 * forgets. Callers get `null` and carry on.
 */
export async function readSave(): Promise<SaveBlob | null> {
  const db = await open();
  if (!db) return null;

  try {
    return await request<SaveBlob | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(SLOT),
    ).then((value) => value ?? null);
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function writeSave(blob: SaveBlob): Promise<boolean> {
  const db = await open();
  if (!db) return false;

  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, SLOT));
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export async function clearSave(): Promise<boolean> {
  const db = await open();
  if (!db) return false;

  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(SLOT));
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let opening: IDBOpenDBRequest;
    try {
      opening = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) {
        opening.result.createObjectStore(STORE);
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => resolve(null);
    opening.onblocked = () => resolve(null);
  });
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}
