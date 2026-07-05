import Dexie, { type Table } from 'dexie';
import type {
  DailyMetricRow,
  ExerciseRow,
  GymSetRow,
  SettingRow,
  SleepRecordRow,
} from './types';

export class DashboardDb extends Dexie {
  dailyMetrics!: Table<DailyMetricRow, [string, string, string]>;
  sleepRecords!: Table<SleepRecordRow, [string, number, number, string]>;
  settings!: Table<SettingRow, string>;
  exercises!: Table<ExerciseRow, number>;
  gymSets!: Table<GymSetRow, number>;

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
  }
}

export const db = new DashboardDb();
