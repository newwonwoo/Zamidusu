// V-06 시각 보정(I-06, I-07, U-06) · V-07 입력 검증(F-01, I-08)
import { describe, expect, it } from 'vitest';
import {
  civilToUtcMs, equationOfTimeMinutes, isDstAt, leapMonthOfLunarYear, lunarMonthDays, lunarToSolar, normalizeBirth, tzOffsetMinutes,
} from '../src/core/time';
import type { TimeSettings } from '../src/core/time';
import { inputOf } from './helpers';

const TRUE: TimeSettings = { correction: 'true', lateZi: 'next', compat: false };
const LMT: TimeSettings = { correction: 'lmt', lateZi: 'next', compat: false };
const COMPAT: TimeSettings = { correction: 'true', lateZi: 'next', compat: true };

const ok = (r: ReturnType<typeof normalizeBirth>) => {
  if (!r.ok) throw new Error(r.errors.join(' / '));
  return r.value;
};

describe('균시차·표준시 이력', () => {
  it('균시차가 알려진 값과 ±1분 이내로 맞는다', () => {
    const at = (m: number, d: number) => equationOfTimeMinutes(Date.UTC(2023, m - 1, d, 12, 0, 0));
    expect(at(2, 11)).toBeCloseTo(-14.2, 0);
    expect(at(11, 3)).toBeCloseTo(16.4, 0);
    expect(Math.abs(at(4, 15))).toBeLessThan(1.2);
    expect(Math.abs(at(6, 13))).toBeLessThan(1.2);
    expect(Math.abs(at(9, 1))).toBeLessThan(1.5);
    expect(Math.abs(at(12, 25))).toBeLessThan(1.2);
  });

  it('한국 표준시 이력을 시간대 데이터에서 읽는다(1954~61 UTC+8:30, 서머타임 구간)', () => {
    const off = (y: number, m: number, d: number) => tzOffsetMinutes('Asia/Seoul', Date.UTC(y, m - 1, d, 3, 0, 0));
    expect(off(1990, 3, 10)).toBe(540);
    expect(off(1962, 1, 1)).toBe(540);
    expect(off(1958, 1, 15)).toBe(510); // UTC+8:30
    expect(off(1958, 7, 15)).toBe(570); // UTC+8:30 + 서머타임 1시간
    expect(off(1988, 7, 15)).toBe(600); // 1987~88 서머타임
    expect(isDstAt('Asia/Seoul', Date.UTC(1988, 6, 15))).toBe(true);
    expect(isDstAt('Asia/Seoul', Date.UTC(1988, 0, 15))).toBe(false);
    expect(isDstAt('Asia/Seoul', Date.UTC(1990, 6, 15))).toBe(false);
  });

  it('civilToUtc 는 오프셋을 정확히 되돌린다', () => {
    const utc = civilToUtcMs('Asia/Seoul', { y: 1990, m: 3, d: 10, h: 13, mi: 10 });
    expect(new Date(utc).toISOString()).toBe('1990-03-10T04:10:00.000Z');
  });
});

describe('V-06 출생지 보정(T5, I-07)', () => {
  it('T5: 1990-03-10 13:10, 서울 — 진태양시는 午시(12시대)로 넘어가고 표준시는 未시다', () => {
    const std = ok(normalizeBirth(inputOf(1990, 3, 10, 13), TRUE));
    expect(std.timeIndex).toBe(7); // 未 (보정 없음 = 사이트의 사실상 동작, I-07)
    const seoul = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10, placeId: '특별·광역시-서울' }), TRUE));
    expect(seoul.corrected).toMatchObject({ y: 1990, m: 3, d: 10, h: 12 });
    expect(seoul.timeIndex).toBe(6); // 午
    expect(seoul.correction!.longitudeMinutes).toBeCloseTo(-32.08, 1);
    expect(seoul.correction!.eotMinutes).toBeCloseTo(-10.6, 0);
  });

  it('경도 보정(평균태양시)은 균시차를 더하지 않는다', () => {
    const v = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10, placeId: '특별·광역시-서울' }), LMT));
    expect(v.correction!.eotMinutes).toBe(0);
    expect(v.corrected).toMatchObject({ h: 12, mi: 37 });
  });

  it('1958년 1월 서울은 −2분 안팎이다 — 사이트의 “서울 −2분”은 UTC+8:30(127.5°) 시기에만 맞는 값이라는 원장의 추정과 일치', () => {
    const v = ok(normalizeBirth(inputOf(1958, 1, 15, 12, 'M', { placeId: '특별·광역시-서울' }), LMT));
    expect(v.correction!.longitudeMinutes).toBeCloseTo(-2.08, 1);
    const v90 = ok(normalizeBirth(inputOf(1990, 1, 15, 12, 'M', { placeId: '특별·광역시-서울' }), LMT));
    expect(v90.correction!.longitudeMinutes).toBeCloseTo(-32.08, 1);
  });

  it('서머타임 기간(1988-07)은 시계가 1시간 빠르므로 보정량이 커지고 안내가 붙는다', () => {
    const v = ok(normalizeBirth(inputOf(1988, 7, 15, 14, 'M', { placeId: '특별·광역시-서울' }), LMT));
    expect(v.correction!.dst).toBe(true);
    expect(v.correction!.longitudeMinutes).toBeCloseTo(126.98 * 4 - 600, 1);
    expect(v.notes.some((n) => n.includes('서머타임'))).toBe(true);
  });

  it('보정으로 날짜가 넘어가면 날짜도 함께 넘긴다(부산 00:20 → 전날 23시대)', () => {
    const v = ok(normalizeBirth(inputOf(1990, 3, 10, 0, 'M', { minute: 20, placeId: '특별·광역시-부산' }), TRUE));
    expect(v.corrected).toMatchObject({ d: 9, h: 23 });
    expect(v.lateZi).toBe(true);
    // 23시대는 다음 날 자시로 이월 → 엔진 날짜는 3월 10일, 시진 子
    expect(v.engineDate).toEqual({ y: 1990, m: 3, d: 10 });
    expect(v.timeIndex).toBe(0);
    expect(v.notes.length).toBeGreaterThanOrEqual(2);
  });

  it('해외 출생: 뉴욕 1990-03-10 13:10(EST)은 경도·시계 오프셋으로 계산한다', () => {
    const v = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10, placeId: '해외·북미-뉴욕' }), LMT));
    expect(v.correction!.longitudeMinutes).toBeCloseTo(-74.01 * 4 + 300, 1);
  });

  it('직접 입력 경도를 쓸 수 있다', () => {
    const v = ok(normalizeBirth(inputOf(2000, 6, 1, 12, 'M', { placeId: 'custom', customLon: 120, customTz: 'Asia/Seoul' }), LMT));
    expect(v.correction!.longitudeMinutes).toBeCloseTo(120 * 4 - 540, 5);
  });

  it('호환 모드(근사): 서울 13:10 은 −2분이라 표준시와 같은 未시, 해외출생 −30분은 午시', () => {
    const std = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10 }), COMPAT));
    const seoul = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10, placeId: '특별·광역시-서울' }), COMPAT));
    const abroad = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10, placeId: 'abroad' }), COMPAT));
    expect(std.timeIndex).toBe(7);
    expect(seoul.timeIndex).toBe(7);
    expect(seoul.correction!.deltaMinutes).toBe(-2);
    expect(abroad.timeIndex).toBe(6);
    expect(abroad.correction!.deltaMinutes).toBe(-30);
  });
});

describe('자시 처리(U-07)', () => {
  it('23:30 — 익일 자시: 날짜를 하루 넘기고 子시', () => {
    const v = ok(normalizeBirth(inputOf(2000, 2, 28, 23, 'M', { minute: 30 }), { correction: 'none', lateZi: 'next', compat: false }));
    expect(v.engineDate).toEqual({ y: 2000, m: 2, d: 29 });
    expect(v.timeIndex).toBe(0);
    expect(v.shiftedDay).toBe(true);
  });
  it('23:30 — 당일 자시: 날짜 유지, 子시', () => {
    const v = ok(normalizeBirth(inputOf(2000, 2, 28, 23, 'M', { minute: 30 }), { correction: 'none', lateZi: 'current', compat: false }));
    expect(v.engineDate).toEqual({ y: 2000, m: 2, d: 28 });
    expect(v.timeIndex).toBe(0);
    expect(v.shiftedDay).toBe(false);
  });
  it('연말 23:30 은 해를 넘겨 이월한다', () => {
    const v = ok(normalizeBirth(inputOf(1999, 12, 31, 23, 'M', { minute: 59 }), { correction: 'none', lateZi: 'next', compat: false }));
    expect(v.engineDate).toEqual({ y: 2000, m: 1, d: 1 });
  });
  it('00시대는 早子로 보고 날짜를 넘기지 않는다', () => {
    const v = ok(normalizeBirth(inputOf(2000, 3, 1, 0, 'M', { minute: 10 }), { correction: 'none', lateZi: 'next', compat: false }));
    expect(v.engineDate).toEqual({ y: 2000, m: 3, d: 1 });
    expect(v.timeIndex).toBe(0);
  });
});

describe('V-07 입력 검증', () => {
  const S: TimeSettings = { correction: 'none', lateZi: 'next', compat: false };
  it('존재하지 않는 양력 날짜를 거절한다', () => {
    const r = normalizeBirth(inputOf(2023, 2, 29, 12), S);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('28일');
  });
  it('윤년 2월 29일은 허용한다', () => {
    expect(normalizeBirth(inputOf(2024, 2, 29, 12), S).ok).toBe(true);
  });
  it('범위(1900-02-01 ~ 2100-12-31) 밖을 거절하고, 호환 모드는 1927~2026만 허용한다(I-08)', () => {
    expect(normalizeBirth(inputOf(1899, 12, 31, 12), S).ok).toBe(false);
    expect(normalizeBirth(inputOf(1900, 1, 15, 12), S).ok).toBe(false);
    expect(normalizeBirth(inputOf(1900, 2, 1, 12), S).ok).toBe(true);
    expect(normalizeBirth(inputOf(2101, 1, 1, 12), S).ok).toBe(false);
    expect(normalizeBirth(inputOf(1926, 5, 5, 12), { ...S, compat: true }).ok).toBe(false);
    expect(normalizeBirth(inputOf(1927, 5, 5, 12), { ...S, compat: true }).ok).toBe(true);
    expect(normalizeBirth(inputOf(2027, 5, 5, 12), { ...S, compat: true }).ok).toBe(false);
  });
  it('음력: 없는 윤달·29일뿐인 달의 30일을 안내와 함께 거절한다', () => {
    expect(leapMonthOfLunarYear(1991)).toBe(0);
    const noLeap = normalizeBirth(inputOf(1991, 5, 5, 12, 'M', { calendar: 'lunar', leap: true }), S);
    expect(noLeap.ok).toBe(false);
    if (!noLeap.ok) expect(noLeap.errors[0]).toContain('윤5월이 없습니다');
    // 1990년에는 윤5월이 실제로 있다(양성 확인) — 있는 해에서 다른 윤달을 고르면 윤달 안내가 붙는다
    expect(leapMonthOfLunarYear(1990)).toBe(5);
    expect(normalizeBirth(inputOf(1990, 5, 5, 12, 'M', { calendar: 'lunar', leap: true }), S).ok).toBe(true);
    const wrongLeap = normalizeBirth(inputOf(1990, 6, 5, 12, 'M', { calendar: 'lunar', leap: true }), S);
    expect(wrongLeap.ok).toBe(false);
    if (!wrongLeap.ok) expect(wrongLeap.errors[0]).toContain('이 해의 윤달은 윤5월');
    // 2020년은 윤4월이 있다
    expect(leapMonthOfLunarYear(2020)).toBe(4);
    expect(normalizeBirth(inputOf(2020, 4, 10, 12, 'M', { calendar: 'lunar', leap: true }), S).ok).toBe(true);
    // 29일뿐인 달 찾기
    let found = false;
    for (let m = 1; m <= 12 && !found; m++) {
      if (lunarMonthDays(1990, m, false) === 29) {
        found = true;
        const r = normalizeBirth(inputOf(1990, m, 30, 12, 'M', { calendar: 'lunar' }), S);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0]).toContain('29일까지');
      }
    }
    expect(found).toBe(true);
  });
  it('음력 입력은 양력으로 환산한다(음력 1990-1-4 = 양력 1990-1-30)', () => {
    const v = ok(normalizeBirth(inputOf(1990, 1, 4, 12, 'M', { calendar: 'lunar' }), S));
    expect(v.civil).toMatchObject({ y: 1990, m: 1, d: 30 });
    expect(lunarToSolar(1990, 1, false, 4)).toEqual({ y: 1990, m: 1, d: 30 });
  });
  it('시를 모르면(null) 보정·시진 없이 날짜만 정규화한다', () => {
    const v = ok(normalizeBirth(inputOf(1990, 1, 30, null), S));
    expect(v.hourKnown).toBe(false);
    expect(v.timeIndex).toBeNull();
    expect(v.corrected).toBeNull();
  });
  it('시·분·경도 범위 오류를 모아서 알려 준다', () => {
    const r = normalizeBirth(inputOf(1990, 1, 30, 25, 'M', { minute: 61 }), S);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(2);
    const r2 = normalizeBirth(inputOf(1990, 1, 30, 12, 'M', { placeId: 'custom', customLon: 200 }), S);
    expect(r2.ok).toBe(false);
  });
});
