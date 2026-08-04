import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/intents.ts';
import { effectiveCycleMs, effectiveYield, hasAutomator } from '../src/roster.ts';
import { createState } from '../src/state.ts';
import { fixture } from './fixtures/content.ts';

const minion = fixture.tiers.find((tier) => tier.id === 'minion');
if (!minion) throw new Error('fixture has no minion tier');

describe('an empty roster', () => {
  it('leaves the tier unautomated', () => {
    expect(hasAutomator(createState(fixture), minion)).toBe(false);
  });

  it('leaves the cycle alone', () => {
    expect(effectiveCycleMs(createState(fixture), minion)).toBe(minion.cycleMs);
  });

  it('leaves the yield alone', () => {
    expect(effectiveYield(createState(fixture), minion).toString()).toBe(minion.yield);
  });
});

describe('a filled roster', () => {
  it('automates the tier', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(hasAutomator(state, minion)).toBe(true);
  });

  it('halves the cycle', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-goad' });

    expect(effectiveCycleMs(state, minion)).toBe(minion.cycleMs / 2);
  });

  it('doubles the yield', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-glut' });

    expect(effectiveYield(state, minion).toString()).toBe('30');
  });
});

describe('appointing', () => {
  it('refuses a post already filled', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(result).toHaveProperty('reason', 'already-appointed');
  });

  it('refuses a post over a tier the player has not met', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.warren = false;

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'warren-hand' });

    expect(result).toHaveProperty('reason', 'tier-not-met');
  });

  it('refuses a post it cannot pay for', () => {
    const state = createState(fixture);
    state.unlocked.minion = true;

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(result).toHaveProperty('reason', 'insufficient-resource');
  });
});

describe('appointing a running tier', () => {
  it('leaves it running when the new post quickens it', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-goad' });

    expect(state.gens.minion.running).toBe(true);
  });

  it('leaves it running when the new post swells it', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-glut' });

    expect(state.gens.minion.running).toBe(true);
  });

  it('stops it when the new post automates it', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });

    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(state.gens.minion.running).toBe(false);
  });
});
