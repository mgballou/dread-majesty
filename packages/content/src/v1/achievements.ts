import type { AchievementId } from '../ids.ts';
import type { AchievementCondition, AchievementDef } from '../types.ts';
import { v1Copy } from './copy.ts';

/**
 * The shipping achievement list.
 *
 * Cosmetic, with the hook already wired: every entry sets `multiplier: 1` and the
 * engine genuinely multiplies by it, so making achievements a power source later is
 * an edit to this file alone (spec §10.4). When one does earn a real multiplier,
 * `defineAchievement` grows a third, object-shaped parameter.
 *
 * The names and descriptions live in `copy.ts`, keyed by id, so the whole voice of
 * the game sits in one file and a missing string fails typecheck. What lives here is
 * only what the engine reads: ids, conditions and multipliers. **The ids are
 * permanent** — a save records them, so one may be added but never renamed.
 *
 * The spread covers each tier at three or four depths, plus lifetime Evil, souls,
 * prestiges and smites, so a player always has one within sight.
 */
function defineAchievement(id: AchievementId, condition: AchievementCondition): AchievementDef {
  return { id, ...v1Copy.achievements[id], condition, multiplier: 1 };
}

export const v1Achievements: readonly AchievementDef[] = [
  defineAchievement('minion-10', { kind: 'tier-owned', tierId: 'minion', atLeast: '10' }),
  defineAchievement('minion-100', { kind: 'tier-owned', tierId: 'minion', atLeast: '100' }),
  defineAchievement('minion-500', { kind: 'tier-owned', tierId: 'minion', atLeast: '500' }),
  defineAchievement('minion-2500', { kind: 'tier-owned', tierId: 'minion', atLeast: '2500' }),

  defineAchievement('warren-1', { kind: 'tier-owned', tierId: 'warren', atLeast: '1' }),
  defineAchievement('warren-25', { kind: 'tier-owned', tierId: 'warren', atLeast: '25' }),
  defineAchievement('warren-200', { kind: 'tier-owned', tierId: 'warren', atLeast: '200' }),

  defineAchievement('legion-1', { kind: 'tier-owned', tierId: 'legion', atLeast: '1' }),
  defineAchievement('legion-25', { kind: 'tier-owned', tierId: 'legion', atLeast: '25' }),
  defineAchievement('legion-200', { kind: 'tier-owned', tierId: 'legion', atLeast: '200' }),

  defineAchievement('fortress-1', { kind: 'tier-owned', tierId: 'fortress', atLeast: '1' }),
  defineAchievement('fortress-25', { kind: 'tier-owned', tierId: 'fortress', atLeast: '25' }),
  defineAchievement('fortress-200', { kind: 'tier-owned', tierId: 'fortress', atLeast: '200' }),

  defineAchievement('throne-1', { kind: 'tier-owned', tierId: 'throne', atLeast: '1' }),
  defineAchievement('throne-25', { kind: 'tier-owned', tierId: 'throne', atLeast: '25' }),
  defineAchievement('throne-200', { kind: 'tier-owned', tierId: 'throne', atLeast: '200' }),

  defineAchievement('evil-1e3', { kind: 'lifetime-evil', atLeast: '1e3' }),
  defineAchievement('evil-1e6', { kind: 'lifetime-evil', atLeast: '1e6' }),
  defineAchievement('evil-1e12', { kind: 'lifetime-evil', atLeast: '1e12' }),
  defineAchievement('evil-1e20', { kind: 'lifetime-evil', atLeast: '1e20' }),

  defineAchievement('souls-1', { kind: 'souls', atLeast: '1' }),
  defineAchievement('souls-100', { kind: 'souls', atLeast: '100' }),
  defineAchievement('souls-10000', { kind: 'souls', atLeast: '10000' }),

  defineAchievement('prestige-1', { kind: 'prestiges', atLeast: 1 }),
  defineAchievement('prestige-10', { kind: 'prestiges', atLeast: 10 }),

  defineAchievement('smite-1', { kind: 'smites', atLeast: 1 }),
  defineAchievement('smite-100', { kind: 'smites', atLeast: 100 }),
  defineAchievement('smite-1000', { kind: 'smites', atLeast: 1000 }),
];
