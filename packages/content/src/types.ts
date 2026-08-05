import type {
  AchievementId,
  OverseerId,
  ProducibleId,
  ResourceId,
  SmiteUpgradeId,
  TierId,
} from './ids.ts';

/**
 * What filling a post does to its tier.
 *
 * Declarative, for the same reason `AchievementCondition` is: a function cannot be
 * validated, cannot be authored by anyone who does not write TypeScript, and cannot
 * survive the round trip through JSON that the meta-plane will eventually make.
 * Adding a kind is a change in two places — here, and the engine's `roster.ts`,
 * which the compiler forces once the union grows.
 *
 * `factor` stays at 2 so every effective cycle remains a whole number of seconds.
 * The harness runs 1s slices and depends on it (spec §5.7); a content test pins it.
 */
export type OverseerEffect =
  | { readonly kind: 'automate' }
  | { readonly kind: 'quicken'; readonly factor: number }
  | { readonly kind: 'swell'; readonly factor: number };

export interface OverseerDef {
  readonly id: OverseerId;
  /** Display title, e.g. "Taskmaster of the Pits". The engine never reads it. */
  readonly name: string;
  /** Evil to fill the post. A string, for the reason at the top of this file. */
  readonly cost: string;
  readonly effect: OverseerEffect;
}

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
   * The posts that can be filled over this tier. Content order is offer order.
   *
   * The first automates the tier; the rest raise what it produces. Three per tier,
   * and a reset takes all of them — an Overseer is power now, not convenience, so
   * losing one costs output and re-earning it is the spine of a run (spec §3).
   */
  readonly overseers: readonly OverseerDef[];
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

/** How a ladder's value should be drawn. The engine never reads it; the web does. */
export type SmiteUnit = 'seconds' | 'multiplier' | 'amount';

export interface SmiteRungDef {
  /** Evil to climb to this rung within a run. A string, so it never passes a float. */
  readonly evil: string;
  /** Souls to make this rung the permanent floor. A string, for the same reason. */
  readonly souls: string;
  /** What the effect reads at this rung. */
  readonly value: number;
}

/**
 * One ladder, and the four rungs above its base.
 *
 * `base` is rung 0 — what the ladder reads before anything is bought — and it carries
 * no price. Keeping it here rather than beside `cooldownMs` is what stops a base value
 * and a rung-0 value drifting apart.
 */
export interface SmiteUpgradeDef {
  readonly id: SmiteUpgradeId;
  /** Display title. The engine never reads it. */
  readonly name: string;
  readonly base: number;
  readonly unit: SmiteUnit;
  /** Rungs 1..N, ascending in price. Never includes rung 0. */
  readonly rungs: readonly SmiteRungDef[];
}

/**
 * The tap verb (spec §5.5), and what it costs to keep using it.
 *
 * A blow raises production for a while, and **every blow makes the next one worth
 * less**. Apathy bleeds off on its own, so striking well beats striking constantly and
 * both beat never striking. See `2026-08-04-smite-as-a-system-design.md` §2.
 *
 * The cooldown is flat and on no ladder. A blow lasts `reach` milliseconds, so a
 * cooldown shorter than that only re-ups a buff already running — the useful range
 * starts at the duration and every second above it cuts uptime. Escalating it could set
 * a ceiling but never create a choice, which is why the escalation is on the blow's
 * value instead. Reach is the tempo upgrade.
 */
export interface SmiteDef {
  readonly cooldownMs: number;
  readonly apathy: {
    /** Added to `smiteApathy` by every blow. */
    readonly perBlow: number;
    /** `smiteApathy` never exceeds this. */
    readonly cap: number;
  };
  /**
   * What a rung's Evil price is multiplied by, per reset already taken.
   *
   * **This is what stops the ladders going stale and what makes a Keep worth buying.**
   * A rung priced in flat Evil is a real decision on the first run and pocket change on
   * the fourth, because souls raise production and every later run is richer. Climbing
   * therefore gets dearer each time, and the soul price of *keeping* a rung does not —
   * so the gap between re-earning a rung and having kept it widens every reset, which
   * is the only thing that can make souls worth spending here.
   *
   * Growth applies to the Evil price alone. `SmiteRungDef.souls` is flat by rung for
   * ever, which is the whole of "the Evil goes up per run, the Keep goes up per rung".
   */
  readonly climbGrowth: number;
  /** One per `SmiteUpgradeId`. Content order is offer order. */
  readonly upgrades: readonly SmiteUpgradeDef[];
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
  readonly smite: SmiteDef;
}
