import Decimal from 'break_eternity.js';
import type { AchievementId, OverseerId, ResourceId, SmiteUpgradeId, TierId } from '@dm/content';
import {
  isAchievementId,
  isOverseerId,
  RESOURCE_IDS,
  SMITE_UPGRADE_IDS,
  TIER_IDS,
} from '@dm/content';
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
  /** Added in save version 8. Optional because a version 7 blob does not carry it. */
  smiteApathy?: number;
  smiteBlow?: number;
  smiteRungs?: Record<string, number>;
  smiteKept?: Record<string, number>;
  soulsSpent?: string;
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

  const smiteRungs: Record<string, number> = {};
  const smiteKept: Record<string, number> = {};
  for (const id of SMITE_UPGRADE_IDS) {
    smiteRungs[id] = state.smiteRungs[id];
    smiteKept[id] = state.smiteKept[id];
  }

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
    smiteApathy: state.smiteApathy,
    smiteBlow: state.smiteBlow,
    smiteRungs,
    smiteKept,
    soulsSpent: state.soulsSpent.toString(),
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

  // Unknown ids are dropped rather than trusted, and a missing one reads as the bottom
  // of its ladder — the same policy the achievement and roster lists follow above.
  const smiteRungs = {} as Record<SmiteUpgradeId, number>;
  const smiteKept = {} as Record<SmiteUpgradeId, number>;
  for (const id of SMITE_UPGRADE_IDS) {
    const rung = migrated.smiteRungs?.[id] ?? 0;
    const kept = migrated.smiteKept?.[id] ?? 0;
    // Trust the lower privilege. `smiteKept <= smiteRungs` is an invariant the whole
    // engine reads without checking, and a hand-edited blob is the one place it can
    // arrive violated — so the floor comes down to the rung rather than the rung being
    // granted up to the floor.
    smiteRungs[id] = rung;
    smiteKept[id] = Math.min(rung, kept);
  }

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: new Decimal(migrated.souls),
    soulsSpent: new Decimal(migrated.soulsSpent ?? '0'),
    lifetimeEvil: new Decimal(migrated.lifetimeEvil),
    earnedAchievements,
    unlocked,
    overseers,
    smiteActiveMs: migrated.smiteActiveMs ?? 0,
    smiteCooldownMs: migrated.smiteCooldownMs ?? 0,
    smiteApathy: migrated.smiteApathy ?? 0,
    smiteBlow: migrated.smiteBlow ?? 1,
    smiteRungs,
    smiteKept,
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
 * **Never edit an entry once it has shipped.** A migration that has run against saves
 * in the wild cannot be corrected in place; there is no way to tell which saves
 * already passed through the old version. Correcting a mistake means appending
 * another step.
 */
const MIGRATIONS: Record<number, (blob: SaveBlob) => SaveBlob> = {
  // 6 → 7: the per-run clock arrives. Zero is the honest default — a save written
  // before this field existed cannot say when its run began, and "as if freshly
  // reset" costs the player nothing but a short reading on the prestige panel.
  6: (blob) => ({
    ...blob,
    saveVersion: 7,
    stats: { ...blob.stats, runMs: blob.stats.runMs ?? 0 },
  }),
  // 7 → 8: Apathy, the two ladder counters and the souls spent on permanence arrive.
  // Every default is the game a version 7 save was already playing — no Apathy, a blow
  // worth its base, every ladder at rung 0 and nothing spent. `deserialize` supplies
  // them, so this step only moves the number.
  7: (blob) => ({ ...blob, saveVersion: 8 }),
  // 8 → 9: souls are re-denominated. The old curve paid `150·√(lifetime/1.14e14)` and
  // each soul was worth 2%; the new one pays `600·(lifetime/5.07e9)^0.055` at a tenth
  // of a percent. `lifetimeEvil` survives every reset, so the new total is not
  // converted from the old count at all — it is recomputed from the Evil that earned
  // it, which is exact where a rescale of the count would not be.
  //
  // `soulsSpent` cannot be recomputed by re-pricing `smiteKept` at the new Keep
  // prices. The new prices hold a fixed three-hour share of the new curve, and a
  // save recovers whatever `lifetimeEvil` it has actually earned — for anyone who
  // reset later than three hours in, or reset more than once, the new bank can be
  // smaller than a full ladder's new price, and the charge wipes them. What the old
  // blob does carry exactly is the *fraction* of their souls the player had already
  // spent, and that fraction is a property of their play, not of either curve's
  // prices — so it is what survives the re-denomination. `spent` is floored before
  // `souls` is taken by subtraction, so `souls + soulsSpent` lands on exactly
  // `floor(earned)`, not on something a hair off it.
  //
  // Every constant here is inlined and frozen. The engine may not import balance
  // data, and a shipped migration must not drift when the content is next retuned.
  // Reading no price table at all is what makes that true: there is nothing here for
  // the next repricing to leave stale.
  8: (blob) => {
    const earned = new Decimal(blob.lifetimeEvil).div(new Decimal('5.07e9')).pow(0.055).mul(600);
    const oldHeld = new Decimal(blob.souls || '0');
    const oldSpent = new Decimal(blob.soulsSpent || '0');
    const oldTotal = oldHeld.add(oldSpent);

    const spent = oldTotal.lte(0) ? new Decimal(0) : oldSpent.div(oldTotal).mul(earned).floor();
    const souls = Decimal.max(0, earned.floor().sub(spent));

    return {
      ...blob,
      saveVersion: 9,
      souls: souls.toString(),
      soulsSpent: spent.toString(),
    };
  },
};

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
