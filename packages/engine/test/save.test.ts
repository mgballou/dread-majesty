import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import {
  apply,
  CorruptSave,
  createState,
  exportSave,
  importSave,
  SAVE_VERSION,
  serialize,
  step,
  UnmigratableSave,
} from '../src/index.ts';
import { TIER_IDS } from '@dm/content';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';

/**
 * Old-shape blobs, written out by hand.
 *
 * They must never be generated from current code: a blob built by today's
 * `serialize` carries today's fields, so migrating it proves nothing. These are what
 * the shipped versions actually wrote, and they are frozen.
 */
const v1Blob = {
  saveVersion: 1,
  resources: { evil: '4875' },
  gens: {
    minion: { owned: '205', progressMs: 0, lifetimeProduced: '4875' },
    warren: { owned: '2', progressMs: 1200, lifetimeProduced: '200' },
    legion: { owned: '0', progressMs: 0, lifetimeProduced: '0' },
    fortress: { owned: '0', progressMs: 0, lifetimeProduced: '0' },
  },
  souls: '31',
  lifetimeEvil: '4875',
  stats: { playTimeMs: 120_000, smites: 4, prestiges: 1 },
  savedAtMs: 0,
};

const v2Blob = {
  ...v1Blob,
  saveVersion: 2,
  earnedAchievements: ['smite-1', 'not-an-achievement'],
};

const v3Blob = {
  ...v2Blob,
  saveVersion: 3,
  unlocked: { minion: true, warren: true, legion: false, fortress: false },
};

function encode(blob: unknown): string {
  return btoa(JSON.stringify(blob));
}

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
    apply(original, fixture, { kind: 'appoint', tierId: 'minion' });

    const restored = importSave(exportSave(original, 0));

    expect(restored.overseers.minion).toBe(true);
  });

  it('leaves an unappointed tier unappointed', () => {
    const original = createState(fixture);

    const restored = importSave(exportSave(original, 0));

    expect(restored.overseers.warren).toBe(false);
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
    original.overseers.warren = false;
    original.gens.warren.running = true;
    step(original, fixture, 300);

    const restored = importSave(exportSave(original, 0));

    expect(serialize(restored, 0)).toEqual(serialize(original, 0));
  });

  it('rejects a blob that is not a save', () => {
    expect(() => importSave('not base64 at all !!')).toThrow(CorruptSave);
    expect(() => importSave(btoa('{"nope":true}'))).toThrow(CorruptSave);
  });
});

describe('a save two versions old', () => {
  it('loads through the whole chain', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.saveVersion).toBe(SAVE_VERSION);
  });

  it('keeps the generator counts it was carrying', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.gens.minion.owned.toString()).toBe('205');
  });

  it('keeps cycle progress', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.gens.warren.progressMs).toBe(1200);
  });

  it('keeps souls', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.souls.toString()).toBe('31');
  });

  it('keeps stats', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.stats.smites).toBe(4);
  });

  it('starts with no achievements earned', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.earnedAchievements).toEqual([]);
  });

  it('unlocks the tiers it already owned', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.unlocked.warren).toBe(true);
  });

  it('leaves tiers it never owned locked', () => {
    const restored = importSave(encode(v1Blob));

    expect(restored.unlocked.legion).toBe(false);
  });
});

describe('a save two versions old, from version two', () => {
  it('loads', () => {
    const restored = importSave(encode(v2Blob));

    expect(restored.saveVersion).toBe(SAVE_VERSION);
  });

  it('keeps the achievements it had already earned', () => {
    const restored = importSave(encode(v2Blob));

    expect(restored.earnedAchievements).toEqual(['smite-1']);
  });

  it('unlocks the tiers it already owned', () => {
    const restored = importSave(encode(v2Blob));

    expect(restored.unlocked.minion).toBe(true);
  });
});

describe('a save one version old', () => {
  it('loads', () => {
    const restored = importSave(encode(v3Blob));

    expect(restored.saveVersion).toBe(SAVE_VERSION);
  });

  it('keeps the generator counts it was carrying', () => {
    const restored = importSave(encode(v3Blob));

    expect(restored.gens.minion.owned.toString()).toBe('205');
  });

  it('keeps the unlock flags it was carrying', () => {
    const restored = importSave(encode(v3Blob));

    expect(restored.unlocked.warren).toBe(true);
  });

  it('appoints nobody', () => {
    const restored = importSave(encode(v3Blob));

    expect(Object.values(restored.overseers)).toEqual([false, false, false, false]);
  });

  it('leaves every tier stopped', () => {
    const restored = importSave(encode(v3Blob));

    expect(TIER_IDS.map((id) => restored.gens[id].running)).toEqual([false, false, false, false]);
  });

  it('produces nothing until something is roused', () => {
    const restored = importSave(encode(v3Blob));
    const before = restored.resources.evil;

    for (let elapsed = 0; elapsed < 120_000; elapsed += 100) step(restored, fixture, 100);

    expect(restored.resources.evil.toString()).toBe(before.toString());
  });

  it('round trips losslessly once migrated', () => {
    const restored = importSave(encode(v3Blob));

    const again = importSave(exportSave(restored, 0));

    expect(serialize(again, 0)).toEqual(serialize(restored, 0));
  });
});

describe('a save from a version with no migration', () => {
  it('refuses to load', () => {
    expect(() => importSave(encode({ ...v1Blob, saveVersion: 0 }))).toThrow(UnmigratableSave);
  });
});
