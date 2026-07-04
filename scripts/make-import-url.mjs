// V-F7 検証用: 日次エクスポートJSONを base64 化し、#import= 付きURLを生成する。
// 使い方: node scripts/make-import-url.mjs [JSONパス] [ベースURL]
import { readFileSync } from 'node:fs';

const jsonPath = process.argv[2] ?? 'docs/samples/daily_export_sample.json';
const bases = process.argv[3]
  ? [process.argv[3]]
  : [
      'https://akihirokunii.github.io/personal-dashboard/',
      'http://localhost:5173/personal-dashboard/',
    ];

const json = readFileSync(jsonPath, 'utf8');
// JSONとして妥当かを先に確認する(壊れた検証URLを作らない)
JSON.parse(json);
const b64 = Buffer.from(json, 'utf8').toString('base64');

console.log(`入力: ${jsonPath}(${json.length} bytes → base64 ${b64.length} 文字)\n`);
for (const base of bases) {
  console.log(`${base}#import=${b64}\n`);
}
