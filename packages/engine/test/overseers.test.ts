import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import {
  apply,
  BASE_DT_MS,
  canAppoint,
  catchUp,
  createState,
  isAppointed,
  isRousable,
  overseerCost,
  productionPerSecond,
  step,
} from '../src/index.ts';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';
import type { GameState } from '../src/types.ts';

const MINION_CYCLE_MS = 24_000;
const MINION_OVERSEER_COST = 400;

function fresh(minions = 5): GameState {
  const state = createState(fixture);
  state.gens.minion.owned = new Decimal(minions);
  return state;
}

function run(state: GameState, ms: number, dt = BASE_DT_MS): void {
  for (let elapsed = 0; elapsed < ms; elapsed += dt) step(state, fixture, dt);
}

describe('a tier nobody oversees', () => {
  it('produces nothing until it is roused', () => {
    const state = fresh();

    run(state, 10 * MINION_CYCLE_MS);

    expect(state.resources.evil.toString()).toBe('0');
  });

  it('accrues no cycle progress while it is stopped', () => {
    const state = fresh();

    run(state, 10 * MINION_CYCLE_MS);

    expect(state.gens.minion.progressMs).toBe(0);
  });

  it('pays exactly one cycle once roused', () => {
    const state = fresh();

    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    run(state, MINION_CYCLE_MS);

    expect(state.resources.evil.toString()).toBe('75');
  });

  it('stops itself at the end of that cycle', () => {
    const state = fresh();

    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    run(state, MINION_CYCLE_MS);

    expect(state.gens.minion.running).toBe(false);
  });

  it('pays no more however long it is left alone', () => {
    const state = fresh();

    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    run(state, 40 * MINION_CYCLE_MS);

    expect(state.resources.evil.toString()).toBe('75');
  });

  it('banks nothing across a long idle, whenever it is next roused', () => {
    const promptly = fresh();
    const eventually = fresh();

    apply(promptly, fixture, { kind: 'rouse', tierId: 'minion' });
    run(promptly, MINION_CYCLE_MS);
    run(eventually, 100 * MINION_CYCLE_MS);
    apply(eventually, fixture, { kind: 'rouse', tierId: 'minion' });
    run(eventually, MINION_CYCLE_MS);

    expect(eventually.resources.evil.toString()).toBe(promptly.resources.evil.toString());
  });

  it('carries no remainder from the cycle it finished', () => {
    const state = fresh();

    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    run(state, MINION_CYCLE_MS + 5_000);

    expect(state.gens.minion.progressMs).toBe(0);
  });

  it('pays a further cycle for every further rouse', () => {
    const state = fresh();

    for (let cycle = 0; cycle < 3; cycle += 1) {
      apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
      run(state, MINION_CYCLE_MS);
    }

    expect(state.resources.evil.toString()).toBe('225');
  });
});

describe('a tier somebody oversees', () => {
  it('runs without ever being roused', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(5);

    run(state, 5 * MINION_CYCLE_MS);

    expect(state.resources.evil.toString()).toBe('375');
  });

  it('produces exactly what it produced before the manual layer existed', () => {
    const overseen = appointed(fixture);
    overseen.gens.minion.owned = new Decimal(5);
    overseen.gens.warren.owned = new Decimal(1);

    run(overseen, 120_000);

    expect(overseen.resources.evil.toString()).toBe('4875');
    expect(overseen.gens.minion.owned.toString()).toBe('205');
  });

  it('keeps its world clock while it owns nothing', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(0);

    run(state, 10 * MINION_CYCLE_MS);
    state.gens.minion.owned = new Decimal(1);
    run(state, MINION_CYCLE_MS);

    expect(state.resources.evil.lte(30)).toBe(true);
  });
});

describe('the rouse intent', () => {
  it('starts the cycle', () => {
    const state = fresh();

    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    expect(state.gens.minion.running).toBe(true);
  });

  it('refuses a tier the content does not name', () => {
    const state = fresh();

    // A tier id the fixture content has no definition for. The union permits it; the
    // content does not carry it, which is the case this guards.
    const result = apply(state, fixture, { kind: 'rouse', tierId: 'legion' });

    expect(result).toEqual({
      ok: false,
      intent: { kind: 'rouse', tierId: 'legion' },
      reason: 'unknown-tier',
    });
  });

  it('refuses a tier the player owns none of', () => {
    const state = fresh(0);

    const result = apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    expect(result).toMatchObject({ ok: false, reason: 'tier-not-owned' });
  });

  it('refuses a tier already turning', () => {
    const state = fresh();
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    const result = apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    expect(result).toMatchObject({ ok: false, reason: 'already-running' });
  });

  it('refuses a tier somebody already oversees', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(5);

    const result = apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    expect(result).toMatchObject({ ok: false, reason: 'already-appointed' });
  });
});

describe('the appoint intent', () => {
  it('appoints the automator', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST);

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(state.overseers.minion).toEqual(['minion-hand']);
  });

  it('spends the cost', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST + 10);

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(state.resources.evil.toString()).toBe('10');
  });

  it('refuses one Evil short', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST - 1);

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(result).toMatchObject({ ok: false, reason: 'insufficient-resource' });
  });

  it('leaves the post empty when it refuses', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST - 1);

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(state.overseers.minion).toEqual([]);
  });

  it('refuses a post already filled', () => {
    const state = fresh();
    state.resources.evil = new Decimal(2 * MINION_OVERSEER_COST);
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(result).toMatchObject({ ok: false, reason: 'already-appointed' });
  });

  it('charges nothing for the refusal', () => {
    const state = fresh();
    state.resources.evil = new Decimal(2 * MINION_OVERSEER_COST);
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(state.resources.evil.toString()).toBe(String(MINION_OVERSEER_COST));
  });

  it('refuses a post the content does not name', () => {
    const state = fresh();
    state.resources.evil = new Decimal('1e12');

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'fortress-hand' });

    expect(result).toMatchObject({ ok: false, reason: 'unknown-overseer' });
  });

  it('leaves the tier running for ever', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST);

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });
    state.resources.evil = new Decimal(0);
    run(state, 5 * MINION_CYCLE_MS);

    expect(state.resources.evil.toString()).toBe('375');
  });

  it('keeps the progress the tier had already made', () => {
    const state = fresh();
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    run(state, 12_000);
    state.resources.evil = new Decimal(MINION_OVERSEER_COST);

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(state.gens.minion.progressMs).toBe(12_000);
  });
});

describe('offline catch-up', () => {
  it('runs an appointed tier for the whole absence', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(5);

    catchUp(state, fixture, 10 * MINION_CYCLE_MS);

    expect(state.resources.evil.toString()).toBe('750');
  });

  it('finishes at most one cycle for a roused manual tier', () => {
    const state = fresh();
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    catchUp(state, fixture, 4 * 60 * 60 * 1000);

    expect(state.resources.evil.toString()).toBe('75');
  });

  it('gives a stopped manual tier nothing at all', () => {
    const state = fresh();

    catchUp(state, fixture, 4 * 60 * 60 * 1000);

    expect(state.resources.evil.toString()).toBe('0');
  });
});

describe('prestige', () => {
  it('clears an appointed post', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST);
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });
    state.lifetimeEvil = new Decimal('1e12');

    apply(state, fixture, { kind: 'prestige' });

    expect(state.overseers.minion).toEqual([]);
  });

  it('leaves an unfilled post unfilled', () => {
    const state = fresh();
    state.lifetimeEvil = new Decimal('1e12');

    apply(state, fixture, { kind: 'prestige' });

    expect(state.overseers.warren).toEqual([]);
  });

  it('stops every manual cycle that was turning', () => {
    const state = fresh();
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    state.lifetimeEvil = new Decimal('1e12');

    apply(state, fixture, { kind: 'prestige' });

    expect(state.gens.minion.running).toBe(false);
  });

  it('stops an overseen tier from producing after the reset', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST);
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });
    state.lifetimeEvil = new Decimal('1e12');
    apply(state, fixture, { kind: 'prestige' });

    run(state, MINION_CYCLE_MS);

    expect(state.resources.evil.eq(0)).toBe(true);
  });
});

describe('productionPerSecond', () => {
  it('reports what a stopped tier would make, not the nothing it is making', () => {
    const stopped = fresh();
    const overseen = appointed(fixture);
    overseen.gens.minion.owned = new Decimal(5);

    const idle = productionPerSecond(stopped, fixture, 'evil');

    expect(idle.toString()).toBe(productionPerSecond(overseen, fixture, 'evil').toString());
  });
});

describe('the selectors', () => {
  it('calls an unfilled post unappointed', () => {
    expect(isAppointed(fresh(), fixture, 'minion')).toBe(false);
  });

  it('calls a filled post appointed', () => {
    expect(isAppointed(appointed(fixture), fixture, 'minion')).toBe(true);
  });

  it('calls a stopped tier the player owns rousable', () => {
    expect(isRousable(fresh(), fixture, 'minion')).toBe(true);
  });

  it('calls a tier the player owns none of unrousable', () => {
    expect(isRousable(fresh(0), fixture, 'minion')).toBe(false);
  });

  it('calls a turning tier unrousable', () => {
    const state = fresh();
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    expect(isRousable(state, fixture, 'minion')).toBe(false);
  });

  it('calls an overseen tier unrousable', () => {
    expect(isRousable(appointed(fixture), fixture, 'minion')).toBe(false);
  });

  it('reports the cost the content set', () => {
    expect(overseerCost(fixture, 'minion-hand')?.toString()).toBe(String(MINION_OVERSEER_COST));
  });

  it('reports nothing for a post the content does not name', () => {
    expect(overseerCost(fixture, 'legion-hand')).toBe(null);
  });

  it('refuses the appointment one Evil short', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST - 1);

    expect(canAppoint(state, fixture, 'minion-hand')).toBe(false);
  });

  it('allows the appointment at exactly the cost', () => {
    const state = fresh();
    state.resources.evil = new Decimal(MINION_OVERSEER_COST);

    expect(canAppoint(state, fixture, 'minion-hand')).toBe(true);
  });

  it('refuses a second appointment however rich the player is', () => {
    const state = appointed(fixture);
    state.resources.evil = new Decimal('1e12');

    expect(canAppoint(state, fixture, 'minion-hand')).toBe(false);
  });
});
