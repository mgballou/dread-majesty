import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/intents.ts';
import { prestigeGain } from '../src/selectors.ts';
import { canClimb, canKeep, climbCost, keepCost, smiteAverageMultiplier } from '../src/smite.ts';
import { createState } from '../src/state.ts';
import type { GameState } from '../src/types.ts';
import { fixture } from './fixtures/content.ts';

function rich(): GameState {
  const state = createState(fixture);
  state.resources.evil = new Decimal('1e9');
  state.souls = new Decimal(100);
  return state;
}

function climb(state: GameState, upgradeId: 'weight' | 'reach' | 'forgetting' | 'restraint') {
  return apply(state, fixture, { kind: 'climb', upgradeId });
}

function keep(state: GameState, upgradeId: 'weight' | 'reach' | 'forgetting' | 'restraint') {
  return apply(state, fixture, { kind: 'keep', upgradeId });
}

describe('climbing a ladder', () => {
  it('raises the rung', () => {
    const state = rich();
    climb(state, 'weight');

    expect(state.smiteRungs.weight).toBe(1);
  });

  it('spends the Evil', () => {
    const state = rich();
    const before = state.resources.evil;
    climb(state, 'weight');

    expect(before.sub(state.resources.evil).eq(1000)).toBe(true);
  });

  it('refuses when the Evil is short', () => {
    const state = createState(fixture);

    expect(climb(state, 'weight').ok).toBe(false);
  });

  it('says why it refused a short purse', () => {
    const state = createState(fixture);
    const result = climb(state, 'weight');

    expect(result.ok === false && result.reason).toBe('insufficient-resource');
  });

  it('refuses at the top of the ladder', () => {
    const state = rich();
    climb(state, 'reach');

    expect(climb(state, 'reach').ok).toBe(false);
  });

  it('says why it refused a maxed ladder', () => {
    const state = rich();
    climb(state, 'reach');
    const result = climb(state, 'reach');

    expect(result.ok === false && result.reason).toBe('rung-maxed');
  });

  it('prices the next rung', () => {
    const state = rich();
    climb(state, 'weight');

    expect(climbCost(state, fixture, 'weight')?.eq(4000)).toBe(true);
  });

  it('prices nothing at the top', () => {
    const state = rich();
    climb(state, 'reach');

    expect(climbCost(state, fixture, 'reach')).toBeNull();
  });

  it('answers the predicate against the purse', () => {
    expect(canClimb(createState(fixture), fixture, 'weight')).toBe(false);
  });
});

describe('keeping a rung', () => {
  it('refuses with nothing earned to keep', () => {
    const state = rich();

    expect(keep(state, 'weight').ok).toBe(false);
  });

  it('says why it refused an unearned rung', () => {
    const state = rich();
    const result = keep(state, 'weight');

    expect(result.ok === false && result.reason).toBe('nothing-to-keep');
  });

  it('raises the floor once the rung is earned', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');

    expect(state.smiteKept.weight).toBe(1);
  });

  it('spends the souls', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');

    expect(state.souls.eq(95)).toBe(true);
  });

  it('records the souls as spent', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');

    expect(state.soulsSpent.eq(5)).toBe(true);
  });

  it('refuses when the souls are short', () => {
    const state = rich();
    state.souls = new Decimal(0);
    climb(state, 'weight');

    expect(keep(state, 'weight').ok).toBe(false);
  });

  it('says why it refused short souls', () => {
    const state = rich();
    state.souls = new Decimal(0);
    climb(state, 'weight');
    const result = keep(state, 'weight');

    expect(result.ok === false && result.reason).toBe('insufficient-souls');
  });

  it('never overtakes what was earned with Evil', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');
    keep(state, 'weight');

    expect(state.smiteKept.weight).toBe(1);
  });

  it('prices the next floor', () => {
    const state = rich();
    climb(state, 'weight');

    expect(keepCost(state, fixture, 'weight')?.eq(5)).toBe(true);
  });

  it('answers the predicate against what is earned', () => {
    expect(canKeep(rich(), fixture, 'weight')).toBe(false);
  });
});

describe('the price of climbing across runs', () => {
  it('charges the authored price on a first run', () => {
    expect(climbCost(rich(), fixture, 'weight')?.eq(1000)).toBe(true);
  });

  it('charges more after a reset', () => {
    const state = rich();
    state.stats.prestiges = 1;

    expect(climbCost(state, fixture, 'weight')?.eq(2000)).toBe(true);
  });

  it('compounds the growth per reset', () => {
    const state = rich();
    state.stats.prestiges = 3;

    expect(climbCost(state, fixture, 'weight')?.toNumber()).toBeCloseTo(8000, 6);
  });

  it('leaves the soul price of keeping a rung alone across runs', () => {
    const state = rich();
    state.stats.prestiges = 5;
    climb(state, 'weight');

    expect(keepCost(state, fixture, 'weight')?.eq(5)).toBe(true);
  });

  it('still refuses a climb the purse cannot reach once the price has grown', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal(1500);
    state.stats.prestiges = 1;

    expect(climb(state, 'weight').ok).toBe(false);
  });

  it('spends the grown price, not the authored one', () => {
    const state = rich();
    state.stats.prestiges = 1;
    const before = state.resources.evil;
    climb(state, 'weight');

    expect(before.sub(state.resources.evil).eq(2000)).toBe(true);
  });
});

describe('a reset and the ladders', () => {
  it('drops an unkept rung back to nothing', () => {
    const state = rich();
    state.lifetimeEvil = new Decimal('1e30');
    climb(state, 'weight');
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteRungs.weight).toBe(0);
  });

  it('holds a kept rung', () => {
    const state = rich();
    state.lifetimeEvil = new Decimal('1e30');
    climb(state, 'weight');
    keep(state, 'weight');
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteRungs.weight).toBe(1);
  });

  it('holds the floor itself', () => {
    const state = rich();
    state.lifetimeEvil = new Decimal('1e30');
    climb(state, 'weight');
    keep(state, 'weight');
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteKept.weight).toBe(1);
  });

  it('never refunds a spent soul', () => {
    const spent = rich();
    const unspent = rich();
    spent.lifetimeEvil = new Decimal('1e30');
    unspent.lifetimeEvil = new Decimal('1e30');
    climb(spent, 'weight');
    keep(spent, 'weight');

    expect(prestigeGain(spent, fixture).eq(prestigeGain(unspent, fixture))).toBe(true);
  });
});

describe('the measure the shop ranks by', () => {
  it('reads a fresh state at the unupgraded average', () => {
    // A fresh state stands at every ladder's base: reach 48000ms, forgetting 60000ms,
    // weight 2 and restraint 0.5, against a fixture cooldown of 120000ms.
    //
    // Apathy bled per cycle is cooldownMs / bleedMs = 120000 / 60000 = 2, which is
    // above the fixture's perBlow of 1 — so a blow striking on cooldown bleeds faster
    // than it accrues and Apathy settles at nothing, not at `cap - bledPerCycle`.
    //
    // With settled Apathy at 0, a blow reads its full weight: 2. Uptime is
    // reach / cooldown = 48000 / 120000 = 0.4, so the average is
    // 0.4 * 2 + 0.6 * 1 = 1.4.
    expect(smiteAverageMultiplier(createState(fixture), fixture, null)).toBeCloseTo(1.4, 5);
  });

  it('reports a gain for a rung not yet bought', () => {
    const state = createState(fixture);
    const now = smiteAverageMultiplier(state, fixture, null);

    expect(smiteAverageMultiplier(state, fixture, 'weight')).toBeGreaterThan(now);
  });

  it('reports no gain at the top of a ladder', () => {
    const state = rich();
    climb(state, 'reach');
    const now = smiteAverageMultiplier(state, fixture, null);

    expect(smiteAverageMultiplier(state, fixture, 'reach')).toBe(now);
  });
});
