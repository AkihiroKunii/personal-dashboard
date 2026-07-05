import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useToast } from '../../app/Toast';
import { RANGE_DAYS, RangeSwitcher, type RangeKey } from '../../core/charts/RangeSwitcher';
import { TimeSeriesChart } from '../../core/charts/TimeSeriesChart';
import { db } from '../../core/db';
import { addDays, todayJst } from '../../core/dates';
import { BODY_METRICS, type BodyMetricId, type SeriesPoint } from '../../core/types';
import { BODY_METRIC_DEFS } from './bodyMetricDefs';
import { loadBodySeries, recordBodyMetric } from './lib/bodyProtein';
import { Stepper } from './Stepper';

// G-F8 ボディ記録(週1想定の手入力)+ 時系列表示。体重×体脂肪率は2軸で重ね合わせ。

function InputRow({ metric, today }: { metric: BodyMetricId; today: string }) {
  const def = BODY_METRIC_DEFS[metric];
  const latest = useLiveQuery(
    () => db.bodyMetrics.where('metric').equals(metric).sortBy('date'),
    [metric],
  );
  const [value, setValue] = useState<number | null>(null);

  // 前回値プリセット(§2.2)。取得できたら初期値にする
  const last = latest?.at(-1)?.value;
  useEffect(() => {
    if (value === null && last !== undefined) setValue(last);
  }, [last, value]);

  const toast = useToast();
  const current = value ?? last ?? 0;
  return (
    <div className="body-input-row">
      <Stepper
        label={def.label}
        unit={def.unit}
        value={current}
        step={def.step}
        min={0}
        onChange={setValue}
      />
      <button
        className="primary-btn small"
        onClick={() =>
          void recordBodyMetric(metric, today, current)
            .then(() => toast(`${def.label} ${current}${def.unit} を記録しました`))
            .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'error'))
        }
      >
        記録
      </button>
    </div>
  );
}

export function BodyView() {
  const [range, setRange] = useState<RangeKey>('quarter');
  const today = todayJst();
  const to = today;
  const from = addDays(to, -(RANGE_DAYS[range] - 1));

  const series = useLiveQuery(async () => {
    const entries = await Promise.all(
      BODY_METRICS.map(async (m) => [m, await loadBodySeries(m, from, to)] as const),
    );
    return Object.fromEntries(entries) as Record<BodyMetricId, SeriesPoint[]>;
  }, [from, to]);

  const hasAny = series && BODY_METRICS.some((m) => series[m].some((p) => p.value !== null));

  return (
    <>
      <section className="card">
        <h2>ボディ記録(本日 {today})</h2>
        {BODY_METRICS.map((m) => (
          <InputRow key={m} metric={m} today={today} />
        ))}
      </section>

      <RangeSwitcher value={range} onChange={setRange} />

      {!hasAny && (
        <section className="card">
          <p className="hint">まだ記録がありません。上のフォームから記録すると推移が表示されます。</p>
        </section>
      )}

      {series && hasAny && (
        <>
          {/* 体重 × 体脂肪率を2軸で重ね合わせ */}
          <section className="card">
            <h2>体重 × 体脂肪率</h2>
            <TimeSeriesChart
              height={200}
              series={[
                {
                  id: 'weight',
                  label: BODY_METRIC_DEFS.weight.label,
                  unit: 'kg',
                  color: BODY_METRIC_DEFS.weight.color,
                  kind: 'line',
                  axis: 'left',
                  points: series.weight,
                },
                {
                  id: 'bodyFatPct',
                  label: BODY_METRIC_DEFS.bodyFatPct.label,
                  unit: '%',
                  color: BODY_METRIC_DEFS.bodyFatPct.color,
                  kind: 'line',
                  axis: 'right',
                  points: series.bodyFatPct,
                },
              ]}
            />
          </section>

          {(['chest', 'arm', 'waist', 'thigh'] as BodyMetricId[]).map((m) => {
            const def = BODY_METRIC_DEFS[m];
            if (!series[m].some((p) => p.value !== null)) return null;
            return (
              <section key={m} className="card">
                <h2>{def.label}</h2>
                <TimeSeriesChart
                  height={160}
                  series={[
                    { id: m, label: def.label, unit: def.unit, color: def.color, kind: 'line', points: series[m] },
                  ]}
                />
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
