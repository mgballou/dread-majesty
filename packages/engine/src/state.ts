import Decimal from 'break_eternity.js';
import type { Content, ResourceId, TierId } from '@dm/content';
import { RESOURCE_IDS, TIER_IDS } from '@dm/content';
import type { GameState, TierState } from './types.ts';

export const SAVE_VERSION = 1;

export function createState(content: Content): GameState {
  const resources = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) resources[id] = new Decimal(0);

  const gens = {} as Record<TierId, TierState>;
  for (const id of TIER_IDS) {
    gens[id] = { owned: new Decimal(0), progressMs: 0, lifetimeProduced: new Decimal(0) };
  }

  // A dark lord starts with a shed and a grievance.
  const first = content.tiers.find((tier) => tier.produces === 'evil');
  if (first) gens[first.id].owned = new Decimal(1);

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: new Decimal(0),
    lifetimeEvil: new Decimal(0),
    stats: { playTimeMs: 0, smites: 0, prestiges: 0 },
  };
}

/** For tests and what-if calculations. Never used on the live loop. */
export function cloneState(state: GameState): GameState {
  const resources = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) resources[id] = new Decimal(state.resources[id]);

  const gens = {} as Record<TierId, TierState>;
  for (const id of TIER_IDS) {
    const g = state.gens[id];
    gens[id] = {
      owned: new Decimal(g.owned),
      progressMs: g.progressMs,
      lifetimeProduced: new Decimal(g.lifetimeProduced),
    };
  }

  return {
    saveVersion: state.saveVersion,
    resources,
    gens,
    souls: new Decimal(state.souls),
    lifetimeEvil: new Decimal(state.lifetimeEvil),
    stats: { ...state.stats },
  };
}
