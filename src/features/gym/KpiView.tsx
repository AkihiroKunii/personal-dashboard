import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../../app/Toast';
import { TimeSeriesChart } from '../../core/charts/TimeSeriesChart';
import { db } from '../../core/db';
import { addDays, todayJst } from '../../core/dates';
import { loadSleepSeries } from '../../core/health/dailySeries';
import { getSourcePriority } from '../../core/settings';
import type { ExerciseRow } from '../../core/types';
import { BODY_METRIC_DEFS } from './bodyMetricDefs';
import { loadBodySeries } from './lib/bodyProtein';
import { runCoachingExport } from './lib/coachingExport';
import { adherence, e1rmChanges, proteinSummary, setsByMuscleGroup } from './lib/kpi';
import { activeProgramOn } from './lib/program';
import { MUSCLE_COLORS } from './muscleColors';

// G-F10 KPIサマリー(1画面集約)+ G-F11 コーチング用エクスポート。
// 睡眠は①のデータを参照し、未取込時は非表示で劣化する。

const round1 = (n: number) => Math.round(n * 10) / 10;

export function KpiView() {
  const toast = useToast();
  const today = todayJst();
  const from90 = addDays(today, -89);
  const from7 = addDays(today, -6);

  const data = useLiveQuery(async () => {
    const priority = await getSourcePriority();
    const [sets, exercises, program, proteinDays, weight, bodyFat, sleep7] = await Promise.all([
      db.gymSets.where('date').between(from90, today, true, true).toArray(),
      db.exercises.toArray(),
      activeProgramOn(today),
      db.proteinDays.toArray(),
      loadBodySeries('weight', addDays(today, -29), today),
      loadBodySeries('bodyFatPct', addDays(today, -29), today),
      loadSleepSeries(from7, today, priority),
    ]);
    return { sets, exercises, program, proteinDays, weight, bodyFat, sleep7 };
  }, [today]);

  if (!data) return null;
  const { sets, exercises, program, proteinDays, weight, bodyFat, sleep7 } = data;
  const byId = new Map<number, ExerciseRow>(exercises.map((e) => [e.id!, e]));

  const sets7 = sets.filter((s) => s.date >= from7);
  const volume7 = setsByMuscleGroup(sets7, byId);
  const changes = e1rmChanges(sets).slice(0, 3);
  const adh = program ? adherence(program, sets, program.validFrom, today) : null;
  const protein7 = proteinSummary(proteinDays, from7, today);
  const sleepVals = sleep7.map((p) => p.value).filter((v): v is number => v !== null);
  const sleepAvg = sleepVals.length > 0 ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length : undefined;

  const latestBody = (points: typeof weight) => [...points].reverse().find((p) => p.value !== null)?.value;

  const isEmpty = sets.length === 0 && proteinDays.length === 0;

  const exportSummary = async () => {
    try {
      const result = await runCoachingExport();
      toast(
        result === 'copied'
          ? 'コーチング用サマリーをクリップボードにコピーしました'
          : 'コーチング用サマリーをダウンロードしました',
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  if (isEmpty) {
    return (
      <section className="card">
        <p className="hint">記録が貯まるとKPIサマリーが表示されます(e1RM・部位別ボリューム・実施率・タンパク質・睡眠)。</p>
      </section>
    );
  }

  return (
    <>
      <div className="kpi-grid">
        {adh && (
          <div className="kpi-cell">
            <span className="kpi-label">トレ実施率</span>
            <span className="kpi-value">
              {adh.rate !== null ? `${Math.round(adh.rate * 100)}%` : '—'}
            </span>
            <span className="kpi-sub">
              予定{adh.scheduled}日中{adh.done}日
            </span>
          </div>
        )}
        <div className="kpi-cell">
          <span className="kpi-label">タンパク質(7日)</span>
          <span className="kpi-value">
            {protein7.rate !== null ? `${Math.round(protein7.rate * 100)}%` : '—'}
          </span>
          <span className="kpi-sub">
            記録{protein7.recorded}日/達成{protein7.achieved}日
          </span>
        </div>
        {sleepAvg !== undefined && (
          <div className="kpi-cell">
            <span className="kpi-label">睡眠(7日平均)</span>
            <span className="kpi-value">{round1(sleepAvg)}<small>h</small></span>
            <span className="kpi-sub">①のデータ参照</span>
          </div>
        )}
        {latestBody(weight) !== undefined && (
          <div className="kpi-cell">
            <span className="kpi-label">体重</span>
            <span className="kpi-value">
              {round1(latestBody(weight)!)}
              <small>kg</small>
            </span>
            {latestBody(bodyFat) !== undefined && (
              <span className="kpi-sub">体脂肪 {round1(latestBody(bodyFat)!)}%</span>
            )}
          </div>
        )}
      </div>

      {changes.length > 0 && (
        <section className="card">
          <h2>主要種目のe1RM(直近90日)</h2>
          {changes.map((c) => {
            const e = byId.get(c.exerciseId);
            const delta = c.last.value - c.first.value;
            return (
              <div key={c.exerciseId} className="kpi-row">
                <span style={{ color: e ? MUSCLE_COLORS[e.muscleGroup] : undefined }}>
                  {e?.name ?? '種目'}
                </span>
                <span className="kpi-row-value">
                  {round1(c.last.value)}kg
                  <span className={delta >= 0 ? 'delta-up' : 'delta-down'}>
                    {delta >= 0 ? '▲' : '▼'}
                    {round1(Math.abs(delta))}
                  </span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      {volume7.size > 0 && (
        <section className="card">
          <h2>部位別セット数(直近7日)</h2>
          {[...volume7.entries()].map(([g, n]) => (
            <div key={g} className="kpi-row">
              <span style={{ color: MUSCLE_COLORS[g] }}>{g}</span>
              <span className="kpi-row-value">{n}セット</span>
            </div>
          ))}
        </section>
      )}

      {latestBody(weight) !== undefined && (
        <section className="card">
          <h2>体重・体脂肪率(直近30日)</h2>
          <TimeSeriesChart
            height={170}
            series={[
              {
                id: 'kpi-weight',
                label: '体重',
                unit: 'kg',
                color: BODY_METRIC_DEFS.weight.color,
                kind: 'line',
                axis: 'left',
                points: weight,
              },
              {
                id: 'kpi-bodyfat',
                label: '体脂肪率',
                unit: '%',
                color: BODY_METRIC_DEFS.bodyFatPct.color,
                kind: 'line',
                axis: 'right',
                points: bodyFat,
              },
            ]}
          />
        </section>
      )}

      <section className="card">
        <h2>コーチング用エクスポート</h2>
        <p className="hint">月次セッションに持ち込むサマリー(e1RM変化・部位別ボリューム・実施率・ボディ・睡眠)を出力します。</p>
        <button className="primary-btn" onClick={() => void exportSummary()}>
          サマリーを出力(コピー)
        </button>
      </section>
    </>
  );
}
