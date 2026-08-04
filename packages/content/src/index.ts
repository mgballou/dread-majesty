export {
  TIER_IDS,
  RESOURCE_IDS,
  ACHIEVEMENT_IDS,
  OVERSEER_IDS,
  isTierId,
  isResourceId,
  isAchievementId,
  isOverseerId,
} from './ids.ts';
export type { TierId, ResourceId, ProducibleId, AchievementId, OverseerId } from './ids.ts';

export type {
  Content,
  TierDef,
  PrestigeDef,
  SmiteDef,
  MilestoneDef,
  AchievementDef,
  AchievementCondition,
  OverseerDef,
  OverseerEffect,
} from './types.ts';

export type {
  Copy,
  TierCopy,
  ResourceCopy,
  AchievementCopy,
  SmiteCopy,
  MilestoneCopy,
  PrestigeCopy,
  OfflineCopy,
  EmptyCopy,
  RailCopy,
  OverseerCopy,
  StageCopy,
  DeedsCopy,
  LedgerCopy,
  ErrorCopy,
} from './copy.ts';

export { ART } from './art.ts';
export type { ArtSlot } from './art.ts';

export { v1 } from './v1/generators.ts';
export { v1Copy } from './v1/copy.ts';

import { v1 } from './v1/generators.ts';
import { v1Copy } from './v1/copy.ts';
import type { Content } from './types.ts';
import type { Copy } from './copy.ts';

/** The content the shipping game runs on. Engine tests must never import this. */
export const CURRENT: Content = v1;

/** The writing the shipping game runs on. Separate from `Content` — see copy.ts. */
export const CURRENT_COPY: Copy = v1Copy;
