// 화면용 날짜·시각 서식. Intl 의 시간대 기능만 쓰므로 어느 환경에서나 같은 결과가 나온다.

import type { Wall, YMD } from './time';

export const pad2 = (n: number): string => String(n).padStart(2, '0');

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const fmt = (tz: string): Intl.DateTimeFormat => {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    fmtCache.set(tz, f);
  }
  return f;
};

export const wallInZone = (utcMs: number, tz: string): Wall => {
  const parts = fmt(tz).formatToParts(new Date(utcMs));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') };
};

/** 1990년 2월 4일 11:14 */
export const fmtInstant = (utcMs: number, tz: string): string => {
  const w = wallInZone(utcMs, tz);
  return `${w.y}년 ${w.m}월 ${w.d}일 ${pad2(w.h)}:${pad2(w.mi)}`;
};

export const fmtWall = (w: Wall): string => `${w.y}-${pad2(w.m)}-${pad2(w.d)} ${pad2(w.h)}:${pad2(w.mi)}`;
export const fmtDateKo = (v: YMD): string => `${v.y}년 ${v.m}월 ${v.d}일`;
export const fmtDateIso = (v: YMD): string => `${v.y}-${pad2(v.m)}-${pad2(v.d)}`;
