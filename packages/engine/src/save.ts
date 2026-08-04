import Decimal from 'break_eternity.js';
import type { AchievementId, ResourceId, TierId } from '@dm/content';
import { isAchievementId, RESOURCE_IDS, TIER_IDS } from '@dm/content';
import { SAVE_VERSION } from './state.ts';
import type { GameState, TierState } from './types.ts';

export interface SaveBlob {
  saveVersion: number;
  resources: Record<string, string>;
  gens: Record<
    string,
    {
      owned: string;
      progressMs: number;
      lifetimeProduced: string;
      /** Added in save version 4. Optional because a version 3 blob does not carry it. */
      running?: boolean;
      /** Added in save version 6. Optional because a version 5 blob does not carry it. */
      purchased?: string;
    }
  >;
  souls: string;
  lifetimeEvil: string;
  stats: GameState['stats'];
  /**
   * Added in save version 2. Optional because a version 1 blob does not carry it and
   * the migration chain has to be able to describe one.
   */
  earnedAchievements?: string[];
  /** Added in save version 3. Optional for the same reason. */
  unlocked?: Record<string, boolean>;
  /** Added in save version 4. Optional for the same reason. */
  overseers?: Record<string, boolean>;
  /** Added in save version 5. Optional for the same reason. */
  smiteActiveMs?: number;
  smiteCooldownMs?: number;
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
      running: gen.running,
      purchased: gen.purchased.toString(),
    };
  }

  const unlocked: Record<string, boolean> = {};
  for (const id of TIER_IDS) unlocked[id] = state.unlocked[id];

  const overseers: Record<string, boolean> = {};
  for (const id of TIER_IDS) overseers[id] = state.overseers[id];

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: state.souls.toString(),
    lifetimeEvil: state.lifetimeEvil.toString(),
    earnedAchievements: [...state.earnedAchievements],
    unlocked,
    overseers,
    smiteActiveMs: state.smiteActiveMs,
    smiteCooldownMs: state.smiteCooldownMs,
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
      running: saved?.running ?? false,
      purchased: new Decimal(saved?.purchased ?? '0'),
    };
  }

  // Unknown ids are dropped rather than trusted. A save can hold an achievement a
  // later build retired, and the state type says every entry is a known id.
  const earnedAchievements: AchievementId[] = (migrated.earnedAchievements ?? []).filter(
    (id): id is AchievementId => isAchievementId(id),
  );

  const unlocked = {} as Record<TierId, boolean>;
  for (const id of TIER_IDS) unlocked[id] = migrated.unlocked?.[id] ?? false;

  const overseers = {} as Record<TierId, boolean>;
  for (const id of TIER_IDS) overseers[id] = migrated.overseers?.[id] ?? false;

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: new Decimal(migrated.souls),
    lifetimeEvil: new Decimal(migrated.lifetimeEvil),
    earnedAchievements,
    unlocked,
    overseers,
    smiteActiveMs: migrated.smiteActiveMs ?? 0,
    smiteCooldownMs: migrated.smiteCooldownMs ?? 0,
    stats: { ...migrated.stats },
  };
}

/**
 * One function per version step, applied in a chain. A save two versions old must
 * load, so the chain is the thing under test, not any single hop.
 *
 * **Never edit an entry in this table.** A migration that has shipped has already run
 * against saves in the wild; changing it changes what those saves become, and there
 * is no way to tell which ones already passed through the old version. Correcting a
 * mistake means appending another step, not fixing the one that made it.
 */
const MIGRATIONS: Record<number, (blob: SaveBlob) => SaveBlob> = {
  // 1 → 2: achievements arrive. Nobody had earned any, so the list starts empty.
  1: (blob) => ({ ...blob, saveVersion: 2, earnedAchievements: [] }),

  // 2 → 3: unlock flags arrive. Deriving them from owned counts matters — defaulting
  // to all-false would take the Fortress row away from a returning player who already
  // owns Fortresses. Tiers the player was merely saving toward re-latch on the next
  // `record-unlocks`, which costs them nothing.
  2: (blob) => {
    const unlocked: Record<string, boolean> = {};
    for (const id of TIER_IDS) {
      unlocked[id] = new Decimal(blob.gens[id]?.owned ?? '0').gt(0);
    }
    return { ...blob, saveVersion: 3, unlocked };
  },

  // 3 → 4: manual cycles and Overseers arrive. Nobody has appointed anybody and
  // nothing is running, so an old save stops producing until the player rouses a
  // tier. That is not a loss to work around — it is the opening spec §5.6 adds, and
  // the game is unreleased, so the only saves this touches are our own.
  3: (blob) => {
    const overseers: Record<string, boolean> = {};
    for (const id of TIER_IDS) overseers[id] = false;

    const gens: SaveBlob['gens'] = {};
    for (const [id, gen] of Object.entries(blob.gens)) {
      gens[id] = { ...gen, running: false };
    }

    return { ...blob, saveVersion: 4, gens, overseers };
  },

  // 4 → 5: the smite becomes a buff with a cooldown. Both counters start at zero, so a
  // returning player may strike at once — which is the friendly way round, and the
  // alternative would be inventing a cooldown they never earned.
  4: (blob) => ({ ...blob, saveVersion: 5, smiteActiveMs: 0, smiteCooldownMs: 0 }),

  // 5 → 6: cost keys off purchases rather than holdings. An old blob cannot say how
  // many of each tier were bought, and guessing high would leave the player at prices
  // they never earned. Zero is the honest floor: it hands back the tiers the cascade
  // had priced out, which is the whole point of the change.
  5: (blob) => {
    const gens: SaveBlob['gens'] = {};
    for (const [id, gen] of Object.entries(blob.gens)) {
      gens[id] = { ...gen, purchased: '0' };
    }
    return { ...blob, saveVersion: 6, gens };
  },
};

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
