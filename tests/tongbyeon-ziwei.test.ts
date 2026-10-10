// V-25 자미두수 통변 점수 규칙(설계 부록 D-5, 요구 T-01·T-02): 구현(ziwei-score.ts)을 별 위치만 보고 다시 계산하는 독립 구현과
// 무작위 명반 800개 × 6영역으로 대조한다. V-27 경향 단계 분포(요구 T-12)도 여기서 확인한다.
import { describe, expect, it } from 'vitest';
import { buildView, decadalList, viewForDecade } from '../src/core/chart';
import type { Chart, StarView } from '../src/core/chart';
import { lunarJavascriptEngine } from '../src/core/saju';
import { SAJU_CUTS, ZIWEI_CUTS } from '../src/core/tongbyeon/calibration';
import { analyzeSaju } from '../src/core/tongbyeon/saju-analysis';
import { assembleSajuDomain, sajuDomainHits } from '../src/core/tongbyeon/saju-read';
import { DOMAINS, LEVELS, levelOf } from '../src/core/tongbyeon/types';
import type { Domain } from '../src/core/tongbyeon/types';
import { chartPatterns, makeScorer } from '../src/core/tongbyeon/ziwei-score';
import { makeChart, randomSolarDate, rng } from './helpers';

// ── 독립 구현: 표를 이 파일에 직접 적는다 ────────────────────────────────────────
const MAIN = ['紫微', '天機', '太陽', '武曲', '天同', '廉貞', '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍'];
const HELP6 = ['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞'];
const KILL: Record<string, number> = { 擎羊: -0.45, 陀羅: -0.4, 火星: -0.35, 鈴星: -0.35, 地空: -0.4, 地劫: -0.4 };
const POWER: Record<string, number> = { miao: 1, wang: 0.7, de: 0.4, li: 0.2, ping: 0, bu: -0.4, xian: -0.8 };
const MUT: Record<string, number> = { lu: 0.6, quan: 0.4, ke: 0.35, ji: -0.7 };
const MISC_GOOD = ['三台', '八座', '恩光', '天貴', '龍池', '鳳閣', '台輔', '封誥', '天福', '天德', '月德', '天官', '天才', '天壽', '天廚'];
const MISC_BAD = ['天刑', '陰煞', '天哭', '天虛', '孤辰', '寡宿', '蜚廉', '破碎', '天傷', '天使', '天月'];
const RELIEF = ['解神', '年解'];
const NAMES = ['life', 'siblings', 'spouse', 'children', 'wealth', 'health', 'travel', 'friends', 'career', 'property', 'fortune', 'parents'];
const FIT: Record<Domain, { good: string[]; bad: string[] }> = {
  self: { good: [], bad: [] },
  wealth: { good: ['武曲', '天府', '太陰', '紫微', '天相'], bad: ['破軍', '七殺', '巨門'] },
  career: { good: ['紫微', '天府', '武曲', '太陽', '天梁', '天相', '廉貞'], bad: ['天同', '巨門', '破軍'] },
  love: { good: ['天同', '天相', '天府', '太陰', '天梁'], bad: ['七殺', '破軍', '巨門', '廉貞', '武曲'] },
  health: { good: ['天同', '天府', '天梁', '天相'], bad: ['七殺', '破軍', '巨門', '廉貞'] },
  people: { good: ['天同', '天梁', '天相', '天府', '紫微', '太陽', '太陰'], bad: ['七殺', '破軍', '巨門', '廉貞'] },
};
const FLANK: [string, string, number][] = [
  ['左輔', '右弼', 0.4], ['天魁', '天鉞', 0.35], ['文昌', '文曲', 0.3], ['擎羊', '陀羅', -0.45], ['地空', '地劫', -0.35], ['火星', '鈴星', -0.35],
];
const SPEC: Record<Domain, [string, number][]> = {
  self: [['life', 1], ['body', 0.35], ['fortune', 0.2]],
  wealth: [['wealth', 1], ['property', 0.35], ['fortune', 0.15]],
  career: [['career', 1], ['travel', 0.3], ['life', 0.25]],
  love: [['spouse', 1], ['fortune', 0.25]],
  health: [['health', 1], ['fortune', 0.3], ['life', 0.2]],
  people: [['friends', 0.4], ['travel', 0.25], ['parents', 0.15], ['siblings', 0.1], ['children', 0.1]],
};

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

const oracle = (chart: Chart) => {
  const stars = (b: number): StarView[] => chart.palaces[((b % 12) + 12) % 12].stars;
  const q = (b: number, domain: Domain): number => {
    const st = stars(b);
    const own = st.filter((s) => MAIN.includes(s.key));
    const opp = stars(b + 6).filter((s) => MAIN.includes(s.key));
    const pw = (s: StarView): number => (s.brightness ? POWER[s.brightness] : 0);
    let v = 0;
    if (own.length) v += mean(own.map(pw));
    else if (opp.length) v += 0.7 * mean(opp.map(pw)) - 0.15;
    else v += -0.2;
    // 길성
    const nHelp = st.filter((s) => HELP6.includes(s.key)).length;
    const lucun = st.some((s) => s.key === '祿存');
    v += Math.min(1.2, 0.3 * nHelp + (lucun ? 0.4 : 0));
    // 살성
    const kill = st.filter((s) => s.key in KILL);
    if (kill.length) v += Math.max(-1.4, kill.reduce((s, k) => s + KILL[k.key], 0));
    // 생년 사화
    for (const s of st) if (s.mutagen) v += MUT[s.mutagen];
    // 영역 적성
    const eff = own.length ? own : opp;
    const f = FIT[domain];
    if (eff.length && (f.good.length || f.bad.length)) {
      const scale = own.length ? 1 : 0.7;
      const g = eff.filter((s) => f.good.includes(s.key)).length;
      const bd = eff.filter((s) => f.bad.includes(s.key)).length;
      v += Math.max(-0.5, Math.min(0.5, (0.25 * g - 0.2 * bd) * scale));
    }
    // 소잡성
    const gm = st.filter((s) => MISC_GOOD.includes(s.key)).length;
    const bm = st.filter((s) => MISC_BAD.includes(s.key)).length;
    const rl = st.filter((s) => RELIEF.includes(s.key)).length;
    v += Math.min(0.2, 0.05 * gm) - Math.min(0.3, 0.08 * bm) + 0.1 * rl;
    // 협
    const bef = new Set(stars(b - 1).map((s) => s.key));
    const aft = new Set(stars(b + 1).map((s) => s.key));
    for (const [a, c, x] of FLANK) if ((bef.has(a) && aft.has(c)) || (bef.has(c) && aft.has(a))) v += x;
    // 조합
    const keys = new Set(st.map((s) => s.key));
    const hasLu = st.some((s) => s.mutagen === 'lu');
    if (keys.has('天馬') && (keys.has('祿存') || hasLu)) v += 0.25;
    if (keys.has('祿存') && st.some((s) => s.mutagen === 'lu' && s.key !== '祿存')) v += 0.3;
    if (st.some((s) => s.mutagen === 'ji') && (keys.has('地空') || keys.has('地劫'))) v -= 0.3;
    return v;
  };
  const Q = (b: number, domain: Domain): number => (q(b, domain) + 0.6 * q(b + 6, domain) + 0.4 * q(b + 4, domain) + 0.4 * q(b + 8, domain)) / 2.4;
  const soul = chart.meta.soulBranch;
  const roleBranch = (role: string): number => (role === 'body' ? chart.meta.bodyBranch : (((soul - NAMES.indexOf(role)) % 12) + 12) % 12);
  const pattern = (): number => {
    const area = [soul, soul + 4, soul + 8, soul + 6].flatMap((b) => stars(b));
    const has = (k: string): StarView | undefined => area.find((s) => s.key === k);
    let v = 0;
    if (has('紫微') && has('天府')) v += 0.3;
    const sun = has('太陽');
    const moon = has('太陰');
    const bright = (s?: StarView): boolean => !!s?.brightness && ['miao', 'wang'].includes(s.brightness);
    const dim = (s?: StarView): boolean => !!s?.brightness && ['xian', 'bu'].includes(s.brightness);
    if (sun && moon && bright(sun) && bright(moon)) v += 0.3;
    else if (sun && moon && dim(sun) && dim(moon)) v -= 0.35;
    if (['lu', 'quan', 'ke'].every((m) => area.some((s) => s.mutagen === m))) v += 0.3;
    if (stars(soul).some((s) => s.mutagen === 'ji') || stars(soul + 6).some((s) => s.mutagen === 'ji')) v -= 0.3;
    return v;
  };
  const domain = (d: Domain): number => {
    let sum = 0;
    let w = 0;
    for (const [role, weight] of SPEC[d]) {
      if (role === 'body' && chart.meta.bodyBranch === soul) continue;
      sum += weight * Q(roleBranch(role), d);
      w += weight;
    }
    return sum / w + (d === 'self' ? pattern() : 0);
  };
  return { domain, pattern };
};

const charts = (n: number, seed: number): { chart: Chart; gender: 'M' | 'F' }[] => {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const d = randomSolarDate(r, 1930, 2030);
    const gender = r() < 0.5 ? 'M' : 'F';
    return { chart: makeChart(d.y, d.m, d.d, Math.floor(r() * 12), gender), gender };
  });
};

describe('V-25 자미두수 통변 점수: 별 위치만으로 다시 계산한 독립 구현과의 대조', () => {
  const sample = charts(800, 25001);

  it('영역 점수가 독립 구현과 같다(칸 점수·삼방사정 합성·영역 가중·명반 격국 포함, 허용 오차 0.02)', () => {
    const bad: string[] = [];
    const seen: Record<string, number> = { ZG1: 0, ZG2: 0, ZG3: 0, ZG4: 0, ZG5: 0, borrowed: 0, bodyDistinct: 0 };
    let maxDiff = 0;
    let compared = 0;
    sample.forEach(({ chart }, i) => {
      const sc = makeScorer(chart, buildView(chart, 'natal', null));
      const o = oracle(chart);
      for (const d of DOMAINS) {
        const got = sc.domain(d).score;
        const want = o.domain(d);
        maxDiff = Math.max(maxDiff, Math.abs(got - want));
        compared++;
        if (Math.abs(got - want) > 0.02) bad.push(`#${i} ${d}: ${got} ≠ ${want.toFixed(3)}`);
      }
      for (const p of chartPatterns(chart)) seen[`ZG${Number(p.id.slice(3))}`]++;
      if (chart.palaces[chart.meta.soulBranch].stars.every((s) => s.group !== 'main')) seen.borrowed++;
      if (chart.meta.bodyBranch !== chart.meta.soulBranch) seen.bodyDistinct++;
    });
    // eslint-disable-next-line no-console
    console.log('TONGBYEON_ZIWEI_ORACLE', JSON.stringify({ charts: sample.length, comparisons: compared, maxDiff: +maxDiff.toFixed(4), ...seen }));
    // 독립 구현이 같은 값을 낸 표본이 모든 갈래(명반 격국 5가지, 차성안궁, 신궁 분리)를 포함해야 의미가 있다
    expect(seen.ZG1).toBeGreaterThan(20);
    expect(seen.ZG2).toBeGreaterThan(3);
    expect(seen.ZG4).toBeGreaterThan(10);
    expect(seen.ZG5).toBeGreaterThan(20);
    expect(seen.borrowed).toBeGreaterThan(30);
    expect(seen.bodyDistinct).toBeGreaterThan(300);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('명반 격국 판정은 별 위치와 밝기만으로 다시 판정한 값과 같다', () => {
    const bad: string[] = [];
    sample.forEach(({ chart }, i) => {
      const o = oracle(chart);
      const bonus = chartPatterns(chart).reduce((s, p) => s + p.value, 0);
      if (Math.abs(bonus - o.pattern()) > 1e-9) bad.push(`#${i}: ${bonus} ≠ ${o.pattern()}`);
    });
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('V-27 경향 단계 분포: 새 표본에서 목표 비율(10/25/30/25/10)의 ±7%p 안', () => {
  const TARGET = [0.1, 0.25, 0.3, 0.25, 0.1];
  const check = (name: string, levels: number[]): string[] => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      const p = levels.filter((x) => x === lv).length / levels.length;
      const t = TARGET[lv + 2];
      if (Math.abs(p - t) > 0.07) bad.push(`${name} 단계 ${lv}: ${(100 * p).toFixed(1)}% (목표 ${100 * t}%)`);
    }
    return bad;
  };

  it('자미두수 본명 영역 6개 (명반 800개, 보정 표본과 다른 시드)', () => {
    const sample = charts(800, 27001);
    const bad: string[] = [];
    for (const d of DOMAINS) {
      const levels = sample.map(({ chart }) => levelOf(makeScorer(chart, buildView(chart, 'natal', null)).domain(d).score, ZIWEI_CUTS[d]));
      bad.push(...check(`자미두수 ${d}`, levels));
    }
    expect(bad).toEqual([]);
  });

  it('사주 영역 6개 (날짜에서 만든 사주 6,000개)', () => {
    const r = rng(27002);
    const levels: Record<Domain, number[]> = { self: [], wealth: [], career: [], love: [], health: [], people: [] };
    for (let i = 0; i < 6000; i++) {
      const d = randomSolarDate(r, 1930, 2030);
      const hour = Math.floor(r() * 24);
      const gender = r() < 0.5 ? 'M' : 'F';
      const s = lunarJavascriptEngine.compute({ instantUtcMs: Date.UTC(d.y, d.m - 1, d.d, hour - 9, 0), clock: { y: d.y, m: d.m, d: d.d, h: hour, mi: 0 }, hourKnown: true, gender, lateZi: 'next' });
      const basis = { year: s.year, month: s.month, day: s.day, hour: s.hour };
      const hits = sajuDomainHits(analyzeSaju(basis, gender), basis);
      for (const dm of DOMAINS) levels[dm].push(assembleSajuDomain(dm, hits[dm]).level);
    }
    const bad: string[] = [];
    for (const dm of DOMAINS) {
      bad.push(...check(`사주 ${dm}`, levels[dm]));
      expect(levelOf(0, SAJU_CUTS[dm])).toBeGreaterThanOrEqual(-2);
    }
    expect(bad).toEqual([]);
  });
});

describe('V-25 대한 덧씌움(ZO-01·ZO-02)과 대한 궁 이름표', () => {
  const FLOW: Record<string, number> = { 運祿: 0.35, 運羊: -0.4, 運陀: -0.35, 運昌: 0.2, 運曲: 0.2, 運魁: 0.2, 運鉞: 0.2 };
  const MUTV: Record<string, number> = { lu: 0.6, quan: 0.4, ke: 0.35, ji: -0.7 };

  it('명반 40개 × 대한 12구간: 대한 사화는 별이 앉은 칸에 0.8배로, 대한 유성은 표대로 더해지고 본명 뷰에는 없다', () => {
    const sample = charts(40, 25002);
    let overlays = 0;
    let flows = 0;
    for (const { chart } of sample) {
      const natal = makeScorer(chart, buildView(chart, 'natal', null));
      for (let b = 0; b < 12; b++) expect(natal.comps(b, 'self').some((c) => c.rule.startsWith('ZO-'))).toBe(false);
      for (const item of decadalList(chart)) {
        const view = viewForDecade(chart, item.startAge);
        const sc = makeScorer(chart, view);
        // 대한 궁 이름표: 대한 명궁에서 시계 반대 방향(지지가 줄어드는 쪽)으로 명·형제·부처…
        for (let b = 0; b < 12; b++) expect(view.names[b], `대한 ${item.startAge}세 ${b}`).toBe(NAMES[(((view.lifeBranch - b) % 12) + 12) % 12]);
        // 대한 사화
        for (const m of view.mutagens) {
          const pos = chart.palaces.find((p) => p.stars.some((st) => st.key === m.star));
          expect(pos, m.star).toBeTruthy();
          const got = sc.comps((pos as { branch: number }).branch, 'self').filter((c) => c.rule === 'ZO-01').map((c) => c.value);
          expect(got.some((v) => Math.abs(v - 0.8 * MUTV[m.mutagen]) < 1e-9), `${m.star} ${m.mutagen}`).toBe(true);
          overlays++;
        }
        // 대한 유성
        for (let b = 0; b < 12; b++) {
          const want = (view.flow[b] ?? []).reduce((sum, f) => sum + (FLOW[f.key] ?? 0), 0);
          const got = sc.comps(b, 'self').filter((c) => c.rule === 'ZO-02').reduce((sum, c) => sum + c.value, 0);
          expect(Math.abs(got - want), `대한 유성 ${b}`).toBeLessThan(1e-9);
          if (want !== 0) flows++;
        }
      }
    }
    expect(overlays).toBeGreaterThan(1500);
    expect(flows).toBeGreaterThan(300);
  });
});
