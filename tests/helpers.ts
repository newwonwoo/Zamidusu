import { Solar } from '../src/core/lunarlib';
import { independentChart, independentDecades } from '../src/core/independent';
import type { LunarKey } from '../src/core/independent';
import { MUTAGENS } from '../src/core/names';
import { BRANCHES, STEMS, branchIndex, mod, stemIndex } from '../src/core/ganzhi';
import { DEFAULT_CHART_OPTIONS, buildChart } from '../src/core/chart';
import type { Chart, ChartOptions } from '../src/core/chart';
import { normalizeBirth, solarToLunar } from '../src/core/time';
import type { BirthInput, Gender, LunarBasis, TimeSettings } from '../src/core/time';

export const NO_CORRECTION: TimeSettings = { correction: 'none', lateZi: 'next', compat: false };

/** 고정 시드 난수(재현 가능한 표본) */
export const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export const randomSolarDate = (r: () => number, from = 1900, to = 2100): { y: number; m: number; d: number } => {
  const start = Date.UTC(from === 1900 ? 1900 : from, from === 1900 ? 1 : 0, from === 1900 ? 1 : 1);
  const end = Date.UTC(to, 11, 31);
  const t = new Date(start + Math.floor(r() * (end - start)));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

export const hourOfBranch = (branch: number): number => (branch === 0 ? 0 : branch * 2);

export const inputOf = (
  y: number, m: number, d: number, hour: number | null, gender: Gender = 'M',
  extra: Partial<BirthInput> = {},
): BirthInput => ({
  calendar: 'solar', leap: false, year: y, month: m, day: d, hour, minute: 0, gender, placeId: 'standard', ...extra,
});

export const makeChart = (
  y: number, m: number, d: number, branch: number, gender: Gender = 'M',
  options: Partial<ChartOptions> = {}, settings: TimeSettings = NO_CORRECTION,
): Chart => {
  const r = normalizeBirth(inputOf(y, m, d, hourOfBranch(branch), gender), settings);
  if (!r.ok) throw new Error(`입력 오류: ${r.errors.join(' / ')} (${y}-${m}-${d})`);
  return buildChart(r.value, { ...DEFAULT_CHART_OPTIONS, ...options });
};

export const solarLunarOf = (y: number, m: number, d: number) => Solar.fromYmd(y, m, d).getLunar();

/**
 * 엔진 날짜에서 독립 구현의 입력(LunarKey)을 만든다.
 * 'china' 는 lunar-javascript 로 따로 구하고, 'korea' 는 한국 음력 표(검증은 tests/lunarkr.test.ts 가 한국천문연구원 자료와 대조)에서 구한다.
 * 입춘 기준 연주는 날짜 단위(라이브러리 값)다 — 입춘 당일 전후는 tests/yearbasis.test.ts 가 따로 검증한다.
 */
export const keyOf = (
  y: number, m: number, d: number, hourBranch: number, basis: 'lunarNewYear' | 'ipchun', calendar: LunarBasis = 'korea',
): LunarKey => {
  const l = solarLunarOf(y, m, d);
  let lunarYear: number;
  let lunarMonth: number;
  let leap: boolean;
  let day: number;
  if (calendar === 'korea') {
    const k = solarToLunar({ y, m, d }, 'korea');
    ({ year: lunarYear, month: lunarMonth, leap, day } = k);
  } else {
    lunarYear = l.getYear();
    lunarMonth = Math.abs(l.getMonth());
    leap = l.getMonth() < 0;
    day = l.getDay();
  }
  let month = lunarMonth;
  if (leap && day > 15) month = lunarMonth === 12 ? 1 : lunarMonth + 1; // 윤달 후반 보정(기본 설정)
  const gan = basis === 'ipchun' ? l.getYearGanByLiChun() : STEMS[mod(lunarYear - 4, 10)];
  const zhi = basis === 'ipchun' ? l.getYearZhiByLiChun() : BRANCHES[mod(lunarYear - 4, 12)];
  return { yearStem: stemIndex(gan), yearBranch: branchIndex(zhi), month, day, hourBranch };
};

export const positionOf = (chart: Chart, key: string): number | undefined =>
  chart.palaces.find((p) => p.stars.some((s) => s.key === key))?.branch;

/** 독립 구현과 명반을 대조해 불일치 항목 설명을 돌려준다. 빈 배열이면 완전 일치. */
export const compareWithIndependent = (tag: string, chart: Chart, k: LunarKey, gender: Gender): string[] => {
  const ind = independentChart(k, gender);
  const bad: string[] = [];
  const chk = (name: string, got: unknown, want: unknown): void => {
    if (got !== want) bad.push(`${tag} ${name}: 엔진=${String(got)} 독립=${String(want)}`);
  };
  chk('명궁', chart.meta.soulBranch, ind.soul);
  chk('신궁', chart.meta.bodyBranch, ind.body);
  chk('오행국', chart.meta.fiveElements.num, ind.fiveClass);
  for (const [star, branch] of Object.entries(ind.stars)) chk(star, positionOf(chart, star), branch);
  ind.mutagens.forEach((m, i) => {
    const got = chart.meta.yearMutagens[i];
    chk(`사화${MUTAGENS[i]}`, got ? `${got.star}/${got.mutagen}` : '없음', `${m.star}/${m.mutagen}`);
  });
  chk('대한방향', chart.meta.decadalForward, ind.decadalForward);
  chk('첫대한나이', chart.meta.firstDecadalAge, ind.firstDecadalAge);
  for (const dec of independentDecades(ind)) {
    const p = chart.palaces[dec.branch];
    chk(`대한구간@${dec.branch}`, `${p.decadalRange[0]}-${p.decadalRange[1]}`, `${dec.from}-${dec.to}`);
  }
  chk('연간', chart.meta.yearStem, k.yearStem);
  chk('연지', chart.meta.yearBranch, k.yearBranch);
  return bad;
};
