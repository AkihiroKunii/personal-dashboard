import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useState } from 'react';
import { RANGE_DAYS, RangeSwitcher, type RangeKey } from '../../core/charts/RangeSwitcher';
import { TimeSeriesChart } from '../../core/charts/TimeSeriesChart';
import { addDays, todayJst } from '../../core/dates';
import { latestDataDate, type MetricId } from '../../core/health/dailySeries';
import { BackupPanel } from '../backup/BackupPanel';
import { DataPanel } from './DataPanel';
import { ImportPanel } from './ImportPanel';
import { METRIC_DEFS, METRIC_IDS } from './metricDefs';
import { SleepStageCard } from './SleepStageCard';
import { useSeries } from './useSeries';

function MetricCard({ metric, from, to }: { metric: MetricId; from: string; to: string }) {
  const def = METRIC_DEFS[metric];
  const points = useSeries(metric, from, to);
  if (!points) return null;
  const latest = [...points].reverse().find((p) => p.value !== null);
  return (
    <section className="card">
      <h2>
        {def.label}
        {latest && (
          <span className="latest-value" style={{ color: def.color }}>
            {Math.round(latest.value! * 10) / 10}
            <small>
              {def.unit}({latest.date.slice(5).replace('-', '/')})
            </small>
          </span>
        )}
      </h2>
      <TimeSeriesChart
        series={[{ id: metric, ...def, points }]}
      />
    </section>
  );
}

// V-F5: 2指標の同時表示(第2軸)
function OverlayCard({ from, to }: { from: string; to: string }) {
  const [left, setLeft] = useState<MetricId>('sleep');
  const [right, setRight] = useState<MetricId>('hrvSdnn');
  const leftPoints = useSeries(left, from, to);
  const rightPoints = useSeries(right, from, to);

  const select = (value: MetricId, onChange: (m: MetricId) => void, label: string) => (
    <label className="overlay-select">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as MetricId)}>
        {METRIC_IDS.map((id) => (
          <option key={id} value={id}>
            {METRIC_DEFS[id].label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="card">
      <h2>重ね合わせ</h2>
      <div className="overlay-controls">
        {select(left, setLeft, '左軸')}
        {select(right, setRight, '右軸')}
      </div>
      {leftPoints && rightPoints && (
        <TimeSeriesChart
          height={240}
          series={[
            { id: `l-${left}`, ...METRIC_DEFS[left], errorBars: false, points: leftPoints, axis: 'left' },
            {
              id: `r-${right}`,
              ...METRIC_DEFS[right],
              errorBars: false,
              points: rightPoints,
              axis: 'right',
              kind: 'line',
              color: '#f43f5e',
            },
          ]}
        />
      )}
    </section>
  );
}

export function VitalsPage() {
  const [range, setRange] = useState<RangeKey>('month');
  // データの最終日を右端にする(V-F4: 再訪時に保存済みデータを即描画)
  const anchor = useLiveQuery(latestDataDate, []) ?? todayJst();
  const to = anchor;
  const from = addDays(to, -(RANGE_DAYS[range] - 1));

  return (
    <div className="page">
      <h1>バイタル</h1>
      <RangeSwitcher value={range} onChange={setRange} />
      {METRIC_IDS.map((id) => (
        <Fragment key={id}>
          <MetricCard metric={id} from={from} to={to} />
          {/* 合計睡眠時間の直後にステージ内訳を出す(§1.4 拡張) */}
          {id === 'sleep' && <SleepStageCard from={from} to={to} />}
        </Fragment>
      ))}
      <OverlayCard from={from} to={to} />
      <ImportPanel />
      <DataPanel />
      <BackupPanel />
    </div>
  );
}
