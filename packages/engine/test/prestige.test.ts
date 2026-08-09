import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { msToNextSoul, soulsEarned } from '../src/selectors.ts';
import { createState } from '../src/state.ts';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';

describe('soulsEarned', () => {
  it('pays nothing at zero lifetime Evil', () => {
    expect(soulsEarned(createState(fixture), fixture).toString()).toBe('0');
  });

  it('pays k souls at one whole scale of lifetime Evil', () => {
    const state = createState(fixture);
    state.lifetimeEvil = new Decimal(fixture.prestige.scale);

    expect(soulsEarned(state, fixture).toString()).toBe(String(fixture.prestige.k));
  });

  it('floors normally with a fractional part below half, outside epsilon', () => {
    const state = createState(fixture);
    state.lifetimeEvil = new Decimal(fixture.prestige.scale).mul(0.0049);

    expect(soulsEarned(state, fixture).toString()).toBe('10');
  });

  it('floors normally with a fractional part above half, outside epsilon', () => {
    const state = createState(fixture);
    state.lifetimeEvil = new Decimal(fixture.prestige.scale).mul(0.008464);

    expect(soulsEarned(state, fixture).toString()).toBe('13');
  });
});

describe('msToNextSoul', () => {
  it('reports nothing when nothing is running', () => {
    expect(msToNextSoul(createState(fixture), fixture)).toBeNull();
  });

  it('shortens as lifetime Evil climbs toward the next soul', () => {
    const early = appointed(fixture);
    early.gens.minion.owned = new Decimal(5);

    const late = appointed(fixture);
    late.gens.minion.owned = new Decimal(5);
    late.lifetimeEvil = new Decimal(fixture.prestige.scale)
      .div(Decimal.pow(fixture.prestige.k, 1 / fixture.prestige.exponent))
      .div(2);

    expect(msToNextSoul(late, fixture) ?? Infinity).toBeLessThan(msToNextSoul(early, fixture) ?? 0);
  });

  it('reports the gap divided by the rate', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(1);
    state.lifetimeEvil = new Decimal(0);

    const rate = new Decimal(fixture.tiers[1]?.yield ?? '0').div(24);
    const target = new Decimal(fixture.prestige.scale).div(
      Decimal.pow(fixture.prestige.k, 1 / fixture.prestige.exponent),
    );

    expect(msToNextSoul(state, fixture)).toBeCloseTo(target.div(rate).mul(1000).toNumber(), -3);
  });
});

describe('soulsEarned at an exponent that is not a square root', () => {
  it('raises lifetime Evil to the exponent the content names', () => {
    const content = { ...fixture, prestige: { ...fixture.prestige, exponent: 1 } };
    const state = createState(content);
    state.lifetimeEvil = new Decimal('2e11');

    expect(soulsEarned(state, content).toNumber()).toBe(300);
  });

  it('still reads as a square root when the exponent says so', () => {
    const content = { ...fixture, prestige: { ...fixture.prestige, exponent: 0.5 } };
    const state = createState(content);
    state.lifetimeEvil = new Decimal('4e11');

    expect(soulsEarned(state, content).toNumber()).toBe(300);
  });
});

describe('the soul formula and its inverse', () => {
  const exponents = [0.5, 0.2, 0.055];
  const lifetimes = ['1e10', '5e12', '3e15', '7e18', '2e22', '9e25'];

  it('never pays fewer souls for more lifetime Evil', () => {
    for (const exponent of exponents) {
      const content = { ...fixture, prestige: { ...fixture.prestige, exponent } };
      let previous = new Decimal(-1);
      for (const lifetime of lifetimes) {
        const state = createState(content);
        state.lifetimeEvil = new Decimal(lifetime);
        const souls = soulsEarned(state, content);
        expect(souls.gte(previous)).toBe(true);
        previous = souls;
      }
    }
  });

  it('puts the next soul strictly ahead of where the player stands', () => {
    let checked = 0;
    for (const exponent of exponents) {
      const content = { ...fixture, prestige: { ...fixture.prestige, exponent } };
      for (const lifetime of lifetimes) {
        const state = appointed(content);
        state.lifetimeEvil = new Decimal(lifetime);
        state.gens.minion.owned = new Decimal(10);
        const wait = msToNextSoul(state, content);
        if (wait === null) continue;
        expect(wait).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBe(18);
  });
});
