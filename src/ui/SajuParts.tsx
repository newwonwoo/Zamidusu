import type { Chart, YearBasis } from '../core/chart';
import { EVIDENCE_LABEL } from '../core/compare';
import type { CompareItem, Comparison } from '../core/compare';
import { fmtInstant } from '../core/format';
import type { SajuChart } from '../core/saju';
import { TermText } from './TermText';
import type { Segment } from './TermText';

const SAME_LABEL = { true: '같음', false: '다름', null: '비교 대상이 다름' } as const;
const GOD_CLASS = (god: string): string => (god === '일간' ? 'god-self' : '');

const STATUS_ICON: Record<string, string> = { match: '✓', differ: '≠', info: '·' };
const STATUS_LABEL: Record<string, string> = { match: '두 체계가 같습니다', differ: '두 체계가 다릅니다', info: '참고' };

function EvidenceBadges({ item }: { item: CompareItem }) {
  const kinds = Array.from(new Set(item.evidence.map((e) => EVIDENCE_LABEL[e.kind]))).join(' · ');
  return (
    <details className="evidence-box">
      <summary>근거 보기 <small>({kinds})</small></summary>
      <ul className="evidence" aria-label="근거">
        {item.evidence.map((e, i) => (
          <li key={i} className={`ev ev-${e.kind}`}>
            <span className="ev-kind">{EVIDENCE_LABEL[e.kind]}</span>
            {e.part && <span className="ev-part">{e.part}</span>}
            <span className="ev-detail">{e.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ItemCard({ item, body, live }: { item: CompareItem; body: Segment[]; live: Segment[][] }) {
  return (
    <article className={`cmp-card ${item.side}`} data-id={item.id}>
      <h4><span className="cmp-id">{item.id}</span> {item.title}</h4>
      <p><TermText segments={body} /></p>
      <ul className="live" aria-label="이 사주의 실제 값">
        {item.live.map((l, i) => (
          <li key={i} className={`live-${l.status}`}>
            <span className="live-icon" role="img" aria-label={STATUS_LABEL[l.status]}>{STATUS_ICON[l.status]}</span>
            <span><TermText segments={live[i]} /></span>
          </li>
        ))}
      </ul>
      <EvidenceBadges item={item} />
    </article>
  );
}

/** 달력 기준 알림과 자미두수 연도 기준 선택. 사주와 자미두수의 연·월이 어떻게 다른지가 통변 비교의 전제라서 비교 탭 맨 위에 둔다 */
export function CalendarNotice({ chart, saju, comparison, lines, onYearBasis }: { chart: Chart; saju: SajuChart; comparison: Comparison; lines: Segment[][]; onYearBasis: (b: YearBasis) => void }) {
  const tz = chart.norm.tz;
  return (
    <section className={`notice ${comparison.notice.level}`} role="note" aria-label="달력 기준 알림">
      <h3>달력 기준 알림 · {comparison.notice.headline}</h3>
      {lines.map((s, i) => <p key={i}><TermText segments={s} /></p>)}
      <fieldset className="basis">
        <legend>자미두수의 연도 기준</legend>
        <label><input type="radio" name="yb" checked={chart.options.yearBasis === 'lunarNewYear'} onChange={() => onYearBasis('lunarNewYear')} /> 음력 설 <small>(기본 · 사이트와 동일)</small></label>
        <label><input type="radio" name="yb" checked={chart.options.yearBasis === 'ipchun'} onChange={() => onYearBasis('ipchun')} /> 입춘 <small>(사주와 같은 해)</small></label>
      </fieldset>
      <p className="dim small">사주의 연주는 어느 쪽을 골라도 항상 입춘 기준입니다. 직전 절기 {saju.jie.prev.ko}({fmtInstant(saju.jie.prev.utcMs, tz)}), 다음 절기 {saju.jie.next.ko}({fmtInstant(saju.jie.next.utcMs, tz)}).</p>
      {saju.notes.map((n, i) => <p key={i} className="dim small">※ {n}</p>)}
    </section>
  );
}

/** 같은 입력의 사주와 자미두수를 나란히 놓은 표와 오행 분포 */
export function PillarsTable({ saju, comparison }: { saju: SajuChart; comparison: Comparison }) {
  const total = comparison.elements.reduce((n, e) => n + e.count, 0) || 1;
  return (
    <div className="saju-parts">
      <div className="table-wrap">
        <table className="pillars">
          <thead>
            <tr><th scope="col"><span className="sr-only">구분</span></th>{comparison.columns.map((c) => <th scope="col" key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="row-saju">
              <th scope="row">사주</th>
              {comparison.columns.map((c) => (
                <td key={c.key}>
                  {c.saju ? <><b className="gz-big">{c.saju.ganzhi}</b><small>{c.saju.ko}</small></> : <span className="dim">모름</span>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">십성<br /><small>천간·지지</small></th>
              {comparison.columns.map((c) => (
                <td key={c.key}>{c.saju ? <span className={GOD_CLASS(c.saju.stemGod)}>{c.saju.stemGod}<br />{c.saju.branchGod}</span> : '–'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">12운성<br /><small>일간 기준</small></th>
              {comparison.columns.map((c) => <td key={c.key}>{c.saju?.stage ?? '–'}</td>)}
            </tr>
            <tr className="row-ziwei">
              <th scope="row">자미두수</th>
              {comparison.columns.map((c) => (
                <td key={c.key}><b>{c.ziwei}</b><small>{c.ziweiNote}</small></td>
              ))}
            </tr>
            <tr className="row-same">
              <th scope="row">비교</th>
              {comparison.columns.map((c) => (
                <td key={c.key} className={`same-${String(c.same)}`}>{SAME_LABEL[String(c.same) as 'true' | 'false' | 'null']}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="elements" aria-label="사주 오행 분포">
        {comparison.elements.map((e) => (
          <div key={e.key} className={`el el-${e.key}`}>
            <span>{e.ko}</span>
            <div className="bar"><div style={{ width: `${(e.count / total) * 100}%` }} /></div>
            <b>{e.count}</b>
          </div>
        ))}
        <p className="dim small">천간과 지지 본기 {saju.hour ? 8 : 6}글자의 오행 개수입니다.</p>
      </div>
    </div>
  );
}

/** 두 체계의 이론(방법론) 차이 10항목. 통변 비교의 배경 지식이라 접어서 둔다 */
export function TheoryCompare({ comparison, segsOf }: { comparison: Comparison; segsOf: Map<string, { body: Segment[]; live: Segment[][] }> }) {
  const common = comparison.items.filter((i) => i.side === 'common');
  const diff = comparison.items.filter((i) => i.side === 'diff');
  const counts = comparison.evidenceCounts;
  return (
    <div className="theory">
      <section aria-label="공통점">
        <h4>공통점 <small>5</small></h4>
        {common.map((i) => <ItemCard key={i.id} item={i} body={segsOf.get(i.id)!.body} live={segsOf.get(i.id)!.live} />)}
      </section>
      <section aria-label="차이점">
        <h4>차이점 <small>5</small></h4>
        {diff.map((i) => <ItemCard key={i.id} item={i} body={segsOf.get(i.id)!.body} live={segsOf.get(i.id)!.live} />)}
      </section>
      <p className="disclaimer">
        근거 구분 집계 — 코드·시험 검증 {counts.code} · 화면 관찰 {counts.screen} · 자료 인용 {counts.source} · 전통 표 인용 {counts.tradition}.
        위 비교는 전통 이론에 따른 설명이며 통계로 검증된 예측이 아닙니다.
      </p>
    </div>
  );
}
