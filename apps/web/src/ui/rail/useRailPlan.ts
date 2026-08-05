import { useMemo, useRef } from 'react';
import { railPlan, type HeldKeys, type RailPlan, type RailPlanInput } from './railPlan.ts';

/**
 * The ranked spends, with the accent's memory attached.
 *
 * `railPlan` is pure and stays pure — hysteresis needs to know what was lifted last
 * time, and that is state, so it lives here. The ref is read and written inside the
 * memo, which is a side effect in render and is deliberate: the memo runs once per
 * state version, and running it twice with the same inputs returns the same answer,
 * because the second run finds its own winner already held. That is what makes it safe
 * under StrictMode's double render.
 *
 * A panel with nothing affordable **keeps** its memory rather than clearing it, so
 * emptying the purse and filling it again resumes the same row instead of picking
 * afresh.
 */
export function useRailPlan(input: Omit<RailPlanInput, 'held'>, version: number): RailPlan {
  const held = useRef<HeldKeys>({ purchase: null, appoint: null, climb: null });
  const { state, content, quantity, isUnlocked } = input;

  return useMemo(() => {
    const plan = railPlan({ state, content, quantity, isUnlocked, held: held.current });

    held.current = {
      purchase: plan.best.purchase?.tierId ?? held.current.purchase,
      appoint: plan.best.appoint?.overseerId ?? held.current.appoint,
      climb: plan.best.climb?.upgradeId ?? held.current.climb,
    };

    return plan;
    // `state` is mutated in place, so its identity never changes and `version` is what
    // a recompute actually hangs on. Both are listed; only one ever moves.
  }, [state, content, quantity, isUnlocked, version]);
}
