import Dexie, { type Table } from 'dexie';
import type { DailyMetricRow, SettingRow, SleepRecordRow } from './types';

export class DashboardDb extends Dexie {
  dailyMetrics!: Table<DailyMetricRow, [string, string, string]>;
  sleepRecords!: Table<SleepRecordRow, [string, number, number, string]>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('personal-dashboard');
    this.version(1).stores({
      dailyMetrics: '[metric+date+source], date, metric',
      sleepRecords: '[source+start+end+stage], start',
      settings: 'key',
    });
  }
}

export const db = new DashboardDb();
