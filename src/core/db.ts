import Dexie, { type Table } from 'dexie';
import type {
  HabitLadderRow,
  HabitPlanRow,
  HabitSpecRow,
  HabitStateRow,
  HabitWindowRow,
  StoredObservation,
} from './habitTypes';
import type {
  BodyMetricRow,
  DailyMetricRow,
  ExerciseRow,
  GymSetRow,
  ProgramRow,
  ProteinDayRow,
  SettingRow,
  SleepRecordRow,
} from './types';

export class DashboardDb extends Dexie {
  dailyMetrics!: Table<DailyMetricRow, [string, string, string]>;
  sleepRecords!: Table<SleepRecordRow, [string, number, number, string]>;
  settings!: Table<SettingRow, string>;
  exercises!: Table<ExerciseRow, number>;
  gymSets!: Table<GymSetRow, number>;
  programs!: Table<ProgramRow, [string, string]>;
  bodyMetrics!: Table<BodyMetricRow, [string, string]>;
  proteinDays!: Table<ProteinDayRow, string>;
  habitWindows!: Table<HabitWindowRow, string>;
  habitSpecs!: Table<HabitSpecRow, string>;
  habitLadders!: Table<HabitLadderRow, string>;
  habitObservations!: Table<StoredObservation, number>;
  habitStates!: Table<HabitStateRow, [string, string]>;
  habitPlans!: Table<HabitPlanRow, string>;

  constructor() {
    super('personal-dashboard');
    this.version(1).stores({
      dailyMetrics: '[metric+date+source], date, metric',
      sleepRecords: '[source+start+end+stage], start',
      settings: 'key',
    });
    // フェーズ2a: ジム記録(既存データはそのまま自動アップグレード)
    this.version(2).stores({
      exercises: '++id, name',
      gymSets: '++id, exerciseId, date, at',
    });
    // フェーズ2b: プログラム実行支援(G-F6〜G-F11)
    // programs は自然キー [programName+validFrom] で世代管理(再取込に冪等)
    this.version(3).stores({
      programs: '[programName+validFrom], validFrom',
      bodyMetrics: '[metric+date], date',
      proteinDays: 'date',
    });
    // フェーズ3: 習慣化(④)。エンジンは packages/habit-engine、ここは永続化のみ
    this.version(4).stores({
      habitWindows: 'id',
      habitSpecs: 'id',
      habitLadders: 'habitId',
      habitObservations: '++id, habitId, date, [habitId+contextKey]',
      habitStates: '[habitId+contextKey]',
      habitPlans: 'weekStart',
    });
  }
}

export const db = new DashboardDb();
