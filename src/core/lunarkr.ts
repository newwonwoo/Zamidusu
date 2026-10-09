// 한국 음력(한국 표준시 기준). 연도별 표(lunarkr-data.ts)를 풀어 양력↔음력 변환을 제공한다.
// 표는 천문 계산 생성기(scripts/lunar-kr-generator.mjs)로 만들었고, 한국천문연구원 자료 기반 라이브러리(korean-lunar-calendar)
// 와 1900-02-01~2050-12-31 의 55,121일이 모두 같음을 tests/lunarkr.test.ts 가 확인한다. 2051년 이후는 같은 규칙의 계산값이다.

import { KR_LUNAR_FIRST_YEAR, KR_LUNAR_INFO } from './lunarkr-data';

export interface KrLunarDate {
  year: number;
  month: number;
  leap: boolean;
  day: number;
  /** 그 달의 일수(29 또는 30) */
  monthDays: number;
}

interface MonthRec {
  year: number;
  month: number;
  leap: boolean;
  /** 초하루의 에포크 일수(1970-01-01 = 0) */
  start: number;
  days: number;
}

const DAY_MS = 86400000;
const epochDay = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
const fromEpochDay = (n: number): { y: number; m: number; d: number } => {
  const t = new Date(n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

let cache: { months: MonthRec[]; byKey: Map<string, MonthRec> } | null = null;

const load = (): { months: MonthRec[]; byKey: Map<string, MonthRec> } => {
  if (cache) return cache;
  const months: MonthRec[] = [];
  KR_LUNAR_INFO.forEach((info, i) => {
    const year = KR_LUNAR_FIRST_YEAR + i;
    const leap = (info >> 13) & 0xf;
    const bits = info & 0x1fff;
    let start = epochDay(year, 1, 1) + ((info >> 17) & 0x3f);
    const count = leap ? 13 : 12;
    for (let j = 0; j < count; j++) {
      const days = (bits >> (12 - j)) & 1 ? 30 : 29;
      // 시간순 j번째 달의 번호: 윤달 앞은 j+1, 윤달 자신은 leap, 그 뒤는 j
      const isLeap = leap > 0 && j === leap;
      const month = leap > 0 && j >= leap ? j : j + 1;
      months.push({ year, month, leap: isLeap, start, days });
      start += days;
    }
  });
  cache = { months, byKey: new Map(months.map((m) => [`${m.year}|${m.month}|${m.leap ? 1 : 0}`, m])) };
  return cache;
};

/** 표가 다루는 양력 범위(에포크 일수) */
export const krLunarRange = (): { first: { y: number; m: number; d: number }; last: { y: number; m: number; d: number } } => {
  const { months } = load();
  const last = months[months.length - 1];
  return { first: fromEpochDay(months[0].start), last: fromEpochDay(last.start + last.days - 1) };
};

/** 양력 → 한국 음력. 표의 범위(1900-01-31~2101-01-28) 밖이면 null */
export const solarToLunarKr = (y: number, m: number, d: number): KrLunarDate | null => {
  const { months } = load();
  const day = epochDay(y, m, d);
  if (day < months[0].start) return null;
  const lastRec = months[months.length - 1];
  if (day >= lastRec.start + lastRec.days) return null;
  let lo = 0;
  let hi = months.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (months[mid].start <= day) lo = mid;
    else hi = mid - 1;
  }
  const rec = months[lo];
  return { year: rec.year, month: rec.month, leap: rec.leap, day: day - rec.start + 1, monthDays: rec.days };
};

/** 한국 음력 → 양력. 없는 달·없는 날이면 null */
export const lunarToSolarKr = (year: number, month: number, leap: boolean, day: number): { y: number; m: number; d: number } | null => {
  const rec = load().byKey.get(`${year}|${month}|${leap ? 1 : 0}`);
  if (!rec || !Number.isInteger(day) || day < 1 || day > rec.days) return null;
  return fromEpochDay(rec.start + day - 1);
};

/** 음력 달의 일수(29·30). 없는 달이면 0 */
export const lunarMonthDaysKr = (year: number, month: number, leap: boolean): number =>
  load().byKey.get(`${year}|${month}|${leap ? 1 : 0}`)?.days ?? 0;

/** 그 해의 윤달 번호(없으면 0). 표 밖이면 0 */
export const leapMonthOfKr = (year: number): number => {
  const info = KR_LUNAR_INFO[year - KR_LUNAR_FIRST_YEAR];
  return info === undefined ? 0 : (info >> 13) & 0xf;
};

/** iztro 가 쓰는 lunar-lite 에 끼워 넣는 달력 공급자(patches/README.md). 표 밖이면 null 을 돌려 기본(중국 표준시) 계산을 쓰게 한다 */
export const KOREAN_LUNAR_PROVIDER = {
  toLunar: (year: number, month: number, day: number) => {
    const l = solarToLunarKr(year, month, day);
    return l && { lunarYear: l.year, lunarMonth: l.month, lunarDay: l.day, isLeap: l.leap, monthDays: l.monthDays };
  },
  toSolar: (lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean) => {
    const s = lunarToSolarKr(lunarYear, lunarMonth, isLeap, lunarDay);
    return s && { solarYear: s.y, solarMonth: s.m, solarDay: s.d };
  },
};
