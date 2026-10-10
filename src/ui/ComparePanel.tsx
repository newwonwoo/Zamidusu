// 통변 비교: 같은 영역에 대해 자미두수 통변과 사주 통변이 같은 말을 하는지 나란히 보여 준다.
// 판정(일치·보완·엇갈림)은 경향 단계로만 정하고, 문장은 그 이유를 쉬운 말로 풀어 쓴 것이다(설계 부록 D-7).
import { useMemo } from 'react';
import type { Chart, YearBasis } from '../core/chart';
import type { Comparison } from '../core/compare';
import type { SajuChart } from '../core/saju';
import { DOMAIN_LABEL, VERDICT_LABEL } from '../core/tongbyeon';
import type { Tongbyeon } from '../core/tongbyeon';
import { CalendarNotice, TheoryCompare } from './SajuParts';
import { makeAnnotator, TermText } from './TermText';
import type { Segment } from './TermText';
import { Chips, Disclaimer, LevelBadge, VerdictBadge } from './tb-shared';

interface Props {
  chart: Chart;
  saju: SajuChart;
  tb: Tongbyeon;
  comparison: Comparison;
  onYearBasis: (b: YearBasis) => void;
}

function Why({ label, items }: { label: string; items: Segment[][] }) {
  if (items.length === 0) return null;
  return (
    <p className="tb-why">
      <span className="tb-tag-label">{label}</span>{' '}
      {items.map((segs, i) => <span key={i}>{i > 0 ? ' · ' : ''}<TermText segments={segs} /></span>)}
    </p>
  );
}

export function ComparePanel({ chart, saju, tb, comparison, onYearBasis }: Props) {
  const c = tb.comparison;
  const v = useMemo(() => {
    const ann = makeAnnotator();
    const notice = comparison.notice.lines.map(ann);
    const summary = c.summary.map(ann);
    const domains = c.domains.map((d) => ({
      lens: ann(d.lens),
      whyZ: d.whyZiwei.map(ann),
      whyS: d.whySaju.map(ann),
    }));
    const periodNotes = c.periods.map((p) => ann(p.note));
    // 접어 두는 이론 비교는 마지막에 풀이를 붙인다
    const common = comparison.items.filter((i) => i.side === 'common');
    const diff = comparison.items.filter((i) => i.side === 'diff');
    const segsOf = new Map<string, { body: Segment[]; live: Segment[][] }>();
    for (const it of [...common, ...diff]) segsOf.set(it.id, { body: ann(it.body), live: it.live.map((l) => ann(l.text)) });
    return { notice, summary, domains, periodNotes, segsOf };
  }, [c, comparison]);

  return (
    <div className="tb tb-compare" data-testid="tongbyeon-compare">
      <details className="how-to-read">
        <summary>이 화면 읽는 법</summary>
        <ol>
          <li>같은 영역을 자미두수와 사주가 각자의 방법으로 읽고, 경향을 5단계(▲▲ ▲ ● ▼ ▼▼)로 매겼습니다.</li>
          <li><b>일치</b>는 같은 방향, <b>보완</b>은 한쪽만 뚜렷한 경우, <b>엇갈림</b>은 서로 반대 방향입니다.</li>
          <li>엇갈림은 한쪽이 틀렸다는 뜻이 아니라 보는 곳이 다르다는 뜻입니다. 어느 쪽이 맞는지는 이 사이트가 판정하지 않습니다.</li>
          <li>일치한다고 해서 맞다는 증거는 아닙니다. 무작위로 만든 명반에서도 두 방법의 일치 비율은 우연에 가까웠습니다.</li>
          <li>자미두수의 10년 운은 ‘대한’, 사주의 10년 운은 ‘대운’이라고 부릅니다. 둘 다 10년마다 바뀌는 운의 구간입니다.</li>
        </ol>
      </details>

      <CalendarNotice chart={chart} saju={saju} comparison={comparison} lines={v.notice} onYearBasis={onYearBasis} />

      <section className="tb-sum" aria-label="비교 요약">
        <h3>한눈에 비교</h3>
        <ul className="tb-sum-lines">{v.summary.map((segs, i) => <li key={i}><TermText segments={segs} /></li>)}</ul>
        <div className="table-wrap">
          <table className="tb-matrix" data-testid="compare-matrix">
            <caption className="sr-only">영역별 경향 비교표</caption>
            <thead>
              <tr><th scope="col">영역</th><th scope="col">자미두수</th><th scope="col">사주</th><th scope="col">판정</th></tr>
            </thead>
            <tbody>
              {c.domains.map((d) => (
                <tr key={d.domain} data-domain={d.domain} data-verdict={d.verdict}>
                  <th scope="row">{DOMAIN_LABEL[d.domain]}</th>
                  <td><LevelBadge level={d.ziwei.level} short /></td>
                  <td><LevelBadge level={d.saju.level} short /></td>
                  <td><VerdictBadge verdict={d.verdict} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tb-domains" aria-label="영역별 비교">
        <h3>영역별 비교</h3>
        {c.domains.map((d, i) => (
          <article className="tb-cmp" key={d.domain} data-domain={d.domain} data-verdict={d.verdict}>
            <header>
              <h4>{DOMAIN_LABEL[d.domain]}</h4>
              <VerdictBadge verdict={d.verdict} />
            </header>
            <p className="tb-cmp-head">{d.headline}{d.nuance ? ` ${d.nuance}` : ''}</p>
            <div className="tb-duo">
              <div className="tb-side tb-side-ziwei">
                <div className="tb-side-top"><span className="tb-side-name">자미두수</span><LevelBadge level={d.ziwei.level} /></div>
                <Why label="근거" items={v.domains[i].whyZ} />
              </div>
              <div className="tb-side tb-side-saju">
                <div className="tb-side-top"><span className="tb-side-name">사주</span><LevelBadge level={d.saju.level} /></div>
                <Why label="근거" items={v.domains[i].whyS} />
              </div>
            </div>
            <dl className="tb-theme-cmp">
              <div><dt>두 체계가 함께 말한 것</dt><dd>{d.shared.length > 0 ? <Chips items={d.shared} label="공통 주제" /> : <span className="dim">겹치는 주제가 없습니다</span>}</dd></div>
              <div><dt>자미두수만 말한 것</dt><dd>{d.onlyZiwei.length > 0 ? <Chips items={d.onlyZiwei} label="자미두수만의 주제" /> : <span className="dim">없음</span>}</dd></div>
              <div><dt>사주만 말한 것</dt><dd>{d.onlySaju.length > 0 ? <Chips items={d.onlySaju} label="사주만의 주제" /> : <span className="dim">없음</span>}</dd></div>
            </dl>
            <p className="tb-lens"><TermText segments={v.domains[i].lens} /></p>
            {c.domains.findIndex((x) => x.verdict === d.verdict) === i && <p className="tb-reading"><b>읽는 법</b> {d.reading}</p>}
          </article>
        ))}
      </section>

      <section className="tb-periods" aria-label="시기 비교">
        <h3>10년 단위 시기 비교 <small>대한 ↔ 대운</small></h3>
        <p className="dim small">자미두수의 10년 운(대한)과 사주의 10년 운(대운)을, 연도 범위가 가장 많이 겹치는 것끼리 짝지었습니다(겹침이 3년 미만이면 비교하지 않습니다).</p>
        <p className="dim small">
          {VERDICT_LABEL.agree} {c.periodCounts.agree}구간 · {VERDICT_LABEL.complement} {c.periodCounts.complement}구간 · {VERDICT_LABEL.conflict} {c.periodCounts.conflict}구간
        </p>
        <ol className="tb-timeline" data-testid="compare-periods">
          {c.periods.map((p, i) => (
            <li key={i} className={`tb-pair ${tb.now.ziweiDecade === i ? 'now' : ''}`} data-verdict={p.verdict ?? 'none'} aria-current={tb.now.ziweiDecade === i ? 'true' : undefined}>
              <div className="tb-period-head">
                <b>{p.ziwei.startAge}~{p.ziwei.endAge}세</b>
                <span className="dim">{p.ziwei.startYear}~{p.ziwei.endYear}년</span>
                {tb.now.ziweiDecade === i && <span className="tb-now">지금</span>}
                {p.verdict && <VerdictBadge verdict={p.verdict} />}
              </div>
              <div className="tb-duo">
                <div className="tb-side tb-side-ziwei">
                  <div className="tb-side-top"><span className="tb-side-name">자미두수</span><LevelBadge level={p.ziwei.level} short /></div>
                  <small className="dim">{p.ziwei.label}</small>
                </div>
                <div className="tb-side tb-side-saju">
                  {p.saju ? (
                    <>
                      <div className="tb-side-top"><span className="tb-side-name">사주</span><LevelBadge level={p.saju.level} short /></div>
                      <small className="dim">{p.saju.label} · {p.saju.startYear}~{p.saju.endYear}년</small>
                    </>
                  ) : <span className="dim">짝이 되는 대운 없음</span>}
                </div>
              </div>
              <p className="dim small"><TermText segments={v.periodNotes[i]} /></p>
            </li>
          ))}
        </ol>
      </section>

      <details className="tb-fold tb-theory">
        <summary>두 체계의 이론 차이 보기 (달력·글자 기준 10항목)</summary>
        <TheoryCompare comparison={comparison} segsOf={v.segsOf} />
      </details>
      <Disclaimer lines={tb.disclaimer} />
    </div>
  );
}
