// 数値ステッパー(記録・ボディ入力で共用)。タップで増減、直接入力も可。

export function Stepper({
  label,
  unit,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
}) {
  // 浮動小数の誤差を刻みの桁で丸める(0.1刻みで 0.30000000000000004 を防ぐ)
  const decimals = (String(step).split('.')[1] ?? '').length;
  const round = (n: number) => Number(n.toFixed(decimals));
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button aria-label={`${label}を減らす`} onClick={() => onChange(round(Math.max(min, value - step)))}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      <button aria-label={`${label}を増やす`} onClick={() => onChange(round(value + step))}>
        +
      </button>
      <span className="stepper-unit">{unit}</span>
    </div>
  );
}
