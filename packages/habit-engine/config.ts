import type { ActivityType, AnchorType, StepKind } from './types';

// 係数・閾値・テンプレートの外出し(habit-algorithm.md §5 の要請:
// 係数は設定ファイルで外出しし、テストで感度を確認できるようにする)。
// すべての関数は EngineConfig を任意引数で受け取り、既定は DEFAULT_CONFIG。

/** 効用 U(s,w) の係数 α〜ζ(§5) */
export interface UtilityWeights {
  /** α: 完了確率 */
  pComplete: number;
  /** β: cue品質 */
  cue: number;
  /** γ: 選好適合 */
  preference: number;
  /** δ: 週目標との差分 */
  gap: number;
  /** ε: 通知・疲労負荷 */
  burden: number;
  /** ζ: スケジュール衝突 */
  conflict: number;
}

export interface StageThresholds {
  /** initiate→stabilize に必要な直近14日完了率 */
  stabilizeCompletion: number;
  /** stabilize→scale に必要な完了率(かつ努力感が低い) */
  scaleCompletion: number;
  /** 難度上げを許す努力感の上限(平均) */
  scaleEffortMax: number;
  /** 難度下げを引き起こす完了率の下限 */
  downgradeCompletion: number;
  /** maintain に必要な自己開始率 */
  maintainSelfInitiation: number;
  /** recover 突入の未実行連続回数 */
  recoverConsecutiveMisses: number;
}

export interface EngineConfig {
  weights: UtilityWeights;
  /** momentum の減衰係数(§6: momentum = decay·momentum + completed) */
  momentumDecay: number;
  /** cue 種別ごとの品質スコア(event > location > time、§2/§5) */
  cueQuality: Record<AnchorType, number>;
  thresholds: StageThresholds;
  /** 1日の最大負荷(分)。これを超える割当は不可 */
  maxDailyLoadMinutes: number;
  /** 初期(cue確立前)に時刻通知を許可する週。§8 */
  reminderInitialWeeks: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  weights: {
    pComplete: 1.0,
    cue: 0.8,
    preference: 0.5,
    gap: 0.9,
    burden: 0.6,
    conflict: 1.2,
  },
  momentumDecay: 0.8,
  cueQuality: { event: 1.0, location: 0.6, time: 0.3 },
  thresholds: {
    stabilizeCompletion: 0.6,
    scaleCompletion: 0.8,
    scaleEffortMax: 2,
    downgradeCompletion: 0.4,
    maintainSelfInitiation: 0.7,
    recoverConsecutiveMisses: 3,
  },
  maxDailyLoadMinutes: 60,
  reminderInitialWeeks: 2,
};

/** 活動タイプ別の属性初期値(§3 の分類例に準拠、0..1) */
export const TYPE_ATTRIBUTES: Record<
  ActivityType,
  { friction: number; setupCost: number; cueability: number; rewardDelay: number; safetyLevel: number }
> = {
  skill: { friction: 0.3, setupCost: 0.2, cueability: 0.8, rewardDelay: 0.8, safetyLevel: 1.0 },
  physical: { friction: 0.5, setupCost: 0.5, cueability: 0.6, rewardDelay: 0.6, safetyLevel: 0.8 },
  admin: { friction: 0.4, setupCost: 0.2, cueability: 0.7, rewardDelay: 0.5, safetyLevel: 1.0 },
  reflective: { friction: 0.2, setupCost: 0.1, cueability: 0.7, rewardDelay: 0.4, safetyLevel: 1.0 },
  'environment-prep': {
    friction: 0.3,
    setupCost: 0.3,
    cueability: 0.6,
    rewardDelay: 0.3,
    safetyLevel: 1.0,
  },
};

/** ラダーテンプレート(§4 の表)。minutes は目安の中央値 */
export const LADDER_TEMPLATES: Record<
  ActivityType,
  Record<StepKind, { label: string; minutes: number }>
> = {
  skill: {
    minimal: { label: '3〜5分の単一練習', minutes: 5 },
    standard: { label: '10〜20分の練習', minutes: 15 },
    stretch: { label: '25〜40分の練習', minutes: 30 },
    recovery: { label: '1分の再接続', minutes: 1 },
  },
  physical: {
    minimal: { label: '1セット or 3〜5分の軽運動', minutes: 5 },
    standard: { label: '10〜20分の運動', minutes: 15 },
    stretch: { label: '25〜40分の運動', minutes: 30 },
    recovery: { label: '30〜90秒の代替運動', minutes: 1 },
  },
  admin: {
    minimal: { label: '1件記録・1アクション', minutes: 3 },
    standard: { label: '5〜10分の処理', minutes: 8 },
    stretch: { label: '15〜30分の処理', minutes: 20 },
    recovery: { label: '写真保存・メモのみ', minutes: 1 },
  },
  reflective: {
    minimal: { label: '一行記録', minutes: 2 },
    standard: { label: '5分の振り返り', minutes: 5 },
    stretch: { label: '15分の振り返り', minutes: 15 },
    recovery: { label: '気分タグのみ', minutes: 1 },
  },
  'environment-prep': {
    minimal: { label: '1つ準備する', minutes: 3 },
    standard: { label: '5〜10分の準備', minutes: 8 },
    stretch: { label: '15〜30分の整備', minutes: 20 },
    recovery: { label: '1箇所だけ', minutes: 1 },
  },
};
