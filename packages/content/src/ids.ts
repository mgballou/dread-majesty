export const TIER_IDS = ['minion', 'slum', 'legion', 'fortress'] as const;
export type TierId = (typeof TIER_IDS)[number];

export const RESOURCE_IDS = ['evil'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

/** Anything a tier can produce: a resource, or units of a lower tier. */
export type ProducibleId = TierId | ResourceId;

export function isTierId(id: string): id is TierId {
  return (TIER_IDS as readonly string[]).includes(id);
}

export function isResourceId(id: string): id is ResourceId {
  return (RESOURCE_IDS as readonly string[]).includes(id);
}
