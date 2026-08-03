import Decimal from 'break_eternity.js';
import type { Content, TierId } from '@dm/content';
import { newlyEarnedAchievements } from './achievements.ts';
import { bulkCost, findTier, maxAffordable } from './cost.ts';
import { isUnlockReached, productionPerSecond, prestigeGain } from './selectors.ts';
import { createState } from './state.ts';
import type { GameState, Intent, IntentResult } from './types.ts';

/**
 * Apply an intent.
 *
 * Mutates `state` in place. With `step`, one of only two functions permitted to.
 */
export function apply(state: GameState, content: Content, intent: Intent): IntentResult {
  switch (intent.kind) {
    case 'purchase':
      return purchase(state, content, intent);
    case 'smite':
      return smite(state, content, intent);
    case 'rouse':
      return rouse(state, content, intent);
    case 'appoint':
      return appoint(state, content, intent);
    case 'prestige':
      return prestige(state, content, intent);
    case 'record-achievements':
      return recordAchievements(state, content, intent);
    case 'record-unlocks':
      return recordUnlocks(state, content, intent);
  }
}

function purchase(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'purchase' }>,
): IntentResult {
  const tier = findTier(content, intent.tierId);
  if (!tier) return { ok: false, intent, reason: 'unknown-tier' };

  const quantity =
    intent.quantity === 'max' ? maxAffordable(state, content, intent.tierId) : intent.quantity;

  if (quantity <= 0) return { ok: false, intent, reason: 'nothing-affordable' };

  const cost = bulkCost(state, content, intent.tierId, quantity);
  if (!cost) return { ok: false, intent, reason: 'unknown-tier' };

  const budget = state.resources[tier.costResource];
  if (cost.gt(budget)) return { ok: false, intent, reason: 'insufficient-resource' };

  state.resources[tier.costResource] = budget.sub(cost);
  state.gens[tier.id].owned = state.gens[tier.id].owned.add(quantity);

  return { ok: true, intent, detail: `Bought ${quantity} ${tier.plural}` };
}

function smite(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'smite' }>,
): IntentResult {
  if (state.smiteCooldownMs > 0) return { ok: false, intent, reason: 'smite-cooling' };

  // The instant part, which is what keeps a blow worth striking before anything is
  // running: a multiplier on nothing is nothing, and the opening minutes are exactly
  // when the player has nothing (spec §5.5). It reads potential production, not what
  // is turning this instant, for the same reason.
  const perSecond = productionPerSecond(state, content, 'evil');
  const gain = Decimal.max(1, perSecond.mul(content.smite.seconds)).floor();

  state.resources.evil = state.resources.evil.add(gain);
  state.lifetimeEvil = state.lifetimeEvil.add(gain);
  state.stats.smites += 1;

  // The lasting part. Set, not added: striking again the moment the cooldown lifts
  // restarts the buff rather than stacking it, so two blows can never be worth more
  // than two blows.
  state.smiteActiveMs = content.smite.durationMs;
  state.smiteCooldownMs = content.smite.cooldownMs;

  return { ok: true, intent, detail: `Smote for ${gain.toString()} Evil` };
}

/**
 * Start one manual cycle.
 *
 * The tap verb that is not Smite. Smite pays now; rousing starts a tier producing.
 * An appointed tier has nothing to rouse — it never stopped.
 */
function rouse(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'rouse' }>,
): IntentResult {
  const tier = findTier(content, intent.tierId);
  if (!tier) return { ok: false, intent, reason: 'unknown-tier' };
  if (state.overseers[tier.id]) return { ok: false, intent, reason: 'already-appointed' };

  const gen = state.gens[tier.id];
  if (gen.owned.lte(0)) return { ok: false, intent, reason: 'tier-not-owned' };
  if (gen.running) return { ok: false, intent, reason: 'already-running' };

  gen.running = true;
  return { ok: true, intent, detail: `Roused the ${tier.plural}` };
}

/**
 * Hire a tier's Overseer, after which it runs for ever.
 *
 * Clears `running` on the way through. Not a reset — an appointed tier's timer keeps
 * whatever progress it had. It only means `running` never has to be read again for a
 * tier somebody oversees, so the two flags cannot drift into disagreeing.
 */
function appoint(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'appoint' }>,
): IntentResult {
  const tier = findTier(content, intent.tierId);
  if (!tier) return { ok: false, intent, reason: 'unknown-tier' };
  if (state.overseers[tier.id]) return { ok: false, intent, reason: 'already-appointed' };

  const cost = new Decimal(tier.overseerCost);
  const budget = state.resources[tier.costResource];
  if (cost.gt(budget)) return { ok: false, intent, reason: 'insufficient-resource' };

  state.resources[tier.costResource] = budget.sub(cost);
  state.overseers[tier.id] = true;
  state.gens[tier.id].running = false;

  return { ok: true, intent, detail: `Appointed an Overseer over the ${tier.plural}` };
}

function prestige(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'prestige' }>,
): IntentResult {
  const gain = prestigeGain(state, content);
  if (gain.lte(0)) return { ok: false, intent, reason: 'no-souls-earned' };

  const carried = {
    souls: state.souls.add(gain),
    lifetimeEvil: state.lifetimeEvil,
    stats: { ...state.stats, prestiges: state.stats.prestiges + 1 },
    // Spec §5.4: a reset keeps achievements and unlock flags. A player who has seen
    // the Fortress row does not lose it for starting over. Spec §5.6 adds Overseers
    // to that list: the tapping phase is an opening, not a tax to pay every reset.
    // Every `running` flag does go, and `createState` supplies the false ones.
    earnedAchievements: state.earnedAchievements,
    unlocked: state.unlocked,
    overseers: state.overseers,
  };

  const fresh = createState(content);
  state.resources = fresh.resources;
  state.gens = fresh.gens;
  state.souls = carried.souls;
  state.lifetimeEvil = carried.lifetimeEvil;
  state.earnedAchievements = carried.earnedAchievements;
  state.unlocked = carried.unlocked;
  state.overseers = carried.overseers;
  // The run is over, so the buff goes with it. The cooldown does not: it is a limit on
  // how often a player may strike, and resetting would hand out a free blow per reset.
  state.smiteActiveMs = 0;
  state.stats = carried.stats;

  return { ok: true, intent, detail: `Claimed ${gain.toString()} Damned Souls` };
}

/**
 * Award every achievement the state now satisfies.
 *
 * Called at the boundary after a batch of slices, never per slice. Rebuilds the list
 * in content order so two states holding the same achievements hold them in the same
 * order. Ids no longer present in the running content drop out, which is what makes
 * retiring an achievement possible at all.
 */
function recordAchievements(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'record-achievements' }>,
): IntentResult {
  const newly = newlyEarnedAchievements(state, content);
  if (newly.length === 0) return { ok: true, intent, detail: 'No new achievements' };

  const earned = new Set([...state.earnedAchievements, ...newly]);
  state.earnedAchievements = content.achievements
    .filter((achievement) => earned.has(achievement.id))
    .map((achievement) => achievement.id);

  return { ok: true, intent, detail: `Earned ${newly.length} achievements` };
}

/**
 * Latch the unlock flag of every tier whose condition now holds.
 *
 * Only ever sets a flag to true, so a tier the player has met cannot disappear from
 * the rail — not on spending, and not on a prestige reset.
 */
function recordUnlocks(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'record-unlocks' }>,
): IntentResult {
  const newly: TierId[] = [];

  for (const tier of content.tiers) {
    if (state.unlocked[tier.id]) continue;
    if (!isUnlockReached(state, content, tier.id)) continue;
    state.unlocked[tier.id] = true;
    newly.push(tier.id);
  }

  return { ok: true, intent, detail: `Unlocked ${newly.length} tiers` };
}
