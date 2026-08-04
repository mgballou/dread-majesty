import Decimal from 'break_eternity.js';
import { renderHook } from '@testing-library/react';
import { CURRENT } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRailPlan } from './useRailPlan.ts';

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
  state.resources.evil = new Decimal(2600);
});

const input = (): Parameters<typeof useRailPlan>[0] => ({
  state,
  content: CURRENT,
  quantity: 1,
  isUnlocked: () => true,
});

describe('the plan remembers what it lifted', () => {
  it('lifts the same purchase on a recompute', () => {
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    const first = result.current.best.purchase?.tierId;
    rerender({ v: 2 });
    expect(result.current.best.purchase?.tierId).toBe(first);
  });

  it('keeps the memory while the purse is empty', () => {
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    const first = result.current.best.purchase?.tierId;
    state.resources.evil = new Decimal(0);
    rerender({ v: 2 });
    state.resources.evil = new Decimal(2600);
    rerender({ v: 3 });
    expect(result.current.best.purchase?.tierId).toBe(first);
  });
});
