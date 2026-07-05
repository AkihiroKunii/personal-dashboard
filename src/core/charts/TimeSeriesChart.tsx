import { useId } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
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
// ダークグローテーマ: 棒・面はメトリクスカラーのグラデーションで描画。

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

const GRID_COLOR = '#1c2842';
const TICK_COLOR = '#64748b';
const ERROR_BAR_COLOR = '#94a3b8';

export function TimeSeriesChart({
  series,
  height = 200,
}: {
  series: ChartSeriesDef[];
  height?: number;
}) {
  // 同一ページに複数チャートがあるため、グラデーションIDを一意化する
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
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
  const gradId = (s: ChartSeriesDef) => `grad-${uid}-${s.id}`;

  // 孤立点(前後が欠測)は線分が描けないため、その点にだけドットを打つ。
  // ジムの記録(週2〜3回)のような疎な系列で必須
  const isolatedDot =
    (s: ChartSeriesDef) =>
    (props: { cx?: number; cy?: number; index?: number }) => {
      const i = props.index ?? 0;
      const val = data[i]?.[s.id];
      const prev = i > 0 ? data[i - 1][s.id] : null;
      const next = i < data.length - 1 ? data[i + 1][s.id] : null;
      const show =
        val != null && prev == null && next == null && props.cx != null && props.cy != null;
      return (
        <circle
          key={`${s.id}-dot-${i}`}
          cx={props.cx}
          cy={props.cy}
          r={show ? 3 : 0}
          fill={s.color}
        />
      );
    };
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
        <defs>
          {series.map((s) => (
            <linearGradient key={s.id} id={gradId(s)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={s.kind === 'bar' ? 0.95 : 0.4} />
              <stop offset="100%" stopColor={s.color} stopOpacity={s.kind === 'bar' ? 0.2 : 0} />
            </linearGradient>
          ))}
        </defs>
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
        <YAxis
          yAxisId="left"
          fontSize={10}
          tickLine={false}
          width={44}
          domain={['auto', 'auto']}
          tick={{ fill: TICK_COLOR }}
          axisLine={false}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            fontSize={10}
            tickLine={false}
            width={44}
            domain={['auto', 'auto']}
            tick={{ fill: TICK_COLOR }}
            axisLine={false}
          />
        )}
        <Tooltip
          labelFormatter={(date) => String(date)}
          contentStyle={{
            background: '#182136',
            border: '1px solid #2a3a5e',
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: '#8fa0b8' }}
          itemStyle={{ color: '#e2e8f0' }}
          cursor={{ stroke: '#2a3a5e' }}
          formatter={(value, _name, item) =>
            typeof value === 'number'
              ? [formatValue(value, String(item.dataKey)), seriesLabel(series, String(item.dataKey))]
              : [String(value), '']
          }
        />
        {series.map((s) => {
          if (s.kind === 'bar') {
            return (
              <Bar
                key={s.id}
                yAxisId={s.axis ?? 'left'}
                dataKey={s.id}
                fill={`url(#${gradId(s)})`}
                name={s.label}
                radius={[5, 5, 0, 0]}
              >
                {s.errorBars && (
                  <ErrorBar
                    dataKey={`${s.id}__err`}
                    width={3}
                    strokeWidth={1}
                    stroke={ERROR_BAR_COLOR}
                  />
                )}
              </Bar>
            );
          }
          if (s.errorBars) {
            // ErrorBar は Area 非対応のため、エラーバー付きの折れ線は Line で描く
            return (
              <Line
                key={s.id}
                yAxisId={s.axis ?? 'left'}
                dataKey={s.id}
                stroke={s.color}
                name={s.label}
                dot={isolatedDot(s)}
                strokeWidth={2}
                connectNulls={false}
                type="monotone"
                isAnimationActive={false}
              >
                <ErrorBar
                  dataKey={`${s.id}__err`}
                  width={3}
                  strokeWidth={1}
                  stroke={ERROR_BAR_COLOR}
                />
              </Line>
            );
          }
          return (
            <Area
              key={s.id}
              yAxisId={s.axis ?? 'left'}
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#${gradId(s)})`}
              name={s.label}
              dot={isolatedDot(s)}
              connectNulls={false}
              type="monotone"
              isAnimationActive={false}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function seriesLabel(series: ChartSeriesDef[], id: string): string {
  return series.find((s) => s.id === id)?.label ?? id;
}
