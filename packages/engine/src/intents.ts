import Decimal from 'break_eternity.js';
import type { Content, TierId } from '@dm/content';
import { newlyEarnedAchievements } from './achievements.ts';
import { bulkCost, findTier, maxAffordable } from './cost.ts';
import { findOverseer, hasAutomator, hasPost } from './roster.ts';
import { isUnlockReached, prestigeGain } from './selectors.ts';
import { nextBlowMultiplier, smiteDurationMs } from './smite.ts';
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
    case 'climb':
      return climbLadder(state, content, intent);
    case 'keep':
      return keepRung(state, content, intent);
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
  state.gens[tier.id].purchased = state.gens[tier.id].purchased.add(quantity);

  return { ok: true, intent, detail: `Bought ${quantity} ${tier.plural}` };
}

function smite(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'smite' }>,
): IntentResult {
  if (state.smiteCooldownMs > 0) return { ok: false, intent, reason: 'smite-cooling' };

  state.stats.smites += 1;

  // Read before the strike, never after. This blow is priced by the Apathy it found,
  // not by the Apathy it causes — which is what makes the first blow of a run full
  // weight and the fourth one nearly nothing.
  state.smiteBlow = nextBlowMultiplier(state, content);

  // Set, not added: striking again the moment the cooldown lifts restarts the buff
  // rather than stacking it, so two blows can never be worth more than two blows.
  state.smiteActiveMs = smiteDurationMs(state, content);
  state.smiteCooldownMs = content.smite.cooldownMs;

  state.smiteApathy = Math.min(
    content.smite.apathy.cap,
    state.smiteApathy + content.smite.apathy.perBlow,
  );

  return { ok: true, intent, detail: 'Struck' };
}

/**
 * Buy the next rung of one ladder with Evil.
 *
 * Named `climbLadder` rather than `climb` only because `smite.ts` already exports
 * `climbCost` and a bare `climb` beside it reads as its pair when it is not.
 */
function climbLadder(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'climb' }>,
): IntentResult {
  const upgrade = content.smite.upgrades.find((entry) => entry.id === intent.upgradeId);
  if (!upgrade) return { ok: false, intent, reason: 'unknown-upgrade' };

  const rung = state.smiteRungs[intent.upgradeId];
  const next = upgrade.rungs[rung];
  if (!next) return { ok: false, intent, reason: 'rung-maxed' };

  const cost = new Decimal(next.evil);
  const budget = state.resources.evil;
  if (cost.gt(budget)) return { ok: false, intent, reason: 'insufficient-resource' };

  state.resources.evil = budget.sub(cost);
  state.smiteRungs[intent.upgradeId] = rung + 1;

  return { ok: true, intent, detail: `Climbed ${upgrade.name} to ${rung + 1}` };
}

/**
 * Spend souls to make a rung survive the next reset.
 *
 * The rung must already be climbed. Souls buy permanence and never progress, so the
 * floor can only ever follow where Evil has already been.
 *
 * The souls go onto `soulsSpent` as well as off `souls`, because `prestigeGain` is
 * `soulsEarned − souls` and without the record every Keep would refund itself on the
 * next reset.
 */
function keepRung(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'keep' }>,
): IntentResult {
  const upgrade = content.smite.upgrades.find((entry) => entry.id === intent.upgradeId);
  if (!upgrade) return { ok: false, intent, reason: 'unknown-upgrade' };

  const kept = state.smiteKept[intent.upgradeId];
  if (kept >= state.smiteRungs[intent.upgradeId]) {
    return { ok: false, intent, reason: 'nothing-to-keep' };
  }

  const next = upgrade.rungs[kept];
  if (!next) return { ok: false, intent, reason: 'rung-maxed' };

  const cost = new Decimal(next.souls);
  if (cost.gt(state.souls)) return { ok: false, intent, reason: 'insufficient-souls' };

  state.souls = state.souls.sub(cost);
  state.soulsSpent = state.soulsSpent.add(cost);
  state.smiteKept[intent.upgradeId] = kept + 1;

  return { ok: true, intent, detail: `Kept ${upgrade.name} at ${kept + 1}` };
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
  if (hasAutomator(state, tier)) {
    return { ok: false, intent, reason: 'already-appointed' };
  }

  const gen = state.gens[tier.id];
  if (gen.owned.lte(0)) return { ok: false, intent, reason: 'tier-not-owned' };
  if (gen.running) return { ok: false, intent, reason: 'already-running' };

  gen.running = true;
  return { ok: true, intent, detail: `Roused the ${tier.plural}` };
}

/**
 * Fill one post over one tier.
 *
 * Rebuilds `state.overseers[tier.id]` in content order rather than pushing, the same
 * reason `record-achievements` rebuilds rather than appends: two states that filled
 * the same posts then hold them in the same order, and there is no tie-break rule to
 * get wrong.
 *
 * Only the automator clears `running`. A tier nobody automates still has a manual
 * cycle in flight — filling its `quicken` or `swell` post must not cancel that.
 */
function appoint(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'appoint' }>,
): IntentResult {
  const found = findOverseer(content, intent.overseerId);
  if (!found) return { ok: false, intent, reason: 'unknown-overseer' };

  const { tier, post } = found;
  if (hasPost(state, tier.id, post.id)) return { ok: false, intent, reason: 'already-appointed' };
  if (!state.unlocked[tier.id]) return { ok: false, intent, reason: 'tier-not-met' };

  const cost = new Decimal(post.cost);
  const budget = state.resources[tier.costResource];
  if (cost.gt(budget)) return { ok: false, intent, reason: 'insufficient-resource' };

  state.resources[tier.costResource] = budget.sub(cost);
  state.overseers[tier.id] = tier.overseers
    .filter((candidate) => candidate.id === post.id || hasPost(state, tier.id, candidate.id))
    .map((candidate) => candidate.id);

  if (post.effect.kind === 'automate') state.gens[tier.id].running = false;

  return { ok: true, intent, detail: `Appointed the ${post.name}` };
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
    stats: { ...state.stats, prestiges: state.stats.prestiges + 1, runMs: 0 },
    // Spec §5.4: a reset keeps achievements and unlock flags. A player who has seen
    // the Fortress row does not lose it for starting over. Overseers are pointedly
    // not on this list — spec §3.4 reverses the old rule that kept them, because a
    // roster is power rather than a record of having seen something: losing one
    // costs output, and re-earning it is the spine of a run.
    // Every `running` flag does go, and `createState` supplies the false ones.
    earnedAchievements: state.earnedAchievements,
    unlocked: state.unlocked,
    smiteKept: { ...state.smiteKept },
    soulsSpent: state.soulsSpent,
  };

  const fresh = createState(content);
  state.resources = fresh.resources;
  state.gens = fresh.gens;
  state.souls = carried.souls;
  state.lifetimeEvil = carried.lifetimeEvil;
  state.earnedAchievements = carried.earnedAchievements;
  state.unlocked = carried.unlocked;
  state.overseers = fresh.overseers;
  // Evil-bought rungs go; soul-bought floors stay, and the run restarts standing on
  // them. `kept <= rung` holds by construction, so this is the whole of the reset.
  state.smiteKept = carried.smiteKept;
  state.smiteRungs = { ...carried.smiteKept };
  state.soulsSpent = carried.soulsSpent;
  // The run is over, so the buff goes with it. The cooldown and the Apathy do not: both
  // are limits on how often a player may strike, and clearing either would hand out a
  // free blow per reset. Apathy bleeds out inside a minute anyway.
  state.smiteActiveMs = 0;
  state.smiteBlow = 1;
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
