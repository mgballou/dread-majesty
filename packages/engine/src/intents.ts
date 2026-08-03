import Decimal from 'break_eternity.js';
import type { Content } from '@dm/content';
import { bulkCost, findTier, maxAffordable } from './cost.ts';
import { productionPerSecond, prestigeGain } from './selectors.ts';
import { createState } from './state.ts';
import type { GameState, Intent, IntentResult } from './types.ts';

/**
 * Apply a player intent.
 *
 * Mutates `state` in place. With `step`, one of only two functions permitted to.
 */
export function apply(state: GameState, content: Content, intent: Intent): IntentResult {
  switch (intent.kind) {
    case 'purchase':
      return purchase(state, content, intent);
    case 'smite':
      return smite(state, content, intent);
    case 'prestige':
      return prestige(state, content, intent);
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
  const perSecond = productionPerSecond(state, content, 'evil');
  const gain = Decimal.max(1, perSecond.mul(content.smiteSeconds)).floor();

  state.resources.evil = state.resources.evil.add(gain);
  state.lifetimeEvil = state.lifetimeEvil.add(gain);
  state.stats.smites += 1;

  return { ok: true, intent, detail: `Smote for ${gain.toString()} Evil` };
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
  };

  const fresh = createState(content);
  state.resources = fresh.resources;
  state.gens = fresh.gens;
  state.souls = carried.souls;
  state.lifetimeEvil = carried.lifetimeEvil;
  state.stats = carried.stats;

  return { ok: true, intent, detail: `Claimed ${gain.toString()} Damned Souls` };
}
