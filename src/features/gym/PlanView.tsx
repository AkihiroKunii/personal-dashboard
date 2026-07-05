import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import { importFile } from '../../core/import/registry';
import { dowOf, todayJst } from '../../core/dates';
import type { DayOfWeek } from '../../core/types';
import { buildProgramIcs } from './lib/ics';
import { currentOrNextProgram } from './lib/program';

// G-F6 プログラム表示 + G-F7 icsダウンロード(フォールバック)+ 手動インポート(フォールバック)。

const DOW_LABEL: Record<DayOfWeek, string> = {
  Sun: '日',
  Mon: '月',
  Tue: '火',
  Wed: '水',
  Thu: '木',
  Fri: '金',
  Sat: '土',
};

export function PlanView() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayJst();
  const found = useLiveQuery(() => currentOrNextProgram(today), [today]);
  const program = found?.program;
  const status = found?.status;
  const programCount = useLiveQuery(() => db.programs.count(), []) ?? 0;

  const downloadIcs = () => {
    if (!program) return;
    const blob = new Blob([buildProgramIcs(program)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${program.programName}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const outcome = await importFile(file);
      toast(outcome.message);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const todayDow = dowOf(today);

  return (
    <>
      {program ? (
        <>
          <section className="card">
            <h2>
              {program.programName}
              <span className="hint-inline">
                {program.validFrom}〜{program.validUntil}
                {status === 'upcoming' ? '(開始前)' : status === 'past' ? '(終了)' : ''}
              </span>
            </h2>
            {program.nutritionTargets?.proteinGramsPerDay !== undefined && (
              <p className="hint">
                タンパク質目標: {program.nutritionTargets.proteinGramsPerDay}g/日
                {program.nutritionTargets.note ? `(${program.nutritionTargets.note})` : ''}
              </p>
            )}
          </section>

          {program.weeklySchedule.map((day) => (
            <section
              key={day.dayOfWeek}
              className={`card${day.dayOfWeek === todayDow ? ' today-highlight' : ''}`}
            >
              <h2>
                <span>
                  {DOW_LABEL[day.dayOfWeek]}曜 · {day.focus}
                </span>
                {day.dayOfWeek === todayDow && <span className="hint-inline">今日</span>}
              </h2>
              {day.exercises.length === 0 ? (
                <p className="hint">種目未定</p>
              ) : (
                <ul className="menu-list">
                  {day.exercises.map((e) => (
                    <li key={e.name}>
                      <span>{e.name}</span>
                      <span className="menu-target">
                        {e.sets}セット × {e.reps}
                        {e.note ? ` · ${e.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      ) : (
        <section className="card">
          <p className="hint">
            現在有効なプログラムがありません。programs/current.json が公開されていれば起動時に自動取込されます。手動で取り込むこともできます。
          </p>
        </section>
      )}

      <section className="card">
        <h2>カレンダー・取込</h2>
        <p className="hint">
          通常はリポジトリの programs/current.json を更新すると、カレンダー(購読URL)とアプリの両方に自動反映されます。以下は手動フォールバックです。
        </p>
        {program && (
          <button className="ghost-btn" style={{ width: '100%', padding: 10 }} onClick={downloadIcs}>
            .ics をダウンロード
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {programCount > 1 && <p className="hint">取込済みプログラム世代: {programCount}件</p>}
      </section>
    </>
  );
}
