// 경향 단계 경계값 재생성 도구(설계 부록 D-5·D-6). 평소 시험에서는 건너뛰고, CALIBRATE=1 일 때만 실행해
// src/core/tongbyeon/calibration.ts 와 docs/generated/tongbyeon-calibration.md 를 다시 쓴다.
//   CALIBRATE=1 npx vitest run tests/calibrate-tongbyeon.test.ts
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildView, decadalList, viewForDecade } from '../src/core/chart';
import { lunarJavascriptEngine } from '../src/core/saju';
import { STRENGTH_CUTS } from '../src/core/tongbyeon/calibration';
import { energyOf } from '../src/core/tongbyeon/saju-analysis';
import type { SajuBasis } from '../src/core/tongbyeon/saju-analysis';
import { analyzeSaju } from '../src/core/tongbyeon/saju-analysis';
import { assembleSajuDomain, readDaeun, sajuDomainHits } from '../src/core/tongbyeon/saju-read';
import { DOMAINS, LEVEL_PERCENTILES, levelOf } from '../src/core/tongbyeon/types';
import type { Domain } from '../src/core/tongbyeon/types';
import { makeScorer } from '../src/core/tongbyeon/ziwei-score';
import { makeChart, randomSolarDate, rng } from './helpers';

const quantile = (sorted: number[], p: number): number => {
  const i = p * (sorted.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

type Cuts4 = [number, number, number, number];
const TARGET = [0.1, 0.25, 0.3, 0.25, 0.1];

/** 경계값으로 자른 다섯 단계(−2~+2)의 표본 비율 */
const sharesOf = (xs: number[], cuts: readonly number[]): number[] => {
  const c = [0, 0, 0, 0, 0];
  for (const x of xs) c[levelOf(x, cuts as Cuts4) + 2]++;
  return c.map((v) => v / xs.length);
};

/**
 * 경계값: 점수가 같은 표본이 몰려 있으면(점수가 띄엄띄엄한 값이라) 보통의 백분위로는 단계 비율이 크게 틀어진다.
 * 그래서 서로 다른 점수 값마다 “그 값 이하의 누적 비율”을 구하고, 목표 백분위(10·35·65·90) 둘레(±12%p)의 값 중
 * 네 경계의 모든 조합을 따져 **다섯 단계 비율이 목표(10/25/30/25/10)에서 가장 덜 벗어나는 조합**을 고른다
 * (가장 크게 벗어난 단계의 차이를 먼저, 같으면 제곱합을 줄인다). 경계는 고른 값 바로 위(+0.005)이고,
 * 점수 > 그 값 이면 위 단계다. 점수는 소수 둘째 자리로 반올림된 값이다.
 */
const cutsOf = (xs: number[]): Cuts4 => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const distinct: { v: number; cum: number }[] = [];
  for (let i = 0; i < n; i++) if (i === n - 1 || s[i + 1] !== s[i]) distinct.push({ v: s[i], cum: (i + 1) / n });
  const cand = LEVEL_PERCENTILES.map((p) => {
    const near = distinct.filter((d) => Math.abs(d.cum - p) <= 0.12);
    if (near.length) return near;
    let best = distinct[0];
    for (const d of distinct) if (Math.abs(d.cum - p) < Math.abs(best.cum - p)) best = d;
    return [best];
  });
  let best: { v: Cuts4; dev: number; sq: number } | null = null;
  for (const a of cand[0]) {
    for (const b of cand[1]) {
      if (b.cum <= a.cum) continue;
      for (const c of cand[2]) {
        if (c.cum <= b.cum) continue;
        for (const d of cand[3]) {
          if (d.cum <= c.cum) continue;
          const sh = [a.cum, b.cum - a.cum, c.cum - b.cum, d.cum - c.cum, 1 - d.cum];
          let dev = 0;
          let sq = 0;
          for (let k = 0; k < 5; k++) {
            const e = Math.abs(sh[k] - TARGET[k]);
            if (e > dev) dev = e;
            sq += e * e;
          }
          if (!best || dev < best.dev - 1e-12 || (Math.abs(dev - best.dev) <= 1e-12 && sq < best.sq)) best = { v: [a.v, b.v, c.v, d.v], dev, sq };
        }
      }
    }
  }
  return best!.v.map((v) => r3(v + 0.005)) as Cuts4;
};

const N_NATAL = 4000;
const N_DECADE = 600;

describe.runIf(process.env.CALIBRATE === '1')('경계값 재생성', () => {
  it('표본을 만들어 calibration.ts 를 다시 쓴다', () => {
    // ── 1) 사주: 도움 지수(강약) 경계 → 영역 점수 경계
    const r = rng(20261009);
    const births: { y: number; m: number; d: number; hour: number; gender: 'M' | 'F' }[] = [];
    for (let i = 0; i < N_NATAL; i++) {
      const d = randomSolarDate(r, 1930, 2030);
      births.push({ ...d, hour: Math.floor(r() * 24), gender: r() < 0.5 ? 'M' : 'F' });
    }
    const sajuOf = (b: (typeof births)[number]) =>
      lunarJavascriptEngine.compute({
        instantUtcMs: Date.UTC(b.y, b.m - 1, b.d, b.hour - 9, 0), clock: { y: b.y, m: b.m, d: b.d, h: b.hour, mi: 0 }, hourKnown: true, gender: b.gender, lateZi: 'next',
      });
    const sajus = births.map(sajuOf);
    const H = sajus.map((s) => {
      const e = energyOf(s as SajuBasis);
      return e.byGroup.비겁 + e.byGroup.인성;
    }).sort((a, b) => a - b);
    const strength = { weak: r3(quantile(H, 0.35)), strong: r3(quantile(H, 0.65)), extremeWeak: r3(quantile(H, 0.03)), extremeStrong: r3(quantile(H, 0.97)) };
    Object.assign(STRENGTH_CUTS, strength);

    const sajuScores = Object.fromEntries(DOMAINS.map((d) => [d, [] as number[]])) as Record<Domain, number[]>;
    const daeunScores: number[] = [];
    sajus.forEach((s, i) => {
      const b: SajuBasis = { year: s.year, month: s.month, day: s.day, hour: s.hour };
      const a = analyzeSaju(b, births[i].gender);
      const hits = sajuDomainHits(a, b);
      for (const d of DOMAINS) sajuScores[d].push(assembleSajuDomain(d, hits[d]).score);
      for (const p of readDaeun(s, a, b)) daeunScores.push(p.score);
    });
    const sajuPeriodCuts = cutsOf(daeunScores);
    const sajuCuts = Object.fromEntries(DOMAINS.map((d) => [d, cutsOf(sajuScores[d])])) as Record<Domain, [number, number, number, number]>;

    // ── 2) 자미두수: 본명 영역 점수
    const zScores = Object.fromEntries(DOMAINS.map((d) => [d, [] as number[]])) as Record<Domain, number[]>;
    const dScores = Object.fromEntries(DOMAINS.map((d) => [d, [] as number[]])) as Record<Domain, number[]>;
    const dRows: number[][] = [];
    births.forEach((b, i) => {
      const branch = b.hour === 23 ? 0 : Math.floor((b.hour + 1) / 2);
      const chart = makeChart(b.y, b.m, b.d, branch, b.gender);
      const sc = makeScorer(chart, buildView(chart, 'natal', null));
      for (const d of DOMAINS) zScores[d].push(sc.domain(d).score);
      if (i < N_DECADE) {
        for (const item of decadalList(chart)) {
          const dsc = makeScorer(chart, viewForDecade(chart, item.startAge));
          const row = DOMAINS.map((d) => dsc.domain(d).score);
          dRows.push(row);
          DOMAINS.forEach((d, k) => dScores[d].push(row[k]));
        }
      }
    });
    const zCuts = Object.fromEntries(DOMAINS.map((d) => [d, cutsOf(zScores[d])])) as Record<Domain, [number, number, number, number]>;
    const dCuts = Object.fromEntries(DOMAINS.map((d) => [d, cutsOf(dScores[d])])) as Record<Domain, [number, number, number, number]>;
    // 대한 종합 = 여섯 영역 단계의 평균 → 그 분포의 백분위
    const avgs = dRows.map((row) => DOMAINS.reduce((s, d, k) => s + levelOf(row[k], dCuts[d]), 0) / DOMAINS.length);
    const ziweiPeriodCuts = cutsOf(avgs.map((v) => Math.round(v * 100) / 100));

    const fmt = (c: Record<Domain, [number, number, number, number]>): string =>
      `{\n${DOMAINS.map((d) => `  ${d}: [${c[d].join(', ')}],`).join('\n')}\n}`;
    const now = new Date().toISOString().slice(0, 10);
    const src = `// 경향 단계의 경계값. 무작위 표본에서 다섯 단계의 비율이 목표(10/25/30/25/10)에서 가장 덜 벗어나도록 고른 값이며 직접 고치지 않는다.
// (점수가 같은 표본이 몰려 있으면 그 덩어리의 위쪽 또는 아래쪽 중 비율이 더 잘 맞는 쪽을 경계로 삼는다: 점수 > 값 이면 위 단계)
// 다시 만들기: CALIBRATE=1 npx vitest run tests/calibrate-tongbyeon.test.ts  (설계서 부록 D-5·D-6)
// 표본: 1930~2030년 무작위 출생 ${N_NATAL}건(본명), 그중 ${N_DECADE}건의 대한 ${N_DECADE * 12}구간, 고정 시드 20261009. 생성일 ${now}.

import type { Domain } from './types';

type Cuts = readonly [number, number, number, number];

/** 사주: 도움 지수(비겁+인성 비중)로 신약/중화/신강을 나누는 경계(35·65 백분위)와 극단(3·97 백분위) */
export const STRENGTH_CUTS = { weak: ${strength.weak}, strong: ${strength.strong}, extremeWeak: ${strength.extremeWeak}, extremeStrong: ${strength.extremeStrong} };

/** 사주 영역 점수 → 단계 경계(목표 10·35·65·90 백분위) */
export const SAJU_CUTS: Record<Domain, Cuts> = ${fmt(sajuCuts)};

/** 자미두수 영역 점수(본명) → 단계 경계 */
export const ZIWEI_CUTS: Record<Domain, Cuts> = ${fmt(zCuts)};

/** 자미두수 영역 점수(대한) → 단계 경계 */
export const ZIWEI_DECADE_CUTS: Record<Domain, Cuts> = ${fmt(dCuts)};

/** 자미두수 대한 종합(여섯 영역 단계의 평균) → 단계 경계 */
export const ZIWEI_PERIOD_CUTS: Cuts = [${ziweiPeriodCuts.join(', ')}];

/** 사주 대운 점수 → 단계 경계 */
export const SAJU_PERIOD_CUTS: Cuts = [${sajuPeriodCuts.join(', ')}];
`;
    writeFileSync(new URL('../src/core/tongbyeon/calibration.ts', import.meta.url), src);

    const row = (name: string, xs: number[]): string => {
      const s = [...xs].sort((a, b) => a - b);
      return `| ${name} | ${s.length} | ${[0, 0.1, 0.35, 0.5, 0.65, 0.9, 1].map((p) => r3(quantile(s, p))).join(' | ')} |`;
    };
    const shareRow = (name: string, xs: number[], cuts: readonly number[]): string => {
      const sh = sharesOf(xs, cuts);
      const dev = Math.max(...sh.map((v, k) => Math.abs(v - TARGET[k])));
      return `| ${name} | ${sh.map((v) => `${(100 * v).toFixed(1)}%`).join(' | ')} | ${(100 * dev).toFixed(1)}%p |`;
    };
    const md = [
      '# 통변 경향 단계 경계값 (자동 생성)',
      '',
      `표본: 1930~2030년 무작위 출생 ${N_NATAL}건, 고정 시드. 대한은 ${N_DECADE}건 × 12구간. 생성일 ${now}. 재생성: \`CALIBRATE=1 npx vitest run tests/calibrate-tongbyeon.test.ts\``,
      '',
      '경계는 점수 분포의 10·35·65·90 백분위 둘레의 값 가운데, 다섯 단계 비율이 목표에서 가장 덜 벗어나는 조합(가장 크게 벗어난 단계의 차이를 최소로)입니다. 점수가 띄엄띄엄한 값이라 같은 점수가 몰려 있으면 목표와 정확히 맞출 수 없어, 아래 “표본에서의 단계 비율” 표에 실제 비율을 함께 적습니다. 목표 비율은 **−2: 10% · −1: 25% · 0: 30% · +1: 25% · +2: 10%** 입니다.',
      '',
      `사주 도움 지수 경계: 신약 < ${strength.weak} ≤ 중화 < ${strength.strong} ≤ 신강 (극단 ${strength.extremeWeak} / ${strength.extremeStrong})`,
      '',
      '| 구분 | 표본 | 최소 | 10% | 35% | 50% | 65% | 90% | 최대 |',
      '|---|---|---|---|---|---|---|---|---|',
      ...DOMAINS.map((d) => row(`사주 ${d}`, sajuScores[d])),
      ...DOMAINS.map((d) => row(`자미두수 ${d}`, zScores[d])),
      ...DOMAINS.map((d) => row(`자미두수 대한 ${d}`, dScores[d])),
      row('자미두수 대한 종합(평균 단계)', avgs),
      row('사주 대운 점수', daeunScores),
      '',
      '## 표본에서의 단계 비율 (보정에 쓴 표본 기준)',
      '',
      '| 구분 | −2 | −1 | 0 | +1 | +2 | 목표와의 최대 차이 |',
      '|---|---|---|---|---|---|---|',
      ...DOMAINS.map((d) => shareRow(`사주 ${d}`, sajuScores[d], sajuCuts[d])),
      ...DOMAINS.map((d) => shareRow(`자미두수 ${d}`, zScores[d], zCuts[d])),
      ...DOMAINS.map((d) => shareRow(`자미두수 대한 ${d}`, dScores[d], dCuts[d])),
      shareRow('자미두수 대한 종합', avgs.map((v) => Math.round(v * 100) / 100), ziweiPeriodCuts),
      shareRow('사주 대운', daeunScores, sajuPeriodCuts),
      '',
    ].join('\n');
    writeFileSync(new URL('../docs/generated/tongbyeon-calibration.md', import.meta.url), md);
    expect(true).toBe(true);
  }, 1_800_000);
});
