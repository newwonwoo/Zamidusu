// 자미두수 통변의 점수 단계(설계 부록 D-5). 문장은 만들지 않는다.
// 칸 하나의 점수 q → 삼방사정 합성 Q → 영역 점수. 점수와 설명이 어긋나지 않도록 각 항목은 값·짧은 설명·근거 문장을 함께 낸다.

import type { Brightness7 } from '../brightness';
import { borrowedMainStars, surround } from '../chart';
import type { Chart, PalaceView, StarView, View } from '../chart';
import { mod } from '../ganzhi';
import { MUTAGEN_LONG_KO } from '../names';
import type { PalaceKey } from '../names';
import { DOMAIN_FIT, DOMAIN_PALACES } from './ziwei-text';
import type { Domain } from './types';
import { josa } from '../explain/korean';
import { tj } from './util';

export interface Comp {
  rule: string;
  value: number;
  /** 비교에서 쓰는 짧은 명사구 */
  brief: string;
  /** 근거에 적을 설명 */
  detail: string;
}

export const BRIGHT_POWER: Record<Brightness7, number> = { miao: 1, wang: 0.7, de: 0.4, li: 0.2, ping: 0, bu: -0.4, xian: -0.8 };
const BRIGHT_KO: Record<Brightness7, string> = { miao: '묘', wang: '왕', de: '득', li: '리', ping: '평', bu: '불', xian: '함' };
export const HELPERS = ['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞'];
export const KILLERS: Record<string, number> = { 擎羊: -0.45, 陀羅: -0.4, 火星: -0.35, 鈴星: -0.35, 地空: -0.4, 地劫: -0.4 };
const MUT_VALUE = { lu: 0.6, quan: 0.4, ke: 0.35, ji: -0.7 } as const;
const FLOW_VALUE: Record<string, number> = { 運祿: 0.35, 運羊: -0.4, 運陀: -0.35, 運昌: 0.2, 運曲: 0.2, 運魁: 0.2, 運鉞: 0.2 };
const DECADE_MUT_SCALE = 0.8;

const FLANKS: { a: string; b: string; value: number; name: string; stars: string }[] = [
  { a: '左輔', b: '右弼', value: 0.4, name: '좌우협', stars: '좌보·우필' },
  { a: '天魁', b: '天鉞', value: 0.35, name: '괴월협', stars: '천괴·천월' },
  { a: '文昌', b: '文曲', value: 0.3, name: '창곡협', stars: '문창·문곡' },
  { a: '擎羊', b: '陀羅', value: -0.45, name: '양타협', stars: '경양·타라' },
  { a: '地空', b: '地劫', value: -0.35, name: '공겁협', stars: '지공·지겁' },
  { a: '火星', b: '鈴星', value: -0.35, name: '화령협', stars: '화성·령성' },
];

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const r2 = (v: number): number => Math.round(v * 100) / 100;
const sgn = (v: number): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;

export const powerOf = (s: StarView): number => (s.brightness ? BRIGHT_POWER[s.brightness] : 0);

export interface PalaceScorer {
  chart: Chart;
  view: View;
  /** 칸 하나의 점수 구성 */
  comps(branch: number, domain: Domain): Comp[];
  /** 칸 하나의 점수 q */
  q(branch: number, domain: Domain): number;
  /** 삼방사정 합성 */
  surround(branch: number, domain: Domain): SurroundScore;
  /** 이 영역을 이루는 칸들의 가중 평균 */
  domain(domain: Domain): DomainScore;
  /** 역할(궁 이름)이 놓인 칸 */
  branchOf(role: PalaceKey): number;
}

export interface SurroundScore {
  branch: number;
  Q: number;
  parts: { self: number; opposite: number; trine: [number, number] };
}

export interface DomainScore {
  domain: Domain;
  score: number;
  /** 영역을 이루는 칸들 */
  parts: { role: PalaceKey; branch: number; w: number; S: SurroundScore }[];
}

export const makeScorer = (chart: Chart, view: View): PalaceScorer => {
  const compCache = new Map<string, Comp[]>();
  const roleBranch = new Map<PalaceKey, number>();
  view.names.forEach((n, b) => roleBranch.set(n, b));
  const branchOf = (role: PalaceKey): number => roleBranch.get(role) as number;

  const compute = (branch: number, domain: Domain): Comp[] => {
    const p: PalaceView = chart.palaces[branch];
    const comps: Comp[] = [];
    const own = p.stars.filter((s) => s.group === 'main');
    const borrowed = own.length === 0 ? borrowedMainStars(chart, branch) : [];

    // ZP-01 / 02 / 03: 중심 별과 그 힘
    if (own.length > 0) {
      const v = mean(own.map(powerOf));
      const first = own[0];
      const phrase = v >= 0.5 ? '힘이 센' : v <= -0.3 ? '힘이 약한' : '보통의';
      // 중심 별이 둘 이상이면 평균 힘이므로 한 별만 가리키지 않고 함께 말한다(카드의 “별의 힘” 문장과 같은 별들)
      const brief = own.length === 1
        ? `${josa(first.ko, '이/가')} ${phrase} 자리에 있음`
        : `중심 별 ${own.map((s) => s.ko).join('·')}의 힘이 ${v >= 0.5 ? '센 편' : v <= -0.3 ? '약한 편' : '보통'}`;
      comps.push({
        rule: 'ZP-01', value: v, brief,
        detail: `중심 별 ${own.map((s) => `${s.ko}${s.brightness ? `(${BRIGHT_KO[s.brightness]})` : ''}`).join('·')} 밝기 평균 ${sgn(v)}`,
      });
    } else if (borrowed.length > 0) {
      const v = 0.7 * mean(borrowed.map(powerOf)) - 0.15;
      comps.push({
        rule: 'ZP-02', value: v, brief: '중심 별이 없어 맞은편 별을 빌림',
        detail: `중심 별 없음 → 맞은편 ${borrowed.map((s) => s.ko).join('·')} 빌림: 0.7×밝기 평균 −0.15 = ${sgn(v)}`,
      });
    } else {
      comps.push({ rule: 'ZP-03', value: -0.2, brief: '맞은편까지 중심 별이 없음', detail: '이 칸과 맞은편 모두 중심 별 없음 −0.20' });
    }

    // ZP-04: 길성
    const helpers = p.stars.filter((s) => HELPERS.includes(s.key));
    const lucun = p.stars.some((s) => s.key === '祿存');
    const helpV = Math.min(1.2, 0.3 * helpers.length + (lucun ? 0.4 : 0));
    if (helpV > 0) {
      const n = helpers.length + (lucun ? 1 : 0);
      comps.push({
        rule: 'ZP-04', value: helpV, brief: `도와주는 별 ${n}개`,
        detail: `길성 ${[...helpers.map((s) => s.ko), ...(lucun ? ['녹존'] : [])].join('·')} → ${sgn(helpV)}`,
      });
    }

    // ZP-06: 살성
    const killers = p.stars.filter((s) => s.key in KILLERS);
    if (killers.length > 0) {
      const v = Math.max(-1.4, killers.reduce((s, k) => s + KILLERS[k.key], 0));
      comps.push({ rule: 'ZP-06', value: v, brief: `긴장을 주는 별 ${killers.length}개`, detail: `살성 ${killers.map((s) => s.ko).join('·')} → ${sgn(v)}` });
    }

    // ZP-07: 생년 사화
    for (const s of p.stars) {
      if (!s.mutagen) continue;
      const v = MUT_VALUE[s.mutagen];
      comps.push({ rule: 'ZP-07', value: v, brief: `생년 ${tj(MUTAGEN_LONG_KO[s.mutagen], '이/가')} 붙음`, detail: `생년 ${josa(MUTAGEN_LONG_KO[s.mutagen], '이/가')} ${s.ko}에 붙음 → ${sgn(v)}` });
    }

    // ZP-08: 영역 적성
    const fit = DOMAIN_FIT[domain];
    const eff = own.length > 0 ? own : borrowed;
    if (eff.length > 0 && (fit.good.length > 0 || fit.caution.length > 0)) {
      const scale = own.length > 0 ? 1 : 0.7;
      const good = eff.filter((s) => fit.good.includes(s.key));
      const bad = eff.filter((s) => fit.caution.includes(s.key));
      const v = Math.max(-0.5, Math.min(0.5, (0.25 * good.length - 0.2 * bad.length) * scale));
      if (v !== 0) {
        comps.push({
          rule: 'ZP-08', value: v, brief: v > 0 ? '중심 별이 이 영역에 어울림' : '중심 별이 이 영역에서는 조심할 별',
          detail: `영역 적성: 어울림 ${good.map((s) => s.ko).join('·') || '없음'} / 조심 ${bad.map((s) => s.ko).join('·') || '없음'} → ${sgn(v)}`,
        });
      }
    }

    // ZP-09: 소잡성
    const goodMisc = p.stars.filter((s) => s.group === 'misc' && s.tone === 'good').length;
    const worryMisc = p.stars.filter((s) => s.group === 'misc' && s.tone === 'bad').length;
    const relief = p.stars.filter((s) => s.group === 'misc' && s.tone === 'helper').length;
    const miscV = Math.min(0.2, 0.05 * goodMisc) - Math.min(0.3, 0.08 * worryMisc) + 0.1 * relief;
    if (Math.abs(miscV) > 1e-9) {
      comps.push({ rule: 'ZP-09', value: miscV, brief: miscV > 0 ? '작은 길한 별' : '작은 걱정 별', detail: `잡성 길 ${goodMisc} · 걱정 ${worryMisc} · 해소 ${relief} → ${sgn(miscV)}` });
    }

    // ZP-10: 협
    const before = new Set(chart.palaces[mod(branch - 1, 12)].stars.map((s) => s.key));
    const after = new Set(chart.palaces[mod(branch + 1, 12)].stars.map((s) => s.key));
    for (const f of FLANKS) {
      if ((before.has(f.a) && after.has(f.b)) || (before.has(f.b) && after.has(f.a))) {
        comps.push({ rule: 'ZP-10', value: f.value, brief: `{{${f.name}}}`, detail: `${f.name}: 양옆 칸에 ${f.stars}이 하나씩 → ${sgn(f.value)}` });
      }
    }

    // ZP-11: 조합
    const keys = new Set(p.stars.map((s) => s.key));
    const hasLu = p.stars.some((s) => s.mutagen === 'lu');
    if (keys.has('天馬') && (keys.has('祿存') || hasLu)) comps.push({ rule: 'ZP-11', value: 0.25, brief: '녹마교치', detail: '녹마교치(재물 별과 이동의 별이 한 칸) → +0.25' });
    if (keys.has('祿存') && p.stars.some((s) => s.mutagen === 'lu' && s.key !== '祿存')) comps.push({ rule: 'ZP-11', value: 0.3, brief: '쌍록', detail: '쌍록(녹존과 화록이 한 칸) → +0.30' });
    if (p.stars.some((s) => s.mutagen === 'ji') && (keys.has('地空') || keys.has('地劫'))) comps.push({ rule: 'ZP-11', value: -0.3, brief: '{{화기}}와 공겁이 겹침', detail: '화기가 지공·지겁과 한 칸 → −0.30' });

    // ZO: 대한 덧씌움
    if (view.scope === 'decadal') {
      for (const m of view.mutagens) {
        const s = p.stars.find((x) => x.key === m.star);
        if (!s) continue;
        const v = MUT_VALUE[m.mutagen] * DECADE_MUT_SCALE;
        comps.push({ rule: 'ZO-01', value: v, brief: `{{대한}} ${tj(MUTAGEN_LONG_KO[m.mutagen], '이/가')} 붙음`, detail: `대한 ${josa(MUTAGEN_LONG_KO[m.mutagen], '이/가')} ${s.ko}에 붙음 → ${sgn(v)}` });
      }
      const flows = view.flow[branch] ?? [];
      const fv = flows.reduce((s, f) => s + (FLOW_VALUE[f.key] ?? 0), 0);
      if (fv !== 0) comps.push({ rule: 'ZO-02', value: fv, brief: '대한 유성이 들어옴', detail: `대한 유성 ${flows.filter((f) => f.key in FLOW_VALUE).map((f) => f.ko).join('·')} → ${sgn(fv)}` });
    }
    return comps;
  };

  const comps = (branch: number, domain: Domain): Comp[] => {
    const k = `${branch}|${domain}`;
    let v = compCache.get(k);
    if (!v) {
      v = compute(branch, domain);
      compCache.set(k, v);
    }
    return v;
  };
  const q = (branch: number, domain: Domain): number => r2(comps(branch, domain).reduce((s, c) => s + c.value, 0));

  const surr = (branch: number, domain: Domain): SurroundScore => {
    const s = surround(branch);
    const self = q(s.self, domain);
    const opposite = q(s.opposite, domain);
    const t1 = q(s.trine[0], domain);
    const t2 = q(s.trine[1], domain);
    return { branch, Q: (self + 0.6 * opposite + 0.4 * t1 + 0.4 * t2) / 2.4, parts: { self, opposite, trine: [t1, t2] } };
  };

  const domainScore = (domain: Domain): DomainScore => {
    const parts: DomainScore['parts'] = [];
    for (const spec of DOMAIN_PALACES[domain]) {
      let role: PalaceKey;
      let branch: number;
      if (spec.role === 'body') {
        // 신궁은 본명에서만, 명궁과 다른 칸일 때만 본다
        if (view.scope !== 'natal' || chart.meta.bodyBranch === chart.meta.soulBranch) continue;
        branch = chart.meta.bodyBranch;
        role = view.names[branch];
      } else {
        role = spec.role;
        branch = branchOf(role);
      }
      parts.push({ role, branch, w: spec.w, S: surr(branch, domain) });
    }
    const wsum = parts.reduce((s, x) => s + x.w, 0);
    let score = parts.reduce((s, x) => s + x.w * x.S.Q, 0) / wsum;
    if (domain === 'self' && view.scope === 'natal') score += chartPatternBonus(chart);
    return { domain, score: r2(score), parts };
  };

  return { chart, view, comps, q, surround: surr, domain: domainScore, branchOf };
};

// ── 명반 전체 격국 ───────────────────────────────────────────────────────────
export interface ChartPattern {
  id: string;
  name: string;
  hanja: string;
  /** 성격 점수에 더하는 값 */
  value: number;
  text: string;
}

const lifeSurroundStars = (chart: Chart): { branch: number; stars: StarView[] }[] => {
  const s = surround(chart.meta.soulBranch);
  return [s.self, ...s.trine, s.opposite].map((b) => ({ branch: b, stars: chart.palaces[b].stars }));
};

export const chartPatterns = (chart: Chart): ChartPattern[] => {
  const out: ChartPattern[] = [];
  const area = lifeSurroundStars(chart);
  const all = area.flatMap((a) => a.stars);
  const find = (key: string): StarView | undefined => all.find((s) => s.key === key);
  const bright = (s: StarView | undefined, good: boolean): boolean => !!s?.brightness && (good ? ['miao', 'wang'].includes(s.brightness) : ['xian', 'bu'].includes(s.brightness));

  if (find('紫微') && find('天府')) {
    out.push({ id: 'ZG-01', name: '자부조원', hanja: '紫府朝垣', value: 0.3, text: '자미와 천부가 명궁 가까이에 모여 품격과 안정이 함께 받쳐 주는 구도입니다.' });
  }
  const sun = find('太陽');
  const moon = find('太陰');
  if (sun && moon && bright(sun, true) && bright(moon, true)) {
    out.push({ id: 'ZG-02', name: '일월병명', hanja: '日月並明', value: 0.3, text: '태양과 태음이 모두 밝은 자리에서 명궁을 비추는 구도입니다. 활동력과 섬세함이 함께 빛납니다.' });
  } else if (sun && moon && bright(sun, false) && bright(moon, false)) {
    out.push({ id: 'ZG-03', name: '일월반배', hanja: '日月反背', value: -0.35, text: '태양과 태음이 모두 어두운 자리에 있는 구도입니다. 힘을 쓰기 어려우니 꾸준함으로 보완하세요.' });
  }
  const mutagenStars = (m: string): boolean => all.some((s) => s.mutagen === m);
  if (mutagenStars('lu') && mutagenStars('quan') && mutagenStars('ke')) {
    out.push({ id: 'ZG-04', name: '삼기가회', hanja: '三奇嘉會', value: 0.3, text: '{{화록}}·{{화권}}·{{화과}}가 모두 명궁과 함께 읽는 칸에 모인 구도입니다. 기회와 주도권, 평판이 함께 따릅니다.' });
  }
  const opp = chart.palaces[surround(chart.meta.soulBranch).opposite];
  if (chart.palaces[chart.meta.soulBranch].stars.some((s) => s.mutagen === 'ji') || opp.stars.some((s) => s.mutagen === 'ji')) {
    out.push({ id: 'ZG-05', name: '기충명', hanja: '忌沖命', value: -0.3, text: '{{화기}}가 명궁이나 맞은편 칸에 있어 마음이 한쪽으로 쏠리기 쉬운 구도입니다. 서두르지 말고 점검하세요.' });
  }
  return out;
};

export const chartPatternBonus = (chart: Chart): number => chartPatterns(chart).reduce((s, p) => s + p.value, 0);

// 영역 구성 설명(근거용)
export const describeDomain = (d: DomainScore, name: (b: number) => string): string =>
  `${d.parts.map((p) => `${name(p.branch)} 가중 ${p.w.toFixed(2)}`).join(' · ')} → 영역 점수 ${sgn(d.score)}`;
