// habit-engine 公開API(habit-algorithm.md §4.2 の四本柱 + 補助)。
// UI(features/habit)からはこの index を通して使う。

export type {
  ActivityAttributes,
  ActivityType,
  AnchorType,
  ContextAnchor,
  DayOfWeek,
  Effort,
  HabitSpec,
  HabitState,
  LadderStep,
  Observation,
  PlanAssignment,
  PlanLadder,
  Stage,
  StepKind,
  TimeWindow,
  UserProfile,
  WeeklyPlan,
} from './types';

export { DEFAULT_CONFIG, LADDER_TEMPLATES, TYPE_ATTRIBUTES } from './config';
export type { EngineConfig, UtilityWeights, StageThresholds } from './config';

// 四本柱
export { canonicalize, classifyActivity, type RawActivity } from './canonicalize';
export { buildLadder, stepForKind } from './ladder';
export { generatePlan, type GenerateOptions } from './scheduler';
export { applyObservation, initialState } from './observation';

// 補助
export { pComplete, priorMean, stepDifficulty } from './successModel';
export { scoreSlot, preferenceScore, burdenScore } from './scorer';
export { candidateSlots, anchorForWindow, WEEK } from './windows';
export {
  chooseDailyIntervention,
  advanceRecovery,
  INTERVENTION_ORDER,
  type Intervention,
  type InterventionKind,
  type InterventionStrategy,
} from './recovery';
export { reviewMetrics, type ReviewMetrics } from './metrics';
