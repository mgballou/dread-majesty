import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import {
  apply,
  BASE_DT_MS,
  createState,
  isTierUnlocked,
  isUnlockReached,
  step,
} from '../src/index.ts';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';
import type { GameState } from '../src/types.ts';

const WARREN_UNLOCK_EVIL = 750; // half of the 1,500 a first Warren costs

function fresh(): GameState {
  return createState(fixture);
}

describe('isUnlockReached', () => {
  it('is true for a tier the player already owns', () => {
    const state = fresh();

    expect(isUnlockReached(state, fixture, 'minion')).toBe(true);
  });

  it('is false for a tier the player is nowhere near', () => {
    const state = fresh();

    expect(isUnlockReached(state, fixture, 'warren')).toBe(false);
  });

  it('is false one Evil short of the fraction', () => {
    const state = fresh();
    state.resources.evil = new Decimal(WARREN_UNLOCK_EVIL - 1);

    expect(isUnlockReached(state, fixture, 'warren')).toBe(false);
  });

  it('is true at exactly the fraction', () => {
    const state = fresh();
    state.resources.evil = new Decimal(WARREN_UNLOCK_EVIL);

    expect(isUnlockReached(state, fixture, 'warren')).toBe(true);
  });

  it('is true for a tier owned with no Evil banked at all', () => {
    const state = fresh();
    state.gens.warren.owned = new Decimal(1);

    expect(isUnlockReached(state, fixture, 'warren')).toBe(true);
  });
});

describe('createState', () => {
  it('unlocks the tier the player starts with', () => {
    expect(isTierUnlocked(fresh(), 'minion')).toBe(true);
  });

  it('leaves every other tier locked', () => {
    expect(isTierUnlocked(fresh(), 'warren')).toBe(false);
  });
});

describe('the record-unlocks intent', () => {
  it('does not latch a tier below the fraction', () => {
    const state = fresh();
    state.resources.evil = new Decimal(WARREN_UNLOCK_EVIL - 1);

    apply(state, fixture, { kind: 'record-unlocks' });

    expect(isTierUnlocked(state, 'warren')).toBe(false);
  });

  it('latches a tier at the fraction', () => {
    const state = fresh();
    state.resources.evil = new Decimal(WARREN_UNLOCK_EVIL);

    apply(state, fixture, { kind: 'record-unlocks' });

    expect(isTierUnlocked(state, 'warren')).toBe(true);
  });

  it('keeps a tier unlocked after the Evil is spent', () => {
    const state = fresh();
    state.resources.evil = new Decimal(WARREN_UNLOCK_EVIL);
    apply(state, fixture, { kind: 'record-unlocks' });

    state.resources.evil = new Decimal(0);
    apply(state, fixture, { kind: 'record-unlocks' });

    expect(isTierUnlocked(state, 'warren')).toBe(true);
  });

  it('keeps a tier unlocked across a prestige reset', () => {
    const state = fresh();
    state.resources.evil = new Decimal(WARREN_UNLOCK_EVIL);
    state.lifetimeEvil = new Decimal('1e12');
    apply(state, fixture, { kind: 'record-unlocks' });

    apply(state, fixture, { kind: 'prestige' });

    expect(isTierUnlocked(state, 'warren')).toBe(true);
  });

  it('clears the generator counts it kept the unlock for', () => {
    const state = fresh();
    state.gens.warren.owned = new Decimal(4);
    state.lifetimeEvil = new Decimal('1e12');
    apply(state, fixture, { kind: 'record-unlocks' });

    apply(state, fixture, { kind: 'prestige' });

    expect(state.gens.warren.owned.toString()).toBe('0');
  });
});

describe('step', () => {
  it('does not unlock anything on its own', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(100);

    for (let elapsed = 0; elapsed < 240_000; elapsed += BASE_DT_MS) {
      step(state, fixture, BASE_DT_MS);
    }

    expect(isTierUnlocked(state, 'warren')).toBe(false);
  });

  it('leaves the tier ready to latch at the next boundary check', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(100);

    for (let elapsed = 0; elapsed < 240_000; elapsed += BASE_DT_MS) {
      step(state, fixture, BASE_DT_MS);
    }
    apply(state, fixture, { kind: 'record-unlocks' });

    expect(isTierUnlocked(state, 'warren')).toBe(true);
  });
});
