import { addDays, dowOf, todayJst } from '../../../core/dates';

// 週の起点(その週の月曜、JST)。habitPlans のキーに使う。

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** YYYY-MM-DD が属する週の月曜(YYYY-MM-DD) */
export function weekStartOf(date: string): string {
  return addDays(date, -WEEKDAY_INDEX[dowOf(date)]);
}

export function currentWeekStart(): string {
  return weekStartOf(todayJst());
}
