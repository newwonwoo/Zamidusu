// 24절기. lunar-javascript 의 절기표(중국 표준시 UTC+8 기준, 간체·별칭 혼용)를 정식 이름과 UTC 시각으로 정리한다.
// 사주의 월 경계는 12절(節)이고, 연 경계는 입춘이다.

import { Solar } from './lunarlib';

export interface SolarTermDef {
  /** 정식 한자 */
  han: string;
  ko: string;
  /** lunar-javascript 절기표의 키 */
  key: string;
  /** 월의 경계가 되는 절(節)인가 */
  jie: boolean;
}

export const SOLAR_TERMS: SolarTermDef[] = [
  { han: '小寒', ko: '소한', key: '小寒', jie: true },
  { han: '大寒', ko: '대한', key: '大寒', jie: false },
  { han: '立春', ko: '입춘', key: '立春', jie: true },
  { han: '雨水', ko: '우수', key: '雨水', jie: false },
  { han: '驚蟄', ko: '경칩', key: '惊蛰', jie: true },
  { han: '春分', ko: '춘분', key: '春分', jie: false },
  { han: '清明', ko: '청명', key: '清明', jie: true },
  { han: '穀雨', ko: '곡우', key: '谷雨', jie: false },
  { han: '立夏', ko: '입하', key: '立夏', jie: true },
  { han: '小滿', ko: '소만', key: '小满', jie: false },
  { han: '芒種', ko: '망종', key: '芒种', jie: true },
  { han: '夏至', ko: '하지', key: '夏至', jie: false },
  { han: '小暑', ko: '소서', key: '小暑', jie: true },
  { han: '大暑', ko: '대서', key: '大暑', jie: false },
  { han: '立秋', ko: '입추', key: '立秋', jie: true },
  { han: '處暑', ko: '처서', key: '处暑', jie: false },
  { han: '白露', ko: '백로', key: '白露', jie: true },
  { han: '秋分', ko: '추분', key: '秋分', jie: false },
  { han: '寒露', ko: '한로', key: '寒露', jie: true },
  { han: '霜降', ko: '상강', key: '霜降', jie: false },
  { han: '立冬', ko: '입동', key: '立冬', jie: true },
  { han: '小雪', ko: '소설', key: '小雪', jie: false },
  { han: '大雪', ko: '대설', key: '大雪', jie: true },
  { han: '冬至', ko: '동지', key: 'DONG_ZHI', jie: false },
];

export interface SolarTermTime {
  def: SolarTermDef;
  /** 절기가 시작되는 순간(UTC ms) */
  utcMs: number;
}

/** 라이브러리 시각은 UTC+8 벽시계이므로 8시간을 빼서 UTC 로 바꾼다. */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

const cache = new Map<number, SolarTermTime[]>();

/** 양력 Y년에 드는 24절기(소한~동지)의 시각 */
export const solarTermsOfYear = (year: number): SolarTermTime[] => {
  const hit = cache.get(year);
  if (hit) return hit;
  const table = Solar.fromYmd(year, 6, 15).getLunar().getJieQiTable();
  const out = SOLAR_TERMS.map((def) => {
    const s = table[def.key];
    if (!s) throw new Error(`절기표에서 ${def.han}(${def.key})을 찾을 수 없습니다 (${year}년)`);
    return {
      def,
      utcMs: Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()) - BEIJING_OFFSET_MS,
    };
  });
  cache.set(year, out);
  return out;
};

/** 순간 t 직전·직후의 절(節) — 월주의 경계 */
export const surroundingJie = (utcMs: number): { prev: SolarTermTime; next: SolarTermTime } => {
  const y = new Date(utcMs).getUTCFullYear();
  const all = [y - 1, y, y + 1].flatMap((yy) => solarTermsOfYear(yy)).filter((t) => t.def.jie).sort((a, b) => a.utcMs - b.utcMs);
  let prev = all[0];
  for (const t of all) {
    if (t.utcMs <= utcMs) prev = t;
    else return { prev, next: t };
  }
  return { prev, next: all[all.length - 1] };
};

/** 절기 이름(한자)으로 Y년의 시각을 찾는다 */
export const termTime = (year: number, han: string): number => {
  const t = solarTermsOfYear(year).find((x) => x.def.han === han);
  if (!t) throw new Error(`절기 ${han} 없음`);
  return t.utcMs;
};
