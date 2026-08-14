export const TIER_IDS = ['minion', 'warren', 'legion', 'fortress', 'throne'] as const;
export type TierId = (typeof TIER_IDS)[number];

/**
 * Every post that can ever be filled, three per tier.
 *
 * `hand` takes the tier off the player's hands and runs it for ever. `goad` halves
 * the cycle. `glut` doubles the yield. Ids are permanent — a save records them — so
 * one may be added but never renamed or reused.
 */
export const OVERSEER_IDS = [
  'minion-hand',
  'minion-goad',
  'minion-glut',
  'warren-hand',
  'warren-goad',
  'warren-glut',
  'legion-hand',
  'legion-goad',
  'legion-glut',
  'fortress-hand',
  'fortress-goad',
  'fortress-glut',
  'throne-hand',
  'throne-goad',
  'throne-glut',
] as const;
export type OverseerId = (typeof OVERSEER_IDS)[number];

export const RESOURCE_IDS = ['evil'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

/** Anything a tier can produce: a resource, or units of a lower tier. */
export type ProducibleId = TierId | ResourceId;

/**
 * Every achievement the game can ever award.
 *
 * An id is a literal, never a `string`, so a typo fails typecheck rather than
 * silently awarding nothing. Ids are permanent: a save records them, so an id may be
 * added but never renamed or reused. Retiring one means dropping it here and
 * accepting that saves holding it lose it — `deserialize` filters unknown ids out.
 */
export const ACHIEVEMENT_IDS = [
  'minion-10',
  'minion-100',
  'minion-500',
  'minion-2500',
  'warren-1',
  'warren-25',
  'warren-200',
  'legion-1',
  'legion-25',
  'legion-200',
  'fortress-1',
  'fortress-25',
  'fortress-200',
  'throne-1',
  'throne-25',
  'throne-200',
  'evil-1e3',
  'evil-1e6',
  'evil-1e12',
  'evil-1e20',
  'souls-500',
  'souls-3000',
  'souls-10000',
  'prestige-1',
  'prestige-10',
  'smite-1',
  'smite-100',
  'smite-1000',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/**
 * The four ladders a player climbs to make a blow worth more.
 *
 * Ids are permanent — a save records the rung each one stands on — so one may be
 * added but never renamed or reused. Content order is offer order, and the content
 * lists Reach first because it is the cheapest and the one that teaches the system.
 */
export const SMITE_UPGRADE_IDS = ['weight', 'reach', 'forgetting', 'restraint'] as const;
export type SmiteUpgradeId = (typeof SMITE_UPGRADE_IDS)[number];

/**
 * The first run, in the order it is walked.
 *
 * Nothing persists these — the interface records only that onboarding was seen — so
 * unlike every other id set in this file they may be renamed freely.
 *
 * The order is the argument the track makes: set the Minion working, learn that it
 * stops, learn that Evil buys more of them, hand the job to somebody else, take ground
 * of your own, start it, and then watch Minions arrive without being asked.
 */
export const DOMINION_BEAT_IDS = [
  'stir',
  'orders',
  'muster',
  'appoint',
  'warren',
  'rouse-warren',
  'cascade',
] as const;
export type DominionBeatId = (typeof DOMINION_BEAT_IDS)[number];

/**
 * Smite, taught by being tempted into misusing it.
 *
 * Two of these three are the narrator and the middle one is not, which is why the voice
 * is a property of the beat rather than of the track. `verdict` follows `goad` so that
 * "her" always has an antecedent by the time the narrator uses it.
 */
export const MALICE_BEAT_IDS = ['first-blow', 'goad', 'verdict'] as const;
export type MaliceBeatId = (typeof MALICE_BEAT_IDS)[number];

export function isTierId(id: string): id is TierId {
  return (TIER_IDS as readonly string[]).includes(id);
}

export function isOverseerId(id: string): id is OverseerId {
  return (OVERSEER_IDS as readonly string[]).includes(id);
}

export function isAchievementId(id: string): id is AchievementId {
  return (ACHIEVEMENT_IDS as readonly string[]).includes(id);
}

export function isResourceId(id: string): id is ResourceId {
  return (RESOURCE_IDS as readonly string[]).includes(id);
}

export function isSmiteUpgradeId(id: string): id is SmiteUpgradeId {
  return (SMITE_UPGRADE_IDS as readonly string[]).includes(id);
}

export function isDominionBeatId(id: string): id is DominionBeatId {
  return (DOMINION_BEAT_IDS as readonly string[]).includes(id);
}

export function isMaliceBeatId(id: string): id is MaliceBeatId {
  return (MALICE_BEAT_IDS as readonly string[]).includes(id);
}
