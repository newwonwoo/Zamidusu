// UI 상태: 입력 폼, 설정, URL 공유, localStorage(실패해도 동작).

import type { BrightnessMode } from '../core/brightness';
import type { YearBasis } from '../core/chart';
import { ABROAD_ID, CUSTOM_ID, KOREA_ID, STANDARD_ID, placeById } from '../core/place';
import type { NameStyle } from '../core/names';
import type { BirthInput, CorrectionMode, Gender, LateZiMode, LunarBasis } from '../core/time';

export interface FormState {
  gender: Gender;
  calendar: 'solar' | 'lunar';
  leap: boolean;
  year: number;
  month: number;
  day: number;
  /** null = 모름 */
  hour: number | null;
  minute: number;
  placeId: string;
  customLon: string;
  yearBasis: YearBasis;
  /** 음력 기준(I-15) */
  lunarBasis: LunarBasis;
}

/** 출생지 기본값: 한국식(동경 127.5° 기준, 시계 −30분). 원본 호환 모드는 사이트의 기본인 “표준시” */
export const defaultPlaceId = (compat = false): string => (compat ? STANDARD_ID : KOREA_ID);

/** 첫 화면 예시: 원장의 시험 입력 T6(임의 입력, 실존 인물 아님) */
export const defaultForm = (compat = false): FormState => ({
  gender: 'M', calendar: 'solar', leap: false, year: 1990, month: 1, day: 30, hour: 12, minute: 0,
  placeId: defaultPlaceId(compat), customLon: '127.5', yearBasis: 'lunarNewYear', lunarBasis: 'korea',
});

export interface Settings {
  fontSize: 'sm' | 'md' | 'lg';
  fontFamily: 'sans' | 'serif';
  nameStyle: NameStyle;
  brightness: BrightnessMode;
  showMisc: boolean;
  showTwelve: boolean;
  showBorrowed: boolean;
  highlightSurround: boolean;
  correction: CorrectionMode;
  lateZi: LateZiMode;
  leapFix: boolean;
}

export const defaultSettings = (): Settings => ({
  fontSize: 'md', fontFamily: 'sans', nameStyle: 'ko', brightness: '5', showMisc: true, showTwelve: false, showBorrowed: true,
  highlightSurround: true, correction: 'true', lateZi: 'next', leapFix: true,
});

export const toBirthInput = (f: FormState): BirthInput => ({
  calendar: f.calendar,
  leap: f.calendar === 'lunar' && f.leap,
  year: f.year,
  month: f.month,
  day: f.day,
  hour: f.hour,
  minute: f.hour === null ? 0 : f.minute,
  gender: f.gender,
  placeId: f.placeId,
  // 빈 칸은 0°(그리니치)가 아니라 “입력 없음”이다. Number('') === 0 이라 따로 걸러야 한다.
  customLon: f.placeId === CUSTOM_ID && f.customLon.trim() !== '' ? Number(f.customLon) : undefined,
  customTz: f.placeId === CUSTOM_ID ? 'Asia/Seoul' : undefined,
});

// ── URL 공유 ────────────────────────────────────────────────────────────────
/** 입력값을 주소창 쿼리로 직렬화(서버로 전송되지 않는다) */
export const formToQuery = (f: FormState): string => {
  const q = new URLSearchParams();
  q.set('g', f.gender);
  q.set('cal', f.calendar);
  if (f.calendar === 'lunar' && f.leap) q.set('leap', '1');
  q.set('y', String(f.year));
  q.set('m', String(f.month));
  q.set('d', String(f.day));
  q.set('h', f.hour === null ? '' : String(f.hour));
  if (f.hour !== null) q.set('mi', String(f.minute));
  // 한국식(기본)이면 생략한다. “시계 그대로(standard)”는 기본이 아니므로 항상 적는다(예전 링크의 생략된 p 는 한국식으로 읽는다)
  if (f.placeId !== KOREA_ID) q.set('p', f.placeId);
  if (f.placeId === CUSTOM_ID) q.set('lon', f.customLon);
  if (f.yearBasis === 'ipchun') q.set('yb', 'ipchun');
  if (f.lunarBasis === 'china') q.set('lb', 'cn');
  return q.toString();
};

const num = (v: string | null, fallback: number): number => {
  if (v === null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** 쿼리에서 폼 복원. y/m/d 가 모두 있으면 자동 실행 대상(auto=true) */
export const queryToForm = (search: string, compatHint?: boolean): { form: FormState; auto: boolean; compat: boolean } => {
  const q = new URLSearchParams(search);
  const compat = compatHint ?? q.get('compat') === '1';
  const base = defaultForm(compat);
  const has = q.has('y') && q.has('m') && q.has('d');
  const hRaw = q.get('h');
  const form: FormState = {
    gender: q.get('g') === 'F' ? 'F' : 'M',
    calendar: q.get('cal') === 'lunar' ? 'lunar' : 'solar',
    leap: q.get('leap') === '1',
    year: num(q.get('y'), base.year),
    month: num(q.get('m'), base.month),
    day: num(q.get('d'), base.day),
    hour: has ? (hRaw === null || hRaw === '' ? null : num(hRaw, 12)) : base.hour,
    minute: num(q.get('mi'), 0),
    placeId: (() => {
      const p = q.get('p');
      return p && (p === CUSTOM_ID || p === STANDARD_ID || p === KOREA_ID || p === ABROAD_ID || placeById(p)) ? p : defaultPlaceId(compat);
    })(),
    customLon: q.get('lon') ?? base.customLon,
    yearBasis: q.get('yb') === 'ipchun' ? 'ipchun' : 'lunarNewYear',
    lunarBasis: q.get('lb') === 'cn' ? 'china' : 'korea',
  };
  return { form, auto: has, compat };
};

/**
 * 주소에서 입력값을 복원한다. 공유 링크는 서버로 전송되지 않는 해시(#)에 담는다
 * (쿼리 문자열은 정적 서버의 접근 기록에 남을 수 있다). 예전 형식(?y=…&m=…)도 읽는다.
 * ?compat=1 은 개인정보가 아니므로 쿼리에 둔다.
 */
export const formFromLocation = (loc: { search: string; hash: string }): { form: FormState; auto: boolean; compat: boolean } => {
  const fromHash = new URLSearchParams(loc.hash.replace(/^#\??/, ''));
  const hashHasDate = fromHash.has('y') && fromHash.has('m') && fromHash.has('d');
  const compat = new URLSearchParams(loc.search).get('compat') === '1' || fromHash.get('compat') === '1';
  return queryToForm(hashHasDate ? fromHash.toString() : loc.search, compat);
};

// ── 설정 저장(localStorage 가 막혀 있어도 동작) ───────────────────────────────
const KEY = 'zamidusu.settings.v1';

export const loadSettings = (): Settings => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = (s: Settings): void => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패는 무시: 화면은 현재 세션 상태로 계속 동작 */
  }
};
