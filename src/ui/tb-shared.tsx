// 통변 화면(종합 통변 · 사주 통변 · 통변 비교)이 함께 쓰는 작은 조각.
import { DOMAIN_LABEL, LEVEL_LABEL, LEVEL_MARK, VERDICT_LABEL, themeLabel } from '../core/tongbyeon';
import type { Domain, DomainReading, Evidence, Level, PeriodReading, Verdict } from '../core/tongbyeon';
import { TermText } from './TermText';
import type { Segment } from './TermText';

export const LEVEL_SHORT: Record<Level, string> = { 2: '매우 좋음', 1: '좋음', 0: '무난', [-1]: '신경', [-2]: '조심' } as Record<Level, string>;
export const levelClass = (l: Level): string => `lv-${l < 0 ? `m${-l}` : l}`;
const VERDICT_MARK: Record<Verdict, string> = { agree: '✓', complement: '◐', conflict: '≠' };

export function LevelBadge({ level, short = false }: { level: Level; short?: boolean }) {
  return (
    <span className={`lv ${levelClass(level)}`} data-level={level}>
      <span aria-hidden="true">{LEVEL_MARK[level]}</span> {short ? LEVEL_SHORT[level] : LEVEL_LABEL[level]}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`vd vd-${verdict}`} data-verdict={verdict}>
      <span aria-hidden="true">{VERDICT_MARK[verdict]}</span> {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function Chips({ items, label }: { items: (string | Segment[])[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="tb-chips" aria-label={label}>
      {items.map((t, i) => <li key={i}>{typeof t === 'string' ? t : <TermText segments={t} />}</li>)}
    </ul>
  );
}

export function EvidenceFold({ items, summary = '근거 보기' }: { items: Evidence[]; summary?: string }) {
  return (
    <details className="evidence-box tb-evidence">
      <summary>{summary}</summary>
      <ul className="tb-ev-list" aria-label="근거">
        {items.map((e, i) => (
          <li key={i}><code>{e.rule}</code> <span>{e.text}</span></li>
        ))}
      </ul>
    </details>
  );
}

/** 여러 문장을 한 문단으로(문장 사이에 공백) */
export function Para({ parts, className }: { parts: Segment[][]; className?: string }) {
  return (
    <p className={className}>
      {parts.map((segs, i) => (
        <span key={i}>{i > 0 ? ' ' : ''}<TermText segments={segs} /></span>
      ))}
    </p>
  );
}

export interface CardText {
  verdict: Segment[];
  /** 이 단계로 본 가장 큰 이유(짧은 명사구) */
  why: Segment[][];
  points: { label: string; kind: string; segs: Segment[] }[];
  advice: Segment[];
}

/** 영역 통변 카드(자미두수·사주 공통). foldPoints 이면 본문 풀이를 접는다(총평에서 이미 읽은 내용이라서) */
export function DomainCard({ reading, text, foldPoints = false }: { reading: DomainReading; text: CardText; foldPoints?: boolean }) {
  const pointList = (
    <ul className="tb-points">
      {text.points.map((p, i) => (
        <li key={i} className={`tb-pt tb-pt-${p.kind}`}>
          <span className="tb-pt-label">{p.label}</span>
          <span className="tb-pt-text"><TermText segments={p.segs} /></span>
        </li>
      ))}
    </ul>
  );
  return (
    <article className="tb-card" data-domain={reading.domain} data-system={reading.system} data-level={reading.level}>
      <header>
        <h4>{DOMAIN_LABEL[reading.domain]}</h4>
        <LevelBadge level={reading.level} />
      </header>
      <p className="tb-verdict"><TermText segments={text.verdict} /></p>
      <Chips items={reading.themes.map((t) => themeLabel(reading.domain, t))} label={`${DOMAIN_LABEL[reading.domain]} 핵심 주제`} />
      {text.why.length > 0 && (
        <p className="tb-why" data-testid="card-why">
          <span className="tb-tag-label">이렇게 본 이유</span>{' '}
          {text.why.map((segs, i) => <span key={i}>{i > 0 ? ' · ' : ''}<TermText segments={segs} /></span>)}
        </p>
      )}
      {foldPoints ? (
        <details className="tb-fold">
          <summary>풀이 자세히 보기</summary>
          {pointList}
        </details>
      ) : pointList}
      <p className="tb-advice"><b>조언</b> <TermText segments={text.advice} /></p>
      <EvidenceFold items={reading.evidence} />
    </article>
  );
}

/** 영역별 한눈에 보기(여섯 칸 배지) */
export function DomainStrip({ domains, onlyLevels }: { domains: Record<Domain, DomainReading>; onlyLevels?: boolean }) {
  return (
    <ul className="tb-strip" aria-label="영역별 경향 요약">
      {(Object.keys(domains) as Domain[]).map((d) => (
        <li key={d}>
          <span className="tb-strip-name">{DOMAIN_LABEL[d]}</span>
          <LevelBadge level={domains[d].level} short={!onlyLevels} />
        </li>
      ))}
    </ul>
  );
}

export function PeriodItem({ p, current, segs, highlightLabel }: { p: PeriodReading; current: boolean; segs: Segment[]; highlightLabel: string }) {
  return (
    <li className={`tb-period ${current ? 'now' : ''}`} aria-current={current ? 'true' : undefined} data-system={p.system} data-level={p.level}>
      <div className="tb-period-head">
        <b>{p.system === 'saju' ? '만 ' : ''}{p.startAge}~{p.endAge}세</b>
        <span className="dim">{p.startYear}~{p.endYear}년</span>
        {current && <span className="tb-now">지금</span>}
        <LevelBadge level={p.level} short />
      </div>
      <div className="tb-period-label">{p.label}</div>
      {p.standing && p.standingNote && <p className={`tb-standing tb-standing-${p.standing}`} data-standing={p.standing}>{p.standingNote}</p>}
      <p><TermText segments={segs} /></p>
      {p.highlights.length > 0 && (
        <div className="tb-period-tags"><span className="tb-tag-label">{highlightLabel}</span><Chips items={p.highlights.map((d) => DOMAIN_LABEL[d])} label={highlightLabel} /></div>
      )}
      {p.cautions && p.cautions.length > 0 && (
        <div className="tb-period-tags"><span className="tb-tag-label">신경 쓸 영역</span><Chips items={p.cautions.map((d) => DOMAIN_LABEL[d])} label="신경 쓸 영역" /></div>
      )}
    </li>
  );
}

export function Disclaimer({ lines }: { lines: string[] }) {
  return (
    <div className="disclaimer tb-disclaimer">
      <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
    </div>
  );
}
