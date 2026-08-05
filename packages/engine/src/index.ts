export { createState, cloneState, SAVE_VERSION, MIN_SUPPORTED_SAVE_VERSION } from './state.ts';
export { step, tierMultiplier, globalMultiplier, BASE_DT_MS } from './step.ts';
export { apply } from './intents.ts';
export { catchUp, COARSE_DT_MS, COARSEN_ABOVE_MS } from './offline.ts';
export { smiteValueAt, smiteWeight, smiteDurationMs, smiteBleedMs, smiteStep } from './smite.ts';

export {
  costOfNth,
  nextCost,
  bulkCost,
  maxAffordable,
  findTier,
  MAX_AFFORDABLE_CAP,
} from './cost.ts';
export {
  productionPerSecond,
  overseenProductionPerSecond,
  prestigeGain,
  soulsEarned,
  msToNextSoul,
  canAfford,
  milestoneProgress,
  isUnlockReached,
  isTierUnlocked,
  isAppointed,
  isRousable,
  overseerCost,
  canAppoint,
  canSmite,
  smitePhase,
} from './selectors.ts';
export type { MilestoneProgress } from './selectors.ts';

export {
  findOverseer,
  hasPost,
  hasAutomator,
  automatorOf,
  effectiveCycleMs,
  effectiveYield,
} from './roster.ts';
export type { OverseerId } from '@dm/content';

export { isConditionMet, newlyEarnedAchievements, achievementMultiplier } from './achievements.ts';

export {
  serialize,
  deserialize,
  migrate,
  exportSave,
  importSave,
  UnmigratableSave,
  ObsoleteSave,
  CorruptSave,
} from './save.ts';
export type { SaveBlob } from './save.ts';

export type {
  GameState,
  TierState,
  StepReport,
  OfflineReport,
  Intent,
  IntentResult,
  IntentFailure,
} from './types.ts';
