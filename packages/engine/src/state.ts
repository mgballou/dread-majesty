import Decimal from 'break_eternity.js';
import type { Content, ResourceId, TierId } from '@dm/content';
import { RESOURCE_IDS, TIER_IDS } from '@dm/content';
import type { AchievementId } from '@dm/content';
import type { GameState, TierState } from './types.ts';

/**
 * 1: the original shape.
 * 2: adds `earnedAchievements`.
 * 3: adds `unlocked`.
 * 4: adds `overseers`, and `running` on every tier.
 * 5: adds the two smite countdowns.
 */
export const SAVE_VERSION = 5;

export function createState(content: Content): GameState {
  const resources = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) resources[id] = new Decimal(0);

  // Every tier starts manual and stopped, with nobody appointed to any of them. The
  // one free Minion therefore produces nothing until the player rouses it, which is
  // the opening spec §5.6 asks for.
  const gens = {} as Record<TierId, TierState>;
  for (const id of TIER_IDS) {
    gens[id] = {
      owned: new Decimal(0),
      progressMs: 0,
      lifetimeProduced: new Decimal(0),
      running: false,
    };
  }

  const overseers = {} as Record<TierId, boolean>;
  for (const id of TIER_IDS) overseers[id] = false;

  // A dark lord starts with a shed and a grievance.
  const first = content.tiers.find((tier) => tier.produces === 'evil');
  if (first) gens[first.id].owned = new Decimal(1);

  // A tier you already own is a tier you have obviously seen. With no Evil banked
  // that is the whole of the unlock condition at this point; the rest of it needs a
  // resource balance, which a fresh state does not have.
  const unlocked = {} as Record<TierId, boolean>;
  for (const id of TIER_IDS) unlocked[id] = gens[id].owned.gt(0);

  const earnedAchievements: AchievementId[] = [];

  return {
    saveVersion: SAVE_VERSION,
    resources,
    gens,
    souls: new Decimal(0),
    lifetimeEvil: new Decimal(0),
    earnedAchievements,
    unlocked,
    overseers,
    smiteActiveMs: 0,
    smiteCooldownMs: 0,
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
      running: g.running,
    };
  }

  const unlocked = {} as Record<TierId, boolean>;
  for (const id of TIER_IDS) unlocked[id] = state.unlocked[id];

  const overseers = {} as Record<TierId, boolean>;
  for (const id of TIER_IDS) overseers[id] = state.overseers[id];

  return {
    saveVersion: state.saveVersion,
    resources,
    gens,
    souls: new Decimal(state.souls),
    lifetimeEvil: new Decimal(state.lifetimeEvil),
    earnedAchievements: [...state.earnedAchievements],
    unlocked,
    overseers,
    smiteActiveMs: state.smiteActiveMs,
    smiteCooldownMs: state.smiteCooldownMs,
    stats: { ...state.stats },
  };
}
