export {
  TIER_IDS,
  RESOURCE_IDS,
  ACHIEVEMENT_IDS,
  OVERSEER_IDS,
  SMITE_UPGRADE_IDS,
  TOUR_STEP_IDS,
  DOMINION_BEAT_IDS,
  MALICE_BEAT_IDS,
  isTierId,
  isResourceId,
  isAchievementId,
  isOverseerId,
  isSmiteUpgradeId,
} from './ids.ts';
export type {
  TierId,
  ResourceId,
  ProducibleId,
  AchievementId,
  OverseerId,
  SmiteUpgradeId,
  TourStepId,
  DominionBeatId,
  MaliceBeatId,
} from './ids.ts';

export type {
  Content,
  TierDef,
  PrestigeDef,
  SmiteDef,
  SmiteRungDef,
  SmiteUpgradeDef,
  SmiteUnit,
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
  MaliceCopy,
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
  TourCopy,
  TourStepCopy,
} from './copy.ts';

export { ART } from './art.ts';
export type { ArtSlot } from './art.ts';

export type {
  BeatReady,
  BeatGate,
  BeatVoice,
  BeatClearedBy,
  OnboardingBeat,
  Onboarding,
} from './onboarding.ts';

export { v1 } from './v1/generators.ts';
export { v1Copy } from './v1/copy.ts';
export { v1Onboarding } from './v1/onboarding.ts';

import { v1 } from './v1/generators.ts';
import { v1Copy } from './v1/copy.ts';
import { v1Onboarding } from './v1/onboarding.ts';
import type { Content } from './types.ts';
import type { Copy } from './copy.ts';
import type { Onboarding } from './onboarding.ts';

/** The content the shipping game runs on. Engine tests must never import this. */
export const CURRENT: Content = v1;

/** The writing the shipping game runs on. Separate from `Content` — see copy.ts. */
export const CURRENT_COPY: Copy = v1Copy;

/**
 * The onboarding the shipping game runs on.
 *
 * A sibling of `CURRENT_COPY`, deliberately **not** a field on `Content`. The engine
 * takes `Content` as an argument and must never learn that a tutorial exists.
 */
export const CURRENT_ONBOARDING: Onboarding = v1Onboarding;
