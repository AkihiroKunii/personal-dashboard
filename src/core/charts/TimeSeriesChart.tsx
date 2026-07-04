import {
  Bar,
  ComposedChart,
  ErrorBar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '../health/dailySeries';

// 共通日次時系列チャート(§3)。範囲切替は親が from/to で制御し、
// 2軸重ね合わせ(V-F5)とエラーバー(G-F3の要件検証を兼ねる)に対応する。

export interface ChartSeriesDef {
  id: string;
  label: string;
  unit?: string;
  color: string;
  kind: 'line' | 'bar';
  /** min/max をエラーバーで表示する(points に min/max が必要) */
  errorBars?: boolean;
  /** 重ね合わせ時の軸。既定は left */
  axis?: 'left' | 'right';
  points: SeriesPoint[];
}

interface MergedRow {
  date: string;
  [key: string]: string | number | null | [number, number];
}

export function TimeSeriesChart({
  series,
  height = 200,
}: {
  series: ChartSeriesDef[];
  height?: number;
}) {
  if (series.length === 0) return null;
  const dates = series[0].points.map((p) => p.date);
  const data: MergedRow[] = dates.map((date, i) => {
    const row: MergedRow = { date };
    for (const s of series) {
      const p = s.points[i];
      row[s.id] = p?.value ?? null;
      if (s.errorBars && p && p.value !== null && p.min !== undefined && p.max !== undefined) {
        row[`${s.id}__err`] = [p.value - p.min, p.max - p.value];
      }
    }
    return row;
  });

  const hasRightAxis = series.some((s) => s.axis === 'right');
  const formatTick = (date: string) => {
    const [, m, d] = date.split('-');
    return dates.length > 120 && d !== '01' ? '' : `${Number(m)}/${Number(d)}`;
  };
  const formatValue = (value: number, id: string) => {
    const s = series.find((x) => x.id === id);
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}${s?.unit ?? ''}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          fontSize={10}
          minTickGap={24}
          tickLine={false}
        />
        <YAxis yAxisId="left" fontSize={10} tickLine={false} width={44} domain={['auto', 'auto']} />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            fontSize={10}
            tickLine={false}
            width={44}
            domain={['auto', 'auto']}
          />
        )}
        <Tooltip
          labelFormatter={(date) => String(date)}
          formatter={(value, _name, item) =>
            typeof value === 'number'
              ? [formatValue(value, String(item.dataKey)), seriesLabel(series, String(item.dataKey))]
              : [String(value), '']
          }
        />
        {series.map((s) =>
          s.kind === 'bar' ? (
            <Bar key={s.id} yAxisId={s.axis ?? 'left'} dataKey={s.id} fill={s.color} name={s.label}>
              {s.errorBars && (
                <ErrorBar dataKey={`${s.id}__err`} width={3} strokeWidth={1} stroke="#64748b" />
              )}
            </Bar>
          ) : (
            <Line
              key={s.id}
              yAxisId={s.axis ?? 'left'}
              dataKey={s.id}
              stroke={s.color}
              name={s.label}
              dot={false}
              strokeWidth={2}
              connectNulls={false}
              type="monotone"
              isAnimationActive={false}
            >
              {s.errorBars && (
                <ErrorBar dataKey={`${s.id}__err`} width={3} strokeWidth={1} stroke="#64748b" />
              )}
            </Line>
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function seriesLabel(series: ChartSeriesDef[], id: string): string {
  return series.find((s) => s.id === id)?.label ?? id;
}
