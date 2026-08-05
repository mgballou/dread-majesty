import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import {
  apply,
  CorruptSave,
  createState,
  deserialize,
  exportSave,
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
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };

    expect(migrate(blob).saveVersion).toBe(8);
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
});
