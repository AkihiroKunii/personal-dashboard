import type {
  DayOfWeek,
  MuscleGroup,
  ProgramContent,
  ProgramDay,
  ProgramExercise,
} from '../../../core/types';
import { dowOf, enumerateDates } from '../../../core/dates';

// 週間プログラムJSON(§2.3a schemaVersion 1)のパースと純粋なドメイン関数。
// DB非依存にしてあり、Viteビルド(ics生成)からも同じコードを使う。

const DAY_OF_WEEK_VALUES: ReadonlySet<string> = new Set([
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** プログラムJSONらしいか(拡張子が同じ日次エクスポートJSONとの内容判別に使う) */
export function looksLikeProgramJson(text: string): boolean {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return toNumber(raw?.schemaVersion) === 1 && Array.isArray(raw?.weeklySchedule);
  } catch {
    return false;
  }
}

/** §2.3a 契約として厳格にバリデーションしてパースする */
export function parseProgramContent(text: string): ProgramContent {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして解釈できません');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('JSONオブジェクトではありません');
  const obj = raw as Record<string, unknown>;

  if (toNumber(obj.schemaVersion) !== 1) {
    throw new Error(`未対応のschemaVersionです: ${String(obj.schemaVersion)}(1のみ対応)`);
  }
  const programName = typeof obj.programName === 'string' ? obj.programName.trim() : '';
  if (!programName) throw new Error('programName がありません');
  const validFrom = typeof obj.validFrom === 'string' ? obj.validFrom : '';
  const validUntil = typeof obj.validUntil === 'string' ? obj.validUntil : '';
  if (!DATE_RE.test(validFrom) || !DATE_RE.test(validUntil) || validFrom > validUntil) {
    throw new Error(`有効期間が不正です: ${validFrom}〜${validUntil}`);
  }
  if (!Array.isArray(obj.weeklySchedule) || obj.weeklySchedule.length === 0) {
    throw new Error('weeklySchedule がありません');
  }

  const weeklySchedule: ProgramDay[] = obj.weeklySchedule.map((d, i) => {
    const day = d as Record<string, unknown>;
    const dayOfWeek = String(day.dayOfWeek ?? '');
    if (!DAY_OF_WEEK_VALUES.has(dayOfWeek)) {
      throw new Error(`weeklySchedule[${i}].dayOfWeek が不正です: ${dayOfWeek}`);
    }
    const exercisesRaw = day.exercises ?? [];
    if (!Array.isArray(exercisesRaw)) throw new Error(`weeklySchedule[${i}].exercises が不正です`);
    const exercises: ProgramExercise[] = exercisesRaw.map((e, j) => {
      const ex = e as Record<string, unknown>;
      const name = typeof ex.name === 'string' ? ex.name.trim() : '';
      const sets = toNumber(ex.sets);
      if (!name || sets === undefined) {
        throw new Error(`weeklySchedule[${i}].exercises[${j}] の name/sets が不正です`);
      }
      return {
        name,
        sets,
        reps: String(ex.reps ?? ''),
        note: typeof ex.note === 'string' && ex.note !== '' ? ex.note : undefined,
      };
    });
    return {
      dayOfWeek: dayOfWeek as DayOfWeek,
      focus: typeof day.focus === 'string' ? day.focus : '',
      exercises,
    };
  });

  const nt = obj.nutritionTargets as Record<string, unknown> | undefined;
  return {
    programName,
    validFrom,
    validUntil,
    weeklySchedule,
    nutritionTargets: nt
      ? {
          proteinGramsPerDay: toNumber(nt.proteinGramsPerDay),
          note: typeof nt.note === 'string' ? nt.note : undefined,
        }
      : undefined,
    bodyMetricsToTrack: Array.isArray(obj.bodyMetricsToTrack)
      ? obj.bodyMetricsToTrack.map(String)
      : undefined,
  };
}

/** focus文字列(例: "胸・三頭")から部位を推定する。未知種目の自動マスタ追加(G-F1b)用 */
export function inferMuscleGroup(focus: string): MuscleGroup {
  const rules: Array<[RegExp, MuscleGroup]> = [
    [/胸/, '胸'],
    [/背/, '背中'],
    [/脚|レッグ/, '脚'],
    [/肩/, '肩'],
    [/腕|二頭|三頭/, '腕'],
    [/コア|腹/, 'コア'],
  ];
  for (const [re, group] of rules) {
    if (re.test(focus)) return group;
  }
  return '胸';
}

/** 指定日のメニュー(G-F6「今日のメニュー」)。該当曜日がなければ undefined */
export function menuForDate(program: ProgramContent, date: string): ProgramDay | undefined {
  if (date < program.validFrom || date > program.validUntil) return undefined;
  const dow = dowOf(date);
  return program.weeklySchedule.find((d) => d.dayOfWeek === dow);
}

/** 期間内のトレ予定日(実施率計算などに使う) */
export function scheduledDates(program: ProgramContent, from: string, to: string): string[] {
  const start = from > program.validFrom ? from : program.validFrom;
  const end = to < program.validUntil ? to : program.validUntil;
  if (start > end) return [];
  return enumerateDates(start, end).filter((d) => menuForDate(program, d) !== undefined);
}
