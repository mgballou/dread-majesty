import Decimal from 'break_eternity.js';
import type { Content, OverseerId, ProducibleId, TierId } from '@dm/content';
import { nextCost } from './cost.ts';
import { effectiveCycleMs, effectiveYield, findOverseer, hasAutomator, hasPost } from './roster.ts';
import { globalMultiplier, tierMultiplier } from './step.ts';
import type { GameState } from './types.ts';

/**
 * Steady-state production of one producible, per second, at current counts.
 *
 * A rate, not a simulation. It ignores compounding — new generators arriving from
 * higher tiers will change it. Use it for display and for smite value, never as a
 * substitute for running `step`.
 *
 * **It reports potential production and deliberately ignores `running` and
 * `overseers`** — what the tiers would make if every one of them were turning, not
 * what they are making this instant. Do not "fix" this. Smite reads it, and a smite
 * worth three seconds of *actual* production would pay the floor of 1 for ever to a
 * player who has roused nothing, which is precisely the player Smite has to carry
 * (spec §5.5).
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

    const perCycle = owned
      .mul(effectiveYield(state, tier))
      .mul(tierMultiplier(state, content, owned));
    total = total.add(perCycle.div(effectiveCycleMs(state, tier) / 1000));
  }

  return total;
}

/**
 * The same rate, counting only the tiers that keep turning on their own.
 *
 * This is the honest headline figure. `productionPerSecond` reports what the machine
 * *could* make and is right to, because Smite is paid out of potential — but a crown
 * reading "0.63 Evil per second" while nothing at all is running is telling the
 * player something untrue about their own game.
 *
 * A roused manual tier is left out on purpose. It pays once and stops, so it has no
 * rate; counting it would make the headline jump every four seconds and settle back.
 * What a tapping player earns shows up in the Evil count, which is the number beside
 * this one.
 */
export function overseenProductionPerSecond(
  state: GameState,
  content: Content,
  producible: ProducibleId,
): Decimal {
  let total = new Decimal(0);

  for (const tier of content.tiers) {
    if (tier.produces !== producible || !hasAutomator(state, tier)) continue;
    const owned = state.gens[tier.id].owned;
    if (owned.lte(0)) continue;

    const perCycle = owned
      .mul(effectiveYield(state, tier))
      .mul(tierMultiplier(state, content, owned));
    total = total.add(perCycle.div(effectiveCycleMs(state, tier) / 1000));
  }

  return total;
}

/**
 * How close a pre-floor souls figure must sit to a whole number to be treated as
 * that whole number rather than floored past it.
 *
 * Exists for one reason: `break_eternity.js`'s own division loses precision on
 * Decimals of similar magnitude — `new Decimal('1e11').div(new Decimal('1e11'))`
 * returns `0.9999999999999999`, not `1`. At `lifetimeEvil` landing on an exact
 * multiple of `scale`, that noise lands the pre-floor value a hair under the next
 * integer, so a plain `floor` shorts the player one soul they earned. This value
 * matches the library's own `eq_tolerance` default (its documented answer to this
 * exact class of noise) and only ever changes the result when the gap to the
 * nearest integer is that small — do not delete this as superstition, and do not
 * widen it into a general "round to nearest" without re-reading why it exists.
 */
const SOUL_EPSILON = 1e-7;

/**
 * What the prestige formula pays for the lifetime Evil on hand, before subtracting
 * held souls.
 */
export function soulsEarned(state: GameState, content: Content): Decimal {
  const { k, scale } = content.prestige;
  const raw = state.lifetimeEvil.div(new Decimal(scale)).sqrt().mul(k);
  const nearest = raw.round();
  return raw.sub(nearest).abs().lte(SOUL_EPSILON) ? nearest : raw.floor();
}

/** Souls this run would yield if cashed in now, above what the player already holds. */
export function prestigeGain(state: GameState, content: Content): Decimal {
  return Decimal.max(0, soulsEarned(state, content).sub(state.souls));
}

/**
 * Milliseconds to the next soul, at the rate the automated tiers are turning now.
 *
 * A straight-line estimate and honestly one: it holds every generator count still,
 * and in play the counts climb, so the real wait is always shorter. That is the
 * right way for it to be wrong — a figure that flattered the player would be worse
 * than one that undersells.
 *
 * Reads the automated rate rather than the potential one, because this answers "how
 * long if I walk away", and a tier nobody oversees produces nothing while you are
 * gone (spec §5.6). Null when nothing is turning, and null rather than `Infinity`
 * when the gap is too large for a JS number to carry.
 */
export function msToNextSoul(state: GameState, content: Content): number | null {
  const { k, scale } = content.prestige;
  const target = new Decimal(scale).mul(soulsEarned(state, content).add(1).div(k).pow(2));
  const remaining = target.sub(state.lifetimeEvil);
  // `soulsEarned` takes a square root; `target` squares back up. They are inverse
  // operations, not the same computation, and a double mantissa cannot always carry
  // one back through the other exactly — well past 1e30 the two paths routinely
  // disagree about which side of an integer `lifetimeEvil` actually sits on.
  // `remaining <= 0` there means precision has run out, not that a soul is due.
  // Null, the existing "cannot say" contract, is the honest answer — never a false
  // "any moment now" that would sit on the panel forever because the soul count
  // never moves to clear it.
  if (remaining.lte(0)) return null;

  const rate = overseenProductionPerSecond(state, content, 'evil');
  if (rate.lte(0)) return null;

  const ms = remaining.div(rate).mul(1000).toNumber();
  return Number.isFinite(ms) ? ms : null;
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

/**
 * Whether this tier has somebody automating it, and so runs without being told.
 *
 * The convenience wrapper: callers here hold a `TierId`, not a `TierDef`, so
 * resolving the tier is this function's own job — `hasAutomator` in `roster.ts` is
 * the hot-path function underneath it and takes the tier directly.
 */
export function isAppointed(state: GameState, content: Content, tierId: TierId): boolean {
  const tier = content.tiers.find((candidate) => candidate.id === tierId);
  return tier !== undefined && hasAutomator(state, tier);
}

/**
 * Whether rousing this tier now would do anything.
 *
 * False for a tier already turning, a tier the player owns none of, and a tier
 * somebody automates — that last one never stopped, so there is nothing to rouse.
 */
export function isRousable(state: GameState, content: Content, tierId: TierId): boolean {
  const tier = content.tiers.find((candidate) => candidate.id === tierId);
  if (tier && hasAutomator(state, tier)) return false;

  const gen = state.gens[tierId];
  return gen.owned.gt(0) && !gen.running;
}

/** What filling this post costs. Null for a post not in the content. */
export function overseerCost(content: Content, overseerId: OverseerId): Decimal | null {
  const found = findOverseer(content, overseerId);
  return found ? new Decimal(found.post.cost) : null;
}

/** Whether the player could fill this post right now. */
export function canAppoint(state: GameState, content: Content, overseerId: OverseerId): boolean {
  const found = findOverseer(content, overseerId);
  if (!found) return false;
  if (hasPost(state, found.tier.id, found.post.id)) return false;
  if (!state.unlocked[found.tier.id]) return false;

  return state.resources[found.tier.costResource].gte(new Decimal(found.post.cost));
}

export interface MilestoneProgress {
  /** Owned count the next threshold sits at, or null once every one is passed. */
  next: number | null;
  /** What passing it is worth. Null alongside `next`. */
  multiplier: number | null;
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
  const next = content.milestones.find((milestone) => owned.lt(milestone.at)) ?? null;
  return {
    next: next?.at ?? null,
    multiplier: next?.multiplier ?? null,
    owned,
    remaining: next === null ? null : new Decimal(next.at).sub(owned),
  };
}

/**
 * Whether a tier's unlock condition holds at this instant.
 *
 * The condition: the player owns at least one, or holds at least
 * `content.unlockFraction` of what the next one costs. Half of the price reads as
 * "nearly there", which is the moment a row earns its place on the rail.
 *
 * "Can afford right now" is the obvious alternative and is worse: the row appears and
 * vanishes every time the player spends, which is exactly the flicker the interface
 * rules forbid. That is why the answer here is latched into `state.unlocked` by the
 * `record-unlocks` intent, and why this predicate is never what the interface reads.
 */
export function isUnlockReached(state: GameState, content: Content, tierId: TierId): boolean {
  if (state.gens[tierId].owned.gt(0)) return true;

  const tier = content.tiers.find((candidate) => candidate.id === tierId);
  if (!tier) return false;

  const cost = nextCost(state, content, tierId);
  if (!cost) return false;

  return state.resources[tier.costResource].gte(cost.mul(content.unlockFraction));
}

/** The latched flag. This is what the interface reads; it never goes back to false. */
export function isTierUnlocked(state: GameState, tierId: TierId): boolean {
  return state.unlocked[tierId];
}

export { globalMultiplier };

/** Whether a blow may be struck right now. */
export function canSmite(state: GameState): boolean {
  return state.smiteCooldownMs <= 0;
}

/**
 * How far through the buff or the cooldown the player is, as a share from 0 to 1.
 *
 * A share rather than a count of milliseconds, because every caller is drawing a bar
 * or a ring with it and none of them should have to know the content's durations.
 * Returns 0 for a state that is neither buffed nor cooling, which is the resting case.
 */
export function smitePhase(
  state: GameState,
  content: Content,
): { readonly kind: 'active' | 'cooling' | 'ready'; readonly share: number } {
  if (state.smiteActiveMs > 0) {
    return { kind: 'active', share: state.smiteActiveMs / content.smite.durationMs };
  }
  if (state.smiteCooldownMs > 0) {
    return { kind: 'cooling', share: state.smiteCooldownMs / content.smite.cooldownMs };
  }
  return { kind: 'ready', share: 0 };
}
