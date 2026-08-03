import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { apply, bulkCost, createState, maxAffordable, nextCost } from '../src/index.ts';
import { fixture } from './fixtures/content.ts';

describe('cost curve', () => {
  it('follows floor(baseCost * rate^owned)', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);

    expect(nextCost(state, fixture, 'minion')?.toString()).toBe('90');

    state.gens.minion.owned = new Decimal(1);
    expect(nextCost(state, fixture, 'minion')?.toString()).toBe('98'); // floor(90 * 1.089)

    state.gens.minion.owned = new Decimal(2);
    expect(nextCost(state, fixture, 'minion')?.toString()).toBe('106'); // floor(90 * 1.089^2)
  });

  it('sums bulk cost from the individual next-costs', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);

    expect(bulkCost(state, fixture, 'minion', 3)?.toString()).toBe('294'); // 90 + 98 + 106
  });

  it('finds the largest affordable quantity', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(294);

    expect(maxAffordable(state, fixture, 'minion')).toBe(3);

    state.resources.evil = new Decimal(293);
    expect(maxAffordable(state, fixture, 'minion')).toBe(2);
  });
});

describe('purchase', () => {
  it('spends exactly the bulk cost', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(1000);

    const result = apply(state, fixture, { kind: 'purchase', tierId: 'minion', quantity: 3 });

    expect(result.ok).toBe(true);
    expect(state.resources.evil.toString()).toBe('706');
    expect(state.gens.minion.owned.toString()).toBe('3');
  });

  it('refuses a purchase the player cannot afford', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(50);

    const result = apply(state, fixture, { kind: 'purchase', tierId: 'minion', quantity: 1 });

    expect(result.ok).toBe(false);
    expect(state.gens.minion.owned.toString()).toBe('0');
  });

  it('refuses a max buy when nothing is affordable', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal(0);

    const result = apply(state, fixture, { kind: 'purchase', tierId: 'minion', quantity: 'max' });

    expect(result.ok).toBe(false);
  });
});
