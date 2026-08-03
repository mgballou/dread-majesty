import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { BASE_DT_MS, catchUp, step } from '../src/index.ts';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';
import type { GameState } from '../src/types.ts';

function seeded(minions: number, warrens: number): GameState {
  const state = appointed(fixture);
  state.gens.minion.owned = new Decimal(minions);
  state.gens.warren.owned = new Decimal(warrens);
  return state;
}

const HOUR_MS = 60 * 60 * 1000;

describe('catchUp', () => {
  it('matches the live loop exactly over an hour', () => {
    const offline = seeded(5, 1);
    const online = seeded(5, 1);

    catchUp(offline, fixture, HOUR_MS);
    for (let elapsed = 0; elapsed < HOUR_MS; elapsed += BASE_DT_MS) {
      step(online, fixture, BASE_DT_MS);
    }

    expect(offline.resources.evil.toString()).toBe(online.resources.evil.toString());
    expect(offline.gens.minion.owned.toString()).toBe(online.gens.minion.owned.toString());
  });

  it('clamps to the offline cap and says so', () => {
    const state = seeded(5, 1);

    const report = catchUp(state, fixture, 12 * HOUR_MS);

    expect(report.elapsedMs).toBe(fixture.offlineCapMs);
    expect(report.capped).toBe(true);
  });

  it('coarsens the slice past an hour', () => {
    const state = seeded(5, 1);

    const report = catchUp(state, fixture, 2 * HOUR_MS);

    expect(report.coarsened).toBe(true);
  });

  it('does not coarsen at exactly one hour', () => {
    const state = seeded(5, 1);

    const report = catchUp(state, fixture, HOUR_MS);

    expect(report.coarsened).toBe(false);
  });

  it('stays within 0.1% of the fine-grained result when coarsened', () => {
    const coarse = seeded(5, 1);
    const fine = seeded(5, 1);

    catchUp(coarse, fixture, 2 * HOUR_MS);
    for (let elapsed = 0; elapsed < 2 * HOUR_MS; elapsed += BASE_DT_MS) {
      step(fine, fixture, BASE_DT_MS);
    }

    const drift = coarse.resources.evil.sub(fine.resources.evil).abs().div(fine.resources.evil);
    expect(drift.lt(0.001)).toBe(true);
  });

  it('yields nothing when the wall clock moved backwards', () => {
    const state = seeded(5, 1);

    const report = catchUp(state, fixture, -5000);

    expect(report.elapsedMs).toBe(0);
    expect(state.resources.evil.toString()).toBe('0');
  });

  it('reports what was produced', () => {
    const state = seeded(5, 1);

    const report = catchUp(state, fixture, 120_000);

    expect(report.produced.evil?.toString()).toBe('4875');
    expect(report.produced.minion?.toString()).toBe('200');
  });
});
