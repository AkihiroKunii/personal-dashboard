import { registerParser } from '../registry';
import { appleHealthXmlParser } from './appleHealthXml';
import { dailyJsonParser } from './dailyJson';

/** 利用可能な全パーサを登録する(アプリ起動時に1回呼ぶ) */
export function registerAllParsers(): void {
  registerParser(dailyJsonParser);
  registerParser(appleHealthXmlParser);
}
