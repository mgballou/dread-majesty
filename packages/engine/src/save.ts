import Decimal from 'break_eternity.js';
import type { ResourceId, TierId } from '@dm/content';
import { RESOURCE_IDS, TIER_IDS } from '@dm/content';
import { SAVE_VERSION } from './state.ts';
import type { GameState, TierState } from './types.ts';

export interface SaveBlob {
  saveVersion: number;
  resources: Record<string, string>;
  gens: Record<string, { owned: string; progressMs: number; lifetimeProduced: string }>;
  souls: string;
  lifetimeEvil: string;
  stats: GameState['stats'];
  /** Server time when the meta-plane exists; client time until then. */
  savedAtMs: number;
}

export function serialize(state: GameState, savedAtMs: number): SaveBlob {
  const resources: Record<string, string> = {};
  for (const id of RESOURCE_IDS) resources[id] = state.resources[id].toString();

  const gens: SaveBlob['gens'] = {};
  for (const id of TIER_IDS) {
    const gen = state.gens[id];
    gens[id] = {
      owned: gen.owned.toString(),
      progressMs: gen.progressMs,
      lifetimeProduced: gen.lifetimeProduced.toString(),
    };
  }

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: state.souls.toString(),
    lifetimeEvil: state.lifetimeEvil.toString(),
    stats: { ...state.stats },
    savedAtMs,
  };
}

export function deserialize(blob: SaveBlob): GameState {
  const migrated = migrate(blob);

  const resources = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) resources[id] = new Decimal(migrated.resources[id] ?? '0');

  const gens = {} as Record<TierId, TierState>;
  for (const id of TIER_IDS) {
    const saved = migrated.gens[id];
    gens[id] = {
      owned: new Decimal(saved?.owned ?? '0'),
      progressMs: saved?.progressMs ?? 0,
      lifetimeProduced: new Decimal(saved?.lifetimeProduced ?? '0'),
    };
  }

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: new Decimal(migrated.souls),
    lifetimeEvil: new Decimal(migrated.lifetimeEvil),
    stats: { ...migrated.stats },
  };
}

/**
 * One function per version step, applied in a chain. A save two versions old must
 * load. Never edit an existing migration — add another.
 */
const MIGRATIONS: Record<number, (blob: SaveBlob) => SaveBlob> = {};

export function migrate(blob: SaveBlob): SaveBlob {
  let current = blob;
  while (current.saveVersion < SAVE_VERSION) {
    const next = MIGRATIONS[current.saveVersion];
    if (!next) throw new UnmigratableSave(current.saveVersion);
    current = next(current);
  }
  return current;
}

/** The pasteable blob. Doubles as the bug-report format. */
export function exportSave(state: GameState, savedAtMs: number): string {
  return btoa(JSON.stringify(serialize(state, savedAtMs)));
}

export function importSave(encoded: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(encoded));
  } catch {
    throw new CorruptSave();
  }
  if (!isSaveBlob(parsed)) throw new CorruptSave();
  return deserialize(parsed);
}

function isSaveBlob(value: unknown): value is SaveBlob {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SaveBlob>;
  return (
    typeof candidate.saveVersion === 'number' &&
    typeof candidate.resources === 'object' &&
    typeof candidate.gens === 'object'
  );
}

export class UnmigratableSave extends Error {
  constructor(readonly fromVersion: number) {
    super(`No migration from save version ${fromVersion} to ${SAVE_VERSION}`);
    this.name = 'UnmigratableSave';
  }
}

export class CorruptSave extends Error {
  constructor() {
    super('Save data could not be read');
    this.name = 'CorruptSave';
  }
}
