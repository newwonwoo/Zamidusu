// 종합 통변(자미두수): 총평 → 영역별 결론 → 10년 단위 흐름. 칸 하나하나가 아니라 명반 전체를 하나로 엮은 해석이다.
import { useMemo } from 'react';
import { DOMAINS, whyOf } from '../core/tongbyeon';
import type { Tongbyeon } from '../core/tongbyeon';
import { makeAnnotator } from './TermText';
import { Chips, Disclaimer, DomainCard, DomainStrip, EvidenceFold, Para, PeriodItem } from './tb-shared';
import type { CardText } from './tb-shared';

export function HowToReadTongbyeon({ who }: { who: '자미두수' | '사주' }) {
  return (
    <details className="how-to-read">
      <summary>이 화면 읽는 법</summary>
      <ol>
        <li>{who === '자미두수'
          ? '명반은 열두 칸(궁)이고 칸마다 맡은 일이 다릅니다(명궁=성격, 재백궁=재물, 관록궁=직업, 부처궁=연애·결혼, 질액궁=건강, 노복궁=친구·동료). 통변은 칸을 하나씩 읽지 않고, 함께 읽는 칸들을 엮어 영역마다 결론을 낸 풀이입니다.'
          : '통변은 태어난 해·달·날·시의 여덟 글자를 하나로 엮어 영역마다 결론을 낸 풀이입니다.'}</li>
        <li>▲▲ ▲ ● ▼ ▼▼ 는 이 영역의 타고난 구조가 받쳐 주는 정도를 {who === '자미두수' ? '무작위로 만든 많은 명반과' : '무작위로 만든 많은 사주와'} 견준 순위로 나타낸 것입니다(▲▲ 상위 약 10%, ▼▼ 하위 약 10%). 앞날을 맞히는 예언이 아닙니다.</li>
        <li>‘신경 쓸 편’(▼)은 나쁘다는 뜻이 아니라 평균보다 아래라는 뜻이라, 좋은 점이 함께 적혀 있을 수 있습니다. 단계를 정한 가장 큰 이유는 카드의 ‘이렇게 본 이유’에 있습니다.</li>
        <li>‘근거 보기’에서 결론을 이룬 규칙과 값을 확인할 수 있습니다.</li>
        <li>규칙으로 옮긴 간이 통변이며 전문가 감수를 받지 않았습니다. 참고용으로만 읽으세요.</li>
      </ol>
    </details>
  );
}

export function TongbyeonPanel({ tb }: { tb: Tongbyeon }) {
  const z = tb.ziwei;
  const v = useMemo(() => {
    const ann = makeAnnotator();
    const headline = ann(z.overview.headline);
    const keywords = z.overview.keywords.map(ann);
    const paragraphs = z.overview.paragraphs.map((p) => ({ label: p.label, sents: p.sentences.map(ann) }));
    const advice = z.overview.advice.map(ann);
    const card = (d: (typeof DOMAINS)[number], withPoints: boolean): CardText => {
      const r = z.domains[d];
      return {
        verdict: ann(r.verdict),
        why: whyOf(r).map(ann),
        points: withPoints ? r.points.map((p) => ({ label: p.label, kind: p.kind, segs: ann(p.text) })) : [],
        advice: ann(r.advice),
      };
    };
    const cards: Record<string, CardText> = {};
    for (const d of DOMAINS) if (d !== 'self') cards[d] = card(d, true);
    const periods = z.decades.map((p) => ann(p.headline));
    // 접어 둔 풀이(성격·기질 카드)는 총평과 겹치므로 마지막에 풀이를 붙인다
    cards.self = card('self', true);
    return { headline, keywords, paragraphs, advice, cards, periods };
  }, [z]);

  return (
    <div className="tb tb-ziwei" data-testid="tongbyeon-ziwei">
      <HowToReadTongbyeon who="자미두수" />
      <section className="tb-overview" aria-label="자미두수 총평">
        <h3>자미두수 종합 통변 <small>총평</small></h3>
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
        <EvidenceFold items={z.overview.evidence} summary="총평의 근거 보기" />
      </section>

      <section className="tb-domains" aria-label="영역별 통변">
        <h3>영역별 통변</h3>
        <DomainStrip domains={z.domains} />
        {DOMAINS.map((d) => <DomainCard key={d} reading={z.domains[d]} text={v.cards[d]} foldPoints={d === 'self'} />)}
      </section>

      <section className="tb-periods" aria-label="10년 단위 흐름">
        <h3>10년 단위 흐름 <small>대한</small></h3>
        <p className="dim small">대한은 나이대별로 바뀌는 10년 운입니다. 같은 명반이라도 10년마다 영역별로 받쳐 주는 정도가 달라집니다. 나이는 세는나이(태어난 해를 1세로 셉니다)이고, 100세까지만 다룹니다.</p>
        {z.decadeNote && <p className="dim small" data-testid="decade-flat-note">{z.decadeNote}</p>}
        <ol className="tb-timeline">
          {z.decades.map((p, i) => (
            <PeriodItem key={i} p={p} current={tb.now.ziweiDecade === i} segs={v.periods[i]} highlightLabel="받쳐 주는 영역" />
          ))}
        </ol>
        {z.decades.length === 0 && <p className="dim">이 명반은 대한을 계산할 수 없습니다.</p>}
      </section>
      <Disclaimer lines={tb.disclaimer} />
    </div>
  );
}
