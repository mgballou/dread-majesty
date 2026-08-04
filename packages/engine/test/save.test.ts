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
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';

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
    const state = appointed(fixture);
    const blob = { ...serialize(state, 0), saveVersion: MIN_SUPPORTED_SAVE_VERSION };

    expect(deserialize(blob).saveVersion).toBe(SAVE_VERSION);
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
});
