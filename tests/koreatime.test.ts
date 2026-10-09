// V-23 한국식 시각 기준(I-16): 시진을 :30 에 끊는다 — 동경 127.5° 기준, 한국 표준시(UTC+9)에서 30분을 뺀다.
//   자시 = 23:30~01:30, 오시 = 11:30~13:30. 1954~61년(UTC+8:30)에는 보정이 0이고 서머타임은 시간대 데이터로 반영된다.
//   “시계 시각 그대로(standard)”와 원본 호환 모드는 예전 동작 그대로다.
import { Solar } from '../src/core/lunarlib';
import { describe, expect, it } from 'vitest';
import { KOREA_ID, STANDARD_ID } from '../src/core/place';
import { branchOfClock, clockShiftOf, dayAdvanced, normalizeBirth, representativeClock, timeRangeLabel } from '../src/core/time';
import type { BirthInput, TimeSettings } from '../src/core/time';
import { computeOutcome } from '../src/ui/compute';
import { defaultForm, defaultSettings, formFromLocation, formToQuery, queryToForm, toBirthInput } from '../src/ui/state';
import { inputOf, rng } from './helpers';

const NEXT: TimeSettings = { correction: 'true', lateZi: 'next', compat: false };
const CURRENT: TimeSettings = { correction: 'true', lateZi: 'current', compat: false };
const COMPAT: TimeSettings = { correction: 'true', lateZi: 'next', compat: true };

const ok = (r: ReturnType<typeof normalizeBirth>) => {
  if (!r.ok) throw new Error(r.errors.join(' / '));
  return r.value;
};
const korea = (y: number, m: number, d: number, h: number, mi: number, extra: Partial<BirthInput> = {}): BirthInput =>
  inputOf(y, m, d, h, 'M', { minute: mi, placeId: KOREA_ID, ...extra });

/**
 * 독립 공식(표를 쓰지 않는 산술): 한국 표준시(UTC+9) 시계의 분(0~1439) → 한국식 시진.
 * 동경 127.5° 평균태양시 = 시계 − 30분, 그 시각에서 子 = 23:00~01:00 → (e + 60) 을 120분 단위로 나눈다.
 */
const koreanBranchAt = (minuteOfDay: number): number => {
  const e = (((minuteOfDay - 30) % 1440) + 1440) % 1440;
  return Math.floor(((e + 60) % 1440) / 120);
};
/** 시계 그대로(보정 없음)의 시진 */
const plainBranchAt = (minuteOfDay: number): number => Math.floor(((minuteOfDay + 60) % 1440) / 120);

describe('V-23 한국식 시각: 시진이 :30 에 바뀐다 (1440분 전수)', () => {
  it('1990-03-10(서머타임 아님) 하루 1440분 모두 독립 공식과 같은 시진이다', () => {
    const bad: string[] = [];
    for (let m = 0; m < 1440; m++) {
      const h = Math.floor(m / 60);
      const mi = m % 60;
      const v = ok(normalizeBirth(korea(1990, 3, 10, h, mi), NEXT));
      if (v.timeIndex !== koreanBranchAt(m)) bad.push(`${h}:${mi} → ${v.timeIndex} (기대 ${koreanBranchAt(m)})`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('경계: 11:29 는 巳, 11:30 은 午 / 13:29 는 午, 13:30 은 未 / 23:29 는 亥, 23:30 은 子', () => {
    const at = (h: number, mi: number) => ok(normalizeBirth(korea(1990, 3, 10, h, mi), NEXT)).timeIndex;
    expect([at(11, 29), at(11, 30), at(13, 29), at(13, 30)]).toEqual([5, 6, 6, 7]);
    expect([at(23, 29), at(23, 30), at(0, 29), at(0, 30), at(1, 29), at(1, 30)]).toEqual([11, 0, 0, 0, 0, 1]);
  });

  it('같은 입력을 “시계 시각 그대로”로 보면 정시(:00)에 바뀐다 — 예전 동작', () => {
    const bad: string[] = [];
    for (let m = 0; m < 1440; m++) {
      const v = ok(normalizeBirth(inputOf(1990, 3, 10, Math.floor(m / 60), 'M', { minute: m % 60, placeId: STANDARD_ID }), NEXT));
      if (v.timeIndex !== plainBranchAt(m)) bad.push(`${m}`);
    }
    expect(bad).toEqual([]);
  });

  it('보정 후 시각과 안내: 12:00 → 11:30, 보정량 −30분, 시계는 30분 앞선다', () => {
    const v = ok(normalizeBirth(korea(1990, 1, 30, 12, 0), NEXT));
    expect(v.corrected).toMatchObject({ y: 1990, m: 1, d: 30, h: 11, mi: 30 });
    expect(v.correction).toMatchObject({ mode: 'korea', deltaMinutes: -30, eotMinutes: 0 });
    expect(v.clockShiftMinutes).toBe(30);
    expect(v.timeIndex).toBe(6);
  });

  it('무작위 8,000건(1961-08-10 이후, 서머타임 제외): 시진·보정 후 시각이 독립 공식과 같다', () => {
    const r = rng(20261010);
    const bad: string[] = [];
    for (let i = 0; i < 8000; i++) {
      const y = 1962 + Math.floor(r() * 138); // 1962~2099
      if (y === 1987 || y === 1988) continue; // 서머타임 해는 아래에서 따로
      const m = 1 + Math.floor(r() * 12);
      const d = 1 + Math.floor(r() * 28);
      const minute = Math.floor(r() * 1440);
      const v = ok(normalizeBirth(korea(y, m, d, Math.floor(minute / 60), minute % 60), NEXT));
      if (v.timeIndex !== koreanBranchAt(minute)) bad.push(`${y}-${m}-${d} ${minute}: ${v.timeIndex}`);
      const e = (minute - 30 + 1440) % 1440;
      const c = v.corrected!;
      if (c.h * 60 + c.mi !== e) bad.push(`${y}-${m}-${d} ${minute}: 보정 후 ${c.h}:${c.mi}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });
});

describe('V-23 한국식 시각: 시간대 이력(1954~61 UTC+8:30, 서머타임)', () => {
  // 시계 12:00 에서 시계가 동경 127.5° 시각(UTC+8:30)보다 앞선 분 = 한국식 보정량의 절댓값. 시간대 이력은 공개 자료(tzdata)의 값이다.
  const cases: [string, number, number, number, number][] = [
    ['지방시 시기(1908-04-01 이전)는 표준시가 없어 보정 없음', 1900, 6, 1, 0],
    ['1908-04-01~1911-12-31 UTC+8:30', 1909, 6, 1, 0],
    ['1912~1953 UTC+9', 1930, 6, 1, 30],
    ['1948~51 서머타임 UTC+10', 1950, 7, 1, 90],
    ['1954-03-21 이후 UTC+8:30(서머타임 아닌 달)', 1956, 1, 1, 0],
    ['1955~60 서머타임 UTC+9:30', 1957, 6, 15, 60],
    ['1961-08-09(UTC+8:30의 마지막 날)', 1961, 8, 9, 0],
    ['1961-08-10(UTC+9로 복귀)', 1961, 8, 10, 30],
    ['1987~88 서머타임 UTC+10', 1987, 7, 1, 90],
    ['1988-07-01 서머타임', 1988, 7, 1, 90],
    ['1988-12-01 서머타임 끝난 뒤', 1988, 12, 1, 30],
    ['현재', 2026, 10, 10, 30],
  ];
  for (const [label, y, m, d, shift] of cases) {
    it(`${label}: ${y}-${m}-${d} 12:00 → 보정 −${shift}분`, () => {
      const v = ok(normalizeBirth(korea(y, m, d, 12, 0), NEXT));
      expect(v.clockShiftMinutes).toBe(shift);
      const c = v.corrected!;
      expect(c.h * 60 + c.mi).toBe(12 * 60 - shift);
    });
  }

  it('보정 후 시각은 언제나 동경 127.5° 평균태양시(= UTC + 8시간 30분)와 같다(1908-04-01 이후 무작위 3,000건)', () => {
    const r = rng(77);
    const bad: string[] = [];
    for (let i = 0; i < 3000; i++) {
      const y = 1909 + Math.floor(r() * 190);
      const m = 1 + Math.floor(r() * 12);
      const d = 1 + Math.floor(r() * 28);
      const minute = 60 + Math.floor(r() * 1320); // 01:00~22:59 — 날짜 이동·서머타임 전환 경계를 피한다
      const v = ok(normalizeBirth(korea(y, m, d, Math.floor(minute / 60), minute % 60), NEXT));
      const utc8h30 = new Date(v.instantUtcMs + 510 * 60000);
      const c = v.corrected!;
      const got = Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi);
      const want = Date.UTC(utc8h30.getUTCFullYear(), utc8h30.getUTCMonth(), utc8h30.getUTCDate(), utc8h30.getUTCHours(), utc8h30.getUTCMinutes());
      if (got !== want) bad.push(`${y}-${m}-${d} ${minute}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('서머타임 기간이면 안내가 붙는다', () => {
    const v = ok(normalizeBirth(korea(1988, 7, 1, 12, 0), NEXT));
    expect(v.correction!.dst).toBe(true);
    expect(v.notes.some((n) => n.includes('서머타임'))).toBe(true);
  });
});

describe('V-23 한국식 시각: 자시(23시대)와 날짜 이월', () => {
  it('익일 자시(기본): 23:30~23:59 는 다음 날 자시, 00:00~00:29 는 입력한 날짜의 자시', () => {
    const late = ok(normalizeBirth(korea(2000, 2, 28, 23, 40), NEXT));
    expect(late.engineDate).toEqual({ y: 2000, m: 2, d: 29 });
    expect(late.timeIndex).toBe(0);
    expect(late.lateZi).toBe(true);
    expect(late.shiftedDay).toBe(true);
    expect(dayAdvanced(late)).toBe(true); // 화면에 “다음 날 자시”

    const early = ok(normalizeBirth(korea(2000, 2, 29, 0, 10), NEXT));
    expect(early.engineDate).toEqual({ y: 2000, m: 2, d: 29 });
    expect(early.timeIndex).toBe(0);
    expect(early.corrected).toMatchObject({ d: 28, h: 23, mi: 40 });
    expect(dayAdvanced(early)).toBe(false); // 입력한 날짜 그대로이므로 “다음 날 자시”라고 하지 않는다
    // 보정으로 전날이 되지만 23시대는 다음 날로 보므로 날짜는 그대로 — 안내는 한 문장으로 설명한다
    expect(early.notes.filter((n) => n.includes('입력한 날짜의 자시')).length).toBe(1);
    expect(early.notes.some((n) => n.includes('날짜가') && n.includes('넘어갔습니다'))).toBe(false);
  });

  it('당일 자시(야자시): 23:30~23:59 는 입력한 날짜, 00:00~00:29 는 전날로 본다(보정 후 날짜)', () => {
    const late = ok(normalizeBirth(korea(2000, 2, 28, 23, 40), CURRENT));
    expect(late.engineDate).toEqual({ y: 2000, m: 2, d: 28 });
    expect(late.shiftedDay).toBe(false);
    const early = ok(normalizeBirth(korea(2000, 2, 29, 0, 10), CURRENT));
    expect(early.engineDate).toEqual({ y: 2000, m: 2, d: 28 });
    expect(early.notes.some((n) => n.includes('날짜가') && n.includes('넘어갔습니다'))).toBe(true);
  });

  it('00:30 이후는 이월이 없다(00:30 → 00:00 子의 시작)', () => {
    const v = ok(normalizeBirth(korea(2000, 3, 1, 0, 30), NEXT));
    expect(v.corrected).toMatchObject({ d: 1, h: 0, mi: 0 });
    expect(v.lateZi).toBe(false);
    expect(v.engineDate).toEqual({ y: 2000, m: 3, d: 1 });
  });

  it('연말·연초: 12-31 23:40 → 다음 해 1-1 자시, 1-1 00:10 → 1-1 자시', () => {
    expect(ok(normalizeBirth(korea(1999, 12, 31, 23, 40), NEXT)).engineDate).toEqual({ y: 2000, m: 1, d: 1 });
    expect(ok(normalizeBirth(korea(2000, 1, 1, 0, 10), NEXT)).engineDate).toEqual({ y: 2000, m: 1, d: 1 });
  });
});

describe('V-23 한국식 시각: 다른 기준과의 관계', () => {
  it('실제 순간(instantUtcMs)은 보정과 무관하다 — 연주·월주(절기)는 한국식에서도 같은 순간으로 판정한다', () => {
    const a = ok(normalizeBirth(korea(2024, 2, 4, 17, 40), NEXT));
    const b = ok(normalizeBirth(inputOf(2024, 2, 4, 17, 'M', { minute: 40, placeId: STANDARD_ID }), NEXT));
    expect(a.instantUtcMs).toBe(b.instantUtcMs);
  });

  it('“보정 안 함” 설정이면 한국식을 골라도 시계 그대로다(고급 설정의 스위치)', () => {
    const v = ok(normalizeBirth(korea(1990, 3, 10, 11, 20), { correction: 'none', lateZi: 'next', compat: false }));
    expect(v.corrected).toMatchObject({ h: 11, mi: 20 });
    expect(v.correction!.deltaMinutes).toBe(0);
    expect(v.timeIndex).toBe(6); // 午(시계 그대로 11시대)
    expect(v.clockShiftMinutes).toBe(0);
  });

  it('“시계 시각 그대로”는 설정과 무관하게 보정하지 않는다', () => {
    for (const correction of ['true', 'lmt', 'none'] as const) {
      const v = ok(normalizeBirth(inputOf(1990, 3, 10, 11, 'M', { minute: 20, placeId: STANDARD_ID }), { correction, lateZi: 'next', compat: false }));
      expect(v.corrected).toMatchObject({ h: 11, mi: 20 });
    }
  });

  it('한국식은 진태양시/평균태양시 설정과 상관없이 −30분이다(균시차를 더하지 않는다)', () => {
    const t = ok(normalizeBirth(korea(1990, 11, 3, 12, 0), { correction: 'true', lateZi: 'next', compat: false }));
    const l = ok(normalizeBirth(korea(1990, 11, 3, 12, 0), { correction: 'lmt', lateZi: 'next', compat: false }));
    expect(t.corrected).toEqual(l.corrected);
    expect(t.corrected).toMatchObject({ h: 11, mi: 30 });
  });

  it('도시를 고르면 그 도시의 경도로 보정한다(한국식과 다름) — 서울 1990-03-10 13:10 은 12:2x 로 午', () => {
    const seoul = ok(normalizeBirth(inputOf(1990, 3, 10, 13, 'M', { minute: 10, placeId: '특별·광역시-서울' }), NEXT));
    const k = ok(normalizeBirth(korea(1990, 3, 10, 13, 10), NEXT));
    expect(seoul.timeIndex).toBe(6);
    expect(k.timeIndex).toBe(6);
    expect(seoul.corrected).not.toEqual(k.corrected);
    expect(k.corrected).toMatchObject({ h: 12, mi: 40 });
  });

  it('원본 호환 모드는 한국식을 쓰지 않는다 — 표준시 0분 그대로(사이트 동작 재현)', () => {
    const v = ok(normalizeBirth(korea(1990, 3, 10, 13, 10), COMPAT));
    expect(v.corrected).toMatchObject({ h: 13, mi: 10 });
    expect(v.timeIndex).toBe(7);
    expect(v.clockShiftMinutes).toBe(0);
  });

  it('시를 모르면 보정 후 시각은 없지만, 그날 정오 기준의 시계 차이는 알려 준다(시 모름 표의 시간대 표기)', () => {
    const v = ok(normalizeBirth(korea(1990, 3, 10, 0, 0, { hour: null }), NEXT));
    expect(v.hourKnown).toBe(false);
    expect(v.clockShiftMinutes).toBe(30);
  });
});

describe('V-23 시진 표기(시계 시각 기준)', () => {
  it('한국식(30분): 子 23:30~01:30, 丑 01:30~03:30, … 午 11:30~13:30, … 亥 21:30~23:30', () => {
    const want = ['23:30~01:30', '01:30~03:30', '03:30~05:30', '05:30~07:30', '07:30~09:30', '09:30~11:30',
      '11:30~13:30', '13:30~15:30', '15:30~17:30', '17:30~19:30', '19:30~21:30', '21:30~23:30'];
    expect(Array.from({ length: 12 }, (_, b) => timeRangeLabel(b, 30))).toEqual(want);
  });
  it('보정이 없으면 예전 표기(23:00~01:00 …)', () => {
    expect(timeRangeLabel(0)).toBe('23:00~01:00');
    expect(timeRangeLabel(6)).toBe('11:00~13:00');
    expect(timeRangeLabel(11, 0)).toBe('21:00~23:00');
  });
  it('branchOfClock 는 독립 공식과 1440분 모두 같다(30분, 0분, 서머타임 90분)', () => {
    const bad: string[] = [];
    for (let m = 0; m < 1440; m++) {
      const h = Math.floor(m / 60);
      const mi = m % 60;
      if (branchOfClock(h, mi, 30) !== koreanBranchAt(m)) bad.push(`30:${m}`);
      if (branchOfClock(h, mi, 0) !== plainBranchAt(m)) bad.push(`0:${m}`);
      const e = (((m - 90) % 1440) + 1440) % 1440;
      if (branchOfClock(h, mi, 90) !== Math.floor(((e + 60) % 1440) / 120)) bad.push(`90:${m}`);
    }
    expect(bad).toEqual([]);
  });
  it('표기한 범위의 경계 시각을 실제로 넣으면 그 시진이다(12시진 × 시작·끝 직전)', () => {
    for (let b = 0; b < 12; b++) {
      const [s, e] = timeRangeLabel(b, 30).split('~');
      const [sh, sm] = s.split(':').map(Number);
      const [eh, em] = e.split(':').map(Number);
      expect(branchOfClock(sh, sm, 30), `${b} 시작`).toBe(b);
      const endMin = (eh * 60 + em - 1 + 1440) % 1440;
      expect(branchOfClock(Math.floor(endMin / 60), endMin % 60, 30), `${b} 끝 직전`).toBe(b);
    }
  });
  it('대표 시각: 시 모름에서 시진을 고를 때 경계에 걸리지 않게 한가운데로 채운다(한국식 12:30, 시계 그대로 12:00)', () => {
    expect(representativeClock(6, 30)).toEqual({ hour: 12, minute: 30 });
    expect(representativeClock(6, 0)).toEqual({ hour: 12, minute: 0 });
    expect(representativeClock(0, 30)).toEqual({ hour: 0, minute: 30 });
    for (const shift of [0, 30, 42, 90]) {
      for (let b = 0; b < 12; b++) {
        const t = representativeClock(b, shift);
        expect(branchOfClock(t.hour, t.minute, shift), `${b}/${shift}`).toBe(b);
      }
    }
  });
  it('입력 화면용 “시계 − 보정 후 시각”: 한국식 30, 시계 그대로 0, 서울 진태양시 3월은 약 41분', () => {
    expect(clockShiftOf(korea(1990, 3, 10, 0, 0), NEXT)).toBe(30);
    expect(clockShiftOf(inputOf(1990, 3, 10, 0, 'M', { placeId: STANDARD_ID }), NEXT)).toBe(0);
    expect(clockShiftOf(inputOf(1990, 3, 10, 0, 'M', { placeId: '특별·광역시-서울' }), NEXT)).toBeCloseTo(42.7, 0);
    // 날짜가 올바르지 않으면 기본 기준을 돌려준다
    expect(clockShiftOf(korea(1990, 2, 31, 0, 0), NEXT)).toBe(30);
  });
});

describe('V-23 화면과 같은 경로(computeOutcome): 명반·사주가 한국식 시각으로 일관된다', () => {
  const pipeline = (y: number, m: number, d: number, h: number, mi: number, lateZi: 'next' | 'current' = 'next') => {
    const form = { ...defaultForm(), year: y, month: m, day: d, hour: h, minute: mi };
    const settings = { ...defaultSettings(), lateZi };
    const res = computeOutcome(form, settings, false);
    if (!res.ok || res.outcome.kind !== 'chart') throw new Error('계산 실패');
    return res.outcome;
  };

  it('기본 입력(T6, 12:00)은 한국식이며 명반이 예전과 같다(午 · 명궁 申)', () => {
    const o = pipeline(1990, 1, 30, 12, 0);
    expect(o.norm.correction!.mode).toBe('korea');
    expect(o.chart.meta.timeBranch).toBe(6);
    expect(o.chart.palaces[o.chart.meta.soulBranch].ganzhi).toBe('甲申');
    expect(o.saju.hour!.ganzhi).toBe('壬午');
  });

  it('무작위 600건: 사주 시주의 지지 = 명반의 시진, 사주 일주 = 명반 날짜의 일주(익일/당일 자시 모두)', () => {
    const r = rng(4242);
    const bad: string[] = [];
    for (let i = 0; i < 600; i++) {
      const y = 1930 + Math.floor(r() * 120);
      const m = 1 + Math.floor(r() * 12);
      const d = 1 + Math.floor(r() * 28);
      const minute = Math.floor(r() * 1440);
      const lateZi = r() < 0.5 ? 'next' : 'current';
      const o = pipeline(y, m, d, Math.floor(minute / 60), minute % 60, lateZi);
      if (o.saju.hour!.branch !== o.chart.meta.timeBranch) bad.push(`${y}-${m}-${d} ${minute} ${lateZi}: 시지 ${o.saju.hour!.branch} ≠ ${o.chart.meta.timeBranch}`);
      const e = o.norm.engineDate;
      const dayGz = Solar.fromYmd(e.y, e.m, e.d).getLunar().getDayInGanZhi();
      if (o.saju.day.ganzhi !== dayGz) bad.push(`${y}-${m}-${d} ${minute} ${lateZi}: 일주 ${o.saju.day.ganzhi} ≠ ${dayGz}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('11:20 과 11:40 은 시진이 다르다 — 사시와 오시의 명반이 서로 다르다', () => {
    const a = pipeline(1990, 1, 30, 11, 20);
    const b = pipeline(1990, 1, 30, 11, 40);
    expect(a.chart.meta.timeBranch).toBe(5);
    expect(b.chart.meta.timeBranch).toBe(6);
    expect(a.chart.meta.soulBranch).not.toBe(b.chart.meta.soulBranch);
  });
});

describe('V-23 입력 상태와 공유 링크', () => {
  it('첫 화면 기본 출생지는 한국식, 호환 모드의 기본은 표준시(사이트와 같음)', () => {
    expect(defaultForm().placeId).toBe(KOREA_ID);
    expect(defaultForm(true).placeId).toBe(STANDARD_ID);
  });
  it('링크: 한국식은 p 를 생략하고, “시계 그대로”는 p=standard 로 적는다', () => {
    expect(formToQuery(defaultForm()).includes('p=')).toBe(false);
    expect(formToQuery({ ...defaultForm(), placeId: STANDARD_ID })).toContain('p=standard');
    expect(queryToForm(formToQuery(defaultForm())).form.placeId).toBe(KOREA_ID);
    expect(queryToForm(formToQuery({ ...defaultForm(), placeId: STANDARD_ID })).form.placeId).toBe(STANDARD_ID);
  });
  it('p 가 없는 링크는 한국식(compat=1 이면 표준시)으로 읽는다', () => {
    expect(queryToForm('y=1990&m=1&d=30&h=12').form.placeId).toBe(KOREA_ID);
    expect(formFromLocation({ search: '?compat=1', hash: '#y=1990&m=1&d=30&h=12' }).form.placeId).toBe(STANDARD_ID);
    expect(formFromLocation({ search: '', hash: '#y=1990&m=1&d=30&h=12&p=standard' }).form.placeId).toBe(STANDARD_ID);
  });
  it('toBirthInput 은 출생지를 그대로 넘긴다', () => {
    expect(toBirthInput(defaultForm()).placeId).toBe(KOREA_ID);
  });
});
