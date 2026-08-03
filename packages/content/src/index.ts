export { TIER_IDS, RESOURCE_IDS, isTierId, isResourceId } from './ids.ts';
export type { TierId, ResourceId, ProducibleId } from './ids.ts';

export type { Content, TierDef, PrestigeDef } from './types.ts';

export { ART } from './art.ts';
export type { ArtSlot } from './art.ts';

export { v1 } from './v1/generators.ts';

import { v1 } from './v1/generators.ts';
import type { Content } from './types.ts';

/** The content the shipping game runs on. Engine tests must never import this. */
export const CURRENT: Content = v1;
