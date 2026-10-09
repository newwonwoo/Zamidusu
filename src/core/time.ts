// 입력 정규화: 양/음력 변환, 출생지 시각 보정(진태양시), 시진 결정, 자시(23시대) 날짜 이월.
// 원장 개선 항목: I-06(보정표 오류) · I-07(보정 무효) · I-08(입력 범위) · U-06(표준시 이력) · U-07(자시/윤달).

import { Solar, Lunar } from './lunarlib';
import { leapMonthOfKr, lunarMonthDaysKr, lunarToSolarKr, solarToLunarKr } from './lunarkr';
import { ABROAD_ID, CUSTOM_ID, KOREA_ID, KOREA_MERIDIAN, KOREA_TZ, STANDARD_ID, placeById } from './place';

export interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}
export interface YMD {
  y: number;
  m: number;
  d: number;
}

export type Gender = 'M' | 'F';
export type CorrectionMode = 'none' | 'lmt' | 'true';
export type LateZiMode = 'next' | 'current';
/**
 * 음력 기준. 한국 음력은 한국 표준시(UTC+9) 날짜로, 중국 음력(iztro·lunar-javascript 계열)은 중국 표준시(UTC+8) 날짜로 센다.
 * 1900~2050년 중 3.59% 의 날짜에서 음력 일이 하루 다르고, 2012·2017년처럼 윤달이 다른 달에 놓이는 해도 있다(I-15).
 */
export type LunarBasis = 'korea' | 'china';
export const DEFAULT_LUNAR_BASIS: LunarBasis = 'korea';

export interface BirthInput {
  calendar: 'solar' | 'lunar';
  /** 음력 윤달 여부(calendar === 'lunar' 일 때만 의미) */
  leap: boolean;
  year: number;
  month: number;
  day: number;
  /** 0~23, 모름은 null */
  hour: number | null;
  minute: number;
  gender: Gender;
  /** KOREA_ID(한국식, 기본) | STANDARD_ID(시계 그대로) | CUSTOM_ID | ABROAD_ID(호환 모드 전용) | 출생지 id */
  placeId: string;
  customLon?: number;
  customTz?: string;
}

export interface TimeSettings {
  correction: CorrectionMode;
  lateZi: LateZiMode;
  compat: boolean;
  /** 음력 기준. 생략하면 한국. 호환 모드에서는 항상 중국(사이트가 그렇게 계산하는 것으로 추정) */
  lunarBasis?: LunarBasis;
}

export const DEFAULT_TIME_SETTINGS: TimeSettings = { correction: 'true', lateZi: 'next', compat: false, lunarBasis: DEFAULT_LUNAR_BASIS };

/** 설정에서 실제로 쓸 음력 기준 */
export const lunarBasisOf = (s: Pick<TimeSettings, 'compat' | 'lunarBasis'>): LunarBasis => (s.compat ? 'china' : (s.lunarBasis ?? DEFAULT_LUNAR_BASIS));

/** 입력 가능 범위(설계서 4-2). 하한은 엔진의 음력 표 시작(1900-01-31) 다음 날. */
export const MIN_DATE: YMD = { y: 1900, m: 2, d: 1 };
export const MAX_DATE: YMD = { y: 2100, m: 12, d: 31 };
/** 호환 모드에서 재현하는 사이트의 입력 범위(I-08) */
export const COMPAT_YEAR_RANGE: [number, number] = [1927, 2026];

// ── 달력 도우미 ───────────────────────────────────────────────────────────────
export const daysInSolarMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const isValidSolar = (y: number, m: number, d: number): boolean => {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInSolarMonth(y, m);
};

export const addDays = (v: YMD, n: number): YMD => {
  const t = new Date(Date.UTC(v.y, v.m - 1, v.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

const cmpYMD = (a: YMD, b: YMD): number => a.y - b.y || a.m - b.m || a.d - b.d;

export interface LunarDate {
  year: number;
  month: number;
  leap: boolean;
  day: number;
}

/** 한국 음력 표가 다루는 음력 연도(표 밖이면 중국 음력 계산으로 넘어간다) */
const inKoreanTable = (year: number): boolean => year >= 1900 && year <= 2100;

export const solarToLunar = (v: YMD, basis: LunarBasis = DEFAULT_LUNAR_BASIS): LunarDate => {
  if (basis === 'korea') {
    const k = solarToLunarKr(v.y, v.m, v.d);
    if (k) return { year: k.year, month: k.month, leap: k.leap, day: k.day };
  }
  const l = Solar.fromYmd(v.y, v.m, v.d).getLunar();
  const lm = l.getMonth();
  return { year: l.getYear(), month: Math.abs(lm), leap: lm < 0, day: l.getDay() };
};

/** 존재하지 않는 음력 날짜(없는 윤달, 29일뿐인 달의 30일 등)는 null */
export const lunarToSolar = (year: number, month: number, leap: boolean, day: number, basis: LunarBasis = DEFAULT_LUNAR_BASIS): YMD | null => {
  if (basis === 'korea' && inKoreanTable(year)) return lunarToSolarKr(year, month, leap, day);
  try {
    const s = Lunar.fromYmd(year, leap ? -month : month, day).getSolar();
    const out = { y: s.getYear(), m: s.getMonth(), d: s.getDay() };
    const back = solarToLunar(out, 'china');
    if (back.year !== year || back.month !== month || back.leap !== leap || back.day !== day) return null;
    return out;
  } catch {
    return null;
  }
};

/** 음력 연·월(윤달 여부)의 일수(29 또는 30). 없는 달이면 0 */
export const lunarMonthDays = (year: number, month: number, leap: boolean, basis: LunarBasis = DEFAULT_LUNAR_BASIS): number => {
  if (basis === 'korea' && inKoreanTable(year)) return lunarMonthDaysKr(year, month, leap);
  if (!lunarToSolar(year, month, leap, 1, 'china')) return 0;
  return lunarToSolar(year, month, leap, 30, 'china') ? 30 : 29;
};

/** 그 해에 윤달이 있으면 윤달의 월 번호, 없으면 0 */
export const leapMonthOfLunarYear = (year: number, basis: LunarBasis = DEFAULT_LUNAR_BASIS): number => {
  if (basis === 'korea' && inKoreanTable(year)) return leapMonthOfKr(year);
  for (let m = 1; m <= 12; m++) if (lunarToSolar(year, m, true, 1, 'china')) return m;
  return 0;
};

// ── 시간대·균시차 ─────────────────────────────────────────────────────────────
const dtfCache = new Map<string, Intl.DateTimeFormat>();
const dtf = (tz: string): Intl.DateTimeFormat => {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', era: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    dtfCache.set(tz, f);
  }
  return f;
};

/** 해당 순간(UTC ms)에서 시간대 tz 의 UTC 오프셋(분). 서머타임·표준시 변경 이력이 반영된다. */
export const tzOffsetMinutes = (tz: string, utcMs: number): number => {
  const parts = dtf(tz).formatToParts(new Date(utcMs));
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '0';
  let y = Number(get('year'));
  if (get('era').startsWith('B')) y = 1 - y;
  const hour = Number(get('hour')) % 24;
  const asUtc = Date.UTC(y, Number(get('month')) - 1, Number(get('day')), hour, Number(get('minute')), Number(get('second')));
  return (asUtc - Math.floor(utcMs / 1000) * 1000) / 60000;
};

/** 현지 시계(벽시계) 시각 → UTC ms. 서머타임 경계에서는 존재하는 쪽을 택한다. */
export const civilToUtcMs = (tz: string, w: Wall): number => {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, 0);
  const off1 = tzOffsetMinutes(tz, guess);
  let utc = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(tz, utc);
  if (off2 !== off1) utc = guess - off2 * 60000;
  return utc;
};

/** 그 순간 서머타임이 적용 중인가(같은 해 1월·7월 중 작은 오프셋을 표준으로 본다) */
export const isDstAt = (tz: string, utcMs: number): boolean => {
  const y = new Date(utcMs).getUTCFullYear();
  const jan = tzOffsetMinutes(tz, Date.UTC(y, 0, 1));
  const jul = tzOffsetMinutes(tz, Date.UTC(y, 6, 1));
  return tzOffsetMinutes(tz, utcMs) > Math.min(jan, jul);
};

/**
 * 균시차(분) = 진태양시 − 평균태양시. NOAA 근사식, 오차 약 ±30초.
 * 양수이면 해시계가 시계보다 앞선다(11월 초 약 +16분, 2월 중순 약 −14분).
 */
export const equationOfTimeMinutes = (utcMs: number): number => {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const dayOfYear = Math.floor((utcMs - start) / 86400000) + 1;
  const daysInYear = (Date.UTC(y + 1, 0, 1) - start) / 86400000;
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + (hour - 12) / 24);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
};

// ── 시진 ─────────────────────────────────────────────────────────────────────
export const TIME_BRANCH_NAMES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

/** 보정 후 시(0~23) → 시진 인덱스(0=子 … 11=亥). 23시는 子로 본다(이월은 호출자가 별도 처리). */
export const hourToBranch = (h: number): number => (h === 23 ? 0 : Math.floor((h + 1) / 2));

/**
 * 시계 시각(h:mi) → 시진 인덱스. shiftMinutes 는 시계가 보정 후 시각보다 앞선 분(한국식은 30)이다.
 * 한국식에서는 시진이 :30 에 바뀐다(11:29 는 巳, 11:30 은 午). 23시대의 날짜 이월은 호출자가 따로 처리한다.
 */
export const branchOfClock = (h: number, mi: number, shiftMinutes: number): number => {
  const effective = (((h * 60 + mi - Math.round(shiftMinutes)) % 1440) + 1440) % 1440;
  return hourToBranch(Math.floor(effective / 60));
};

/** 시진의 한가운데에 해당하는 시계 시각(시·분). 시진을 정해 주는 화면(시 모름·역산)이 경계에 걸리지 않도록 쓴다 */
export const representativeClock = (branch: number, shiftMinutes: number): { hour: number; minute: number } => {
  const c = ((((branch * 2) % 24) * 60 + Math.round(shiftMinutes)) % 1440 + 1440) % 1440;
  return { hour: Math.floor(c / 60), minute: c % 60 };
};

/** 시진이 시작하는 시계 시각 ~ 끝나는 시계 시각. shiftMinutes 가 30 이면 午 = 11:30~13:30 */
export const timeRangeLabel = (branch: number, shiftMinutes = 0): string => {
  const start = ((branch * 2 + 23) % 24) * 60 + Math.round(shiftMinutes);
  const f = (min: number): string => {
    const m = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  return `${f(start)}~${f(start + 120)}`;
};

// ── 보정 ─────────────────────────────────────────────────────────────────────
export interface CorrectionDetail {
  mode: CorrectionMode | 'compat' | 'korea';
  placeName: string;
  /** 보정 후 − 보정 전, 분 단위(소수 가능) */
  deltaMinutes: number;
  /** 현지 시계의 UTC 오프셋(분) */
  offsetMinutes: number;
  dst: boolean;
  longitude: number;
  /** 경도에 의한 분량 = (경도/15시간)−오프셋 */
  longitudeMinutes: number;
  eotMinutes: number;
  note: string;
}

const fmtSigned = (min: number): string => {
  const sign = min < 0 ? '−' : '+';
  const abs = Math.abs(min);
  const m = Math.floor(abs);
  const s = Math.round((abs - m) * 60);
  return s === 60 ? `${sign}${m + 1}분 00초` : `${sign}${m}분 ${String(s).padStart(2, '0')}초`;
};
export const formatDelta = fmtSigned;

const fromMs = (ms: number): Wall => {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
};

/** 호환 모드: 사이트로 추정되는 보정(표준시 0 / 해외 −30분 / 지역 trunc((경도−127.5)×4)분). 근사다. */
const compatDelta = (input: BirthInput): { delta: number; placeName: string; lon: number } => {
  if (input.placeId === STANDARD_ID || input.placeId === KOREA_ID) return { delta: 0, placeName: '표준시', lon: 135 };
  const place = placeById(input.placeId);
  if (input.placeId === ABROAD_ID || (place && !place.domestic)) {
    return { delta: -30, placeName: place?.name ?? '해외출생', lon: place?.lon ?? 0 };
  }
  const lon = input.placeId === CUSTOM_ID ? (input.customLon ?? 127.5) : (place?.lon ?? 127.5);
  return { delta: Math.trunc((lon - 127.5) * 4), placeName: place?.name ?? '직접 입력', lon };
};

const utcLabel = (offsetMinutes: number): string =>
  `UTC${offsetMinutes >= 0 ? '+' : '−'}${Math.floor(Math.abs(offsetMinutes) / 60)}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;

export interface CorrectionResult {
  corrected: Wall;
  detail: CorrectionDetail;
}

export const correctTime = (civil: Wall, input: BirthInput, settings: TimeSettings): CorrectionResult => {
  const civilMs = Date.UTC(civil.y, civil.m - 1, civil.d, civil.h, civil.mi, 0);

  if (settings.compat) {
    const c = compatDelta(input);
    return {
      corrected: fromMs(civilMs + c.delta * 60000),
      detail: {
        mode: 'compat', placeName: c.placeName, deltaMinutes: c.delta, offsetMinutes: 540, dst: false, longitude: c.lon,
        longitudeMinutes: c.delta, eotMinutes: 0, note: '원본 호환 모드: 사이트 보정을 근사한 값(검증 전용)',
      },
    };
  }

  // 한국식: 동경 127.5°(UTC+8:30) 기준. 그 순간의 시계 오프셋(UTC+9, 1954~61년 UTC+8:30, 서머타임 +1)을 시간대 데이터에서 읽어
  // 시계에서 뺀다. 균시차는 더하지 않는다(한국식은 지방시가 아니라 한반도 표준 자오선 기준). 보정 안 함(none)이면 시계 그대로다.
  if (input.placeId === KOREA_ID && settings.correction !== 'none') {
    const utc = civilToUtcMs(KOREA_TZ, civil);
    const offset = tzOffsetMinutes(KOREA_TZ, utc);
    const target = KOREA_MERIDIAN * 4;
    // 1908-04-01 이전은 표준시가 없던 지방시 시기라 보정하지 않는다(그 뒤로 UTC+8:30 이상)
    const delta = offset < target - 1 ? 0 : target - offset;
    const dst = isDstAt(KOREA_TZ, utc);
    return {
      corrected: fromMs(civilMs + Math.round(delta * 60000)),
      detail: {
        mode: 'korea', placeName: '한국식(동경 127.5°)', deltaMinutes: delta, offsetMinutes: offset, dst, longitude: KOREA_MERIDIAN,
        longitudeMinutes: delta, eotMinutes: 0,
        note: delta === 0
          ? `한국식(동경 127.5°, ${utcLabel(target)}) 기준 — 시계가 이미 같은 시각이라 보정이 없습니다(${utcLabel(offset)})`
          : `한국식(동경 127.5°, ${utcLabel(target)}) 기준 — 시계 ${utcLabel(offset)}${dst ? '(서머타임)' : ''}에서 ${Math.abs(Math.round(delta))}분을 ${delta < 0 ? '뺐' : '더했'}습니다`,
      },
    };
  }

  const place = placeById(input.placeId);
  const unspecified = input.placeId === STANDARD_ID || (input.placeId === CUSTOM_ID && input.customLon === undefined) || (!place && input.placeId !== CUSTOM_ID);
  if (settings.correction === 'none' || unspecified) {
    return {
      corrected: civil,
      detail: {
        mode: 'none', placeName: place?.name ?? '표준시', deltaMinutes: 0, offsetMinutes: 0, dst: false, longitude: place?.lon ?? 135,
        longitudeMinutes: 0, eotMinutes: 0, note: '보정 없음(입력한 시계 시각 그대로 사용)',
      },
    };
  }

  const tz = input.placeId === CUSTOM_ID ? (input.customTz ?? KOREA_TZ) : (place?.tz ?? KOREA_TZ);
  const lon = input.placeId === CUSTOM_ID ? (input.customLon as number) : (place?.lon as number);
  const utc = civilToUtcMs(tz, civil);
  const offset = tzOffsetMinutes(tz, utc);
  const lonMin = lon * 4 - offset;
  const eot = settings.correction === 'true' ? equationOfTimeMinutes(utc) : 0;
  const delta = lonMin + eot;
  const dst = isDstAt(tz, utc);
  const label = place?.name ?? `경도 ${lon}°`;
  return {
    corrected: fromMs(civilMs + Math.round(delta * 60000)),
    detail: {
      mode: settings.correction, placeName: label, deltaMinutes: delta, offsetMinutes: offset, dst, longitude: lon,
      longitudeMinutes: lonMin, eotMinutes: eot,
      note: `${label} 경도 ${lon}°, 시계 ${utcLabel(offset)}${dst ? '(서머타임)' : ''}`,
    },
  };
};

// ── 정규화 ───────────────────────────────────────────────────────────────────
export interface NormalizedBirth {
  gender: Gender;
  /** 입력 시계가 따르는 IANA 시간대(출생지 기준, 없으면 한국) */
  tz: string;
  /** 보정 전 시계 시각이 가리키는 실제 순간(UTC ms). 절기와 비교하는 연주·월주·대운 판정에 쓴다. */
  instantUtcMs: number;
  /** 입력을 양력으로 환산한 시계 시각(보정 전). 시를 모르면 h=12, mi=0 으로 채운 날짜만 의미 있음 */
  civil: Wall;
  hourKnown: boolean;
  /** 보정 후 시각(시를 모르면 null) */
  corrected: Wall | null;
  correction: CorrectionDetail | null;
  /**
   * 시계 시각이 보정 후 시각보다 앞선 분(한국식 30, 보정 없음 0, 서울 진태양시 약 40). 시진 범위를 “입력한 시계 시각” 기준으로
   * 보여 줄 때 쓴다(午 = 11:30~13:30). 시를 모르면 그날 정오를 기준으로 구한다.
   */
  clockShiftMinutes: number;
  /** 엔진에 넘길 양력일(자시 이월 반영) */
  engineDate: YMD;
  /** 엔진 시진(0=子 … 11=亥). 시를 모르면 null */
  timeIndex: number | null;
  /** 보정 후 시각이 23:00~23:59 인가 */
  lateZi: boolean;
  /** 자시 이월로 날짜가 하루 넘어갔는가 */
  shiftedDay: boolean;
  /** 사용자가 음력으로 입력했는가 */
  inputCalendar: 'solar' | 'lunar';
  /** 음력 입력의 변환과 명반의 음력 날짜에 쓴 음력 기준 */
  lunarBasis: LunarBasis;
  lunarInput?: LunarDate;
  notes: string[];
}

const clockShiftOfDetail = (d: CorrectionDetail): number => (d.deltaMinutes === 0 ? 0 : -d.deltaMinutes);

/**
 * 명반에 쓰는 날짜가 입력한 날짜보다 하루 뒤인가(23시대를 다음 날 자시로 본 경우).
 * 한국식으로 00:10 이 전날 23시대가 되어도 다음 날 자시로 보면 입력한 날짜 그대로이므로 false 다(화면의 “다음 날 자시” 표시 기준).
 */
export const dayAdvanced = (n: Pick<NormalizedBirth, 'engineDate' | 'civil'>): boolean =>
  cmpYMD(n.engineDate, { y: n.civil.y, m: n.civil.m, d: n.civil.d }) > 0;

export type NormalizeResult = { ok: true; value: NormalizedBirth } | { ok: false; errors: string[] };

export const normalizeBirth = (input: BirthInput, settings: TimeSettings): NormalizeResult => {
  const errors: string[] = [];
  const notes: string[] = [];
  const [yMin, yMax] = settings.compat ? COMPAT_YEAR_RANGE : [MIN_DATE.y, MAX_DATE.y];
  const basis = lunarBasisOf(settings);

  if (!Number.isInteger(input.year) || input.year < yMin || input.year > yMax) {
    errors.push(`출생 연도는 ${yMin}~${yMax}년만 입력할 수 있습니다.`);
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) errors.push('월은 1~12 사이여야 합니다.');
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) errors.push('일은 1~31 사이여야 합니다.');
  if (input.hour !== null && (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23)) errors.push('시는 0~23 사이여야 합니다.');
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) errors.push('분은 0~59 사이여야 합니다.');
  if (input.placeId === CUSTOM_ID && (input.customLon === undefined || !Number.isFinite(input.customLon) || Math.abs(input.customLon) > 180)) {
    errors.push('경도는 −180~180 사이의 숫자로 입력하세요.');
  }
  if (errors.length) return { ok: false, errors };

  let solar: YMD;
  let lunarInput: LunarDate | undefined;
  if (input.calendar === 'lunar') {
    const s = lunarToSolar(input.year, input.month, input.leap, input.day, basis);
    if (!s) {
      const days = lunarMonthDays(input.year, input.month, input.leap, basis);
      if (days === 0) {
        const leapMonth = leapMonthOfLunarYear(input.year, basis);
        errors.push(
          input.leap
            ? `음력 ${input.year}년에는 윤${input.month}월이 없습니다.${leapMonth ? ` (이 해의 윤달은 윤${leapMonth}월)` : ' (이 해에는 윤달이 없습니다)'}`
            : `음력 ${input.year}년 ${input.month}월을 찾을 수 없습니다.`,
        );
      } else {
        errors.push(`음력 ${input.year}년 ${input.leap ? '윤' : ''}${input.month}월은 ${days}일까지 있습니다.`);
      }
      return { ok: false, errors };
    }
    solar = s;
    lunarInput = { year: input.year, month: input.month, leap: input.leap, day: input.day };
  } else {
    if (!isValidSolar(input.year, input.month, input.day)) {
      return { ok: false, errors: [`양력 ${input.year}년 ${input.month}월은 ${daysInSolarMonth(input.year, input.month)}일까지 있습니다.`] };
    }
    solar = { y: input.year, m: input.month, d: input.day };
  }

  if (cmpYMD(solar, MIN_DATE) < 0 || cmpYMD(solar, MAX_DATE) > 0) {
    return { ok: false, errors: [`${MIN_DATE.y}-${String(MIN_DATE.m).padStart(2, '0')}-${String(MIN_DATE.d).padStart(2, '0')} ~ ${MAX_DATE.y}-12-31 사이의 날짜만 계산할 수 있습니다.`] };
  }

  const hourKnown = input.hour !== null;
  const civil: Wall = { ...solar, h: hourKnown ? (input.hour as number) : 12, mi: hourKnown ? input.minute : 0 };
  const place = placeById(input.placeId);
  const tz = input.placeId === CUSTOM_ID ? (input.customTz ?? KOREA_TZ) : (place?.tz ?? KOREA_TZ);
  const instantUtcMs = civilToUtcMs(tz, civil);

  if (!hourKnown) {
    const shift = clockShiftOfDetail(correctTime(civil, input, settings).detail);
    return {
      ok: true,
      value: {
        gender: input.gender, tz, instantUtcMs, civil, hourKnown: false, corrected: null, correction: null, clockShiftMinutes: shift,
        engineDate: solar, timeIndex: null, lateZi: false, shiftedDay: false, inputCalendar: input.calendar, lunarBasis: basis, lunarInput, notes,
      },
    };
  }

  const { corrected, detail } = correctTime(civil, input, settings);
  if (detail.dst) notes.push('출생 당시 서머타임이 적용되던 시기라 시계 시각에서 서머타임 1시간을 반영해 보정했습니다.');

  const lateZi = corrected.h === 23;
  const shiftedDay = lateZi && settings.lateZi === 'next';
  const correctedDay: YMD = { y: corrected.y, m: corrected.m, d: corrected.d };
  const engineDate = shiftedDay ? addDays(correctedDay, 1) : correctedDay;
  const movedByCorrection = cmpYMD(correctedDay, solar) !== 0;
  if (shiftedDay && movedByCorrection && cmpYMD(engineDate, solar) === 0) {
    // 예: 한국식 보정으로 00:10 → 전날 23:40. 23시대는 다음 날 자시로 보므로 날짜는 입력한 그대로다
    notes.push(`보정으로 시각이 ${corrected.y}-${corrected.m}-${corrected.d} ${String(corrected.h).padStart(2, '0')}:${String(corrected.mi).padStart(2, '0')}(전날 23시대)이 되지만, 23시대는 다음 날 자시로 보므로 입력한 날짜의 자시로 계산합니다(설정에서 당일 자시로 바꿀 수 있음).`);
  } else {
    if (movedByCorrection) notes.push(`보정으로 날짜가 ${corrected.y}-${corrected.m}-${corrected.d}로 넘어갔습니다. 보정된 날짜로 명반을 계산합니다.`);
    if (shiftedDay) notes.push('23시대는 다음 날 자시로 보아 날짜를 하루 넘겨 계산합니다(설정에서 당일 자시로 바꿀 수 있음).');
  }

  if (cmpYMD(engineDate, MIN_DATE) < 0 || cmpYMD(engineDate, MAX_DATE) > 0) {
    return { ok: false, errors: ['보정 후 날짜가 계산 가능한 범위를 벗어났습니다.'] };
  }

  return {
    ok: true,
    value: {
      gender: input.gender, tz, instantUtcMs, civil, hourKnown: true, corrected, correction: detail, clockShiftMinutes: clockShiftOfDetail(detail),
      engineDate, timeIndex: hourToBranch(corrected.h), lateZi, shiftedDay, inputCalendar: input.calendar, lunarBasis: basis, lunarInput, notes,
    },
  };
};

/**
 * 폼에 입력한 출생지·날짜로 본 “시계 − 보정 후 시각”(분). 시진 범위와 시 드롭다운 표기에 쓴다(그날 정오 기준).
 * 날짜가 올바르지 않으면 기본 기준(한국식 30분, 그 밖에는 0)을 돌려준다.
 */
export const clockShiftOf = (input: BirthInput, settings: TimeSettings): number => {
  const r = normalizeBirth({ ...input, hour: 12, minute: 0 }, settings);
  if (r.ok) return r.value.clockShiftMinutes;
  return !settings.compat && input.placeId === KOREA_ID && settings.correction !== 'none' ? 30 : 0;
};
