// I-15 한국 음력(한국 표준시 기준) 검증.
//   배경: 엔진(iztro·lunar-javascript)의 음력은 중국 표준시 날짜 기준이라 한국 음력과 1900~2050년 중 3.59% 의 날짜가 다르다.
//   검증 수단: ① 한국천문연구원 자료 기반 라이브러리(korean-lunar-calendar, 개발 전용)로 55,121일 전수 대조
//             ② 생성기를 처음부터 다시 돌려 저장한 표와 비교(표가 낡거나 손으로 고쳐지지 않았는지)
//             ③ 생성기를 중국 표준시로 돌리면 lunar-javascript 와 1961~2099 전 구간이 같음(생성 알고리즘 자체의 검증)
//             ④ 구조 불변식(달 길이·윤달·정월 위치·왕복 변환)  ⑤ 사람이 아는 사실(석가탄신일 등)
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { setLunarProvider } from 'lunar-lite';
import { astro } from 'iztro';
import { KR_LUNAR_FIRST_YEAR, KR_LUNAR_INFO } from '../src/core/lunarkr-data';
import { krLunarRange, leapMonthOfKr, lunarMonthDaysKr, lunarToSolarKr, solarToLunarKr } from '../src/core/lunarkr';
import { DEFAULT_CHART_OPTIONS, buildChart, buildView } from '../src/core/chart';
import { leapMonthOfLunarYear, lunarMonthDays, lunarToSolar, normalizeBirth, solarToLunar } from '../src/core/time';
import { NO_CORRECTION, compareWithIndependent, inputOf, keyOf, makeChart, randomSolarDate, rng } from './helpers';
// 생성기(.mjs)는 천문 계산을 하는 개발용 코드이므로 앱 번들에는 들어가지 않는다
import {
  buildCalendar, chineseOffset, DAY_MS, encodeYear, epochDay, fromEpochDay, koreanOffset, lunarOfDay, yearInfos,
} from '../scripts/lunar-kr-generator.mjs';

const require_ = createRequire(import.meta.url);
const KoreanLunarCalendar = (() => {
  const m = require_('korean-lunar-calendar');
  return m.default ?? m;
})();
const L = require_('lunar-javascript');

const fmt = (l: { year: number; month: number; leap: boolean; day: number }): string => `${l.year}-${l.leap ? '윤' : ''}${l.month}-${l.day}`;
const days = (from: [number, number, number], to: [number, number, number]): { y: number; m: number; d: number; t: number }[] => {
  const out: { y: number; m: number; d: number; t: number }[] = [];
  for (let t = Date.UTC(from[0], from[1] - 1, from[2]); t <= Date.UTC(to[0], to[1] - 1, to[2]); t += DAY_MS) {
    const x = new Date(t);
    out.push({ y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), t });
  }
  return out;
};

describe('한국 음력 표 대 한국천문연구원 자료(오라클)', () => {
  it('1900-02-01 ~ 2050-12-31 의 55,121일이 모두 같다(양력 → 음력)', () => {
    const kc = new KoreanLunarCalendar();
    const bad: string[] = [];
    let n = 0;
    for (const { y, m, d } of days([1900, 2, 1], [2050, 12, 31])) {
      n++;
      if (!kc.setSolarDate(y, m, d)) { bad.push(`${y}-${m}-${d} 오라클 범위 밖`); continue; }
      const k = kc.getLunarCalendar();
      const mine = solarToLunarKr(y, m, d);
      if (!mine || mine.year !== k.year || mine.month !== k.month || mine.leap !== !!k.intercalation || mine.day !== k.day) {
        bad.push(`${y}-${m}-${d} 표=${mine && fmt(mine)} KASI=${fmt({ year: k.year, month: k.month, leap: !!k.intercalation, day: k.day })}`);
      }
    }
    expect(n).toBe(55121);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('음력 → 양력도 전수 같다(1900~2050의 모든 음력 날짜)', () => {
    const kc = new KoreanLunarCalendar();
    const bad: string[] = [];
    let n = 0;
    for (let ly = 1901; ly <= 2049; ly++) {
      for (let m = 1; m <= 12; m++) {
        for (const leap of [false, true]) {
          const len = lunarMonthDaysKr(ly, m, leap);
          if (len === 0) continue;
          for (let d = 1; d <= len; d++) {
            n++;
            if (!kc.setLunarDate(ly, m, d, leap)) { bad.push(`${ly}-${leap ? '윤' : ''}${m}-${d} 오라클이 거절`); continue; }
            const s = kc.getSolarCalendar();
            const mine = lunarToSolarKr(ly, m, leap, d);
            if (!mine || mine.y !== s.year || mine.m !== s.month || mine.d !== s.day) bad.push(`${ly}-${leap ? '윤' : ''}${m}-${d} 표=${JSON.stringify(mine)} KASI=${s.year}-${s.month}-${s.day}`);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(53000);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('윤달이 있는 해와 윤달 번호가 오라클과 같다(1901~2049)', () => {
    const kc = new KoreanLunarCalendar();
    const bad: string[] = [];
    for (let ly = 1901; ly <= 2049; ly++) {
      const mine = leapMonthOfKr(ly);
      let theirs = 0;
      for (let m = 1; m <= 12; m++) if (kc.setLunarDate(ly, m, 1, true)) theirs = m;
      if (mine !== theirs) bad.push(`${ly}: 표 ${mine} KASI ${theirs}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('한국 음력 생성기', () => {
  it('규칙대로 처음부터 다시 만든 표가 저장된 표(lunarkr-data.ts)와 정확히 같다', () => {
    const cal = buildCalendar(koreanOffset, 1899, 2102);
    const infos = yearInfos(cal, 1900, 2100);
    expect(infos.map(encodeYear)).toEqual([...KR_LUNAR_INFO]);
    expect(KR_LUNAR_FIRST_YEAR).toBe(1900);
  });

  it('중국 표준시로 돌린 생성기는 lunar-javascript 와 1961~2099 의 50,769일이 모두 같다(알고리즘 검증)', () => {
    const cal = buildCalendar(chineseOffset, 1899, 2102);
    const bad: string[] = [];
    let n = 0;
    for (const { y, m, d, t } of days([1961, 1, 1], [2099, 12, 31])) {
      n++;
      const mine = lunarOfDay(cal, Math.floor(t / DAY_MS));
      const l = L.Solar.fromYmd(y, m, d).getLunar();
      const lm = l.getMonth();
      if (!mine || mine.year !== l.getYear() || mine.month !== Math.abs(lm) || mine.leap !== lm < 0 || mine.day !== l.getDay()) {
        bad.push(`${y}-${m}-${d} 생성기=${mine && fmt(mine)} 라이브러리=${l.getYear()}-${lm < 0 ? '윤' : ''}${Math.abs(lm)}-${l.getDay()}`);
      }
    }
    expect(n).toBe(50769);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('1912년 이전은 중국 음력과 같다(한국천문연구원 표가 그렇다)', () => {
    const bad: string[] = [];
    for (const { y, m, d } of days([1900, 2, 1], [1911, 12, 31])) {
      const k = solarToLunarKr(y, m, d)!;
      const l = L.Solar.fromYmd(y, m, d).getLunar();
      if (k.year !== l.getYear() || k.month !== Math.abs(l.getMonth()) || k.leap !== l.getMonth() < 0 || k.day !== l.getDay()) bad.push(`${y}-${m}-${d}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('한국 음력 표의 구조', () => {
  it('달이 끊김 없이 이어지고(29·30일), 해마다 12 또는 13개월이며 윤달은 많아야 하나다', () => {
    const range = krLunarRange();
    expect(range.first).toEqual({ y: 1900, m: 1, d: 31 });
    expect(range.last).toEqual({ y: 2101, m: 1, d: 28 });
    let prevEnd: number | null = null;
    for (let i = 0; i < KR_LUNAR_INFO.length; i++) {
      const info = KR_LUNAR_INFO[i];
      const year = KR_LUNAR_FIRST_YEAR + i;
      const leap = (info >> 13) & 0xf;
      const start = epochDay(year, 1, 1) + ((info >> 17) & 0x3f);
      const sd = fromEpochDay(start);
      // 정월 초하루는 양력 1월 21일 ~ 2월 21일 사이
      expect(sd.y).toBe(year);
      expect(sd.m === 1 ? sd.d >= 21 : sd.m === 2 && sd.d <= 21).toBe(true);
      if (prevEnd !== null) expect(start).toBe(prevEnd);
      let total = 0;
      const count = leap ? 13 : 12;
      for (let j = 0; j < count; j++) total += (info >> (12 - j)) & 1 ? 30 : 29;
      // 13개월째 비트는 윤달이 없으면 0 이어야 한다
      if (!leap) expect(info & 1).toBe(0);
      if (leap) {
        expect(total).toBeGreaterThanOrEqual(383);
        expect(total).toBeLessThanOrEqual(385);
      } else {
        expect(total).toBeGreaterThanOrEqual(353);
        expect(total).toBeLessThanOrEqual(355);
      }
      prevEnd = start + total;
    }
  });

  it('1900-01-31 ~ 2101-01-28 의 모든 날이 음력 하나에 대응하고 양력으로 정확히 되돌아온다', () => {
    const bad: string[] = [];
    let n = 0;
    let prev: { year: number; month: number; leap: boolean; day: number } | null = null;
    for (const { y, m, d } of days([1900, 1, 31], [2101, 1, 28])) {
      n++;
      const l = solarToLunarKr(y, m, d);
      if (!l) { bad.push(`${y}-${m}-${d} 변환 실패`); continue; }
      const back = lunarToSolarKr(l.year, l.month, l.leap, l.day);
      if (!back || back.y !== y || back.m !== m || back.d !== d) bad.push(`${y}-${m}-${d} 왕복 실패 ${fmt(l)}`);
      // 하루 지나면 음력 날짜는 +1 이거나 (달이 바뀌어) 1일
      if (prev) {
        const next = l.day === prev.day + 1 && l.month === prev.month && l.leap === prev.leap && l.year === prev.year;
        const newMonth = l.day === 1;
        if (!next && !newMonth) bad.push(`${y}-${m}-${d} 날짜 흐름 이상 ${fmt(prev)} → ${fmt(l)}`);
      }
      prev = l;
    }
    expect(n).toBe(epochDay(2101, 1, 28) - epochDay(1900, 1, 31) + 1);
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('표 밖은 null 이고, 없는 달·없는 날은 거절한다', () => {
    expect(solarToLunarKr(1900, 1, 30)).toBeNull();
    expect(solarToLunarKr(2101, 1, 29)).toBeNull();
    expect(lunarToSolarKr(1899, 1, false, 1)).toBeNull();
    expect(lunarToSolarKr(2012, 3, true, 1)).not.toBeNull(); // 2012 한국 음력에는 윤3월이 있다
    expect(lunarToSolarKr(2012, 4, true, 1)).toBeNull(); // 중국 음력의 윤4월은 한국에는 없다
    expect(lunarToSolarKr(2023, 2, true, 30)).toBeNull(); // 윤2월은 29일뿐
    expect(lunarToSolarKr(1990, 1, false, 0)).toBeNull();
    expect(lunarMonthDaysKr(2012, 4, true)).toBe(0);
  });
});

describe('사람이 아는 사실(한국천문연구원 특일 정보와 같은 날짜)', () => {
  const sol = (y: number, m: number, d: number) => fmt(solarToLunarKr(y, m, d)!);
  it('석가탄신일(음력 4월 8일)', () => {
    const buddha: [number, number, number][] = [
      [2012, 5, 28], [2013, 5, 17], [2014, 5, 6], [2015, 5, 25], [2016, 5, 14], [2017, 5, 3], [2018, 5, 22], [2019, 5, 12],
      [2020, 4, 30], [2021, 5, 19], [2022, 5, 8], [2023, 5, 27], [2024, 5, 15], [2025, 5, 5], [2026, 5, 24],
    ];
    for (const [y, m, d] of buddha) expect(sol(y, m, d)).toBe(`${y}-4-8`);
  });
  it('설날(음력 1월 1일)과 추석(음력 8월 15일) 2015~2026', () => {
    const seol: [number, number, number][] = [[2015, 2, 19], [2016, 2, 8], [2017, 1, 28], [2018, 2, 16], [2019, 2, 5], [2020, 1, 25], [2021, 2, 12], [2022, 2, 1], [2023, 1, 22], [2024, 2, 10], [2025, 1, 29], [2026, 2, 17]];
    for (const [y, m, d] of seol) expect(sol(y, m, d)).toBe(`${y}-1-1`);
    const chuseok: [number, number, number][] = [[2015, 9, 27], [2016, 9, 15], [2017, 10, 4], [2018, 9, 24], [2019, 9, 13], [2020, 10, 1], [2021, 9, 21], [2022, 9, 10], [2023, 9, 29], [2024, 9, 17], [2025, 10, 6], [2026, 9, 25]];
    for (const [y, m, d] of chuseok) expect(sol(y, m, d)).toBe(`${y}-8-15`);
  });
  it('윤달이 중국과 다른 해: 2012 한국 윤3월(중국 윤4월), 2017 한국 윤5월(중국 윤6월)', () => {
    expect(leapMonthOfKr(2012)).toBe(3);
    expect(leapMonthOfKr(2017)).toBe(5);
    expect(sol(2012, 4, 21)).toBe('2012-윤3-1');
    expect(sol(2012, 5, 21)).toBe('2012-4-1');
    expect(sol(2017, 6, 24)).toBe('2017-윤5-1');
    const cn2012 = L.Solar.fromYmd(2012, 5, 21).getLunar();
    expect([cn2012.getMonth(), cn2012.getDay()]).toEqual([-4, 1]); // 중국: 윤4월 1일
    const cn2017 = L.Solar.fromYmd(2017, 7, 23).getLunar();
    expect([cn2017.getMonth(), cn2017.getDay()]).toEqual([-6, 1]);
  });
  it('초하루가 하루 갈리는 날: 2023-05-19 는 중국 4월 1일이지만 한국은 4월 1일이 5월 20일', () => {
    expect(sol(2023, 5, 19)).toBe('2023-3-30');
    expect(sol(2023, 5, 20)).toBe('2023-4-1');
    const cn = L.Solar.fromYmd(2023, 5, 19).getLunar();
    expect([cn.getMonth(), cn.getDay()]).toEqual([4, 1]);
  });
  it('T6(1990-01-30)은 두 달력이 같다: 음력 1990년 1월 4일', () => {
    expect(sol(1990, 1, 30)).toBe('1990-1-4');
  });
});

describe('한국 음력과 중국 음력의 차이(I-15 정량)', () => {
  it('1900-02-01~2050-12-31 중 다른 날은 1,978일(3.59%), 59개 연도이고 모두 1912년 이후이며, 윤달이 다른 달에 놓이는 2012년(119일)·2017년(59일)이 가장 크다', () => {
    let diff = 0;
    const perYear = new Map<number, number>();
    let firstDiffYear = 9999;
    for (const { y, m, d } of days([1900, 2, 1], [2050, 12, 31])) {
      const k = solarToLunar({ y, m, d }, 'korea');
      const c = solarToLunar({ y, m, d }, 'china');
      if (k.year !== c.year || k.month !== c.month || k.leap !== c.leap || k.day !== c.day) {
        diff++;
        perYear.set(y, (perYear.get(y) ?? 0) + 1);
        firstDiffYear = Math.min(firstDiffYear, y);
      }
    }
    expect(diff).toBe(1978);
    expect(firstDiffYear).toBeGreaterThanOrEqual(1912);
    expect(perYear.size).toBe(59);
    expect(perYear.get(2012)).toBe(119);
    expect(perYear.get(2017)).toBe(59);
    expect([...perYear.entries()].sort((a, b) => b[1] - a[1])[0][0]).toBe(2012);
  });

  it('time.ts 의 기준 선택: 한국/중국이 같은 날은 같고, 다른 날은 다르다', () => {
    expect(solarToLunar({ y: 2012, m: 5, d: 21 }, 'korea')).toEqual({ year: 2012, month: 4, leap: false, day: 1 });
    expect(solarToLunar({ y: 2012, m: 5, d: 21 }, 'china')).toEqual({ year: 2012, month: 4, leap: true, day: 1 });
    expect(leapMonthOfLunarYear(2012, 'korea')).toBe(3);
    expect(leapMonthOfLunarYear(2012, 'china')).toBe(4);
    expect(lunarMonthDays(2012, 3, true, 'korea')).toBe(30); // 2012-04-21 ~ 05-20
    expect(lunarMonthDays(2012, 3, true, 'china')).toBe(0);
    expect(lunarToSolar(2012, 3, true, 1, 'korea')).toEqual({ y: 2012, m: 4, d: 21 });
    expect(lunarToSolar(2012, 3, true, 1, 'china')).toBeNull();
    // 표 밖 연도(1899)는 중국 계산으로 넘어간다
    expect(solarToLunar({ y: 1900, m: 1, d: 15 }, 'korea')).toEqual(solarToLunar({ y: 1900, m: 1, d: 15 }, 'china'));
  });
});

describe('명반에서의 음력 기준(패치 연결 검증)', () => {
  /** lunar-javascript 로 만든 중국 음력 공급자 — 이것을 끼워도 결과가 달라지면 안 된다(끼워 넣는 경로의 중립성 확인용) */
  const CHINESE_PROVIDER = {
    toLunar: (y: number, m: number, d: number) => {
      const l = L.Solar.fromYmd(y, m, d).getLunar();
      const lm = l.getMonth();
      const mon = L.LunarMonth.fromYm(l.getYear(), lm);
      return { lunarYear: l.getYear(), lunarMonth: Math.abs(lm), lunarDay: l.getDay(), isLeap: lm < 0, monthDays: mon.getDayCount() };
    },
    toSolar: (ly: number, lm: number, ld: number, isLeap: boolean) => {
      try {
        const s = L.Lunar.fromYmd(ly, isLeap ? -lm : lm, ld).getSolar();
        return { solarYear: s.getYear(), solarMonth: s.getMonth(), solarDay: s.getDay() };
      } catch {
        return null;
      }
    },
  };
  const snapshot = (c: ReturnType<typeof makeChart>): string =>
    JSON.stringify({ meta: { ...c.meta, altLunar: null }, palaces: c.palaces });

  it('중국 음력 공급자를 끼워 넣어도 명반이 그대로다(300건, 두 연도 기준) — 패치 경로의 중립성', () => {
    const r = rng(15);
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1900, 2100);
      if (y === 1900 && m < 2) continue;
      const hb = Math.floor(r() * 12);
      const yb = i % 2 ? 'ipchun' : 'lunarNewYear';
      const plain = makeChart(y, m, d, hb, 'M', { lunarBasis: 'china', yearBasis: yb });
      setLunarProvider(CHINESE_PROVIDER);
      let withProvider;
      try {
        withProvider = makeChart(y, m, d, hb, 'M', { lunarBasis: 'china', yearBasis: yb });
      } finally {
        setLunarProvider(null);
      }
      expect(snapshot(withProvider)).toBe(snapshot(plain));
      n++;
    }
    expect(n).toBeGreaterThan(280);
  });

  it('한국/중국 음력이 다른 날 300건: 한국 기준 명반은 한국 음력으로 계산한 독립 구현과, 중국 기준은 중국 음력과 일치하고 둘은 서로 다르다', () => {
    const diffDays: { y: number; m: number; d: number }[] = [];
    for (const x of days([1912, 1, 1], [2100, 12, 31])) {
      const k = solarToLunar(x, 'korea');
      const c = solarToLunar(x, 'china');
      if (k.year !== c.year || k.month !== c.month || k.leap !== c.leap || k.day !== c.day) diffDays.push(x);
    }
    expect(diffDays.length).toBeGreaterThan(2000);
    const r = rng(2012);
    const bad: string[] = [];
    let differ = 0;
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = diffDays[Math.floor(r() * diffDays.length)];
      const hb = Math.floor(r() * 12);
      const g = r() < 0.5 ? 'M' : 'F';
      const kc = makeChart(y, m, d, hb, g, { lunarBasis: 'korea' });
      const cc = makeChart(y, m, d, hb, g, { lunarBasis: 'china' });
      bad.push(...compareWithIndependent(`[한국 ${y}-${m}-${d} ${hb}시]`, kc, keyOf(y, m, d, hb, 'lunarNewYear', 'korea'), g));
      bad.push(...compareWithIndependent(`[중국 ${y}-${m}-${d} ${hb}시]`, cc, keyOf(y, m, d, hb, 'lunarNewYear', 'china'), g));
      expect(kc.meta.altLunar).not.toBeNull();
      expect(kc.meta.altLunar!.basis).toBe('china');
      expect(cc.meta.altLunar!.basis).toBe('korea');
      // 음력 날짜가 다르므로 명반(자미성 위치 또는 월계 별)이 달라진다 — 다르지 않은 경우는 같은 달·일차이가 24일 주기에 걸린 드문 경우뿐
      if (snapshot(kc) !== snapshot(cc)) differ++;
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(differ).toBeGreaterThan(270);
  });

  it('같은 날(차이가 없는 날)은 altLunar 가 없고, 호환 모드는 항상 중국 음력이다', () => {
    const same = makeChart(1990, 1, 30, 6, 'M');
    expect(same.meta.altLunar).toBeNull();
    expect(same.meta.lunarBasis).toBe('korea');
    const compat = makeChart(2012, 5, 21, 6, 'M', { compat: true });
    expect(compat.meta.lunarBasis).toBe('china');
    expect(compat.meta.lunar).toMatchObject({ month: 4, leap: true, day: 1 });
  });

  it('계산이 끝나면 공급자가 해제되어 엔진을 직접 불러도 중국 음력이 나온다(누수 없음)', () => {
    makeChart(2012, 5, 21, 6, 'M', { lunarBasis: 'korea' });
    astro.config({ yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current', algorithm: 'default' });
    const raw = astro.bySolar('2012-5-21', 6, '男', true, 'zh-TW');
    expect(raw.rawDates.lunarDate.toString()).toBe('2012-4-1'); // 중국: 윤4월 1일(윤 표시는 문자열에 없음)
    expect(raw.rawDates.lunarDate.isLeap).toBe(true);
    // 예외가 나도 해제된다
    const r = normalizeBirth(inputOf(2012, 5, 21, 12, 'M'), NO_CORRECTION);
    if (!r.ok) throw new Error('입력 오류');
    try {
      buildChart({ ...r.value, timeIndex: 99 }, { ...DEFAULT_CHART_OPTIONS, lunarBasis: 'korea' });
    } catch {
      /* 예외 여부는 중요하지 않다 */
    }
    const raw2 = astro.bySolar('2012-5-21', 6, '男', true, 'zh-TW');
    expect(raw2.rawDates.lunarDate.isLeap).toBe(true);
  });

  it('운 모드(유년·유월·유일)도 같은 음력 기준을 쓴다: 2012-05-21 의 유월은 한국 4월, 중국 윤4월', () => {
    const kc = makeChart(1985, 3, 3, 6, 'M', { lunarBasis: 'korea' });
    const cc = makeChart(1985, 3, 3, 6, 'M', { lunarBasis: 'china' });
    const target = { date: { y: 2012, m: 5, d: 21 }, timeIndex: 6 };
    const kv = buildView(kc, 'monthly', target);
    const cv = buildView(cc, 'monthly', target);
    expect(kv.info.lunar).toMatchObject({ month: 4, leap: false, day: 1 });
    expect(cv.info.lunar).toMatchObject({ month: 4, leap: true, day: 1 });
  });
});
