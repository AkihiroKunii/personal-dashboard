import { describe, expect, it, vi } from 'vitest';
import { importFile, registerParser, type RegisteredParser } from './registry';

// registry の内容判定ディスパッチ(フェーズ2bで .json が日次/プログラムで衝突するため追加)。

function textFile(name: string, content: string): File {
  return new File([content], name, { type: 'application/json' });
}

describe('インポート基盤のディスパッチ', () => {
  it('同一拡張子(.json)を内容(canParseText)で振り分ける', async () => {
    const dailyImport = vi.fn().mockResolvedValue({ message: 'daily', warnings: [] });
    const programImport = vi.fn().mockResolvedValue({ message: 'program', warnings: [] });

    const daily: RegisteredParser = {
      id: 'test-daily',
      displayName: 'daily',
      matches: (n) => n.endsWith('.json'),
      canParseText: (t) => t.includes('"kind":"daily"'),
      importText: dailyImport,
      importFile: async (f) => dailyImport(await f.text()),
    };
    const program: RegisteredParser = {
      id: 'test-program',
      displayName: 'program',
      matches: (n) => n.endsWith('.json'),
      canParseText: (t) => t.includes('"kind":"program"'),
      importText: programImport,
      importFile: async (f) => programImport(await f.text()),
    };
    registerParser(daily);
    registerParser(program);

    const r1 = await importFile(textFile('a.json', '{"kind":"daily"}'));
    expect(r1.message).toBe('daily');
    expect(dailyImport).toHaveBeenCalledOnce();

    const r2 = await importFile(textFile('b.json', '{"kind":"program"}'));
    expect(r2.message).toBe('program');
    expect(programImport).toHaveBeenCalledOnce();
  });

  it('未対応拡張子はエラー', async () => {
    await expect(importFile(textFile('x.csv', 'a,b'))).rejects.toThrow(/対応していない/);
  });

  it('内容がどのパーサにも一致しなければエラー', async () => {
    await expect(importFile(textFile('c.json', '{"kind":"unknown"}'))).rejects.toThrow(
      /判別できません/,
    );
  });
});
