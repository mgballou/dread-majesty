import Decimal from 'break_eternity.js';
import type { Content, TierDef, TierId } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * Cost of the nth unit of a tier, zero-indexed by units already owned.
 *
 * cost(n) = floor(baseCost * costRate^n)
 */
export function costOfNth(tier: TierDef, n: Decimal): Decimal {
  return new Decimal(tier.baseCost).mul(Decimal.pow(tier.costRate, n)).floor();
}

export function nextCost(state: GameState, content: Content, tierId: TierId): Decimal | null {
  const tier = findTier(content, tierId);
  if (!tier) return null;
  return costOfNth(tier, state.gens[tierId].owned);
}

/**
 * Total cost of buying `quantity` more, summing each individual next-cost.
 *
 * Deliberately the exact loop rather than a geometric closed form: the per-term
 * floor means the closed form is not equal, only close. Spec §5.2 allows a closed
 * form only once it is tested against this.
 */
export function bulkCost(
  state: GameState,
  content: Content,
  tierId: TierId,
  quantity: number,
): Decimal | null {
  const tier = findTier(content, tierId);
  if (!tier) return null;

  const owned = state.gens[tierId].owned;
  let total = new Decimal(0);
  for (let i = 0; i < quantity; i += 1) {
    total = total.add(costOfNth(tier, owned.add(i)));
  }
  return total;
}

/**
 * The largest quantity the player can currently afford.
 *
 * A linear walk, capped. Realistic max-buys are small because the cost curve is
 * steep, but the cap means this is an approximation at the extreme. Replacing it
 * with a closed-form solve is an M1 task, and it must be tested against this.
 */
export const MAX_AFFORDABLE_CAP = 5000;

export function maxAffordable(state: GameState, content: Content, tierId: TierId): number {
  const tier = findTier(content, tierId);
  if (!tier) return 0;

  const budget = state.resources[tier.costResource];
  const owned = state.gens[tierId].owned;

  let spent = new Decimal(0);
  let count = 0;
  while (count < MAX_AFFORDABLE_CAP) {
    const next = spent.add(costOfNth(tier, owned.add(count)));
    if (next.gt(budget)) break;
    spent = next;
    count += 1;
  }
  return count;
}

export function findTier(content: Content, tierId: TierId): TierDef | undefined {
  return content.tiers.find((tier) => tier.id === tierId);
}
