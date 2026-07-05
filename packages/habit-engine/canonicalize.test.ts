import { describe, expect, it } from 'vitest';
import { canonicalize, classifyActivity } from './canonicalize';

describe('canonicalize(§3 活動正規化)', () => {
  it('活動名から活動タイプを推定する', () => {
    expect(classifyActivity('英語学習')).toBe('skill');
    expect(classifyActivity('筋トレ')).toBe('physical');
    expect(classifyActivity('家計記録')).toBe('admin');
    expect(classifyActivity('日記')).toBe('reflective');
    expect(classifyActivity('未知の活動')).toBe('skill'); // 既定
  });

  it('HabitSpecへ正規化し属性を付与する', () => {
    const spec = canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 5, why: '海外で働く' });
    expect(spec.activityType).toBe('skill');
    expect(spec.targetFrequencyPerWeek).toBe(5);
    expect(spec.why).toBe('海外で働く');
    expect(spec.attributes.cueability).toBeGreaterThan(0.5);
    // skill は setup_cost 低・reward_delay 高(§3)
    expect(spec.attributes.setupCost).toBeLessThan(0.5);
    expect(spec.attributes.rewardDelay).toBeGreaterThan(0.5);
  });

  it('明示した activityType は推定より優先される', () => {
    const spec = canonicalize({ activity: '謎の運動', targetFrequencyPerWeek: 3, activityType: 'physical' });
    expect(spec.activityType).toBe('physical');
  });

  it('週頻度で最小間隔日数を決める(週4以上は連日可)', () => {
    expect(canonicalize({ activity: '英語', targetFrequencyPerWeek: 5 }).constraints.minIntervalDays).toBe(0);
    expect(canonicalize({ activity: '筋トレ', targetFrequencyPerWeek: 3 }).constraints.minIntervalDays).toBe(1);
    expect(canonicalize({ activity: '家計', targetFrequencyPerWeek: 7 }).constraints.minIntervalDays).toBe(0);
  });

  it('id を自動採番する(未指定時)', () => {
    const a = canonicalize({ activity: 'A', targetFrequencyPerWeek: 1 });
    const b = canonicalize({ activity: 'B', targetFrequencyPerWeek: 1 });
    expect(a.id).not.toBe(b.id);
    expect(canonicalize({ activity: 'C', targetFrequencyPerWeek: 1, id: 'fixed' }).id).toBe('fixed');
  });
});
