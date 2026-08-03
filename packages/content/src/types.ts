import type { ProducibleId, ResourceId, TierId } from './ids.ts';

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
  /** Key into the art manifest. Every key has a generated SVG fallback. */
  readonly art: string;
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
  /** Owned-count thresholds that each multiply that tier's output. */
  readonly milestones: readonly number[];
  readonly milestoneMultiplier: number;
  readonly prestige: PrestigeDef;
  /** Offline production is clamped to this. Raisable by upgrades later. */
  readonly offlineCapMs: number;
  /** A smite is worth this many seconds of current production. */
  readonly smiteSeconds: number;
}
