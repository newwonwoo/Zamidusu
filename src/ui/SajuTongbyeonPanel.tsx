// 사주 통변: 총평(일간·강약·격국·용신) → 영역별 결론 → 대운 흐름. 사주 값 표는 접어서 둔다.
import { useMemo } from 'react';
import { DOMAINS, whyOf } from '../core/tongbyeon';
import type { Tongbyeon } from '../core/tongbyeon';
import type { Comparison } from '../core/compare';
import type { SajuChart } from '../core/saju';
import { makeAnnotator } from './TermText';
import { PillarsTable } from './SajuParts';
import { Chips, Disclaimer, DomainCard, DomainStrip, EvidenceFold, Para, PeriodItem } from './tb-shared';
import type { CardText } from './tb-shared';
import { HowToReadTongbyeon } from './TongbyeonPanel';

export function SajuTongbyeonPanel({ tb, saju, comparison }: { tb: Tongbyeon; saju: SajuChart; comparison: Comparison }) {
  const s = tb.saju;
  const v = useMemo(() => {
    const ann = makeAnnotator();
    const headline = ann(s.overview.headline);
    const keywords = s.overview.keywords.map(ann);
    const paragraphs = s.overview.paragraphs.map((p) => ({ label: p.label, sents: p.sentences.map(ann) }));
    const advice = s.overview.advice.map(ann);
    const card = (d: (typeof DOMAINS)[number]): CardText => {
      const r = s.domains[d];
      return { verdict: ann(r.verdict), why: whyOf(r).map(ann), points: r.points.map((p) => ({ label: p.label, kind: p.kind, segs: ann(p.text) })), advice: ann(r.advice) };
    };
    const cards: Record<string, CardText> = {};
    for (const d of DOMAINS) if (d !== 'self') cards[d] = card(d);
    const periods = s.daeun.map((p) => ann(p.headline));
    cards.self = card('self');
    return { headline, keywords, paragraphs, advice, cards, periods };
  }, [s]);

  return (
    <div className="tb tb-saju" data-testid="tongbyeon-saju">
      <HowToReadTongbyeon who="사주" />
      <section className="tb-overview" aria-label="사주 총평">
        <h3>사주명리 통변 <small>총평</small></h3>
        <p className="tb-headline"><Para parts={[v.headline]} /></p>
        <Chips items={v.keywords} label="핵심어" />
        {v.paragraphs.map((p, i) => (
          <div className="tb-para" key={i}>
            <h4>{p.label}</h4>
            <Para parts={p.sents} />
          </div>
        ))}
        <div className="tb-advice-box">
          <h4>종합 조언</h4>
          <ul>{v.advice.map((a, i) => <li key={i}><Para parts={[a]} /></li>)}</ul>
        </div>
        <EvidenceFold items={s.overview.evidence} summary="총평의 근거 보기" />
      </section>

      <section className="tb-domains" aria-label="영역별 통변">
        <h3>영역별 통변</h3>
        <DomainStrip domains={s.domains} />
        {DOMAINS.map((d) => <DomainCard key={d} reading={s.domains[d]} text={v.cards[d]} foldPoints={d === 'self'} />)}
      </section>

      <section className="tb-periods" aria-label="대운 흐름">
        <h3>10년 단위 흐름 <small>대운</small></h3>
        <p className="dim small">대운은 {saju.daeun.forward ? '순행' : '역행'}하며 대운수는 {saju.daeun.startYears}입니다. 나이는 만 나이이고, 달력 연도는 대운이 시작되는 해 기준의 대략입니다.</p>
        {s.daeunNote && <p className="dim small" data-testid="daeun-flat-note">{s.daeunNote}</p>}
        <ol className="tb-timeline">
          {s.daeun.map((p, i) => (
            <PeriodItem key={i} p={p} current={tb.now.sajuDaeun === i} segs={v.periods[i]} highlightLabel="강조되는 영역" />
          ))}
        </ol>
      </section>

      <details className="tb-fold tb-saju-table">
        <summary>사주 여덟 글자 표와 오행 분포 보기</summary>
        <PillarsTable saju={saju} comparison={comparison} />
      </details>
      <Disclaimer lines={tb.disclaimer} />
    </div>
  );
}
