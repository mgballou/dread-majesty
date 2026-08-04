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
    expect(hasAutomator(createState(fixture), fixture, 'minion')).toBe(false);
  });

  it('leaves the cycle alone', () => {
    expect(effectiveCycleMs(createState(fixture), fixture, minion)).toBe(minion.cycleMs);
  });

  it('leaves the yield alone', () => {
    expect(effectiveYield(createState(fixture), fixture, minion).toString()).toBe(minion.yield);
  });
});

describe('a filled roster', () => {
  it('automates the tier', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(hasAutomator(state, fixture, 'minion')).toBe(true);
  });

  it('halves the cycle', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-goad' });

    expect(effectiveCycleMs(state, fixture, minion)).toBe(minion.cycleMs / 2);
  });

  it('doubles the yield', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-glut' });

    expect(effectiveYield(state, fixture, minion).toString()).toBe('30');
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
