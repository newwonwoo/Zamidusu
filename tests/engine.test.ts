// V-01 포국 정합(R-01~R-03, U-08): 독립 구현(전통 구결) 대 래퍼(iztro) — 칸 단위 대조
import { describe, expect, it } from 'vitest';
import { leapMonthOfLunarYear, lunarToSolar, solarToLunar } from '../src/core/time';
import { branchIndex, mod } from '../src/core/ganzhi';
import { compareWithIndependent as compare, hourOfBranch, keyOf, makeChart, randomSolarDate, rng, solarLunarOf } from './helpers';

describe('V-01 포국 정합: 독립 구현 대 엔진', () => {
  it('무작위 900건(1900~2100, 음력 설 기준)에서 모든 대조 항목이 일치한다', () => {
    const r = rng(20261009);
    const failures: string[] = [];
    let compared = 0;
    for (let i = 0; i < 900; i++) {
      const { y, m, d } = randomSolarDate(r, 1900, 2100);
      if (y === 1900 && m < 2) continue;
      const hb = Math.floor(r() * 12);
      const gender = r() < 0.5 ? 'M' : 'F';
      const chart = makeChart(y, m, d, hb, gender);
      failures.push(...compare(`[${y}-${m}-${d} ${hb}시 ${gender}]`, chart, keyOf(y, m, d, hb, 'lunarNewYear'), gender));
      compared++;
    }
    expect(compared).toBeGreaterThan(850);
    expect(failures.slice(0, 20)).toEqual([]);
  });

  it('입춘 기준(N-03) 300건도 연간·연지 계열이 입춘 기준 연주와 일치한다', () => {
    const r = rng(777);
    const failures: string[] = [];
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1900, 2100);
      if (y === 1900 && m < 2) continue;
      const hb = Math.floor(r() * 12);
      const gender = r() < 0.5 ? 'M' : 'F';
      const chart = makeChart(y, m, d, hb, gender, { yearBasis: 'ipchun' });
      failures.push(...compare(`[입춘 ${y}-${m}-${d} ${hb}시 ${gender}]`, chart, keyOf(y, m, d, hb, 'ipchun'), gender));
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });

  it('윤달 날짜(1900~2100의 모든 윤달 20일, 후반 보정 포함)에서도 일치한다', () => {
    const failures: string[] = [];
    let n = 0;
    for (let ly = 1901; ly <= 2099; ly++) {
      const lm = leapMonthOfLunarYear(ly);
      if (!lm) continue;
      const s = lunarToSolar(ly, lm, true, 20);
      if (!s) continue;
      const chart = makeChart(s.y, s.m, s.d, 5, 'F');
      failures.push(...compare(`[윤${lm}월 ${ly}]`, chart, keyOf(s.y, s.m, s.d, 5, 'lunarNewYear'), 'F'));
      n++;
    }
    expect(n).toBeGreaterThan(60);
    expect(failures.slice(0, 20)).toEqual([]);
  });

  it('T6(1990-01-30 12시 남): 원장 R-05 — 설 기준 庚午·水二局, 입춘 기준 己巳·金四局', () => {
    const a = makeChart(1990, 1, 30, 6, 'M');
    expect(a.meta.fiveElements.hanja).toBe('水二局');
    expect(a.meta.soulBranch).toBe(branchIndex('申'));
    expect(a.meta.yearMutagens.map((m) => m.star)).toEqual(['太陽', '武曲', '太陰', '天同']); // 庚
    const b = makeChart(1990, 1, 30, 6, 'M', { yearBasis: 'ipchun' });
    expect(b.meta.fiveElements.hanja).toBe('金四局');
    expect(b.meta.yearMutagens.map((m) => m.star)).toEqual(['武曲', '貪狼', '天梁', '文曲']); // 己
  });

  it('두 달력 라이브러리의 음력 날짜가 표본에서 일치한다(엔진 달력 = 사주 달력)', () => {
    const r = rng(5);
    for (let i = 0; i < 400; i++) {
      const { y, m, d } = randomSolarDate(r, 1900, 2100);
      if (y === 1900 && m < 2) continue;
      const a = solarToLunar({ y, m, d });
      const l = solarLunarOf(y, m, d);
      expect([a.year, a.month, a.leap, a.day]).toEqual([l.getYear(), Math.abs(l.getMonth()), l.getMonth() < 0, l.getDay()]);
    }
  });

  it('도메인 사실: 같은 달의 d일과 d+24일은 명반이 완전히 같다(역산 입력 안내의 근거)', () => {
    // 음력 1990년 1월 4일 = 양력 1990-01-30, 28일 = 양력 1990-02-23
    const a = makeChart(1990, 1, 30, 6, 'M');
    const b = makeChart(1990, 2, 23, 6, 'M');
    expect(solarToLunar({ y: 1990, m: 2, d: 23 })).toMatchObject({ month: 1, day: 28 });
    for (let br = 0; br < 12; br++) {
      expect(b.palaces[br].stars.map((s) => s.key + (s.brightness ?? '') + (s.mutagen ?? ''))).toEqual(
        a.palaces[br].stars.map((s) => s.key + (s.brightness ?? '') + (s.mutagen ?? '')),
      );
    }
  });

  it('시진·지지 변환 보조: hourOfBranch 가 의도한 시진으로 정규화된다', () => {
    for (let b = 0; b < 12; b++) {
      const c = makeChart(2000, 6, 15, b);
      expect(c.meta.timeBranch).toBe(b);
      expect(mod(hourOfBranch(b), 24)).toBeLessThan(24);
    }
  });
});
