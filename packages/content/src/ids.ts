export const TIER_IDS = ['minion', 'warren', 'legion', 'fortress', 'throne'] as const;
export type TierId = (typeof TIER_IDS)[number];

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
  'souls-1',
  'souls-100',
  'souls-10000',
  'prestige-1',
  'prestige-10',
  'smite-1',
  'smite-100',
  'smite-1000',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export function isTierId(id: string): id is TierId {
  return (TIER_IDS as readonly string[]).includes(id);
}

export function isAchievementId(id: string): id is AchievementId {
  return (ACHIEVEMENT_IDS as readonly string[]).includes(id);
}

export function isResourceId(id: string): id is ResourceId {
  return (RESOURCE_IDS as readonly string[]).includes(id);
}
