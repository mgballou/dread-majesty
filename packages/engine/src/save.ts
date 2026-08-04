import Decimal from 'break_eternity.js';
import type { AchievementId, OverseerId, ResourceId, TierId } from '@dm/content';
import { isAchievementId, isOverseerId, RESOURCE_IDS, TIER_IDS } from '@dm/content';
import { MIN_SUPPORTED_SAVE_VERSION, SAVE_VERSION } from './state.ts';
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
  /**
   * Added in save version 4 as a per-tier flag. Save version 6 turned it into the
   * posts filled, in content order — see `SAVE_VERSION`'s history in `state.ts`.
   */
  overseers?: Record<string, string[]>;
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

  const overseers: Record<string, string[]> = {};
  for (const id of TIER_IDS) overseers[id] = [...state.overseers[id]];

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

  // Unknown ids are dropped rather than trusted. A save can hold a post a later
  // build retired — the state type says every entry is a known id.
  const overseers = {} as Record<TierId, readonly OverseerId[]>;
  for (const id of TIER_IDS) {
    overseers[id] = (migrated.overseers?.[id] ?? []).filter((post): post is OverseerId =>
      isOverseerId(post),
    );
  }

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
    // `runMs` is spread first then re-applied with a fallback, not written as
    // `{ runMs: 0, ...migrated.stats }`: `SaveBlob['stats']` reuses `GameState['stats']`
    // wholesale, so its type already claims `runMs` is always present and tsc refuses
    // the more obvious ordering as a dead default (TS2783). A save from before this
    // field existed has no such guarantee at runtime, so the fallback still earns its
    // place.
    stats: { ...migrated.stats, runMs: migrated.stats.runMs ?? 0 },
  };
}

/**
 * One function per version step, applied in a chain.
 *
 * Empty, because `MIN_SUPPORTED_SAVE_VERSION` currently equals `SAVE_VERSION`: every
 * save this build accepts is already current. The machinery stays because version 7
 * will want it, and because the chain — not any single hop — is the thing under test.
 *
 * **Never edit an entry once it has shipped.** A migration that has run against saves
 * in the wild cannot be corrected in place; there is no way to tell which saves
 * already passed through the old version. Correcting a mistake means appending
 * another step.
 */
const MIGRATIONS: Record<number, (blob: SaveBlob) => SaveBlob> = {};

export function migrate(blob: SaveBlob): SaveBlob {
  if (blob.saveVersion < MIN_SUPPORTED_SAVE_VERSION) throw new ObsoleteSave(blob.saveVersion);

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

export class ObsoleteSave extends Error {
  constructor(readonly fromVersion: number) {
    super(
      `Save version ${fromVersion} is below the supported floor of ${MIN_SUPPORTED_SAVE_VERSION}`,
    );
    this.name = 'ObsoleteSave';
  }
}

export class CorruptSave extends Error {
  constructor() {
    super('Save data could not be read');
    this.name = 'CorruptSave';
  }
}
