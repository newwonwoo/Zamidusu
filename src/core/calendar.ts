// 만세력(F-10): 한 달의 양력·음력·일진·절기. 팝업과 검증에서 쓴다.

import { Solar } from './lunarlib';
import { BRANCHES_KO, STEMS_KO } from './ganzhi';
import { wallInZone } from './format';
import { SOLAR_TERMS, solarTermsOfYear } from './solarterms';
import { daysInSolarMonth } from './time';

export interface CalendarCell {
  y: number;
  m: number;
  d: number;
  weekday: number;
  lunar: { month: number; day: number; leap: boolean };
  /** 일진 한자·한글 */
  ganzhi: string;
  ganzhiKo: string;
  term?: { han: string; ko: string; jie: boolean; hhmm: string };
}

export interface CalendarMonth {
  y: number;
  m: number;
  /** 앞쪽 빈 칸(일요일 시작) */
  leading: number;
  cells: CalendarCell[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** tz 기준으로 그 달에 드는 절기를 날짜별로 모은다 */
const termsByDay = (y: number, m: number, tz: string): Map<number, CalendarCell['term']> => {
  const out = new Map<number, CalendarCell['term']>();
  for (const yy of [y - 1, y, y + 1]) {
    for (const t of solarTermsOfYear(yy)) {
      const w = wallInZone(t.utcMs, tz);
      if (w.y === y && w.m === m) out.set(w.d, { han: t.def.han, ko: t.def.ko, jie: t.def.jie, hhmm: `${pad(w.h)}:${pad(w.mi)}` });
    }
  }
  return out;
};

export const buildMonth = (y: number, m: number, tz = 'Asia/Seoul'): CalendarMonth => {
  const terms = termsByDay(y, m, tz);
  const days = daysInSolarMonth(y, m);
  const cells: CalendarCell[] = [];
  for (let d = 1; d <= days; d++) {
    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();
    const gz: string = lunar.getDayInGanZhi();
    const lm = lunar.getMonth();
    cells.push({
      y, m, d,
      weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
      lunar: { month: Math.abs(lm), day: lunar.getDay(), leap: lm < 0 },
      ganzhi: gz,
      ganzhiKo: STEMS_KO[['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].indexOf(gz[0])] +
        BRANCHES_KO[['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].indexOf(gz[1])],
      term: terms.get(d),
    });
  }
  return { y, m, leading: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), cells };
};

export const TERM_NAMES = SOLAR_TERMS.map((t) => t.ko);
