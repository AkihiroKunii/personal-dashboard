import type { Stage } from '../../../packages/habit-engine';

// momentumスコア(減衰付き)の可視化(H-F5)。binary streakにしない主表示。

const STAGE_LABEL: Record<Stage, string> = {
  initiate: '始動',
  stabilize: '安定化',
  scale: '拡張',
  maintain: '維持',
  recover: '回復中',
};

const STAGE_COLOR: Record<Stage, string> = {
  initiate: '#38bdf8',
  stabilize: '#818cf8',
  scale: '#a78bfa',
  maintain: '#34d399',
  recover: '#fb7185',
};

/** momentum は decay=0.8 の累積のため理論上限は 1/(1-0.8)=5。0..5 を 0..100% に写す */
const MOMENTUM_MAX = 5;

export function MomentumBar({
  activity,
  momentum,
  stage,
}: {
  activity: string;
  momentum: number;
  stage: Stage;
}) {
  const pct = Math.min(100, Math.round((momentum / MOMENTUM_MAX) * 100));
  const color = STAGE_COLOR[stage];
  return (
    <div className="momentum-row">
      <div className="momentum-head">
        <span className="momentum-name">{activity}</span>
        <span className="momentum-badge" style={{ color, borderColor: `${color}66` }}>
          {STAGE_LABEL[stage]}
        </span>
      </div>
      <div className="momentum-track">
        <div
          className="momentum-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}88` }}
        />
      </div>
      <span className="momentum-value">勢い {Math.round(momentum * 10) / 10}</span>
    </div>
  );
}

export { STAGE_LABEL, STAGE_COLOR };
