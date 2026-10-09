// 입춘 기준 연주(N-03) 회귀 검증.
// 배경: 엔진(iztro → lunar-lite)은 입춘 기준 연주를 '날짜' 단위로만 판정해 입춘 당일에는 절입 시각 전이어도 새해로 본다.
// 그래서 lunar-lite 를 패치(patches/README.md)해 출생 순간으로 정한 연주를 쓰게 했다.
// 이 파일은 (1) 패치가 적용돼 있는지 (2) 사주 연주와 같은 해로 판정되는지 (3) 범위 밖으로 새지 않는지를 확인한다.

import { astro } from 'iztro';
import { getHeavenlyStemAndEarthlyBranchBySolarDate, setBirthYearOverride } from 'lunar-lite';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHART_OPTIONS, buildChart } from '../src/core/chart';
import { BRANCHES, STEMS, mod } from '../src/core/ganzhi';
import { wallInZone } from '../src/core/format';
import { Solar } from '../src/core/lunarlib';
import { lunarJavascriptEngine } from '../src/core/saju';
import { ipchunYearOf, termTime } from '../src/core/solarterms';
import { normalizeBirth } from '../src/core/time';
import { NO_CORRECTION, inputOf, makeChart, rng } from './helpers';

const TZ = 'Asia/Seoul';
const MIN = 60_000;
const ganzhiOfYear = (y: number): string => STEMS[mod(y - 4, 10)] + BRANCHES[mod(y - 4, 12)];

/** 한국 시계로 y-m-d h:mi 에 태어난 사람의 입춘 기준 명반 연주(간지)와 사주 연주 */
const yearsAt = (y: number, m: number, d: number, h: number, mi: number) => {
  const r = normalizeBirth(inputOf(y, m, d, h, 'M', { minute: mi }), NO_CORRECTION);
  if (!r.ok) throw new Error(r.errors.join(' / '));
  const chart = buildChart(r.value, { ...DEFAULT_CHART_OPTIONS, yearBasis: 'ipchun' });
  const saju = lunarJavascriptEngine.compute({ instantUtcMs: r.value.instantUtcMs, clock: r.value.civil, hourKnown: true, gender: 'M', lateZi: 'next' });
  return { chart: STEMS[chart.meta.yearStem] + BRANCHES[chart.meta.yearBranch], saju: saju.year.ganzhi, norm: r.value };
};

describe('입춘 기준 연주 — 패치와 정확도', () => {
  it('lunar-lite 패치가 적용되어 있고, 지정한 날짜의 입춘 기준 연주에만 작용한다 (postinstall: scripts/apply-patches.mjs)', () => {
    // 이 테스트가 실패하면 npm install 을 --ignore-scripts 로 했는지 확인하라.
    expect(typeof setBirthYearOverride).toBe('function');
    const read = (date: string, basis: 'exact' | 'normal') =>
      getHeavenlyStemAndEarthlyBranchBySolarDate(date, 5, { year: basis }).yearly.join('');
    // 2024-02-12 는 설날(2/10) 이후이고 입춘(2/4) 이후라 두 기준 모두 甲辰
    expect(read('2024-2-12', 'exact')).toBe('甲辰');
    expect(read('2024-2-12', 'normal')).toBe('甲辰');
    setBirthYearOverride({ year: 2024, month: 2, date: 12, gan: '癸', zhi: '卯' });
    try {
      expect(read('2024-2-12', 'exact')).toBe('癸卯'); // 같은 날짜 + 입춘 기준 → 덮어씀
      expect(read('2024-2-12', 'normal')).toBe('甲辰'); // 음력 설 기준은 그대로
      expect(read('2024-2-13', 'exact')).toBe('甲辰'); // 다른 날짜는 그대로
    } finally {
      setBirthYearOverride(null);
    }
    expect(read('2024-2-12', 'exact')).toBe('甲辰'); // 해제 후 원래대로
  });

  it('고정 사례: 2024 입춘(2월 4일 16:27 중국 표준시 = 한국 17:27)의 전후', () => {
    const t = wallInZone(termTime(2024, '立春'), TZ);
    expect([t.y, t.m, t.d, t.h, t.mi]).toEqual([2024, 2, 4, 17, 27]);
    // 절입 30분 전 → 전년(癸卯), 30분 후 → 새해(甲辰). 엔진이 날짜로만 보면 앞의 값이 틀린다.
    expect(yearsAt(2024, 2, 4, 16, 57)).toMatchObject({ chart: '癸卯', saju: '癸卯' });
    expect(yearsAt(2024, 2, 4, 17, 57)).toMatchObject({ chart: '甲辰', saju: '甲辰' });
    // 같은 날 새벽(한국 0시 10분)은 중국 표준시로는 전날 23시 10분 — 어느 쪽으로 보아도 전년
    expect(yearsAt(2024, 2, 4, 0, 10)).toMatchObject({ chart: '癸卯', saju: '癸卯' });
    expect(yearsAt(2024, 2, 3, 12, 0)).toMatchObject({ chart: '癸卯', saju: '癸卯' });
    expect(yearsAt(2024, 2, 5, 12, 0)).toMatchObject({ chart: '甲辰', saju: '甲辰' });
  });

  it('고정 사례: 한국 시계와 중국 표준시의 날짜가 어긋나는 입춘(2021, 한국 2월 3일 23:59)', () => {
    const t = wallInZone(termTime(2021, '立春'), TZ);
    expect([t.y, t.m, t.d, t.h]).toEqual([2021, 2, 3, 23]);
    // 23시대 출생은 기본 설정(익일 자시)에서 엔진 날짜가 2월 4일로 넘어가지만, 절입(23:59) 전이므로 전년(庚子)
    const late = yearsAt(2021, 2, 3, 23, 30);
    expect(late.norm.engineDate).toEqual({ y: 2021, m: 2, d: 4 });
    expect(late).toMatchObject({ chart: '庚子', saju: '庚子' });
    expect(yearsAt(2021, 2, 4, 0, 30)).toMatchObject({ chart: '辛丑', saju: '辛丑' });
    expect(yearsAt(2021, 2, 3, 12, 0)).toMatchObject({ chart: '庚子', saju: '庚子' });
  });

  it('절입 시각 ±25시간 안의 아홉 지점에서 명반 연주 = 사주 연주 (1952~2048, 4년 간격)', () => {
    const offsets = [-1500, -600, -90, -1, 0, 1, 90, 600, 1500];
    const bad: string[] = [];
    let n = 0;
    for (let y = 1952; y <= 2048; y += 4) {
      const term = termTime(y, '立春');
      for (const off of offsets) {
        const w = wallInZone(term + off * MIN, TZ);
        const r = yearsAt(w.y, w.m, w.d, w.h, w.mi);
        n++;
        const want = ganzhiOfYear(ipchunYearOf(r.norm.instantUtcMs));
        if (r.chart !== r.saju || r.chart !== want) bad.push(`${y} ${off >= 0 ? '+' : ''}${off}분 (${w.m}/${w.d} ${w.h}:${String(w.mi).padStart(2, '0')}) 명반=${r.chart} 사주=${r.saju} 기대=${want}`);
      }
    }
    expect(n).toBe(25 * offsets.length);
    expect(bad).toEqual([]);
  });

  it('임의의 시각 3,000건: 입춘 기준 해(ipchunYearOf)가 lunar-javascript 의 정밀 연주와 같다', () => {
    const r = rng(20240204);
    const lo = Date.UTC(1900, 0, 1);
    const hi = Date.UTC(2100, 11, 30);
    const bad: string[] = [];
    for (let i = 0; i < 3000; i++) {
      const t = lo + Math.floor(r() * (hi - lo));
      const b = new Date(t + 8 * 3600_000);
      const want = Solar.fromYmdHms(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(), b.getUTCHours(), b.getUTCMinutes(), b.getUTCSeconds())
        .getLunar().getEightChar().getYear();
      const got = ganzhiOfYear(ipchunYearOf(t));
      if (got !== want) bad.push(`${new Date(t).toISOString()} 계산=${got} 라이브러리=${want}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('입춘 기준 연주 — 범위와 부작용', () => {
  it('덮어쓰기가 계산이 끝나면 풀려 다른 호출에 새지 않는다', () => {
    const call = () => getHeavenlyStemAndEarthlyBranchBySolarDate('2024-2-4', 5, { year: 'exact' }).yearly.join('');
    const before = call();
    const inside = yearsAt(2024, 2, 4, 10, 0); // 입춘 당일 오전: 전년으로 덮어쓴다
    expect(inside.chart).toBe('癸卯');
    expect(call()).toBe(before);
    // 기본 모드(음력 설 기준)의 같은 날짜도 영향이 없다
    const lny = makeChart(2024, 2, 4, 5, 'M', { yearBasis: 'lunarNewYear' });
    expect(STEMS[lny.meta.yearStem] + BRANCHES[lny.meta.yearBranch]).toBe('癸卯');
  });

  it('계산 중 예외가 나도 덮어쓰기가 풀린다', () => {
    const call = () => getHeavenlyStemAndEarthlyBranchBySolarDate('2024-2-4', 5, { year: 'exact' }).yearly.join('');
    const before = call();
    const r = normalizeBirth(inputOf(2024, 2, 4, 10, 'M'), NO_CORRECTION);
    if (!r.ok) throw new Error('입력 오류');
    // timeIndex 가 범위를 벗어나면 엔진이 예외를 던질 수 있다 — 어떻든 이후 호출은 원래대로여야 한다
    try {
      buildChart({ ...r.value, timeIndex: 99 }, { ...DEFAULT_CHART_OPTIONS, yearBasis: 'ipchun' });
    } catch {
      /* 예외 여부는 중요하지 않다 */
    }
    expect(call()).toBe(before);
  });

  it('입춘에서 먼 날짜는 패치 전과 같다: 엔진을 직접 부른 결과와 모든 별의 위치가 일치', () => {
    const r = rng(7);
    let compared = 0;
    for (let i = 0; i < 40; i++) {
      const y = 1950 + Math.floor(r() * 100);
      const m = 3 + Math.floor(r() * 9); // 3~11월 — 입춘(2월 초)과 멀다
      const d = 1 + Math.floor(r() * 28);
      const hb = Math.floor(r() * 12);
      const chart = makeChart(y, m, d, hb, 'F', { yearBasis: 'ipchun' });
      astro.config({ yearDivide: 'exact', horoscopeDivide: 'exact', ageDivide: 'normal', dayDivide: 'current', algorithm: 'default' });
      const raw = astro.bySolar(`${y}-${m}-${d}`, hb, '女', true, 'zh-TW');
      const rawYear = raw.rawDates.chineseDate.yearly.join('');
      expect(STEMS[chart.meta.yearStem] + BRANCHES[chart.meta.yearBranch]).toBe(rawYear);
      expect(chart.meta.soulBranch).toBe(BRANCHES.indexOf(raw.earthlyBranchOfSoulPalace as (typeof BRANCHES)[number]));
      compared++;
    }
    expect(compared).toBe(40);
  });
});
