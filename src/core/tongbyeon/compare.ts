// 두 통변의 비교(설계 부록 D-7). 같은 사람·같은 영역에 대해 자미두수 통변과 사주 통변이 같은 말을 하는지 가린다.
// 판정은 경향 단계만으로 정한다(아래 verdictOf) — 문장은 판정 뒤에 붙는 설명이다.

import { josa } from '../explain/korean';
import { LENS } from './common-text';
import { DOMAINS, DOMAIN_LABEL, LEVEL_LABEL, themeLabel } from './types';
import type { Domain, DomainReading, Level, PeriodReading, Verdict } from './types';
import { tm } from './util';

/** 판정 규칙: 부호가 반대면 엇갈림, 한쪽만 0이면 보완, 그 외(같은 부호이거나 둘 다 0)는 일치 */
export const verdictOf = (z: Level, s: Level): Verdict => (z * s < 0 ? 'conflict' : (z === 0) !== (s === 0) ? 'complement' : 'agree');

export interface DomainComparison {
  domain: Domain;
  ziwei: DomainReading;
  saju: DomainReading;
  verdict: Verdict;
  /** 판정 한 줄 */
  headline: string;
  /** 강도 차이 등 덧붙이는 설명(없을 수 있음) */
  nuance: string | null;
  shared: string[];
  onlyZiwei: string[];
  onlySaju: string[];
  /** 각 체계가 그렇게 본 주된 근거(짧은 명사구) */
  whyZiwei: string[];
  whySaju: string[];
  /** 두 체계가 보는 곳이 어떻게 다른지 */
  lens: string;
  /** 읽는 법 */
  reading: string;
}

export interface PeriodPair {
  ziwei: PeriodReading;
  saju: PeriodReading | null;
  overlapYears: number;
  verdict: Verdict | null;
  note: string;
  /** 두 체계가 함께 두드러진 영역으로 꼽는 것 */
  shared: Domain[];
}

export interface TongbyeonComparison {
  domains: DomainComparison[];
  counts: Record<Verdict, number>;
  summary: string[];
  periods: PeriodPair[];
  periodCounts: Record<Verdict, number>;
}

const dirWord = (l: Level): string => (l > 0 ? '받쳐 주는 쪽' : l < 0 ? '신경 쓸 쪽' : '무난한 쪽');

/** 영역을 가리키는 말 + 조사 */
const dj = (d: Domain, type: '은/는' | '이/가' | '을/를'): string => josa(DOMAIN_LABEL[d], type);

const HEADLINE = (d: Domain, z: Level, s: Level, v: Verdict): string => {
  if (v === 'agree') {
    if (z > 0 && s > 0) return `두 체계 모두 ${dj(d, '을/를')} 받쳐 주는 쪽으로 봅니다.`;
    if (z < 0 && s < 0) return `두 체계 모두 ${DOMAIN_LABEL[d]}에서 신경 쓸 점이 있다고 봅니다.`;
    return `두 체계 모두 ${dj(d, '을/를')} 무난하게 봅니다.`;
  }
  if (v === 'complement') {
    return z !== 0
      ? `자미두수는 ${dj(d, '을/를')} ${dirWord(z)}으로 뚜렷하게 보고, 사주는 무난하게 봅니다.`
      : `사주는 ${dj(d, '을/를')} ${dirWord(s)}으로 뚜렷하게 보고, 자미두수는 무난하게 봅니다.`;
  }
  return `자미두수는 ${dj(d, '을/를')} ${dirWord(z)}으로 보지만, 사주는 ${dirWord(s)}으로 봅니다.`;
};

const NUANCE = (z: Level, s: Level, v: Verdict): string | null => {
  if (v !== 'agree' || z === s) return null;
  return Math.abs(z) > Math.abs(s) ? '방향은 같고, 자미두수 쪽이 더 강하게 봅니다.' : '방향은 같고, 사주 쪽이 더 강하게 봅니다.';
};

const READING: Record<Verdict, { shared: string; apart: string }> = {
  agree: {
    shared: '같은 방향이며, 두 방법이 같은 주제를 짚었습니다. 맞는다는 증거는 아니고, 두 방법이 같은 쪽을 가리킨다는 뜻입니다.',
    apart: '이유는 서로 다르지만 결론은 같습니다. 맞는다는 증거는 아니고, 두 방법이 같은 쪽을 가리킨다는 뜻입니다.',
  },
  complement: {
    shared: '한쪽만 뚜렷한 신호를 줍니다. 뚜렷한 쪽의 조언을 참고하되 확정으로 받아들이지는 마세요.',
    apart: '한쪽만 뚜렷한 신호를 줍니다. 뚜렷한 쪽의 조언을 참고하되 확정으로 받아들이지는 마세요.',
  },
  conflict: {
    shared: '두 체계가 반대로 봅니다. 한쪽이 틀렸다는 뜻이 아니라 보는 곳이 달라서일 수 있습니다. 어느 쪽이 맞는지 이 사이트는 판정하지 않으니, 두 가지를 모두 염두에 두고 준비하세요.',
    apart: '두 체계가 반대로 봅니다. 한쪽이 틀렸다는 뜻이 아니라 보는 곳이 달라서일 수 있습니다. 어느 쪽이 맞는지 이 사이트는 판정하지 않으니, 두 가지를 모두 염두에 두고 준비하세요.',
  },
};

/**
 * 레벨 부호에 맞는 근거(짧은 명사구) 최대 2개.
 * 경향 단계는 무작위 출생 전체에서의 위치라, 단계가 낮아도 나쁜 요소가 하나도 없을 수 있다(좋은 단계의 반대도 같다).
 * 그럴 때는 근거가 비어 읽는 사람이 단계를 이해하지 못하므로, 그 사실을 짧게 적는다.
 */
export const whyOf = (r: DomainReading): string[] => {
  const pos = r.reasons.filter((x) => x.delta > 0).slice(0, 2).map((x) => x.brief);
  const neg = r.reasons.filter((x) => x.delta < 0).slice(0, 2).map((x) => x.brief);
  if (r.level > 0) return pos.length > 0 ? pos : ['뚜렷한 강점은 없지만 약점이 적음'];
  if (r.level < 0) return neg.length > 0 ? neg : ['뚜렷한 약점은 없지만 받쳐 주는 요소가 적음'];
  return [...pos.slice(0, 1), ...neg.slice(0, 1)];
};

export const compareDomain = (z: DomainReading, s: DomainReading): DomainComparison => {
  const d = z.domain;
  const verdict = verdictOf(z.level, s.level);
  const shared = z.themes.filter((t) => s.themes.includes(t));
  const lensText = `자미두수는 ${josa(LENS.ziwei[d], '을/를')} 봅니다. 사주는 ${josa(LENS.saju[d], '을/를')} 봅니다.`;
  return {
    domain: d,
    ziwei: z,
    saju: s,
    verdict,
    headline: HEADLINE(d, z.level, s.level, verdict),
    nuance: NUANCE(z.level, s.level, verdict),
    shared: shared.map((t) => themeLabel(d, t)),
    onlyZiwei: z.themes.filter((t) => !s.themes.includes(t)).map((t) => themeLabel(d, t)),
    onlySaju: s.themes.filter((t) => !z.themes.includes(t)).map((t) => themeLabel(d, t)),
    whyZiwei: whyOf(z),
    whySaju: whyOf(s),
    lens: lensText,
    reading: shared.length > 0 ? READING[verdict].shared : READING[verdict].apart,
  };
};

// ── 시기 짝짓기 ──────────────────────────────────────────────────────────────
const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0) + 1);

/** 자미두수 대한마다 연도가 가장 많이 겹치는 대운을 짝짓는다(동률은 앞 대운). 겹침이 3년 미만이면 짝 없음 */
export const pairPeriods = (decades: PeriodReading[], daeun: PeriodReading[]): PeriodPair[] =>
  decades.map((z) => {
    let best: PeriodReading | null = null;
    let bestN = 0;
    for (const s of daeun) {
      const n = overlap(z.startYear, z.endYear, s.startYear, s.endYear);
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    if (!best || bestN < 3) return { ziwei: z, saju: null, overlapYears: bestN, verdict: null, note: '겹치는 {{대운}}이 3년 미만이라 비교하지 않았습니다.', shared: [] };
    const verdict = verdictOf(z.level, best.level);
    const shared = z.highlights.filter((d) => best!.highlights.includes(d));
    const base =
      verdict === 'agree' ? (z.level > 0 ? '두 체계 모두 이 시기를 편안한 쪽으로 봅니다.' : z.level < 0 ? '두 체계 모두 이 시기를 신경 쓸 쪽으로 봅니다.' : '두 체계 모두 이 시기를 무난하게 봅니다.')
        : verdict === 'complement' ? `한쪽만 뚜렷합니다. 자미두수는 ${LEVEL_LABEL[z.level]}, 사주는 ${LEVEL_LABEL[best.level]}입니다.`
          : `자미두수는 ${LEVEL_LABEL[z.level]}, 사주는 ${josa(LEVEL_LABEL[best.level], '으로/로')} 엇갈립니다.`;
    const extra = shared.length > 0 ? ` 두 체계 모두 ${shared.map((d) => DOMAIN_LABEL[d]).join('·')}을 두드러진 영역으로 꼽습니다.` : '';
    return { ziwei: z, saju: best, overlapYears: bestN, verdict, note: `${base}${extra}`, shared };
  });

const countVerdicts = (list: (Verdict | null)[]): Record<Verdict, number> => {
  const c: Record<Verdict, number> = { agree: 0, complement: 0, conflict: 0 };
  for (const v of list) if (v) c[v]++;
  return c;
};

export const compareAll = (zi: Record<Domain, DomainReading>, sa: Record<Domain, DomainReading>, decades: PeriodReading[], daeun: PeriodReading[]): TongbyeonComparison => {
  const domains = DOMAINS.map((d) => compareDomain(zi[d], sa[d]));
  const counts = countVerdicts(domains.map((x) => x.verdict));
  const periods = pairPeriods(decades, daeun);
  const periodCounts = countVerdicts(periods.map((p) => p.verdict));

  const summary: string[] = [`여섯 영역 중 ${counts.agree}개는 일치, ${counts.complement}개는 보완, ${counts.conflict}개는 엇갈립니다.`];
  // 같은 쪽으로 가장 강하게 보는 영역: 일치이면서 둘 다 0이 아닌 쪽 중 강도 합이 가장 큰 것.
  // 단계가 정확히 같은 영역보다 합이 큰 영역이 뽑힐 수 있으므로(▲/▲ 보다 ▲/▲▲), 뽑힌 이유가 보이게 두 단계를 함께 적는다.
  const agrees = domains.filter((x) => x.verdict === 'agree' && x.ziwei.level !== 0).sort((a, b) => Math.abs(b.ziwei.level) + Math.abs(b.saju.level) - (Math.abs(a.ziwei.level) + Math.abs(a.saju.level)));
  if (agrees.length > 0) {
    const a = agrees[0];
    // 엇갈림 문장(“자미두수는 …, 사주는 …로 봅니다”)과 틀이 같으면 뜻이 겹쳐 읽히므로 다른 틀로 쓴다
    const how = a.ziwei.level === a.saju.level
      ? `둘 다 ${josa(LEVEL_LABEL[a.ziwei.level], '으로/로')} 봅니다.`
      : `둘 다 ${dirWord(a.ziwei.level)}으로 보며, ${Math.abs(a.ziwei.level) > Math.abs(a.saju.level) ? '자미두수' : '사주'}가 더 강하게 봅니다.`;
    summary.push(`두 체계가 같은 쪽으로 가장 강하게 보는 영역은 ${DOMAIN_LABEL[a.domain]}입니다. ${how}`);
  }
  const conflicts = domains.filter((x) => x.verdict === 'conflict').sort((a, b) => Math.abs(b.ziwei.level - b.saju.level) - Math.abs(a.ziwei.level - a.saju.level));
  if (conflicts.length > 0) {
    const c = conflicts[0];
    summary.push(`가장 크게 엇갈리는 영역은 ${DOMAIN_LABEL[c.domain]}입니다. 자미두수는 ${LEVEL_LABEL[c.ziwei.level]}, 사주는 ${josa(LEVEL_LABEL[c.saju.level], '으로/로')} 봅니다.`);
  }
  summary.push('엇갈림은 한쪽이 틀렸다는 뜻이 아니라 보는 곳이 다르다는 뜻입니다.');
  if (periods.length > 0) {
    summary.push(`10년마다 바뀌는 운을 자미두수는 ${tm('대한')}, 사주는 ${tm('대운')}이라 부릅니다.`);
    const n = periodCounts.agree + periodCounts.complement + periodCounts.conflict;
    summary.push(`10년 단위 흐름 ${n}구간 중 ${periodCounts.agree}구간은 일치, ${periodCounts.complement}구간은 보완, ${periodCounts.conflict}구간은 엇갈립니다.`);
  }
  return { domains, counts, summary, periods, periodCounts };
};
