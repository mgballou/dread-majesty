import Decimal from 'break_eternity.js';
import type { AchievementCondition, AchievementId, Content } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * Whether one achievement condition holds right now.
 *
 * Pure and read-only. The switch has no default: adding a condition kind to the
 * content union makes this fail typecheck until it is handled, which is the whole
 * reason the condition is declarative data rather than a function.
 */
export function isConditionMet(state: GameState, condition: AchievementCondition): boolean {
  switch (condition.kind) {
    case 'tier-owned':
      return state.gens[condition.tierId].owned.gte(new Decimal(condition.atLeast));
    case 'lifetime-evil':
      return state.lifetimeEvil.gte(new Decimal(condition.atLeast));
    case 'souls':
      return state.souls.gte(new Decimal(condition.atLeast));
    case 'prestiges':
      return state.stats.prestiges >= condition.atLeast;
    case 'smites':
      return state.stats.smites >= condition.atLeast;
  }
}

/**
 * Achievements the state now satisfies but has not been awarded.
 *
 * Read-only. Recording them is the `record-achievements` intent's job, so the caller
 * can show what was earned before the state changes under it.
 */
export function newlyEarnedAchievements(state: GameState, content: Content): AchievementId[] {
  const recorded = new Set<AchievementId>(state.earnedAchievements);
  const newly: AchievementId[] = [];

  for (const achievement of content.achievements) {
    if (recorded.has(achievement.id)) continue;
    if (isConditionMet(state, achievement.condition)) newly.push(achievement.id);
  }

  return newly;
}

/**
 * The product of every earned achievement's multiplier.
 *
 * One today, because every shipping achievement grants `1`. It is live anyway: the
 * engine really does multiply by it, so making achievements a power source is a
 * content edit and not an engine change (spec §10.4).
 *
 * This runs inside `globalMultiplier`, which runs per tier per slice, so it walks the
 * content list rather than the earned list and skips a neutral multiplier before
 * doing any lookup. With every multiplier at 1 that is a handful of number
 * comparisons and no allocation.
 */
export function achievementMultiplier(state: GameState, content: Content): Decimal {
  let multiplier = new Decimal(1);

  for (const achievement of content.achievements) {
    if (achievement.multiplier === 1) continue;
    if (!state.earnedAchievements.includes(achievement.id)) continue;
    multiplier = multiplier.mul(achievement.multiplier);
  }

  return multiplier;
}
