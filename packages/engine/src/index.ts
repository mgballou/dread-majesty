export { createState, cloneState, SAVE_VERSION } from './state.ts';
export { step, tierMultiplier, globalMultiplier, BASE_DT_MS } from './step.ts';
export { apply } from './intents.ts';
export { catchUp, COARSE_DT_MS, COARSEN_ABOVE_MS } from './offline.ts';

export {
  costOfNth,
  nextCost,
  bulkCost,
  maxAffordable,
  findTier,
  MAX_AFFORDABLE_CAP,
} from './cost.ts';
export { productionPerSecond, prestigeGain, canAfford, milestoneProgress } from './selectors.ts';
export type { MilestoneProgress } from './selectors.ts';

export {
  serialize,
  deserialize,
  migrate,
  exportSave,
  importSave,
  UnmigratableSave,
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
