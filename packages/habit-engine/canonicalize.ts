import { TYPE_ATTRIBUTES } from './config';
import type { ActivityType, HabitSpec } from './types';

// 活動正規化(habit-algorithm.md §3)。
// 「目標」ではなく「行動」を扱う: 生の活動を活動タイプへ分類し属性を推定する。

export interface RawActivity {
  id?: string;
  activity: string;
  targetFrequencyPerWeek: number;
  goalType?: string;
  preferredContexts?: string[];
  constraints?: { minIntervalDays?: number };
  why?: string;
  /** 分類を明示したい場合の上書き(推定より優先) */
  activityType?: ActivityType;
}

// タイプ推定のキーワード(先勝ち)。日本語の代表語を採用。
const TYPE_KEYWORDS: Array<[RegExp, ActivityType]> = [
  [/英語|語学|学習|勉強|読書|シャドー|単語|リスニング|プログラ/, 'skill'],
  [/筋トレ|トレーニング|ラン|ジョグ|運動|ジム|ストレッチ|ヨガ|歩|散歩|体操/, 'physical'],
  [/家計|記録|請求|メール|片付け|掃除|事務|手続き|支払/, 'admin'],
  [/日記|振り返り|瞑想|マインドフル|感謝|ジャーナル/, 'reflective'],
  [/準備|セットアップ|整備|環境|用意/, 'environment-prep'],
];

export function classifyActivity(activity: string): ActivityType {
  for (const [re, type] of TYPE_KEYWORDS) {
    if (re.test(activity)) return type;
  }
  return 'skill';
}

let autoId = 0;

/** 生の活動を HabitSpec へ正規化する */
export function canonicalize(raw: RawActivity): HabitSpec {
  const activityType = raw.activityType ?? classifyActivity(raw.activity);
  const base = TYPE_ATTRIBUTES[activityType];
  // 高頻度(毎日など)の活動は最小間隔を詰める必要があるため friction をわずかに上げる
  const frequencyPressure = Math.min(0.15, Math.max(0, (raw.targetFrequencyPerWeek - 3) * 0.03));
  return {
    id: raw.id ?? `habit-${++autoId}`,
    activity: raw.activity,
    activityType,
    targetFrequencyPerWeek: raw.targetFrequencyPerWeek,
    goalType: raw.goalType,
    preferredContexts: raw.preferredContexts ?? [],
    constraints: {
      // 高頻度(週4以上)は連日を許す必要があるため 0、低頻度は 1(実行日の間隔を空ける)
      minIntervalDays: raw.constraints?.minIntervalDays ?? (raw.targetFrequencyPerWeek >= 4 ? 0 : 1),
    },
    why: raw.why,
    attributes: {
      ...base,
      friction: Math.min(1, base.friction + frequencyPressure),
    },
  };
}
