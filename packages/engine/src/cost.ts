import Decimal from 'break_eternity.js';
import type { Content, TierDef, TierId } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * Cost of the nth unit of a tier, zero-indexed by units already **bought**.
 *
 * cost(n) = floor(baseCost * costRate^n)
 */
export function costOfNth(tier: TierDef, n: Decimal): Decimal {
  return new Decimal(tier.baseCost).mul(Decimal.pow(tier.costRate, n)).floor();
}

export function nextCost(state: GameState, content: Content, tierId: TierId): Decimal | null {
  const tier = findTier(content, tierId);
  if (!tier) return null;
  return costOfNth(tier, state.gens[tierId].purchased);
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

  const purchased = state.gens[tierId].purchased;
  let total = new Decimal(0);
  for (let i = 0; i < quantity; i += 1) {
    total = total.add(costOfNth(tier, purchased.add(i)));
  }
  return total;
}

/**
 * A last-resort ceiling, for content a sane balance pass would never ship.
 *
 * It is not a limit on what a player may buy. `affordableCeiling` derives a real
 * bound from the cost curve, and the walk below stops at the first unaffordable
 * unit regardless. This exists only so a `costRate` of 1 or below — where cost
 * stops growing and the answer is unbounded — cannot spin forever.
 */
export const MAX_AFFORDABLE_CAP = 1_000_000;

/**
 * The largest quantity the player can currently afford.
 *
 * Exact. It sums real next-costs and stops at the first one it cannot pay, so it
 * agrees with `bulkCost` by construction rather than by approximation — which
 * matters, because a "max" buy that under-reports leaves Evil on the table and a
 * player counting units would see it.
 *
 * The old version stopped at a flat 5,000 units, which silently truncated any
 * late-game max-buy on a cheap tier. What replaces the flat cap is a ceiling
 * derived from the curve itself (see `affordableCeiling`).
 *
 * Cost is O(answer), and the answer is logarithmic in the budget: costs grow like
 * `rate^n`, so affording `q` units takes a budget on the order of `rate^q`. Even at
 * 1e300 Evil against the cheapest tier that is a few thousand terms, and in play it
 * is nearly always nought or a handful — the early return below covers the case
 * that dominates every frame.
 */
export function maxAffordable(state: GameState, content: Content, tierId: TierId): number {
  const tier = findTier(content, tierId);
  if (!tier) return 0;

  const budget = state.resources[tier.costResource];
  const purchased = state.gens[tierId].purchased;

  if (budget.lt(costOfNth(tier, purchased))) return 0;

  const ceiling = affordableCeiling({ tier, owned: purchased, budget });

  let spent = new Decimal(0);
  let count = 0;
  while (count < ceiling) {
    const next = spent.add(costOfNth(tier, purchased.add(count)));
    if (next.gt(budget)) break;
    spent = next;
    count += 1;
  }
  return count;
}

interface CeilingInput {
  tier: TierDef;
  owned: Decimal;
  budget: Decimal;
}

/**
 * An upper bound on the answer, so the walk provably terminates without truncating.
 *
 * The unfloored cost of `q` units from `owned` is a geometric series:
 *
 *     U(q) = base·rate^owned · (rate^q − 1) / (rate − 1)
 *
 * Each `floor` removes strictly less than 1, so the true sum `S(q)` satisfies
 * `U(q) − q < S(q) ≤ U(q)`. Any affordable `q` therefore has `U(q) < budget + q`,
 * and `q` is itself below the safety cap, so every affordable `q` satisfies
 * `U(q) < budget + MAX_AFFORDABLE_CAP`. Solving that for `q` gives the bound.
 *
 * The bound only has to be large enough — the walk's own test is what makes the
 * answer exact — so it is rounded up and given a couple of units of slack against
 * floating-point error in the logarithm.
 */
function affordableCeiling({ tier, owned, budget }: CeilingInput): number {
  // Cost stops growing, so the answer is bounded by the purse rather than by the
  // curve. Degenerate content; the safety cap is the honest answer.
  if (tier.costRate <= 1) return MAX_AFFORDABLE_CAP;

  const first = new Decimal(tier.baseCost).mul(Decimal.pow(tier.costRate, owned));
  if (first.lte(0)) return MAX_AFFORDABLE_CAP;

  const reach = budget
    .add(MAX_AFFORDABLE_CAP)
    .mul(tier.costRate - 1)
    .div(first);
  const bound = new Decimal(1).add(reach).log(tier.costRate).toNumber();
  if (!Number.isFinite(bound)) return MAX_AFFORDABLE_CAP;

  return Math.min(MAX_AFFORDABLE_CAP, Math.ceil(bound) + 2);
}

export function findTier(content: Content, tierId: TierId): TierDef | undefined {
  return content.tiers.find((tier) => tier.id === tierId);
}
