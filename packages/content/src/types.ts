import type { AchievementId, ProducibleId, ResourceId, TierId } from './ids.ts';

/**
 * One rung of the production chain.
 *
 * Every numeric value that feeds a resource or generator count is a string, so it
 * survives the trip into `Decimal` without ever passing through a JS float.
 * `cycleMs` and `costRate` are plain numbers: the first is exact integer
 * milliseconds, the second never grows large enough to lose precision.
 */
export interface TierDef {
  readonly id: TierId;
  /** Singular display name, e.g. "Minion". */
  readonly name: string;
  /** Plural display name, e.g. "Minions". */
  readonly plural: string;
  /** What one cycle of this tier produces. */
  readonly produces: ProducibleId;
  /** Produced per owned unit, per completed cycle, before multipliers. */
  readonly yield: string;
  /** Exact integer milliseconds. Never a fraction — see engine/src/step.ts. */
  readonly cycleMs: number;
  readonly costResource: ResourceId;
  readonly baseCost: string;
  /** cost(n) = floor(baseCost * costRate^n). Deliberately varies per tier. */
  readonly costRate: number;
  /**
   * Evil to appoint this tier's Overseer, after which the tier runs for ever.
   *
   * A string for the same reason `baseCost` is one. Set at roughly 0.4× the next
   * tier's base cost, so appointing competes directly with reaching the tier above —
   * that trade is the point of the number (spec §5.6).
   */
  readonly overseerCost: string;
  /** Key into the art manifest. Every key has a generated SVG fallback. */
  readonly art: string;
}

/**
 * What an achievement asks of the player.
 *
 * Declarative and serialisable — deliberately not a function. A function cannot be
 * validated, cannot be authored by anyone who does not write TypeScript, and cannot
 * survive a round trip through JSON when the balance config eventually ships from the
 * meta-plane. Adding a kind is a change in two places: here, and the engine's
 * `isConditionMet`, which the compiler forces once the union grows.
 *
 * `atLeast` is a string wherever the threshold feeds a `Decimal`, for the reason at
 * the top of this file. Where it counts plain events it is a number.
 */
export type AchievementCondition =
  | { readonly kind: 'tier-owned'; readonly tierId: TierId; readonly atLeast: string }
  | { readonly kind: 'lifetime-evil'; readonly atLeast: string }
  | { readonly kind: 'souls'; readonly atLeast: string }
  | { readonly kind: 'prestiges'; readonly atLeast: number }
  | { readonly kind: 'smites'; readonly atLeast: number };

export interface AchievementDef {
  readonly id: AchievementId;
  readonly name: string;
  /** One line, shown under the name. */
  readonly description: string;
  readonly condition: AchievementCondition;
  /**
   * Folded into the global production multiplier while earned.
   *
   * Every shipping achievement sets `1`, so achievements are cosmetic today. The
   * engine genuinely multiplies by this, so turning them into a power source later is
   * a content edit and not an engine change. See spec §10.4.
   */
  readonly multiplier: number;
}

/**
 * One owned-count threshold, and what passing it is worth.
 *
 * A multiplier **per rung**, not one shared across the ladder. That distinction is
 * load-bearing. With a single flat value the total is `shared^(rungs passed)`, and
 * generator counts run past 1e20, so a player passes every rung on the ladder — the
 * ladder's *length* alone would set the late-game multiplier. Extending six rungs to
 * fifteen took the whole economy 2.2× faster and moved first prestige from 2h46m to
 * 1h17m. Per-rung values let the ladder keep offering a next goal without that.
 *
 * Thresholds must be ascending; the engine stops walking at the first one the count
 * has not reached.
 */
export interface MilestoneDef {
  readonly at: number;
  readonly multiplier: number;
}

export interface PrestigeDef {
  /** souls = floor(k * sqrt(lifetimeEvil / scale)) */
  readonly k: number;
  readonly scale: string;
  /** Additive share of the global multiplier granted per soul. 0.02 = +2%. */
  readonly perSoul: number;
}

export interface Content {
  readonly version: string;
  readonly tiers: readonly TierDef[];
  /** Owned-count thresholds that each multiply that tier's output. Ascending. */
  readonly milestones: readonly MilestoneDef[];
  readonly achievements: readonly AchievementDef[];
  /**
   * A tier becomes visible once the player has ever held this share of the cost of
   * its next unit. Half reads as "nearly there" without the row flickering in and out
   * the way "can afford right now" does.
   */
  readonly unlockFraction: number;
  readonly prestige: PrestigeDef;
  /** Offline production is clamped to this. Raisable by upgrades later. */
  readonly offlineCapMs: number;
  /** A smite is worth this many seconds of current production. */
  readonly smiteSeconds: number;
}
