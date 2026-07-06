import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '../../core/health/dailySeries';

// 睡眠ステージ専用の積み上げ棒(共通TimeSeriesChartとは別。積み上げは自己完結の
// BarChartで描く)。深い/コア/レム/未分類を1本のバーに積む。

export interface StageSeries {
  key: string;
  label: string;
  color: string;
  points: SeriesPoint[];
}

interface Row {
  date: string;
  [key: string]: string | number | null;
}

const GRID_COLOR = '#1c2842';
const TICK_COLOR = '#64748b';

export function SleepStageChart({ series, height = 200 }: { series: StageSeries[]; height?: number }) {
  if (series.length === 0) return null;
  const dates = series[0].points.map((p) => p.date);
  const data: Row[] = dates.map((date, i) => {
    const row: Row = { date };
    for (const s of series) row[s.key] = s.points[i]?.value ?? null;
    return row;
  });

  const labelByKey = new Map(series.map((s) => [s.key, s.label]));
  const formatTick = (date: string) => {
    const [, m, d] = date.split('-');
    return dates.length > 120 && d !== '01' ? '' : `${Number(m)}/${Number(d)}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          fontSize={10}
          minTickGap={24}
          tickLine={false}
          tick={{ fill: TICK_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
        />
        <YAxis fontSize={10} tickLine={false} width={44} tick={{ fill: TICK_COLOR }} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#182136', border: '1px solid #2a3a5e', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#8fa0b8' }}
          itemStyle={{ color: '#e2e8f0' }}
          cursor={{ fill: 'rgb(148 163 184 / 0.08)' }}
          formatter={(value, _name, item) =>
            typeof value === 'number'
              ? [`${Math.round(value * 10) / 10}時間`, labelByKey.get(String(item.dataKey)) ?? '']
              : [String(value), '']
          }
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} stackId="sleep" fill={s.color} name={s.label} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
