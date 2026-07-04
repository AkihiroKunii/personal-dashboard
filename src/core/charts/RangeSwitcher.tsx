// 表示範囲切替(V-F2): 週 / 月 / 3ヶ月 / 年。①③④で共用する。

export type RangeKey = 'week' | 'month' | 'quarter' | 'year';

export const RANGE_DAYS: Record<RangeKey, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const RANGE_LABELS: Record<RangeKey, string> = {
  week: '週',
  month: '月',
  quarter: '3ヶ月',
  year: '年',
};

export function RangeSwitcher({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <div className="range-switcher" role="tablist" aria-label="表示範囲">
      {(Object.keys(RANGE_DAYS) as RangeKey[]).map((key) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          className={value === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {RANGE_LABELS[key]}
        </button>
      ))}
    </div>
  );
}
