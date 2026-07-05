import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalize';
import { buildLadder } from './ladder';

describe('buildLadder(§4 分解ラダー)', () => {
  it('4段(最小/標準/伸長/復旧)を生成する', () => {
    const ladder = buildLadder(canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 5 }));
    expect(ladder.minimal.kind).toBe('minimal');
    expect(ladder.standard.kind).toBe('standard');
    expect(ladder.stretch.kind).toBe('stretch');
    expect(ladder.recovery.kind).toBe('recovery');
  });

  it('最小 < 標準 < 伸長 の所要時間で、復旧は最小より小さい', () => {
    const ladder = buildLadder(canonicalize({ activity: '筋トレ', targetFrequencyPerWeek: 3 }));
    expect(ladder.minimal.minutes).toBeLessThan(ladder.standard.minutes);
    expect(ladder.standard.minutes).toBeLessThan(ladder.stretch.minutes);
    expect(ladder.recovery.minutes).toBeLessThanOrEqual(ladder.minimal.minutes);
  });

  it('活動タイプ別にテンプレが変わる(admin の最小は1件記録)', () => {
    const admin = buildLadder(canonicalize({ activity: '家計記録', targetFrequencyPerWeek: 7 }));
    expect(admin.minimal.label).toContain('1件');
    // ラベルに活動名が含まれ、本人が認識できる最小有意味単位になっている
    expect(admin.minimal.label).toContain('家計記録');
  });
});
