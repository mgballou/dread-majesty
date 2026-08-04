import { describe, expect, it } from 'vitest';
import { CURRENT } from '@dm/content';
import { createState } from '@dm/engine';
import { isPrestigeWorthShowing } from './reveals.ts';

const firstSoul = Number(CURRENT.prestige.scale) / CURRENT.prestige.k ** 2;

describe('isPrestigeWorthShowing', () => {
  it('stays out of the way on a fresh save', () => {
    expect(isPrestigeWorthShowing(createState(CURRENT), CURRENT)).toBe(false);
  });

  it('stays out of the way a tenth of the way to the first soul', () => {
    const state = createState(CURRENT);
    state.lifetimeEvil = state.lifetimeEvil.add(firstSoul * 0.1);
    expect(isPrestigeWorthShowing(state, CURRENT)).toBe(false);
  });

  it('arrives a quarter of the way to the first soul', () => {
    const state = createState(CURRENT);
    state.lifetimeEvil = state.lifetimeEvil.add(firstSoul * 0.3);
    expect(isPrestigeWorthShowing(state, CURRENT)).toBe(true);
  });

  it('stays once a soul has been taken, whatever the board looks like', () => {
    const state = createState(CURRENT);
    state.souls = state.souls.add(1);
    expect(isPrestigeWorthShowing(state, CURRENT)).toBe(true);
  });

  it('stays after a reset that paid nothing', () => {
    const state = createState(CURRENT);
    state.stats.prestiges = 1;
    expect(isPrestigeWorthShowing(state, CURRENT)).toBe(true);
  });
});
