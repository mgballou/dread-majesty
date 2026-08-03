import Decimal from 'break_eternity.js';
import type { Content, ProducibleId, TierId } from '@dm/content';
import { globalMultiplier, tierMultiplier } from './step.ts';
import type { GameState } from './types.ts';

/**
 * Steady-state production of one producible, per second, at current counts.
 *
 * A rate, not a simulation. It ignores compounding — new generators arriving from
 * higher tiers will change it. Use it for display and for smite value, never as a
 * substitute for running `step`.
 */
export function productionPerSecond(
  state: GameState,
  content: Content,
  producible: ProducibleId,
): Decimal {
  let total = new Decimal(0);

  for (const tier of content.tiers) {
    if (tier.produces !== producible) continue;
    const owned = state.gens[tier.id].owned;
    if (owned.lte(0)) continue;

    const perCycle = owned.mul(new Decimal(tier.yield)).mul(tierMultiplier(state, content, owned));
    total = total.add(perCycle.div(tier.cycleMs / 1000));
  }

  return total;
}

/** Souls this run would yield if cashed in now, above what the player already holds. */
export function prestigeGain(state: GameState, content: Content): Decimal {
  const { k, scale } = content.prestige;
  const earned = state.lifetimeEvil.div(new Decimal(scale)).sqrt().mul(k).floor();
  return Decimal.max(0, earned.sub(state.souls));
}

export function canAfford(
  state: GameState,
  content: Content,
  tierId: TierId,
  cost: Decimal,
): boolean {
  const tier = content.tiers.find((candidate) => candidate.id === tierId);
  if (!tier) return false;
  return state.resources[tier.costResource].gte(cost);
}

export interface MilestoneProgress {
  next: number | null;
  owned: Decimal;
  remaining: Decimal | null;
}

/** Drives the "12 more for ×2" line every rail row needs. */
export function milestoneProgress(
  state: GameState,
  content: Content,
  tierId: TierId,
): MilestoneProgress {
  const owned = state.gens[tierId].owned;
  const next = content.milestones.find((threshold) => owned.lt(threshold)) ?? null;
  return {
    next,
    owned,
    remaining: next === null ? null : new Decimal(next).sub(owned),
  };
}

export { globalMultiplier };
