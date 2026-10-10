// 자미두수 종합 통변: 점수(ziwei-score)와 사실을 영역별 결론·본문·근거로 엮고, 명반 전체 총평과 대한 흐름을 만든다.
// 설계서 부록 D-5. 별 하나하나의 해설(궁 해설 탭)과 달리, 칸들을 삼방사정으로 묶어 한 영역의 결론을 낸다.

import type { BrightnessMode } from '../brightness';
import { buildView, decadalList, surround, viewForDecade } from '../chart';
import type { Chart, StarView, View } from '../chart';
import { detectCombos } from '../explain/combos';
import { josa } from '../explain/korean';
import { PALACES } from '../explain/palaces';
import { mutagenEffects, mutagenSubject, powerParts } from '../explain/phrases';
import { MAIN_PALACE_LINES, STAR_PROFILES } from '../explain/stars';
import { MUTAGEN_LONG_KO, PALACE_KO } from '../names';
import type { Mutagen, PalaceKey } from '../names';
import { STANDING_MIN_SPREAD, adviceOf, bestDomains, domainList, flatNoteOf, markStanding, spreadAdvice, verdictWithThemes, worstDomains } from './common-text';
import { ZIWEI_CUTS, ZIWEI_DECADE_CUTS, ZIWEI_PERIOD_CUTS } from './calibration';
import { DOMAINS, DOMAIN_LABEL, DOMAIN_TOPIC, LEVEL_LABEL, THEMES, levelOf } from './types';
import type { Domain, DomainReading, Evidence, Level, Overview, PeriodReading, Point, Reason } from './types';
import { ganzhiLabel, markTerms, signed, tj, tm } from './util';
import { HELPERS, KILLERS, chartPatterns, makeScorer } from './ziwei-score';
import type { ChartPattern, DomainScore, PalaceScorer } from './ziwei-score';
import { BODY_LINE, HELP_RESULT, MINOR_THEMES, STAR_THEMES, STRONG_PHRASE, TENSION_RESULT } from './ziwei-text';

/** 화면에서 처음 나올 때 풀이를 붙일 말(명반 해설에 자주 나오는 낱말) */
/** 핵심 네 칸 가운데 영역 하나에 바로 대응하는 칸(천이궁은 직업·대인에 나뉘어 들어가 하나로 정할 수 없다) */
const FOUR_DOMAIN: Partial<Record<PalaceKey, Domain>> = { life: 'self', wealth: 'wealth', career: 'career' };

const ZIWEI_TERMS = ['명궁', '신궁', '명반', '형제궁', '부처궁', '자녀궁', '재백궁', '질액궁', '천이궁', '노복궁', '관록궁', '전택궁', '복덕궁', '부모궁'] as const;
const zm = (text: string): string => markTerms(text, ZIWEI_TERMS);

export interface ZiweiOptions {
  mode: BrightnessMode;
}

/** 생년 사화가 주제에 더하는 것(영역별) */
const MUT_THEMES: Partial<Record<Domain, Partial<Record<Mutagen, string[]>>>> = {
  self: { quan: ['lead'], ke: ['think'], lu: ['social'], ji: ['feel'] },
  wealth: { lu: ['chance'], ji: ['leak', 'swing'], quan: ['earned'] },
  career: { quan: ['leader'], ke: ['expert'], ji: ['change'], lu: ['venture'] },
  love: { lu: ['warm', 'passion'], ji: ['conflict'], ke: ['warm'] },
  health: { ji: ['watch', 'stress'] },
  people: { lu: ['wide'], ke: ['helpers'], ji: ['rivals'] },
};

const BORROW_NOTE = '빌려 온 별은 힘이 다소 약해서 영향이 부드럽게 나타납니다.';

const mainsOf = (chart: Chart, branch: number): StarView[] => chart.palaces[branch].stars.filter((s) => s.group === 'main');
const surroundBranches = (branch: number): number[] => {
  const s = surround(branch);
  return [s.self, s.opposite, ...s.trine];
};
const uniq = (xs: string[]): string[] => Array.from(new Set(xs));
const names = (xs: StarView[], max = 3): string => {
  const list = uniq(xs.map((s) => s.ko));
  return list.length > max ? `${list.slice(0, max).join('·')} 등` : list.join('·');
};

interface Built {
  points: Point[];
  themes: Record<string, number>;
}

const buildPoints = (chart: Chart, v: View, domain: Domain, ds: DomainScore, mode: BrightnessMode, seen?: Set<string>): Built => {
  const points: Point[] = [];
  const themes: Record<string, number> = {};
  const addTheme = (id: string, w: number): void => {
    themes[id] = (themes[id] ?? 0) + w;
  };
  const primary = ds.parts[0];
  const role = primary.role;
  const palaceKo = PALACE_KO[role];
  const own = mainsOf(chart, primary.branch);
  const borrowed = own.length === 0 ? mainsOf(chart, (primary.branch + 6) % 12) : [];

  // 1) 중심 칸의 별
  if (own.length > 0) {
    const first = own[0];
    const prof = STAR_PROFILES[first.key];
    const head = `${palaceKo}에는 ${josa(names(own, 4), '이/가')} 앉아 있습니다.`;
    const line = MAIN_PALACE_LINES[first.key][role];
    const more = own.length > 1 ? ` 여기에 ${own[1].ko}의 성격(${STAR_PROFILES[own[1].key].tag})이 더해집니다.` : '';
    points.push({ kind: 'core', label: `${palaceKo}의 중심 별`, text: `${head} ${line}${more}` });
    own.forEach((s, i) => (STAR_THEMES[domain][s.key] ?? []).forEach((t, j) => addTheme(t, (i === 0 ? 1 : 0.6) * (j === 0 ? 1 : 0.7))));
    if (first.brightness) {
      const pw = powerParts(first.brightness, mode, prof);
      const second = own[1];
      const pw2 = second?.brightness ? powerParts(second.brightness, mode, STAR_PROFILES[second.key]) : null;
      // 중심 별이 둘이면 점수가 평균 힘이므로 둘째 별의 힘도 함께 적는다(같으면 한 문장으로)
      const lead = pw2 && pw2.label === pw.label ? `${first.ko}·${josa(second.ko, '은/는')} 모두` : josa(first.ko, '은/는');
      let text = `${lead} ${pw.phrase}('${pw.label}')에 있습니다. ${pw.effect}`;
      if (pw2 && pw2.label !== pw.label) text += ` ${josa(second.ko, '은/는')} ${pw2.phrase}('${pw2.label}')에 있습니다.`;
      points.push({ kind: 'power', label: '별의 힘', text });
    }
  } else if (borrowed.length > 0) {
    const oppRole = v.names[(primary.branch + 6) % 12];
    const list = names(borrowed, 3);
    points.push({
      kind: 'core', label: `${palaceKo}의 중심 별`,
      text: `${palaceKo}에는 중심 별이 없어 맞은편 ${PALACE_KO[oppRole]}의 ${josa(list, '을/를')} 빌려 읽습니다. ${MAIN_PALACE_LINES[borrowed[0].key][role]} ${BORROW_NOTE}`,
    });
    borrowed.forEach((s, i) => (STAR_THEMES[domain][s.key] ?? []).forEach((t, j) => addTheme(t, 0.7 * (i === 0 ? 1 : 0.6) * (j === 0 ? 1 : 0.7))));
  } else {
    points.push({ kind: 'core', label: `${palaceKo}의 중심 별`, text: `${palaceKo}와 맞은편 칸에는 중심 별이 없어 함께 읽는 칸의 분위기를 더 참고합니다.` });
  }

  // 2) 도움의 별 / 긴장의 별 (삼방사정)
  const around = surroundBranches(primary.branch).flatMap((b) => chart.palaces[b].stars);
  const helpers = around.filter((s) => HELPERS.includes(s.key) || s.key === '祿存');
  const killers = around.filter((s) => s.key in KILLERS);
  if (helpers.length > 0) {
    points.push({ kind: 'support', label: '도와주는 별', text: `{{삼방사정}}에 도움의 별이 ${helpers.length}개(${names(helpers)}) 있습니다. ${HELP_RESULT[domain]}` });
  }
  if (killers.length > 0) {
    points.push({ kind: 'tension', label: '긴장을 주는 별', text: `{{삼방사정}}에 긴장의 별이 ${killers.length}개(${names(killers)}) 있습니다. ${TENSION_RESULT[domain]}` });
  }
  const minor = MINOR_THEMES[domain] ?? {};
  chart.palaces[primary.branch].stars.forEach((s) => (minor[s.key] ?? []).forEach((t) => addTheme(t, 0.6)));
  around.forEach((s) => (minor[s.key] ?? []).forEach((t) => addTheme(t, 0.25)));

  // 3) 생년 사화: 중심 칸의 것은 하나씩, 함께 읽는 칸의 것은 한 문단으로 묶는다
  const sBr = surround(primary.branch);
  const spread: { b: number; st: StarView }[] = [];
  let mutCount = 0;
  for (const b of [sBr.self, sBr.opposite, ...sBr.trine]) {
    for (const st of chart.palaces[b].stars) {
      if (!st.mutagen) continue;
      (MUT_THEMES[domain]?.[st.mutagen] ?? []).forEach((t) => addTheme(t, b === primary.branch ? 0.7 : 0.4));
      if (b === primary.branch) {
        if (mutCount++ >= 3) continue;
        const tag = { mutagen: st.mutagen, scope: 'natal' as const };
        const eff = mutagenEffects(STAR_PROFILES[st.key], tag, PALACES[v.names[b]].topic).slice(1);
        points.push({ kind: 'mutagen', label: '생년 사화', text: `${mutagenSubject(tag)} ${st.ko}에 붙어 있습니다. ${eff.join(' ')}` });
      } else if (spread.length < 3) {
        spread.push({ b, st });
      }
    }
  }
  if (spread.length > 0) {
    // 같은 칸에 여러 개면 한 덩어리로: “형제궁의 거문에는 화록이, 문창에는 화기가”
    const groups: { b: number; list: StarView[] }[] = [];
    for (const x of spread) {
      const g = groups.find((y) => y.b === x.b);
      if (g) g.list.push(x.st);
      else groups.push({ b: x.b, list: [x.st] });
    }
    const item = (g: { b: number; list: StarView[] }): string =>
      `${PALACE_KO[v.names[g.b]]}의 ${g.list.map((st) => `${st.ko}에는 ${tj(MUTAGEN_LONG_KO[st.mutagen as Mutagen], '이/가')}`).join(', ')}`;
    const sentences: string[] = [];
    for (let k = 0; k < groups.length; k += 2) sentences.push(`${groups.slice(k, k + 2).map(item).join(', ')} 붙어 있습니다.`);
    const kinds = new Set(spread.map((x) => x.st.mutagen));
    const bad = kinds.has('ji');
    const good = Array.from(kinds).some((k) => k !== 'ji');
    sentences.push(bad && good ? '이 영역에 좋은 흐름과 걱정이 함께 번집니다.' : bad ? '이 영역에도 걱정이 번지기 쉽습니다.' : '이 영역에도 좋은 흐름이 이어집니다.');
    points.push({ kind: 'mutagen', label: '함께 읽는 칸의 사화', text: sentences.join(' ') });
  }

  // 4) 조합과 격국
  const combos = detectCombos(chart, primary.branch).filter((h) => h.kind !== 'pattern' || domain === 'self');
  const lifePatterns = domain === 'career' ? detectCombos(chart, chart.meta.soulBranch).filter((h) => h.kind === 'pattern') : [];
  for (const h of [...combos, ...lifePatterns].slice(0, 3)) points.push({ kind: 'pattern', label: `${h.name}(${h.hanja})`, text: h.text });
  if (domain === 'career') {
    const has = (id: string): boolean => lifePatterns.some((h) => h.id === id);
    if (has('sapalang')) addTheme('venture', 0.8);
    if (has('gwiweol')) addTheme('organization', 0.8);
    if (has('yangryang')) addTheme('expert', 0.8);
  }
  if (domain === 'self') for (const p of chartPatterns(chart)) points.push({ kind: 'pattern', label: `${p.name}(${p.hanja})`, text: p.text });

  // 5) 함께 읽는 두 번째 칸
  const second = ds.parts[1];
  if (second) {
    const sRole = second.role;
    const sMains = mainsOf(chart, second.branch);
    if (domain === 'self' && v.scope === 'natal' && chart.meta.bodyBranch !== chart.meta.soulBranch && BODY_LINE[sRole]) {
      points.push({ kind: 'link', label: '신궁', text: `신궁은 ${PALACE_KO[sRole]}에 있습니다. ${BODY_LINE[sRole]}` });
    } else if (sMains.length > 0) {
      const key = `${sRole}|${sMains.map((x) => x.key).join(',')}`;
      if (!seen?.has(key)) {
        seen?.add(key);
        points.push({ kind: 'link', label: `함께 읽는 ${PALACE_KO[sRole]}`, text: `${PALACE_KO[sRole]}에는 ${josa(names(sMains, 3), '이/가')} 있습니다. ${MAIN_PALACE_LINES[sMains[0].key][sRole]}` });
      }
    }
  }
  return { points, themes };
};

const topThemes = (domain: Domain, w: Record<string, number>): string[] => {
  const order = Object.keys(THEMES[domain]);
  return Object.entries(w)
    .filter(([id, x]) => x > 0 && order.includes(id))
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .slice(0, 3)
    .map(([id]) => id);
};

export const readZiweiDomain = (chart: Chart, sc: PalaceScorer, v: View, domain: Domain, mode: BrightnessMode, seen?: Set<string>): DomainReading => {
  const ds = sc.domain(domain);
  const level = levelOf(ds.score, ZIWEI_CUTS[domain]);
  const { points, themes } = buildPoints(chart, v, domain, ds, mode, seen);
  const primary = ds.parts[0];
  const nameOf = (b: number): string => PALACE_KO[v.names[b]];

  const evidence: Evidence[] = [];
  evidence.push({ rule: 'ZD-01', text: `영역 구성: ${ds.parts.map((p) => `${nameOf(p.branch)} 가중 ${p.w.toFixed(2)}`).join(' · ')}` });
  for (const p of ds.parts) {
    const s = p.S.parts;
    evidence.push({
      rule: 'ZQ-01',
      text: `${nameOf(p.branch)} 합성 ${signed(p.S.Q)} = (본궁 ${signed(s.self)} + 0.6×대궁 ${signed(s.opposite)} + 0.4×삼합 ${signed(s.trine[0])} + 0.4×삼합 ${signed(s.trine[1])}) ÷ 2.4`,
    });
  }
  const comps = sc.comps(primary.branch, domain);
  for (const c of comps) evidence.push({ rule: c.rule, text: `${nameOf(primary.branch)}: ${c.detail}` });
  const patterns: ChartPattern[] = domain === 'self' && v.scope === 'natal' ? chartPatterns(chart) : [];
  for (const p of patterns) evidence.push({ rule: p.id, text: `명반 격국 ${p.name}(${p.hanja}) → ${signed(p.value)}` });
  evidence.push({ rule: 'ZD-SUM', text: `영역 점수 ${signed(ds.score)} → 단계 ${LEVEL_LABEL[level]}` });

  // 별 개수는 어느 칸의 것인지 밝힌다(카드 본문의 “삼방사정에 도움의 별 N개”와 다른 범위의 숫자이기 때문)
  const scoped = (c: { rule: string; brief: string }): string => (c.rule === 'ZP-04' || c.rule === 'ZP-06' ? `${nameOf(primary.branch)}에 ${c.brief}` : c.brief);
  const reasons: Reason[] = comps.map((c) => ({ rule: c.rule, brief: scoped(c), delta: c.value }));
  const qSelf = sc.q(primary.branch, domain);
  const spread = primary.S.Q - qSelf;
  if (Math.abs(spread) >= 0.1) reasons.push({ rule: 'ZQ-01', brief: spread > 0 ? '함께 읽는 칸이 받쳐 줌' : '함께 읽는 칸이 부담을 줌', delta: spread });
  for (const p of patterns) reasons.push({ rule: p.id, brief: `${p.name} 구도`, delta: p.value });
  reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const top = topThemes(domain, themes);
  return {
    system: 'ziwei',
    domain,
    level,
    score: ds.score,
    title: `${DOMAIN_LABEL[domain]} — ${LEVEL_LABEL[level]}`,
    verdict: verdictWithThemes(domain, level, top),
    points: points.slice(0, 8),
    themes: top,
    advice: adviceOf(domain, level),
    reasons,
    evidence,
  };
};

// ── 대한 ─────────────────────────────────────────────────────────────────────
const PERIOD_LINE: Record<Level, string> = {
  2: '여러 영역에서 힘이 받쳐 주는 가장 순한 10년입니다.',
  1: '대체로 힘이 받쳐 주어 편안히 나아가기 좋은 10년입니다.',
  0: '특별히 돕지도 방해하지도 않는 무난한 10년입니다.',
  [-1]: '신경 쓸 일이 여러 영역에서 생기기 쉬운 10년입니다.',
  [-2]: '여러 영역에서 부담이 겹쳐 특히 조심해야 하는 10년입니다.',
} as Record<Level, string>;

/** 그 10년에 받쳐 주는 영역과 신경 쓸 영역을 한 문장으로(없으면 null) */
const decadeDomainLine = (best: Domain[], worst: Domain[]): string | null => {
  if (best.length === 0 && worst.length === 0) return null;
  if (best.length > 0 && worst.length > 0) return `이 10년에는 ${josa(domainList(best), '은/는')} 받쳐 주고, ${josa(domainList(worst), '은/는')} 신경 쓸 시기입니다.`;
  return best.length > 0 ? `이 10년에는 ${josa(domainList(best), '은/는')} 받쳐 주는 시기입니다.` : `이 10년에는 ${josa(domainList(worst), '은/는')} 신경 쓸 시기입니다.`;
};

/** 통변에서 다루는 10년 구간의 마지막 시작 나이 */
export const PERIOD_MAX_AGE = 100;

const decadeCache = new WeakMap<Chart, PeriodReading[]>();

/** 대한 12구간. 같은 명반이면 한 번만 계산한다(대한마다 운 계산이 필요해 비용이 크다) */
export const readDecades = (chart: Chart): PeriodReading[] => {
  const cached = decadeCache.get(chart);
  if (cached) return cached;
  const list = computeDecades(chart);
  decadeCache.set(chart, list);
  return list;
};

const computeDecades = (chart: Chart): PeriodReading[] => {
  const out: PeriodReading[] = [];
  // 100세가 넘는 구간(대한 12구간 중 마지막 둘)은 만들지 않는다
  for (const item of decadalList(chart).filter((x) => x.startAge <= PERIOD_MAX_AGE)) {
    let view: View;
    try {
      view = viewForDecade(chart, item.startAge);
    } catch {
      return [];
    }
    const sc = makeScorer(chart, view);
    const byDomain = {} as Record<Domain, Level>;
    const scores = {} as Record<Domain, number>;
    for (const d of DOMAINS) {
      const s = sc.domain(d).score;
      scores[d] = s;
      byDomain[d] = levelOf(s, ZIWEI_DECADE_CUTS[d]);
    }
    const avg = DOMAINS.reduce((s, d) => s + byDomain[d], 0) / DOMAINS.length;
    const level = levelOf(avg, ZIWEI_PERIOD_CUTS);
    // 같은 명반의 구간끼리 견주는 값: 영역 점수가 “무난” 구간의 가운데에서 얼마나 떨어졌는지를 경계값 폭(10~90%)으로 나눈 평균
    const fine = DOMAINS.reduce((s, d) => {
      const c = ZIWEI_DECADE_CUTS[d];
      return s + (scores[d] - (c[1] + c[2]) / 2) / (c[3] - c[0]);
    }, 0) / DOMAINS.length;
    const order = [...DOMAINS].sort((a, b) => byDomain[b] - byDomain[a] || scores[b] - scores[a]);
    const best = order.filter((d) => byDomain[d] >= 1).slice(0, 2);
    const worst = [...order].reverse().filter((d) => byDomain[d] <= -1).slice(0, 2);
    // 받쳐 주는 영역·신경 쓸 영역은 목록에서 칩으로 보이므로 글에는 넣지 않는다(총평의 “지금의 흐름”에서만 한 문장으로 쓴다)
    const lines: string[] = [PERIOD_LINE[level]];
    const roleOf = (key: string): PalaceKey | null => {
      const pos = chart.palaces.find((p) => p.stars.some((st) => st.key === key));
      return pos ? view.names[pos.branch] : null;
    };
    const luRole = roleOf(view.mutagens.find((m) => m.mutagen === 'lu')?.star ?? '');
    const jiRole = roleOf(view.mutagens.find((m) => m.mutagen === 'ji')?.star ?? '');
    if (luRole && jiRole && luRole === jiRole) {
      lines.push(`이 10년의 {{${MUTAGEN_LONG_KO.lu}}}과 {{${MUTAGEN_LONG_KO.ji}}}가 모두 {{대한}} ${PALACE_KO[luRole]}에 들어옵니다. ${PALACES[luRole].focus}에서 기회와 신경 쓸 일이 함께 생기기 쉽습니다.`);
    } else {
      if (luRole) lines.push(`이 10년의 {{${MUTAGEN_LONG_KO.lu}}}은 {{대한}} ${PALACE_KO[luRole]}에 들어와 ${PALACES[luRole].focus}에서 기회가 늘기 쉽습니다.`);
      if (jiRole) lines.push(`이 10년의 {{${MUTAGEN_LONG_KO.ji}}}는 {{대한}} ${PALACE_KO[jiRole]}에 들어와 ${PALACES[jiRole].focus}에서 신경 쓸 일이 생기기 쉽습니다.`);
    }
    const lifeNatal = chart.palaces[view.lifeBranch];
    const startYear = chart.meta.baseYear + item.startAge - 1;
    out.push({
      system: 'ziwei',
      label: `${PALACE_KO[lifeNatal.natalName]} ${ganzhiLabel(lifeNatal.ganzhi)} 대한`,
      startAge: item.startAge,
      endAge: item.endAge,
      startYear,
      endYear: chart.meta.baseYear + item.endAge - 1,
      level,
      score: Math.round(avg * 100) / 100,
      fine,
      headline: lines.join(' '),
      highlights: best,
      cautions: worst,
      byDomain,
      evidence: [
        { rule: 'ZT-01', text: `대한 명궁 ${PALACE_KO[lifeNatal.natalName]}(${lifeNatal.ganzhi}), 나이 ${item.startAge}~${item.endAge}세(${startYear}~${chart.meta.baseYear + item.endAge - 1}년)` },
        { rule: 'ZT-02', text: `영역별 단계 ${DOMAINS.map((d) => `${DOMAIN_LABEL[d]} ${byDomain[d] > 0 ? '+' : ''}${byDomain[d]}`).join(' · ')}` },
        { rule: 'ZT-SUM', text: `평균 ${signed(avg)} → 단계 ${LEVEL_LABEL[level]}` },
      ],
    });
  }
  markStanding(out, STANDING_MIN_SPREAD.ziwei);
  return out;
};

// ── 총평 ─────────────────────────────────────────────────────────────────────
export interface ZiweiTongbyeon {
  overview: Overview;
  domains: Record<Domain, DomainReading>;
  decades: PeriodReading[];
  /** 대한끼리 차이가 작아 가장 나은 때·신경 쓸 때를 짚지 않았을 때의 안내 */
  decadeNote?: string;
  patterns: ChartPattern[];
}

export const readZiwei = (chart: Chart, opts: ZiweiOptions, todayYear: number): ZiweiTongbyeon => {
  const v = buildView(chart, 'natal', null);
  const sc = makeScorer(chart, v);
  // 같은 칸의 해설(복덕궁·천이궁 등)이 여러 영역 카드에 되풀이되지 않게, 성격 카드(화면에서 접혀 있음)를 뺀 카드끼리 한 번만 적는다
  const seen = new Set<string>();
  const domains = Object.fromEntries(DOMAINS.map((d) => [d, readZiweiDomain(chart, sc, v, d, opts.mode, d === 'self' ? undefined : seen)])) as Record<Domain, DomainReading>;
  const decades = readDecades(chart);
  const patterns = chartPatterns(chart);
  const overview = buildOverview(chart, sc, v, domains, decades, patterns, opts.mode, todayYear);
  // 문장 속의 칸 이름(명궁·재백궁 …)에 풀이 표시를 붙인다(핵심어 칩과 목록의 이름표는 그대로 둔다)
  for (const d of DOMAINS) {
    const r = domains[d];
    r.verdict = zm(r.verdict);
    r.advice = zm(r.advice);
    r.points = r.points.map((pt) => ({ ...pt, text: zm(pt.text) }));
    r.reasons = r.reasons.map((x) => ({ ...x, brief: zm(x.brief) }));
  }
  overview.headline = zm(overview.headline);
  overview.paragraphs = overview.paragraphs.map((pg) => ({ ...pg, sentences: pg.sentences.map(zm) }));
  overview.advice = overview.advice.map(zm);
  for (const dec of decades) dec.headline = zm(dec.headline);
  return { overview, domains, decades, decadeNote: flatNoteOf(decades), patterns };
};

const buildOverview = (
  chart: Chart, sc: PalaceScorer, v: View, domains: Record<Domain, DomainReading>, decades: PeriodReading[], patterns: ChartPattern[], mode: BrightnessMode, todayYear: number,
): Overview => {
  const life = chart.meta.soulBranch;
  const lifeP = chart.palaces[life];
  const own = mainsOf(chart, life);
  const borrowed = own.length === 0 ? chart.palaces[(life + 6) % 12].stars.filter((s) => s.group === 'main') : [];
  const paragraphs: Overview['paragraphs'] = [];

  // 바탕
  const base: string[] = [];
  const lead = own[0] ?? borrowed[0];
  if (own.length > 0) {
    base.push(`명궁에는 ${josa(names(own, 4), '이/가')} 앉아 있습니다.`);
    base.push(MAIN_PALACE_LINES[own[0].key].life);
    if (own.length > 1) base.push(`여기에 ${own[1].ko}의 성격(${STAR_PROFILES[own[1].key].tag})이 더해집니다.`);
    if (own[0].brightness) {
      const pw = powerParts(own[0].brightness, mode, STAR_PROFILES[own[0].key]);
      base.push(`${josa(own[0].ko, '은/는')} ${pw.phrase}('${pw.label}')에 있습니다. ${pw.effect}`);
    }
  } else if (borrowed.length > 0) {
    base.push(`명궁에는 중심 별이 없어 맞은편 ${PALACE_KO[v.names[(life + 6) % 12]]}의 ${josa(names(borrowed, 3), '을/를')} 빌려 읽습니다.`);
    base.push(MAIN_PALACE_LINES[borrowed[0].key].life);
    base.push(BORROW_NOTE);
  } else {
    base.push('명궁과 맞은편 칸에는 중심 별이 없어 함께 읽는 칸의 분위기를 더 참고합니다.');
  }
  paragraphs.push({ label: '바탕(명궁)', sentences: base });

  // 신궁
  const bodyRole = lifeP.natalName === 'life' && chart.meta.bodyBranch === life ? null : v.names[chart.meta.bodyBranch];
  paragraphs.push({
    label: '신궁',
    sentences: bodyRole
      ? [`신궁은 ${PALACE_KO[bodyRole]}에 있습니다.`, BODY_LINE[bodyRole] ?? '중년 이후의 초점이 이 칸으로 옮겨 갑니다.']
      : ['신궁이 명궁과 같은 칸에 있어, 타고난 성향이 삶 전체에 일관되게 드러납니다.'],
  });

  // 명·재·관·천이 구조
  const four: PalaceKey[] = ['life', 'wealth', 'career', 'travel'];
  const q4 = four.map((r) => ({ r, q: sc.q(sc.branchOf(r), 'self') }));
  const strong4 = [...q4].sort((a, b) => b.q - a.q)[0];
  const weak4 = [...q4].sort((a, b) => a.q - b.q)[0];
  // 가장 약한 칸도 평균(0.3) 이상이면 “약하다”고 하지 않는다 — 가장 앞선 영역이 ▲▲ 인데 관록궁이 약하다고 읽히는 모순을 막는다
  const structure: string[] = [];
  if (weak4.q >= 0.3) {
    structure.push(`명궁·재백궁·관록궁·천이궁이 모두 든든한 편이며, 그중 ${PALACE_KO[strong4.r]}이 가장 든든합니다.`);
    structure.push(`${PALACES[strong4.r].focus}에 힘을 싣는 편이 좋습니다.`);
  } else {
    structure.push(`명궁·재백궁·관록궁·천이궁 가운데 ${PALACE_KO[strong4.r]}이 가장 든든하고, ${PALACE_KO[weak4.r]}은 상대적으로 약합니다.`);
    if (strong4.r !== weak4.r) {
      // 칸 하나의 점수는 낮아도 영역 점수는 함께 읽는 칸(맞은편·삼합)이 받쳐 높게 나올 수 있다.
      // 그때 “보완하라”고 하면 영역 카드(▲▲)와 어긋나 읽히므로(3차 독자 시험), 보완 권유 대신 이유를 말한다.
      const wd = FOUR_DOMAIN[weak4.r];
      const wl = wd ? domains[wd].level : 0;
      if (wd && wl >= 1) {
        structure.push(`${PALACES[strong4.r].focus}에 힘을 싣는 편이 좋습니다.`);
        structure.push(`${PALACE_KO[weak4.r]} 하나만 보면 약하지만, 함께 읽는 칸이 받쳐 주어 ${josa(DOMAIN_TOPIC[wd], '은/는')} ${LEVEL_LABEL[wl]}입니다.`);
      } else {
        structure.push(`${PALACES[strong4.r].focus}에 힘을 싣고, ${PALACES[weak4.r].focus}은 꾸준히 보완하는 편이 좋습니다.`);
      }
    }
  }
  paragraphs.push({ label: '핵심 네 칸의 균형', sentences: structure });

  // 격국
  const combos = detectCombos(chart, life);
  const pat: string[] = [];
  for (const h of combos.filter((c) => c.kind === 'pattern').slice(0, 2)) pat.push(`${h.name}(${h.hanja}): ${h.text}`);
  for (const p of patterns.slice(0, 2)) pat.push(`${p.name}(${p.hanja}): ${p.text}`);
  if (pat.length > 0) paragraphs.push({ label: '명반의 격국', sentences: pat });

  // 인생 테마(생년 사화)
  const theme: string[] = [];
  const findStar = (key: string): { branch: number; star: StarView } | null => {
    for (const p of chart.palaces) {
      const st = p.stars.find((s) => s.key === key);
      if (st) return { branch: p.branch, star: st };
    }
    return null;
  };
  const subject = (m: Mutagen): string => {
    const long = MUTAGEN_LONG_KO[m];
    return `생년 {{${long}}}${josa(long, '은/는').slice(long.length)}`;
  };
  const RESULT: Record<Mutagen, string> = {
    lu: '얻는 것이 늘기 쉽습니다.',
    quan: '주도권을 쥐려는 힘이 큽니다.',
    ke: '좋은 평판과 도움이 따르기 쉽습니다.',
    ji: '걱정과 집착이 생기기 쉽습니다.',
  };
  for (const m of chart.meta.yearMutagens) {
    const f = findStar(m.star);
    if (!f) continue;
    const role = v.names[f.branch];
    theme.push(`${subject(m.mutagen)} ${PALACE_KO[role]}의 ${f.star.ko}에 있어 ${PALACES[role].focus}에서 ${RESULT[m.mutagen]}`);
  }
  const luF = findStar(chart.meta.yearMutagens.find((m) => m.mutagen === 'lu')?.star ?? '');
  const jiF = findStar(chart.meta.yearMutagens.find((m) => m.mutagen === 'ji')?.star ?? '');
  if (luF && jiF) {
    if (luF.branch === jiF.branch) theme.push('얻는 것과 걱정이 한 칸에 함께 있어, 기회를 잡을수록 신경 쓸 일도 늘어납니다.');
    else if ((luF.branch + 6) % 12 === jiF.branch) theme.push('얻는 것과 걱정이 마주 보는 칸에 있어, 한 영역의 기회가 다른 영역의 걱정과 맞물립니다.');
  }
  paragraphs.push({ label: '인생의 테마(타고난 네 가지 변화)', sentences: theme });

  // 지금의 흐름
  const nowIdx = decades.findIndex((d) => todayYear >= d.startYear && todayYear <= d.endYear);
  if (nowIdx >= 0) {
    const d = decades[nowIdx];
    // 10년 구간별 자세한 풀이(화록·화기가 들어오는 칸 등)는 아래 “10년 단위 흐름”에 있으므로 여기서는 요약만 쓴다
    const line = decadeDomainLine(d.highlights, d.cautions ?? []);
    // 이름표 끝의 “대한”은 처음 나오는 곳이라 풀이를 붙인다(제목에는 용어를 쓰지 않는다)
    const nowLabel = d.label.replace(/대한$/, tm('대한'));
    // 타고난 바탕과 이 10년의 방향이 반대인 영역이 있으면 따로 읽는 것임을 한 번 말한다(3차 독자 시험: 바탕은 좋은데 10년은 신경 쓰라니 모순으로 읽힘)
    const apart = DOMAINS.filter((x) => d.byDomain && domains[x].level * d.byDomain[x] < 0).slice(0, 3);
    const apartLines = apart.length > 0 ? [`${josa(domainList(apart), '은/는')} 타고난 바탕과 이 10년의 방향이 다릅니다.`, '바탕은 타고난 구조이고, 10년 운은 그 시기에 더해지는 흐름입니다.'] : [];
    paragraphs.push({ label: '지금의 흐름(10년 운)', sentences: [`지금은 ${todayYear}년(세는나이 ${todayYear - chart.meta.baseYear + 1}세)이며, ${d.startAge}~${d.endAge}세 ${nowLabel}입니다.`, PERIOD_LINE[d.level], ...(line ? [line] : []), ...apartLines, ...(d.standingNote ? [d.standingNote] : [])] });
  }

  // 한 줄 결론: 가장 높은 단계(+1 이상)의 영역들과 가장 낮은 단계(−1 이하)의 영역들. 단계가 같은 영역은 함께 말한다
  const bestSet = bestDomains(domains);
  const worstSet = worstDomains(domains);
  const tagLine = lead ? `성향의 핵심은 ‘${STAR_PROFILES[lead.key].tag}’입니다.` : '중심 별이 없어 주변의 분위기를 따라 읽는 명반입니다.';
  const spread =
    bestSet.length > 0 && worstSet.length > 0 ? `${josa(domainList(bestSet), '은/는')} 받쳐 주는 편이고, ${josa(domainList(worstSet), '은/는')} 신경 쓸 편입니다.`
      : bestSet.length > 0 ? `${josa(domainList(bestSet), '이/가')} 받쳐 주는 편입니다.`
        : worstSet.length > 0 ? `${josa(domainList(worstSet), '이/가')} 신경 쓸 영역입니다.`
          : '영역마다 크게 앞서거나 처지는 곳 없이 무난한 편입니다.';
  const seat = own.length > 0 ? `명궁에 ${josa(names(own, 4), '이/가')} 앉은 명반입니다.` : '명궁에 중심 별이 없는 명반입니다.';
  const headline = `${seat} ${tagLine} ${spread}`;

  const kw: string[] = [];
  if (own.length > 0) kw.push(`명궁 ${names(own, 3)}`);
  else if (borrowed.length > 0) kw.push(`명궁 빌린 별 ${names(borrowed, 2)}`);
  for (const p of patterns.slice(0, 1)) kw.push(p.name);
  for (const h of combos.filter((c) => c.kind === 'pattern').slice(0, 1)) kw.push(h.name);
  if (bestSet.length > 0) kw.push(`${STRONG_PHRASE[bestSet[0]]} 강점`);
  if (worstSet.length > 0) kw.push(`${DOMAIN_LABEL[worstSet[0]]} 점검`);

  // 영역별 구체적인 조언은 아래 영역 카드에 있다. 여기서는 방향과 이 명반만의 당부를 말한다
  const advice: string[] = [];
  const direction = spreadAdvice(bestSet, worstSet);
  if (direction) advice.push(direction);
  const ji = chart.meta.yearMutagens.find((m) => m.mutagen === 'ji');
  const jiPos = ji ? findStar(ji.star) : null;
  if (jiPos) advice.push(`{{${MUTAGEN_LONG_KO.ji}}}가 있는 ${PALACE_KO[v.names[jiPos.branch]]}의 일은 서두르지 말고 한 번 더 점검하세요.`);
  if (advice.length === 0) advice.push('특별히 앞서거나 처지는 영역이 없으니, 하고 싶은 일부터 차근차근 시작해 보세요.');

  const evidence: Evidence[] = [
    { rule: 'ZO-OV1', text: `명궁 ${PALACE_KO[v.names[life]]} ${lifeP.ganzhi}, 주성 ${own.length > 0 ? own.map((s) => s.ko).join('·') : '없음(빌림)'}` },
    { rule: 'ZO-OV2', text: `핵심 네 칸 단독 점수 ${q4.map((x) => `${PALACE_KO[x.r]} ${signed(x.q)}`).join(' · ')}` },
    { rule: 'ZO-OV3', text: `명반 격국 ${patterns.length > 0 ? patterns.map((p) => p.name).join('·') : '해당 없음'}` },
  ];
  return { headline, keywords: kw, paragraphs, advice, evidence };
};
