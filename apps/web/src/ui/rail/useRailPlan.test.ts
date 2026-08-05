import Decimal from 'break_eternity.js';
import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { CURRENT } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRailPlan } from './useRailPlan.ts';

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
  state.resources.evil = new Decimal(5200);
});

const input = (): Parameters<typeof useRailPlan>[0] => ({
  state,
  content: CURRENT,
  quantity: 1,
  isUnlocked: () => true,
});

function dearWarrens(): void {
  state.gens.warren.owned = new Decimal(3);
  state.gens.warren.purchased = new Decimal(3);
}

function nearTie(): void {
  state.gens.warren.owned = new Decimal(1);
  state.gens.warren.purchased = new Decimal(1);
}

describe('the plan remembers what it lifted', () => {
  it('lifts the same purchase on a recompute', () => {
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    const first = result.current.best.purchase?.tierId;
    rerender({ v: 2 });
    expect(result.current.best.purchase?.tierId).toBe(first);
  });

  it('holds its choice against a challenger that only just beats it', () => {
    dearWarrens();
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    nearTie();
    rerender({ v: 2 });
    expect(result.current.best.purchase?.tierId).toBe('minion');
  });

  it('keeps the memory while the purse is empty', () => {
    dearWarrens();
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    state.resources.evil = new Decimal(0);
    rerender({ v: 2 });
    nearTie();
    state.resources.evil = new Decimal(5200);
    rerender({ v: 3 });
    expect(result.current.best.purchase?.tierId).toBe('minion');
  });

  /* The memo reads and writes a ref during render, which StrictMode runs twice. */
  it('gives the same answer under a double render', () => {
    dearWarrens();
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
      wrapper: StrictMode,
    });
    nearTie();
    rerender({ v: 2 });
    expect(result.current.best.purchase?.tierId).toBe('minion');
  });
});
