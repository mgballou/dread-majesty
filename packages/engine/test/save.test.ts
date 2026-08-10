import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import {
  apply,
  CorruptSave,
  createState,
  deserialize,
  exportSave,
  globalMultiplier,
  importSave,
  MIN_SUPPORTED_SAVE_VERSION,
  ObsoleteSave,
  SAVE_VERSION,
  serialize,
  step,
  migrate,
} from '../src/index.ts';
import type { SaveBlob } from '../src/index.ts';
import { SMITE_UPGRADE_IDS } from '@dm/content';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';
import type { GameState } from '../src/types.ts';

/**
 * A real save version 6 blob, hand-frozen rather than built from `serialize`.
 *
 * Migration tests must never be generated from current code: a blob built by
 * today's `serialize` carries today's fields, so migrating it proves nothing about
 * whether the chain can still read what a version 6 build actually wrote — it only
 * proves the current code accepts its own output. This is the shape a version 6
 * build actually wrote: every field that version carried (`purchased` and the
 * roster-as-posts-filled `overseers`, both added at 6), none that version 7 added
 * (`stats.runMs`). It must never be regenerated from `serialize`, or it stops being
 * anything but a second copy of the tests it exists to check.
 */
const FROZEN_V6_BLOB: SaveBlob = {
  saveVersion: 6,
  resources: { evil: '4200' },
  gens: {
    throne: { owned: '0', progressMs: 0, lifetimeProduced: '0', running: false, purchased: '0' },
    fortress: {
      owned: '0',
      progressMs: 0,
      lifetimeProduced: '0',
      running: false,
      purchased: '0',
    },
    legion: { owned: '0', progressMs: 0, lifetimeProduced: '0', running: false, purchased: '0' },
    warren: {
      owned: '7',
      progressMs: 12_000,
      lifetimeProduced: '350',
      running: false,
      purchased: '7',
    },
    minion: {
      owned: '205',
      progressMs: 4_000,
      lifetimeProduced: '4875',
      running: true,
      purchased: '200',
    },
  },
  souls: '0',
  lifetimeEvil: '4875',
  // A version 6 blob predates `runMs`; `SaveBlob['stats']` reuses `GameState['stats']`
  // wholesale, so the type has no way to describe the missing field on its own.
  stats: { playTimeMs: 120_000, smites: 1, prestiges: 0 } as GameState['stats'],
  earnedAchievements: ['smite-1'],
  unlocked: { throne: false, fortress: false, legion: false, warren: true, minion: true },
  overseers: {
    throne: [],
    fortress: [],
    legion: [],
    warren: ['warren-hand'],
    minion: ['minion-hand'],
  },
  smiteActiveMs: 0,
  smiteCooldownMs: 45_000,
  savedAtMs: 0,
};

/**
 * A real save version 7 blob, hand-frozen rather than built from `serialize`.
 *
 * The four "starts a migrated save with…" tests below exist to prove the version 8
 * defaults in `deserialize`'s `??` fallbacks actually fire on a save that predates
 * them. A blob built as `{ ...serialize(createState(fixture), 0), saveVersion: 7 }`
 * cannot do that: `serialize` always writes every version 8 field, so a "version 7"
 * blob built that way already carries `smiteApathy`, `smiteBlow`, `smiteRungs`,
 * `smiteKept` and `soulsSpent` from `createState`'s own defaults — the tests would
 * pass even if every fallback were deleted. This is the shape a version 7 build
 * actually wrote: every field up through the per-run clock (added at 7), none of the
 * five version 8 added. It must never be regenerated from `serialize`.
 */
const FROZEN_V7_BLOB: SaveBlob = {
  saveVersion: 7,
  resources: { evil: '4200' },
  gens: {
    throne: { owned: '0', progressMs: 0, lifetimeProduced: '0', running: false, purchased: '0' },
    fortress: {
      owned: '0',
      progressMs: 0,
      lifetimeProduced: '0',
      running: false,
      purchased: '0',
    },
    legion: { owned: '0', progressMs: 0, lifetimeProduced: '0', running: false, purchased: '0' },
    warren: {
      owned: '7',
      progressMs: 12_000,
      lifetimeProduced: '350',
      running: false,
      purchased: '7',
    },
    minion: {
      owned: '205',
      progressMs: 4_000,
      lifetimeProduced: '4875',
      running: true,
      purchased: '200',
    },
  },
  souls: '0',
  lifetimeEvil: '4875',
  stats: { playTimeMs: 120_000, smites: 1, prestiges: 0, runMs: 60_000 },
  earnedAchievements: ['smite-1'],
  unlocked: { throne: false, fortress: false, legion: false, warren: true, minion: true },
  overseers: {
    throne: [],
    fortress: [],
    legion: [],
    warren: ['warren-hand'],
    minion: ['minion-hand'],
  },
  smiteActiveMs: 0,
  smiteCooldownMs: 45_000,
  savedAtMs: 0,
};

describe('save round trip', () => {
  it('restores state exactly', () => {
    const original = appointed(fixture);
    original.gens.minion.owned = new Decimal('1e40');
    original.gens.warren.owned = new Decimal(7);
    original.souls = new Decimal(31);
    step(original, fixture, 100);

    const restored = importSave(exportSave(original, 0));

    expect(restored.gens.minion.owned.toString()).toBe(original.gens.minion.owned.toString());
    expect(restored.gens.warren.owned.toString()).toBe(original.gens.warren.owned.toString());
    expect(restored.souls.toString()).toBe(original.souls.toString());
    expect(restored.resources.evil.toString()).toBe(original.resources.evil.toString());
  });

  it('preserves cycle progress, so reloading cannot farm cycles', () => {
    const original = appointed(fixture);
    step(original, fixture, 10_000);

    const restored = importSave(exportSave(original, 0));

    expect(restored.gens.minion.progressMs).toBe(original.gens.minion.progressMs);
  });

  it('restores earned achievements', () => {
    const original = createState(fixture);
    original.stats.smites = 1;
    apply(original, fixture, { kind: 'record-achievements' });

    const restored = importSave(exportSave(original, 0));

    expect(restored.earnedAchievements).toEqual(['smite-1']);
  });

  it('restores unlock flags', () => {
    const original = createState(fixture);
    original.resources.evil = new Decimal(750);
    apply(original, fixture, { kind: 'record-unlocks' });

    const restored = importSave(exportSave(original, 0));

    expect(restored.unlocked.warren).toBe(true);
  });

  it('restores appointed Overseers', () => {
    const original = createState(fixture);
    original.resources.evil = new Decimal(400);
    apply(original, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    const restored = importSave(exportSave(original, 0));

    expect(restored.overseers.minion).toEqual(['minion-hand']);
  });

  it('leaves an unappointed tier unappointed', () => {
    const original = createState(fixture);

    const restored = importSave(exportSave(original, 0));

    expect(restored.overseers.warren).toEqual([]);
  });

  it('round-trips a part-filled roster', () => {
    const state = appointed(fixture);
    state.overseers.minion = ['minion-hand', 'minion-glut'];

    const restored = deserialize(serialize(state, 0));

    expect(restored.overseers.minion).toEqual(['minion-hand', 'minion-glut']);
  });

  it('drops a post the running content no longer knows', () => {
    const state = appointed(fixture);
    const blob = serialize(state, 0);
    blob.overseers = { minion: ['minion-hand', 'not-a-post'] };

    expect(deserialize(blob).overseers.minion).toEqual(['minion-hand']);
  });

  it('restores a manual cycle that was still turning', () => {
    const original = createState(fixture);
    apply(original, fixture, { kind: 'rouse', tierId: 'minion' });

    const restored = importSave(exportSave(original, 0));

    expect(restored.gens.minion.running).toBe(true);
  });

  it('leaves a stopped tier stopped', () => {
    const original = createState(fixture);

    const restored = importSave(exportSave(original, 0));

    expect(restored.gens.minion.running).toBe(false);
  });

  it('loses nothing at all', () => {
    const original = appointed(fixture);
    original.gens.minion.owned = new Decimal('1e40');
    original.overseers.warren = [];
    original.gens.warren.running = true;
    step(original, fixture, 300);

    const restored = importSave(exportSave(original, 0));

    expect(serialize(restored, 0)).toEqual(serialize(original, 0));
  });

  it('round-trips purchased counts', () => {
    const state = appointed(fixture);
    state.gens.minion.purchased = new Decimal('12345');

    const restored = deserialize(serialize(state, 0));

    expect(restored.gens.minion.purchased.toString()).toBe('12345');
  });

  it('rejects a blob that is not a save', () => {
    expect(() => importSave('not base64 at all !!')).toThrow(CorruptSave);
    expect(() => importSave(btoa('{"nope":true}'))).toThrow(CorruptSave);
  });
});

describe('the version floor', () => {
  it('refuses a save below the supported floor', () => {
    const state = appointed(fixture);
    const blob = { ...serialize(state, 0), saveVersion: MIN_SUPPORTED_SAVE_VERSION - 1 };

    expect(() => deserialize(blob)).toThrow(ObsoleteSave);
  });

  it('loads a save at the supported floor', () => {
    expect(deserialize(FROZEN_V6_BLOB).saveVersion).toBe(SAVE_VERSION);
  });

  it('names the version it refused', () => {
    const state = appointed(fixture);
    const blob = { ...serialize(state, 0), saveVersion: 2 };

    expect(() => deserialize(blob)).toThrow(/version 2/);
  });

  it('passes a current save through untouched', () => {
    const blob = serialize(appointed(fixture), 0);

    expect(migrate(blob)).toEqual(blob);
  });

  it('migrates a version 6 save without a run clock to 0', () => {
    const migrated = migrate(FROZEN_V6_BLOB);

    expect(migrated.stats.runMs).toBe(0);
  });

  it('keeps a version 6 save that already carries a run clock', () => {
    // `runMs` did not exist at version 6; a build that had already migrated a save
    // forward once and re-saved it before version 7 shipped is not a real case, but
    // the migration step still has to leave a present value alone rather than
    // clobber it, so this constructs the one shape that checks that.
    const legacy = {
      ...FROZEN_V6_BLOB,
      stats: { ...FROZEN_V6_BLOB.stats, runMs: 900_000 } as GameState['stats'],
    };

    const migrated = migrate(legacy);

    expect(migrated.stats.runMs).toBe(900_000);
  });

  it('still refuses a save below the floor once the chain has a live step', () => {
    const blob = {
      ...serialize(appointed(fixture), 0),
      saveVersion: MIN_SUPPORTED_SAVE_VERSION - 1,
    };

    expect(() => deserialize(blob)).toThrow(ObsoleteSave);
  });
});

describe('save version 8', () => {
  it('migrates a version 7 blob', () => {
    // `migrate` always runs the full chain to `SAVE_VERSION`, not one step, so a
    // version 7 blob lands at the current version rather than stopping at 8.
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };

    expect(migrate(blob).saveVersion).toBe(SAVE_VERSION);
  });

  it('starts a migrated save with no apathy', () => {
    expect(deserialize(FROZEN_V7_BLOB).smiteApathy).toBe(0);
  });

  it('starts a migrated save with a blow worth nothing extra', () => {
    expect(deserialize(FROZEN_V7_BLOB).smiteBlow).toBe(1);
  });

  it('starts a migrated save at the bottom of every ladder', () => {
    const state = deserialize(FROZEN_V7_BLOB);

    expect(SMITE_UPGRADE_IDS.map((id) => state.smiteRungs[id])).toEqual([0, 0, 0, 0]);
  });

  it('starts a migrated save having spent no souls', () => {
    expect(deserialize(FROZEN_V7_BLOB).soulsSpent.eq(0)).toBe(true);
  });

  it('round-trips the rungs it was given', () => {
    const state = createState(fixture);
    state.smiteRungs.weight = 2;
    state.smiteKept.weight = 1;

    expect(deserialize(serialize(state, 0)).smiteKept.weight).toBe(1);
  });

  it('trusts the lower privilege when a blob claims a kept floor above its rung', () => {
    const state = createState(fixture);
    const blob = serialize(state, 0);
    blob.smiteRungs = { weight: 0 };
    blob.smiteKept = { weight: 4 };

    expect(deserialize(blob).smiteRungs.weight).toBe(0);
  });
});

describe('migrating souls to the 2026-08-08 denomination', () => {
  // A real playtest save: 31,630 souls under the old curve, which recovers a
  // lifetime Evil of ~5.07e18. The new curve pays 600·((5.07e18/5.07e9)^0.055 − 1),
  // which floors to 1275 — verified directly against `break_eternity.js`, not
  // estimated. The blob is stamped version 8, so it walks both steps: 8 → 9 mints
  // the un-offset count, 9 → 10 corrects it. Only the end state is asserted, which
  // is the only thing a loaded save ever sees. `soulsSpent` is zero, so nothing has
  // been priced at the old rates yet, and `smiteKept` describes a full ladder — the
  // migration must not read it, so what it says here does not matter to the outcome.
  const blob: SaveBlob = {
    ...serialize(createState(fixture), 0),
    saveVersion: 8,
    souls: '31630',
    soulsSpent: '0',
    lifetimeEvil: '5.07e18',
    smiteKept: { reach: 4, weight: 0, forgetting: 0, restraint: 0 },
  };

  it('lands the reported playtest save at the new curve floor', () => {
    const migrated = migrate(blob);

    expect(Number(migrated.souls)).toBe(1275);
  });

  it('stamps the new version', () => {
    expect(migrate(blob).saveVersion).toBe(10);
  });

  // The three tests below are Finding 1 from the whole-branch review: the old
  // migration re-priced `smiteKept` at the new Keep prices, which routinely
  // exceeded the entire new bank and wiped any player who had ever kept a rung.
  // The fix charges the *fraction* of their old bank a player had already spent,
  // which survives the re-denomination exactly and can never exceed what the new
  // curve pays out. None of these blobs sets `smiteKept` at all — the migration no
  // longer reads it, so there is nothing left to wipe a Keep-holder with.

  it('does not wipe a player who kept one full ladder', () => {
    // Old Keep prices were 8/20/50/120 souls; a full ladder cost 198. The same
    // lifetime Evil as the base blob, with 198 of the old 31,630 souls already
    // spent rather than held.
    const migrated = migrate({ ...blob, souls: '31432', soulsSpent: '198' });

    expect(Number(migrated.souls)).toBe(1268);
  });

  it('carries the spent fraction of one kept ladder into the new soulsSpent', () => {
    const migrated = migrate({ ...blob, souls: '31432', soulsSpent: '198' });

    expect(Number(migrated.soulsSpent)).toBe(7);
  });

  it('does not wipe a player who kept two full ladders', () => {
    // Two full ladders at the old prices cost 396 souls.
    const migrated = migrate({ ...blob, souls: '31234', soulsSpent: '396' });

    expect(Number(migrated.souls)).toBe(1260);
  });

  it('never leaves the player owing souls they cannot have', () => {
    // Spending everything the old bank held still leaves a non-negative remainder,
    // because the spent fraction can never exceed one.
    const migrated = migrate({ ...blob, souls: '0', soulsSpent: '31630' });

    expect(Number(migrated.souls)).toBeGreaterThanOrEqual(0);
  });

  it('pays the full new total when the old blob records no souls at all', () => {
    // A blob whose souls and soulsSpent are both zero — the old-fraction divisor
    // would be zero too. The migration must not stall or throw; it must fall back
    // to paying the whole new total, exactly as a player who never held a soul
    // under the old curve should.
    const migrated = migrate({ ...blob, souls: '0', soulsSpent: '0' });

    expect(Number(migrated.souls)).toBe(1275);
  });
});

// Version 9 shipped to the deploy preview before the offset was found, so these saves
// exist and hold souls the corrected curve never paid. They enter the table one step
// later than the version 8 blobs above and must land on the same figures.
describe('correcting a version 9 save that was paid on the un-offset curve', () => {
  const blob: SaveBlob = {
    ...serialize(createState(fixture), 0),
    saveVersion: 9,
    souls: '1875',
    soulsSpent: '0',
    lifetimeEvil: '5.07e18',
  };

  it('takes the offset off a bank minted without it', () => {
    expect(Number(migrate(blob).souls)).toBe(1275);
  });

  it('agrees with a version 8 save carrying the same lifetime Evil', () => {
    const fromEight = migrate({ ...blob, saveVersion: 8, souls: '31630' });

    expect(migrate(blob).souls).toBe(fromEight.souls);
  });

  it('takes back every soul from a run that never reached scale', () => {
    const early = migrate({ ...blob, souls: '213', lifetimeEvil: '34' });

    expect(Number(early.souls)).toBe(0);
  });

  it('leaves the favour multiplier at one for that run', () => {
    const early = deserialize(migrate({ ...blob, souls: '213', lifetimeEvil: '34' }));

    expect(globalMultiplier(early, fixture).toNumber()).toBe(1);
  });
});

describe('a save holding an achievement the build no longer ships', () => {
  it('loads, dropping the unknown id', () => {
    const state = createState(fixture);
    const blob = {
      ...serialize(state, 0),
      earnedAchievements: ['ghost-achievement', 'prestige-1'],
    };

    // `as never`: the blob deliberately carries an id outside `AchievementId`, which is
    // the case under test and a shape the type cannot express.
    const loaded = deserialize(blob as never);

    expect(loaded.earnedAchievements).toEqual(['prestige-1']);
  });
});
