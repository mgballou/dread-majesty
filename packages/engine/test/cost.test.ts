import Decimal from 'break_eternity.js';
import type { Content } from '@dm/content';
import { describe, expect, it } from 'vitest';
import {
  MAX_AFFORDABLE_CAP,
  apply,
  bulkCost,
  costOfNth,
  createState,
  maxAffordable,
  nextCost,
} from '../src/index.ts';
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

describe('maxAffordable against the summed loop', () => {
  function reference(budget: Decimal): number {
    let spent = new Decimal(0);
    let count = 0;
    for (;;) {
      const next = spent.add(costOfNth(minion, new Decimal(count)));
      if (next.gt(budget)) return count;
      spent = next;
      count += 1;
    }
  }

  const minion = fixture.tiers.find((tier) => tier.id === 'minion') ?? fixture.tiers[0]!;

  const budgets = ['0', '89', '90', '294', '1000', '1e6', '1e12', '1e40', '1e120'];

  it.each(budgets)('agrees with a brute-force walk at a budget of %s', (budget) => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(budget);

    expect(maxAffordable(state, fixture, 'minion')).toBe(reference(new Decimal(budget)));
  });

  it.each(budgets)('spends no more than the purse holds at %s', (budget) => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(budget);
    const count = maxAffordable(state, fixture, 'minion');

    expect(bulkCost(state, fixture, 'minion', count)?.lte(new Decimal(budget))).toBe(true);
  });

  it.each(budgets)('leaves nothing affordable behind at %s', (budget) => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(budget);
    const count = maxAffordable(state, fixture, 'minion');

    expect(bulkCost(state, fixture, 'minion', count + 1)?.gt(new Decimal(budget))).toBe(true);
  });

  it('counts far past the five thousand the old ceiling stopped at', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal('1e250');

    expect(maxAffordable(state, fixture, 'minion')).toBeGreaterThan(5000);
  });

  it('starts the curve from what is already owned', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal('1e12');
    const count = maxAffordable(state, fixture, 'minion');

    expect(bulkCost(state, fixture, 'minion', count + 1)?.gt(state.resources.evil)).toBe(true);
  });

  it('affords nothing on an empty purse', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal(0);

    expect(maxAffordable(state, fixture, 'minion')).toBe(0);
  });

  it('stops at the safety ceiling when cost never grows', () => {
    const flat: Content = {
      ...fixture,
      tiers: fixture.tiers.map((tier) =>
        tier.id === 'minion' ? { ...tier, costRate: 1, baseCost: '1' } : tier,
      ),
    };
    const state = createState(flat);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal('1e30');

    expect(maxAffordable(state, flat, 'minion')).toBe(MAX_AFFORDABLE_CAP);
  });

  it('affords exactly the purse when cost never grows', () => {
    const flat: Content = {
      ...fixture,
      tiers: fixture.tiers.map((tier) =>
        tier.id === 'minion' ? { ...tier, costRate: 1, baseCost: '10' } : tier,
      ),
    };
    const state = createState(flat);
    state.gens.minion.owned = new Decimal(0);
    state.resources.evil = new Decimal(95);

    expect(maxAffordable(state, flat, 'minion')).toBe(9);
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
