import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import {
  achievementMultiplier,
  apply,
  BASE_DT_MS,
  isConditionMet,
  newlyEarnedAchievements,
  step,
} from '../src/index.ts';
import { fixture, fixtureWithAchievementMultiplier } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';
import type { GameState } from '../src/types.ts';

function blank(): GameState {
  const state = appointed(fixture);
  state.gens.minion.owned = new Decimal(0);
  return state;
}

function runOneCycle(state: GameState, content = fixture): void {
  for (let elapsed = 0; elapsed < 24_000; elapsed += BASE_DT_MS) step(state, content, BASE_DT_MS);
}

describe('isConditionMet', () => {
  it('is false below a tier-owned threshold', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(9);

    expect(isConditionMet(state, { kind: 'tier-owned', tierId: 'minion', atLeast: '10' })).toBe(
      false,
    );
  });

  it('is true at a tier-owned threshold', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(10);

    expect(isConditionMet(state, { kind: 'tier-owned', tierId: 'minion', atLeast: '10' })).toBe(
      true,
    );
  });

  it('is true above a tier-owned threshold', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(11);

    expect(isConditionMet(state, { kind: 'tier-owned', tierId: 'minion', atLeast: '10' })).toBe(
      true,
    );
  });

  it('is false below a lifetime-evil threshold', () => {
    const state = blank();
    state.lifetimeEvil = new Decimal(999);

    expect(isConditionMet(state, { kind: 'lifetime-evil', atLeast: '1000' })).toBe(false);
  });

  it('is true at a lifetime-evil threshold', () => {
    const state = blank();
    state.lifetimeEvil = new Decimal(1000);

    expect(isConditionMet(state, { kind: 'lifetime-evil', atLeast: '1000' })).toBe(true);
  });

  it('is true above a lifetime-evil threshold', () => {
    const state = blank();
    state.lifetimeEvil = new Decimal('1e30');

    expect(isConditionMet(state, { kind: 'lifetime-evil', atLeast: '1000' })).toBe(true);
  });

  it('is false below a souls threshold', () => {
    const state = blank();
    state.souls = new Decimal(0);

    expect(isConditionMet(state, { kind: 'souls', atLeast: '1' })).toBe(false);
  });

  it('is true at a souls threshold', () => {
    const state = blank();
    state.souls = new Decimal(1);

    expect(isConditionMet(state, { kind: 'souls', atLeast: '1' })).toBe(true);
  });

  it('is true above a souls threshold', () => {
    const state = blank();
    state.souls = new Decimal(400);

    expect(isConditionMet(state, { kind: 'souls', atLeast: '1' })).toBe(true);
  });

  it('is false below a prestiges threshold', () => {
    const state = blank();
    state.stats.prestiges = 0;

    expect(isConditionMet(state, { kind: 'prestiges', atLeast: 1 })).toBe(false);
  });

  it('is true at a prestiges threshold', () => {
    const state = blank();
    state.stats.prestiges = 1;

    expect(isConditionMet(state, { kind: 'prestiges', atLeast: 1 })).toBe(true);
  });

  it('is true above a prestiges threshold', () => {
    const state = blank();
    state.stats.prestiges = 9;

    expect(isConditionMet(state, { kind: 'prestiges', atLeast: 1 })).toBe(true);
  });

  it('is false below a smites threshold', () => {
    const state = blank();
    state.stats.smites = 0;

    expect(isConditionMet(state, { kind: 'smites', atLeast: 1 })).toBe(false);
  });

  it('is true at a smites threshold', () => {
    const state = blank();
    state.stats.smites = 1;

    expect(isConditionMet(state, { kind: 'smites', atLeast: 1 })).toBe(true);
  });

  it('is true above a smites threshold', () => {
    const state = blank();
    state.stats.smites = 50;

    expect(isConditionMet(state, { kind: 'smites', atLeast: 1 })).toBe(true);
  });
});

describe('newlyEarnedAchievements', () => {
  it('names an achievement whose condition has just come true', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(10);

    expect(newlyEarnedAchievements(state, fixture)).toContain('minion-10');
  });

  it('names nothing when no condition holds', () => {
    const state = blank();

    expect(newlyEarnedAchievements(state, fixture)).toEqual([]);
  });

  it('excludes an achievement already recorded', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(10);
    apply(state, fixture, { kind: 'record-achievements' });

    expect(newlyEarnedAchievements(state, fixture)).toEqual([]);
  });
});

describe('the record-achievements intent', () => {
  it('records what was earned', () => {
    const state = blank();
    state.stats.smites = 3;

    apply(state, fixture, { kind: 'record-achievements' });

    expect(state.earnedAchievements).toEqual(['smite-1']);
  });

  it('does not record the same achievement twice', () => {
    const state = blank();
    state.stats.smites = 3;

    apply(state, fixture, { kind: 'record-achievements' });
    apply(state, fixture, { kind: 'record-achievements' });

    expect(state.earnedAchievements).toEqual(['smite-1']);
  });

  it('keeps the list in content order', () => {
    const state = blank();
    state.stats.smites = 1;
    apply(state, fixture, { kind: 'record-achievements' });
    state.gens.minion.owned = new Decimal(10);

    apply(state, fixture, { kind: 'record-achievements' });

    expect(state.earnedAchievements).toEqual(['minion-10', 'smite-1']);
  });

  it('survives a prestige reset', () => {
    const state = blank();
    state.stats.smites = 1;
    state.lifetimeEvil = new Decimal('1e12');
    apply(state, fixture, { kind: 'record-achievements' });

    apply(state, fixture, { kind: 'prestige' });

    expect(state.earnedAchievements).toContain('smite-1');
  });
});

describe('achievementMultiplier', () => {
  it('is one when nothing is earned', () => {
    expect(achievementMultiplier(blank(), fixture).toString()).toBe('1');
  });

  it('is one when every earned achievement grants one', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(10);
    state.stats.smites = 1;
    apply(state, fixture, { kind: 'record-achievements' });

    expect(achievementMultiplier(state, fixture).toString()).toBe('1');
  });

  it('is the granted multiplier when one is earned', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(10);
    apply(state, fixtureWithAchievementMultiplier, { kind: 'record-achievements' });

    expect(achievementMultiplier(state, fixtureWithAchievementMultiplier).toString()).toBe('3');
  });
});

describe('achievements against production', () => {
  it('changes no production number while every multiplier is one', () => {
    const plain = blank();
    plain.gens.minion.owned = new Decimal(10);
    const decorated = blank();
    decorated.gens.minion.owned = new Decimal(10);
    decorated.stats.smites = 1;
    apply(decorated, fixture, { kind: 'record-achievements' });

    runOneCycle(plain);
    runOneCycle(decorated);

    expect(decorated.resources.evil.toString()).toBe(plain.resources.evil.toString());
  });

  it('multiplies production when an earned achievement grants more than one', () => {
    const plain = blank();
    plain.gens.minion.owned = new Decimal(10);
    const boosted = blank();
    boosted.gens.minion.owned = new Decimal(10);
    apply(boosted, fixtureWithAchievementMultiplier, { kind: 'record-achievements' });

    runOneCycle(plain);
    runOneCycle(boosted, fixtureWithAchievementMultiplier);

    expect(plain.resources.evil.toString()).toBe('150');
    expect(boosted.resources.evil.toString()).toBe('450');
  });

  it('grants nothing until the achievement is recorded', () => {
    const state = blank();
    state.gens.minion.owned = new Decimal(10);

    runOneCycle(state, fixtureWithAchievementMultiplier);

    expect(state.resources.evil.toString()).toBe('150');
  });
});
