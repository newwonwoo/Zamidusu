import type { RefObject } from 'react';
import { LEGEND5, LEGEND7 } from '../core/brightness';
import { GRID_ROWS, borrowedMainStars, decadalList, surround } from '../core/chart';
import type { Chart, View, ViewTarget } from '../core/chart';
import type { Comparison } from '../core/compare';
import { fmtWall } from '../core/format';
import { BRANCHES, BRANCHES_KO, STEMS, ZODIAC_KO } from '../core/ganzhi';
import { MUTAGEN_LONG_KO, SCOPES, SCOPE_KO, starMeta, starLabel } from '../core/names';
import type { Scope } from '../core/names';
import { addDays, daysInSolarMonth, formatDelta, timeRangeLabel } from '../core/time';
import type { YMD } from '../core/time';
import { PalaceCell } from './PalaceCell';
import type { Highlight } from './PalaceCell';
import type { Settings } from './state';

interface Props {
  chart: Chart;
  view: View;
  comparison: Comparison | null;
  settings: Settings;
  scope: Scope;
  onScope: (s: Scope) => void;
  decadeIndex: number;
  onDecade: (i: number) => void;
  target: ViewTarget;
  onTarget: (t: ViewTarget) => void;
  selected: number;
  onSelect: (branch: number) => void;
  boardRef: RefObject<HTMLDivElement | null>;
  tools: {
    onSaveImage: () => void;
    onManse: () => void;
    onFont: () => void;
    onOptions: () => void;
    onCopyLink: () => void;
    busy: boolean;
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');
const toInput = (d: YMD): string => `${d.y}-${pad(d.m)}-${pad(d.d)}`;
const fromInput = (v: string): YMD | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};
const inRange = (d: YMD): boolean => d.y >= 1901 && d.y <= 2099;

/** 운 모드별 한 칸 이동(◀ ▶) */
export const stepTarget = (scope: Scope, t: ViewTarget, dir: -1 | 1): ViewTarget => {
  const d = t.date;
  let next: ViewTarget = t;
  if (scope === 'yearly') {
    const y = d.y + dir;
    next = { ...t, date: { y, m: d.m, d: Math.min(d.d, daysInSolarMonth(y, d.m)) } };
  } else if (scope === 'monthly') {
    const idx = d.y * 12 + (d.m - 1) + dir;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    next = { ...t, date: { y, m, d: Math.min(d.d, daysInSolarMonth(y, m)) } };
  } else if (scope === 'daily') {
    next = { ...t, date: addDays(d, dir) };
  } else if (scope === 'hourly') {
    const ti = t.timeIndex + dir;
    next = ti < 0 ? { date: addDays(d, -1), timeIndex: 11 } : ti > 11 ? { date: addDays(d, 1), timeIndex: 0 } : { ...t, timeIndex: ti };
  }
  return inRange(next.date) ? next : t;
};

function FortuneBar({ chart, view, scope, onScope, decadeIndex, onDecade, target, onTarget }: Pick<Props, 'chart' | 'view' | 'scope' | 'onScope' | 'decadeIndex' | 'onDecade' | 'target' | 'onTarget'>) {
  const decades = decadalList(chart);
  return (
    <div className="fortune">
      <div className="seg" role="tablist" aria-label="운 선택">
        {SCOPES.map((s) => (
          <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? 'on' : ''} onClick={() => onScope(s)}>
            {SCOPE_KO[s]}
          </button>
        ))}
      </div>
      {scope === 'decadal' && (
        <div className="decades" aria-label="대한 구간">
          {decades.map((d, i) => (
            <button key={d.startAge} className={i === decadeIndex ? 'on' : ''} onClick={() => onDecade(i)} title={`${chart.palaces[d.branch].ganzhi}궁`}>
              <b>{d.startAge}–{d.endAge}</b>
              <small>{chart.palaces[d.branch].ganzhi}</small>
            </button>
          ))}
        </div>
      )}
      {scope !== 'natal' && scope !== 'decadal' && (
        <div className="stepper">
          <button aria-label="이전" onClick={() => onTarget(stepTarget(scope, target, -1))}>◀</button>
          <input
            type="date"
            aria-label="기준 날짜"
            min="1901-01-01"
            max="2099-12-31"
            value={toInput(target.date)}
            onChange={(e) => {
              const v = fromInput(e.target.value);
              if (v && inRange(v)) onTarget({ ...target, date: v });
            }}
          />
          {scope === 'hourly' && (
            <select aria-label="기준 시진" value={target.timeIndex} onChange={(e) => onTarget({ ...target, timeIndex: Number(e.target.value) })}>
              {BRANCHES_KO.map((b, i) => <option key={b} value={i}>{b}시 ({timeRangeLabel(i)})</option>)}
            </select>
          )}
          <button aria-label="다음" onClick={() => onTarget(stepTarget(scope, target, 1))}>▶</button>
          <button className="ghost" onClick={() => onTarget({ date: todayYmd(), timeIndex: nowBranch() })}>오늘</button>
        </div>
      )}
      <p className="fortune-info" aria-live="polite">
        {scope === 'natal' && '타고난 명반(본명)입니다. 칸을 눌러 삼방사정과 해설을 확인하세요.'}
        {scope === 'decadal' && view.info.rangeLabel && `대한 ${view.info.rangeLabel} · ${view.info.ganzhi}대한 · 이 10년의 명궁이 ${chart.palaces[view.lifeBranch].ganzhi}칸으로 옮겨 갑니다.`}
        {scope === 'yearly' && view.info.ganzhi && `${view.info.ganzhi}년 · 세는나이 ${view.info.nominalAge}세 · 유년 명궁이 ${chart.palaces[view.lifeBranch].ganzhi}칸입니다.`}
        {scope === 'monthly' && view.info.lunar && `${view.info.ganzhi}월 · 음력 ${view.info.lunar.leap ? '윤' : ''}${view.info.lunar.month}월 · 유월 명궁이 ${chart.palaces[view.lifeBranch].ganzhi}칸입니다.`}
        {scope === 'daily' && view.info.lunar && `${view.info.ganzhi}일 · 음력 ${view.info.lunar.month}월 ${view.info.lunar.day}일 · 유일 명궁이 ${chart.palaces[view.lifeBranch].ganzhi}칸입니다.`}
        {scope === 'hourly' && `${view.info.ganzhi}시 · 유시 명궁이 ${chart.palaces[view.lifeBranch].ganzhi}칸입니다.`}
        {scope !== 'natal' && ' (유년 이하는 엔진 값을 그대로 보여 줍니다.)'}
      </p>
    </div>
  );
}

const todayYmd = (): YMD => {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
};
export const nowBranch = (): number => {
  const h = new Date().getHours();
  return h === 23 ? 0 : Math.floor((h + 1) / 2);
};

function CenterInfo({ chart, view, comparison, settings }: Pick<Props, 'chart' | 'view' | 'comparison' | 'settings'>) {
  const m = chart.meta;
  const n = chart.norm;
  const lunar = m.lunar;
  const soul = starMeta(m.soulStar);
  const body = starMeta(m.bodyStar);
  const notice = comparison?.notice;
  return (
    <div className="center">
      <h2 className="center-title">{n.gender === 'M' ? '남' : '여'}명 · {ZODIAC_KO[m.yearBranch]}띠</h2>
      <dl className="center-list">
        <div><dt>양력</dt><dd>{n.civil.y}-{pad(n.civil.m)}-{pad(n.civil.d)}{n.hourKnown ? ` ${pad(n.civil.h)}:${pad(n.civil.mi)}` : ' (시 모름)'}</dd></div>
        <div><dt>음력</dt><dd>{lunar.year}년 {lunar.leap ? '윤' : ''}{lunar.month}월 {lunar.day}일</dd></div>
        {n.correction && n.correction.deltaMinutes !== 0 && (
          <div><dt>보정</dt><dd title={n.correction.note}>{n.corrected ? fmtWall(n.corrected) : ''} ({formatDelta(n.correction.deltaMinutes)})</dd></div>
        )}
        <div><dt>시</dt><dd>{BRANCHES_KO[m.timeBranch]}시 ({timeRangeLabel(m.timeBranch)}){n.shiftedDay ? ' · 다음 날 자시' : ''}</dd></div>
        <div><dt>연주</dt><dd>{STEMS[m.yearStem]}{BRANCHES[m.yearBranch]}년 <small>({chart.options.yearBasis === 'ipchun' ? '입춘' : '음력 설'} 기준)</small></dd></div>
        <div><dt>오행국</dt><dd>{m.fiveElements.ko} ({m.fiveElements.hanja})</dd></div>
        <div><dt>명주 · 신주</dt><dd>{starLabel(soul, settings.nameStyle)} · {starLabel(body, settings.nameStyle)}</dd></div>
        <div><dt>명궁 · 신궁</dt><dd>{chart.palaces[m.soulBranch].ganzhi} · {chart.palaces[m.bodyBranch].ganzhi}</dd></div>
        <div><dt>대한</dt><dd>{m.firstDecadalAge}세부터 {m.decadalForward ? '순행' : '역행'}</dd></div>
      </dl>
      <div className="center-mut" aria-label="생년 사화">
        {m.yearMutagens.map((y) => (
          <span key={y.mutagen} className={`mut mut-${y.mutagen}`} title={MUTAGEN_LONG_KO[y.mutagen]}>
            {MUTAGEN_LONG_KO[y.mutagen]} {starLabel(starMeta(y.star), settings.nameStyle)}
          </span>
        ))}
      </div>
      {notice && (
        <div className={`center-notice ${notice.yearDiffers ? 'warn' : ''}`} role="note">
          <b>달력 기준</b> {notice.headline}
        </div>
      )}
      {view.scope !== 'natal' && <div className="center-scope">{SCOPE_KO[view.scope]} 보기: 칸 이름이 그 시기 기준으로 바뀌었습니다</div>}
    </div>
  );
}

export function Legend({ settings }: { settings: Settings }) {
  const list = settings.brightness === '7' ? LEGEND7 : LEGEND5;
  return (
    <div className="legend" aria-label="범례">
      <span className="legend-title">밝기</span>
      {list.map((l) => (
        <span key={l.key} className={`br br-t${l.tier}`} title={`지수 ${l.score}`}>{l.symbol}{l.text}</span>
      ))}
      <span className="legend-sep" />
      <span className="mut mut-lu">록</span><span className="mut mut-quan">권</span><span className="mut mut-ke">과</span><span className="mut mut-ji">기</span>
      <span className="legend-sep" />
      <span className="chip chip-good">길성</span><span className="chip chip-bad">살성</span><span className="mut mut-out mut-lu">대·록</span>
      <span className="legend-note">윤곽 배지는 선택한 운의 사화</span>
    </div>
  );
}

export function ChartBoard(props: Props) {
  const { chart, view, comparison, settings, selected, onSelect, boardRef, tools } = props;
  const hl = settings.highlightSurround ? surround(selected) : null;
  const highlightOf = (b: number): Highlight => {
    if (b === selected) return 'sel';
    if (!hl) return null;
    if (b === hl.opposite) return 'opp';
    if (hl.trine.includes(b)) return 'tri';
    return null;
  };

  return (
    <section className="chart-section" aria-label="명반">
      <div className="toolbar" role="toolbar" aria-label="도구">
        <button onClick={tools.onSaveImage} disabled={tools.busy}>이미지 저장</button>
        <button onClick={tools.onManse}>만세력</button>
        <button onClick={tools.onFont}>글꼴 설정</button>
        <button onClick={tools.onOptions}>표시 옵션</button>
        <button onClick={tools.onCopyLink}>링크 복사</button>
      </div>
      <FortuneBar {...props} />
      <div className="board" ref={boardRef}>
        <div className="grid">
          {GRID_ROWS.flat().map((b, i) =>
            b === null ? (
              i === 5 ? <div key="center" className="center-slot"><CenterInfo chart={chart} view={view} comparison={comparison} settings={settings} /></div> : null
            ) : (
              <PalaceCell
                key={b}
                palace={chart.palaces[b]}
                view={view}
                settings={settings}
                highlight={highlightOf(b)}
                borrowed={borrowedMainStars(chart, b)}
                onSelect={() => onSelect(b)}
              />
            ),
          )}
        </div>
        <Legend settings={settings} />
      </div>
    </section>
  );
}
