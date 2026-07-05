import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import { dowOf, todayJst } from '../../core/dates';
import { WEEK, type DayOfWeek } from '../../../packages/habit-engine';
import { generateWeeklyPlan } from './lib/habitStore';
import { currentWeekStart } from './lib/week';

// H-F3 週間計画の生成・表示。event-based cue(「朝食後に」)を時刻より優先して見せる。

const DOW_LABEL: Record<DayOfWeek, string> = {
  Mon: '月',
  Tue: '火',
  Wed: '水',
  Thu: '木',
  Fri: '金',
  Sat: '土',
  Sun: '日',
};

export function PlanView() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const weekStart = currentWeekStart();
  const planRow = useLiveQuery(() => db.habitPlans.get(weekStart), [weekStart]);
  const specs = useLiveQuery(() => db.habitSpecs.toArray(), []) ?? [];
  const specById = new Map(specs.map((s) => [s.id, s]));
  const todayDow = dowOf(todayJst());

  const generate = async () => {
    setBusy(true);
    try {
      const plan = await generateWeeklyPlan(weekStart);
      const total = plan.assignments.length;
      toast(total > 0 ? `今週の計画を作成しました(${total}件)` : '割り当てできる時間窓がありませんでした');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const assignmentsByDay = (day: DayOfWeek) =>
    (planRow?.plan.assignments ?? [])
      .filter((a) => a.day === day)
      .sort((a, b) => a.windowId.localeCompare(b.windowId));

  return (
    <>
      <section className="card">
        <h2>
          今週の計画
          <span className="hint-inline">{weekStart}〜</span>
        </h2>
        <p className="hint">
          活動と時間窓から、制約(週の回数・間隔・1日の負荷)を守って自動で割り当てます。「朝食後に」のような文脈の手がかりを時刻より優先します。
        </p>
        <button className="primary-btn" disabled={busy} onClick={() => void generate()}>
          {planRow ? '計画を作り直す' : '今週の計画をつくる'}
        </button>
      </section>

      {planRow &&
        WEEK.map((day) => {
          const items = assignmentsByDay(day);
          return (
            <section key={day} className={`card${day === todayDow ? ' today-highlight' : ''}`}>
              <h2>
                <span>{DOW_LABEL[day]}曜</span>
                {day === todayDow && <span className="hint-inline">今日</span>}
              </h2>
              {items.length === 0 ? (
                <p className="hint">予定なし</p>
              ) : (
                <ul className="menu-list">
                  {items.map((a) => (
                    <li key={`${a.habitId}|${a.windowId}`}>
                      <span>
                        {a.anchor.label}
                        {specById.get(a.habitId)?.activity ?? ''}
                      </span>
                      <span className="menu-target">
                        {a.step.label.replace(/^.*?:\s*/, '')}
                        {a.notify ? ' 🔔' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      {planRow && (
        <section className="card">
          <h2>復旧単位(つらい時はこれだけ)</h2>
          <ul className="menu-list">
            {Object.entries(planRow.plan.recoverySteps).map(([habitId, step]) => (
              <li key={habitId}>
                <span>{specById.get(habitId)?.activity ?? habitId}</span>
                <span className="menu-target">{step.label.replace(/^.*?:\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
