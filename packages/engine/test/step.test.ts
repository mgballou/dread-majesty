import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { BASE_DT_MS, step } from '../src/index.ts';
import { fixture, fixtureReversed } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';
import type { GameState } from '../src/types.ts';

function seeded(minions: number, warrens: number): GameState {
  const state = appointed(fixture);
  state.gens.minion.owned = new Decimal(minions);
  state.gens.warren.owned = new Decimal(warrens);
  return state;
}

function run(state: GameState, content = fixture, ms = 120_000, dt = BASE_DT_MS): void {
  for (let elapsed = 0; elapsed < ms; elapsed += dt) step(state, content, dt);
}

describe('the worked example', () => {
  it('produces 4,875 Evil and 205 Minions over 120 seconds', () => {
    const state = seeded(5, 1);

    run(state);

    expect(state.resources.evil.toString()).toBe('4875');
    expect(state.gens.minion.owned.toString()).toBe('205');
  });

  it('pays the minion tier at its pre-warren count in the slice they share', () => {
    // At t=120s a Warren and the Minion tier both complete. The 100 minions the warren
    // produces did not exist during the shift that just ended, so the payout uses
    // 105, not 205. project_init.md §10's higher-tier-first rule gets this wrong;
    // its own example gets it right.
    const state = seeded(5, 1);

    run(state, fixture, 119_900);
    const beforeFinalSlice = state.resources.evil;
    step(state, fixture, BASE_DT_MS);

    expect(state.resources.evil.sub(beforeFinalSlice).toString()).toBe('1575');
  });

  it('pays a full share to minions that arrived part-way through the shift', () => {
    // The warren fires at t=60, mid-way through the minion shift running 48s to 72s.
    // Those minions are paid in full at t=72. This matches AdVenture Capitalist.
    const state = seeded(5, 1);

    run(state, fixture, 72_000);

    expect(state.resources.evil.toString()).toBe('1725'); // 75 + 75 + 1575
  });
});

describe('slice semantics', () => {
  it('gives the same result whatever order the tiers are iterated in', () => {
    const forward = seeded(5, 1);
    const reversed = seeded(5, 1);

    run(forward, fixture);
    run(reversed, fixtureReversed);

    expect(forward.resources.evil.toString()).toBe(reversed.resources.evil.toString());
    expect(forward.gens.minion.owned.toString()).toBe(reversed.gens.minion.owned.toString());
  });

  it('is unchanged by slice width below the shortest cycle', () => {
    const fine = seeded(5, 1);
    const coarse = seeded(5, 1);

    run(fine, fixture, 120_000, 100);
    run(coarse, fixture, 120_000, 200);

    expect(fine.resources.evil.toString()).toBe(coarse.resources.evil.toString());
    expect(fine.gens.minion.owned.toString()).toBe(coarse.gens.minion.owned.toString());
  });

  it('does not let an idle tier bank progress and pay it out on purchase', () => {
    const state = seeded(0, 0);

    run(state, fixture, 600_000);

    // The cycle timer is a world clock: it wraps whether or not anything is owned.
    expect(state.gens.minion.progressMs).toBeLessThan(24_000);

    state.gens.minion.owned = new Decimal(1);
    run(state, fixture, 24_000);

    // At most two completions in the 24s after buying — never the 25 cycles that
    // ten idle minutes would have banked.
    expect(state.resources.evil.lte(30)).toBe(true);
  });

  it('accumulates exact cycles across thousands of slices', () => {
    // Fractional progress accumulation would land on 0.9999999999999999 here and
    // silently skip a cycle. Integer milliseconds do not.
    const state = seeded(1, 0);

    run(state, fixture, 24_000);

    expect(state.resources.evil.toString()).toBe('15');
  });

  it('splits a slice the same way with a quickened tier', () => {
    const once = appointed(fixture);
    once.gens.minion.owned = new Decimal(5);
    once.overseers.minion = [...once.overseers.minion, 'minion-goad'];
    step(once, fixture, 24_000);

    const twice = appointed(fixture);
    twice.gens.minion.owned = new Decimal(5);
    twice.overseers.minion = [...twice.overseers.minion, 'minion-goad'];
    step(twice, fixture, 12_000);
    step(twice, fixture, 12_000);

    expect(twice.resources.evil.toString()).toBe(once.resources.evil.toString());
  });
});

describe('the roster', () => {
  it('pays twice as often when the tier is quickened', () => {
    const plain = appointed(fixture);
    plain.gens.minion.owned = new Decimal(5);
    step(plain, fixture, 24_000);

    const quick = appointed(fixture);
    quick.gens.minion.owned = new Decimal(5);
    quick.overseers.minion = [...quick.overseers.minion, 'minion-goad'];
    step(quick, fixture, 24_000);

    expect(quick.resources.evil.div(plain.resources.evil).toString()).toBe('2');
  });

  it('pays twice as much when the tier is swollen', () => {
    const plain = appointed(fixture);
    plain.gens.minion.owned = new Decimal(5);
    step(plain, fixture, 24_000);

    const fat = appointed(fixture);
    fat.gens.minion.owned = new Decimal(5);
    fat.overseers.minion = [...fat.overseers.minion, 'minion-glut'];
    step(fat, fixture, 24_000);

    expect(fat.resources.evil.div(plain.resources.evil).toString()).toBe('2');
  });

  it('compounds a quickened and a swollen tier', () => {
    const plain = appointed(fixture);
    plain.gens.minion.owned = new Decimal(5);
    step(plain, fixture, 24_000);

    const both = appointed(fixture);
    both.gens.minion.owned = new Decimal(5);
    both.overseers.minion = [...both.overseers.minion, 'minion-goad', 'minion-glut'];
    step(both, fixture, 24_000);

    expect(both.resources.evil.div(plain.resources.evil).toString()).toBe('4');
  });
});
