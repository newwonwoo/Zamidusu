import { useMemo, useState } from 'react';
import { BRANCHES, BRANCHES_KO, STEMS, STEMS_KO } from '../core/ganzhi';
import { CONSTRAINT_LABEL, reverseSearch, valueLabel, yearsFor } from '../core/reverse';
import type { ConstraintKey, ReverseCandidate, ReverseConstraints } from '../core/reverse';
import type { LunarBasis } from '../core/time';

interface Props {
  /** 후보와 연도를 골라 명반을 만든다 */
  onUse: (c: ReverseCandidate, year: number) => void;
  /** 음력 기준: 해당 달에 그 날짜가 있는 해(예: 30일)가 기준에 따라 달라진다 */
  lunarBasis: LunarBasis;
}

const optionsOf = (key: ConstraintKey): { v: number; label: string }[] => {
  switch (key) {
    case 'yearStem': return STEMS.map((s, i) => ({ v: i, label: `${STEMS_KO[i]}(${s})` }));
    case 'yearBranch': return BRANCHES.map((b, i) => ({ v: i, label: `${BRANCHES_KO[i]}(${b})` }));
    case 'month': return Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: `${i + 1}월` }));
    case 'day': return Array.from({ length: 30 }, (_, i) => ({ v: i + 1, label: `${i + 1}일` }));
    case 'hourBranch': return BRANCHES.map((b, i) => ({ v: i, label: `${BRANCHES_KO[i]}시(${b})` }));
    case 'fiveClass': return [2, 3, 4, 5, 6].map((n) => ({ v: n, label: valueLabel('fiveClass', n) }));
    default: return BRANCHES.map((b, i) => ({ v: i, label: `${BRANCHES_KO[i]}궁(${b})` }));
  }
};

const GROUPS: { title: string; keys: ConstraintKey[] }[] = [
  { title: '해와 날짜', keys: ['yearStem', 'yearBranch', 'month', 'day', 'hourBranch'] },
  { title: '명반에서 읽은 위치', keys: ['soul', 'body', 'fiveClass', 'ziwei'] },
  { title: '월·시·일에 따라 정해지는 별', keys: ['zuofu', 'youbi', 'wenchang', 'wenqu', 'santai', 'bazuo'] },
];

function CandidateRow({ c, onUse, lunarBasis }: { c: ReverseCandidate; onUse: Props['onUse']; lunarBasis: LunarBasis }) {
  const years = useMemo(() => c.yearBranches.flatMap((b) => yearsFor(c, b, lunarBasis)).sort((a, b) => a - b), [c, lunarBasis]);
  const [year, setYear] = useState<number | null>(null);
  const chosen = year ?? years[0];
  return (
    <li>
      <span>
        {STEMS_KO[c.yearStem]}({STEMS[c.yearStem]})년 · 음력 {c.month}월 {c.day}일 · {BRANCHES_KO[c.hourBranch]}시
      </span>
      {years.length === 0 ? (
        <small className="dim">1900~2100년 중 이 날짜가 있는 해가 없습니다</small>
      ) : (
        <>
          <select aria-label="대표 연도" value={chosen} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button type="button" onClick={() => onUse(c, chosen)}>명반 보기</button>
        </>
      )}
    </li>
  );
}

export function ReverseInput({ onUse, lunarBasis }: Props) {
  const [c, setC] = useState<ReverseConstraints>({});
  const result = useMemo(() => reverseSearch(c, 400), [c]);
  const set = (k: ConstraintKey, v: string) => {
    const next = { ...c };
    if (v === '') delete next[k];
    else next[k] = Number(v);
    setC(next);
  };

  return (
    <div className="reverse">
      <p className="hint">출생 정보를 모를 때, 명반에서 읽은 값만 골라 가능한 생월·생일·생시를 찾습니다. 모르는 칸은 비워 두세요. 값을 바꾸면 바로 계산됩니다.</p>
      {GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          <div className="rev-grid">
            {g.keys.map((k) => (
              <label key={k}>{CONSTRAINT_LABEL[k]}
                <select value={c[k] === undefined ? '' : String(c[k])} onChange={(e) => set(k, e.target.value)}>
                  <option value="">모름</option>
                  {optionsOf(k).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="actions">
        <button type="button" onClick={() => setC({})}>초기화</button>
      </div>

      <div className="rev-result" aria-live="polite">
        {result.status === 'empty-input' && <p className="dim">아는 값을 하나 이상 고르면 후보가 나타납니다.</p>}
        {result.status === 'none' && (
          <div className="rev-none" role="alert">
            <b>입력한 값들이 함께 성립하지 않습니다 (후보 0개)</b>
            <ul>{result.conflicts.map((x, i) => <li key={i}>{x.message}</li>)}</ul>
            {result.conflicts.length === 0 && <p className="dim">여러 입력이 서로 얽혀 있어 하나만 바꿔서는 해결되지 않습니다. 값을 하나씩 비워 보세요.</p>}
          </div>
        )}
        {(result.status === 'unique' || result.status === 'multiple') && (
          <>
            <p><b>가능한 조합 {result.count}개</b>{result.truncated ? ` (앞의 ${result.candidates.length}개만 표시)` : ''}{result.status === 'unique' ? ' — 하나로 정해졌습니다.' : ' — 값을 더 고르면 좁혀집니다.'}</p>
            <ol className="cands">
              {result.candidates.slice(0, 20).map((cand, i) => <CandidateRow key={i} c={cand} onUse={onUse} lunarBasis={lunarBasis} />)}
            </ol>
            <p className="hint">참고: 같은 달의 d일과 d+24일(예: 4일과 28일)은 명반이 똑같아 구분할 수 없습니다. 연지를 모르면 6가지 해가 모두 후보로 나옵니다.</p>
          </>
        )}
      </div>
    </div>
  );
}
