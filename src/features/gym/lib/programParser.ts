import type { RegisteredParser } from '../../../core/import/registry';
import { importProgramText } from './program';
import { looksLikeProgramJson } from './programSchema';

// 週間プログラムJSON(§2.3a)をインポート基盤(registry)に載せるためのパーサ。
// 日次エクスポートJSONと同じ .json 拡張子のため、内容(canParseText)で判別される。

async function importText(text: string) {
  const outcome = await importProgramText(text);
  const added =
    outcome.addedExercises.length > 0
      ? `。種目マスタに追加: ${outcome.addedExercises.join('、')}`
      : '';
  return {
    message: outcome.updated
      ? `プログラム「${outcome.program.programName}」を取り込みました${added}`
      : `プログラム「${outcome.program.programName}」は取込済みです(変更なし)`,
    warnings: [],
  };
}

export const programJsonParser: RegisteredParser = {
  id: 'program-json',
  displayName: '週間プログラムJSON(コーチング成果物)',
  matches: (fileName) => /\.json$/i.test(fileName),
  canParseText: looksLikeProgramJson,
  importText,
  importFile: async (file) => importText(await file.text()),
};
