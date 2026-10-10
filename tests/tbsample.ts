// 통변 시험용 무작위 표본(고정 시드). 명반·사주·통변을 한 번만 만들어 여러 시험이 나눠 쓴다.
import { buildTongbyeon } from '../src/core/tongbyeon';
import type { Tongbyeon } from '../src/core/tongbyeon';
import type { Chart } from '../src/core/chart';
import { lunarJavascriptEngine } from '../src/core/saju';
import type { SajuChart } from '../src/core/saju';
import { makeChart, randomSolarDate, rng } from './helpers';

export interface TbCase {
  y: number;
  m: number;
  d: number;
  branch: number;
  gender: 'M' | 'F';
  chart: Chart;
  saju: SajuChart;
  tb: Tongbyeon;
}

export const sajuOfChart = (chart: Chart, gender: 'M' | 'F'): SajuChart =>
  lunarJavascriptEngine.compute({ instantUtcMs: chart.norm.instantUtcMs, clock: chart.norm.corrected ?? chart.norm.civil, hourKnown: true, gender, lateZi: 'next' });

const cache = new Map<string, TbCase[]>();

/** 1930~2030년 무작위 출생 n건. 같은 (n, seed, mode) 이면 같은 객체를 돌려준다 */
export const tbSample = (n: number, seed: number, mode: '5' | '7' = '5'): TbCase[] => {
  const key = `${n}|${seed}|${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(seed);
  const out: TbCase[] = [];
  for (let i = 0; i < n; i++) {
    const d = randomSolarDate(r, 1930, 2030);
    const branch = Math.floor(r() * 12);
    const gender = r() < 0.5 ? 'M' : 'F';
    const chart = makeChart(d.y, d.m, d.d, branch, gender);
    const saju = sajuOfChart(chart, gender);
    out.push({ ...d, branch, gender, chart, saju, tb: buildTongbyeon(chart, saju, { mode, todayYear: 2026 }) });
  }
  cache.set(key, out);
  return out;
};
