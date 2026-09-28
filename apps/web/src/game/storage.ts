import type { SaveBlob } from '@dm/engine';

const DB_NAME = 'dread-majesty';
const DB_VERSION = 1;
const STORE = 'saves';
const SLOT = 'current';

/**
 * Where a save the game could not read is put before anything writes over it.
 *
 * One slot, not a list. It exists so a damaged save is not destroyed ten seconds after
 * the game fails to load it — the next autosave would otherwise take the only copy —
 * and one copy is enough for that. A later unreadable save replaces an earlier one.
 */
const KEPT_SLOT = 'unreadable';

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
  return get<SaveBlob>(SLOT);
}

export async function writeSave(blob: SaveBlob): Promise<boolean> {
  return put(blob, SLOT);
}

export async function clearSave(): Promise<boolean> {
  return remove(SLOT);
}

/**
 * Sets aside whatever was in the save slot, as it was read.
 *
 * `unknown` because the data is kept precisely when it failed to be a save.
 */
export async function keepUnreadableSave(blob: unknown): Promise<boolean> {
  return put(blob, KEPT_SLOT);
}

export async function readKeptSave(): Promise<unknown> {
  return get<unknown>(KEPT_SLOT);
}

export async function clearKeptSave(): Promise<boolean> {
  return remove(KEPT_SLOT);
}

async function get<T>(key: string): Promise<T | null> {
  const db = await open();
  if (!db) return null;

  try {
    return await request<T | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(key),
    ).then((value) => value ?? null);
  } catch {
    return null;
  } finally {
    db.close();
  }
}

async function put(value: unknown, key: string): Promise<boolean> {
  const db = await open();
  if (!db) return false;

  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key));
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

async function remove(key: string): Promise<boolean> {
  const db = await open();
  if (!db) return false;

  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key));
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
