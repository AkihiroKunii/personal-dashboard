import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { RANGE_DAYS, RangeSwitcher, type RangeKey } from '../../core/charts/RangeSwitcher';
import { TimeSeriesChart } from '../../core/charts/TimeSeriesChart';
import { db } from '../../core/db';
import { addDays, todayJst } from '../../core/dates';
import { MUSCLE_GROUPS, type GymSetRow, type MuscleGroup } from '../../core/types';
import { dailyE1rmSeries, dailyWeightSeries } from './lib/stats';
import { MUSCLE_COLORS } from './muscleColors';

// G-F3: 部位別の重量推移(中央値+最低〜最高エラーバー)
// G-F3b: e1RM推移(主指標) / G-F4: 期間切替 / G-F5: 部位→種目ドリルダウン

export function ChartsView() {
  const [range, setRange] = useState<RangeKey>('month');
  const [drillGroup, setDrillGroup] = useState<MuscleGroup | null>(null);
  const [e1rmExerciseId, setE1rmExerciseId] = useState<number | null>(null);

  const to = todayJst();
  const from = addDays(to, -(RANGE_DAYS[range] - 1));

  const data = useLiveQuery(async () => {
    const [sets, exercises] = await Promise.all([
      db.gymSets.where('date').between(from, to, true, true).toArray(),
      db.exercises.toArray(),
    ]);
    return { sets, exercises };
  }, [from, to]);

  if (!data) return null;
  const { sets, exercises } = data;
  const byId = new Map(exercises.map((e) => [e.id!, e]));

  const setsByGroup = new Map<MuscleGroup, GymSetRow[]>();
  const setsByExercise = new Map<number, GymSetRow[]>();
  for (const s of sets) {
    const e = byId.get(s.exerciseId);
    if (!e) continue;
    setsByGroup.set(e.muscleGroup, [...(setsByGroup.get(e.muscleGroup) ?? []), s]);
    setsByExercise.set(s.exerciseId, [...(setsByExercise.get(s.exerciseId) ?? []), s]);
  }

  // e1RMの既定種目 = 範囲内で記録数が最多の種目
  const exercisesWithSets = [...setsByExercise.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );
  const e1rmId =
    e1rmExerciseId !== null && setsByExercise.has(e1rmExerciseId)
      ? e1rmExerciseId
      : (exercisesWithSets[0]?.[0] ?? null);
  const e1rmExercise = e1rmId !== null ? byId.get(e1rmId) : undefined;

  if (sets.length === 0) {
    return (
      <>
        <RangeSwitcher value={range} onChange={setRange} />
        <section className="card">
          <p className="hint">この期間の記録がありません。「記録」タブからセットを記録すると、部位別の重量推移とe1RMがここに表示されます。</p>
        </section>
      </>
    );
  }

  // G-F5: 種目ドリルダウン表示
  if (drillGroup) {
    const groupExercises = exercisesWithSets.filter(
      ([id]) => byId.get(id)?.muscleGroup === drillGroup,
    );
    const color = MUSCLE_COLORS[drillGroup];
    return (
      <>
        <button className="link-btn" onClick={() => setDrillGroup(null)}>
          ← 部位一覧へ戻る
        </button>
        <RangeSwitcher value={range} onChange={setRange} />
        {groupExercises.map(([id, exSets]) => {
          const e = byId.get(id)!;
          return (
            <section key={id} className="card">
              <h2>
                {e.name}
                <span className="hint-inline">{exSets.length}セット</span>
              </h2>
              <p className="chart-caption">重量(中央値と最低〜最高)</p>
              <TimeSeriesChart
                height={170}
                series={[
                  {
                    id: `w-${id}`,
                    label: '重量',
                    unit: 'kg',
                    color,
                    kind: 'line',
                    errorBars: true,
                    points: dailyWeightSeries(exSets, from, to),
                  },
                ]}
              />
              <p className="chart-caption">推定1RM(Epley・日次最大)</p>
              <TimeSeriesChart
                height={170}
                series={[
                  {
                    id: `e-${id}`,
                    label: 'e1RM',
                    unit: 'kg',
                    color: '#818cf8',
                    kind: 'line',
                    points: dailyE1rmSeries(exSets, from, to),
                  },
                ]}
              />
            </section>
          );
        })}
      </>
    );
  }

  return (
    <>
      <RangeSwitcher value={range} onChange={setRange} />

      {e1rmExercise && e1rmId !== null && (
        <section className="card">
          <h2>e1RM推移(主指標)</h2>
          <select
            className="exercise-select"
            value={e1rmId}
            onChange={(e) => setE1rmExerciseId(Number(e.target.value))}
          >
            {exercisesWithSets.map(([id]) => (
              <option key={id} value={id}>
                {byId.get(id)?.name}
              </option>
            ))}
          </select>
          <TimeSeriesChart
            height={200}
            series={[
              {
                id: `e1rm-${e1rmId}`,
                label: 'e1RM',
                unit: 'kg',
                color: MUSCLE_COLORS[e1rmExercise.muscleGroup],
                kind: 'line',
                points: dailyE1rmSeries(setsByExercise.get(e1rmId)!, from, to),
              },
            ]}
          />
        </section>
      )}

      <h2 className="section-title">部位別の重量推移(タップで種目別へ)</h2>
      {MUSCLE_GROUPS.filter((g) => setsByGroup.has(g)).map((g) => {
        const groupSets = setsByGroup.get(g)!;
        return (
          <button key={g} className="card card-button" onClick={() => setDrillGroup(g)}>
            <h2>
              <span style={{ color: MUSCLE_COLORS[g] }}>{g}</span>
              <span className="hint-inline">{groupSets.length}セット・詳細 →</span>
            </h2>
            <TimeSeriesChart
              height={160}
              series={[
                {
                  id: `g-${g}`,
                  label: '重量',
                  unit: 'kg',
                  color: MUSCLE_COLORS[g],
                  kind: 'line',
                  errorBars: true,
                  points: dailyWeightSeries(groupSets, from, to),
                },
              ]}
            />
          </button>
        );
      })}
    </>
  );
}
