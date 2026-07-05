// habit-engine ドメインモデル(7オブジェクト、habit-algorithm.md §2)。
// UI非依存の純粋データ。入出力はすべてプレーンオブジェクト。

export type ActivityType = 'skill' | 'physical' | 'admin' | 'reflective' | 'environment-prep';
export type AnchorType = 'event' | 'location' | 'time';
export type StepKind = 'minimal' | 'standard' | 'stretch' | 'recovery';
export type Stage = 'initiate' | 'stabilize' | 'scale' | 'maintain' | 'recover';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
/** 努力感(3段階): 1=楽 2=普通 3=きつい */
export type Effort = 1 | 2 | 3;

/** canonicalize が推定する活動の性質(すべて 0..1) */
export interface ActivityAttributes {
  friction: number;
  setupCost: number;
  cueability: number;
  rewardDelay: number;
  safetyLevel: number;
}

/** 文脈手がかり(§2 ContextAnchor) */
export interface ContextAnchor {
  type: AnchorType;
  label: string;
  /** 対応する時間窓のID(UserProfile.availableWindows と対応) */
  windowId: string;
}

/** 個人差変数(§2 UserProfile) */
export interface TimeWindow {
  id: string;
  label: string;
  /** この窓が使える曜日 */
  days: DayOfWeek[];
  /** 使える分数(この窓の上限) */
  minutes: number;
  /** event-based の手がかり(あれば time より優先される)。例: "朝食後" */
  anchorEvent?: string;
  /** 0..1: この時間帯の本人のエネルギー(選好適合 F_preference に使う) */
  energy?: number;
  /** おおよその時刻(0..23)。B_burden/衝突判定の補助 */
  hour?: number;
}

export interface UserProfile {
  values: string[];
  availableWindows: TimeWindow[];
  maxNotificationsPerDay: number;
}

/** 正規化済みの活動仕様(§2 HabitSpec) */
export interface HabitSpec {
  id: string;
  activity: string;
  activityType: ActivityType;
  targetFrequencyPerWeek: number;
  goalType?: string;
  /** 優先して使いたい時間窓ID(UserProfile.availableWindows のID) */
  preferredContexts: string[];
  constraints: {
    /** 同一習慣の最小間隔日数 */
    minIntervalDays: number;
  };
  why?: string;
  attributes: ActivityAttributes;
}

/** 実行単位1段(§2 PlanLadder の要素) */
export interface LadderStep {
  kind: StepKind;
  label: string;
  /** 目安の所要分数(1日の負荷計算・難度に使う) */
  minutes: number;
}

/** 活動の4段階分解(§2 PlanLadder) */
export interface PlanLadder {
  habitId: string;
  minimal: LadderStep;
  standard: LadderStep;
  stretch: LadderStep;
  recovery: LadderStep;
}

/** 週間計画の1エントリ(§2 PlanAssignment) */
export interface PlanAssignment {
  habitId: string;
  step: LadderStep;
  windowId: string;
  anchor: ContextAnchor;
  day: DayOfWeek;
  /** この割当に時刻通知を付けるか(初期のみ。event cue 確立後は false) */
  notify: boolean;
}

export interface WeeklyPlan {
  assignments: PlanAssignment[];
  /** 各活動の復旧単位(併記、§11) */
  recoverySteps: Record<string, LadderStep>;
  /** 曜日ごとの通知数(maxNotificationsPerDay 検証用) */
  notificationsByDay: Record<DayOfWeek, number>;
}

/** 日次記録(§2 Observation) */
export interface Observation {
  habitId: string;
  /** 状態を分ける文脈キー(通常は windowId)。同一活動でも文脈別に HabitState を持つ(§2) */
  contextKey: string;
  date: string;
  completed: boolean;
  effort?: Effort;
  /** 計画した文脈で実行できたか */
  contextMatch?: boolean;
  /** 通知(プロンプト)がきっかけだったか。false=自己開始 */
  promptUsed?: boolean;
  stepKind?: StepKind;
}

/** システム推定の進行度(§2 HabitState)。(habitId, contextKey) 単位で1つ */
export interface HabitState {
  habitId: string;
  contextKey: string;
  stage: Stage;
  momentum: number;
  completionRate7: number;
  completionRate14: number;
  /** 通知依存度 0..1(完了のうち通知起点の割合) */
  promptDependence: number;
  /** 自己開始率 0..1(完了のうち通知なしの割合) */
  selfInitiationRate: number;
  /** 直近の未実行連続回数 */
  consecutiveMisses: number;
  /** recover 中の介入ステップindex(§7の順序を進める) */
  recoveryStage: number;
}
