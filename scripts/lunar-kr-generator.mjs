// 한국 음력 생성기 — 천문 계산(합삭·중기)으로 음양력을 만든다.
//
// 왜 필요한가: 이 프로젝트의 명반·사주 엔진(iztro, lunar-javascript)은 음력을 중국 표준시(UTC+8) 날짜로 센다.
// 한국 음력(한국천문연구원, KASI)은 한국 표준시(UTC+9) 날짜로 센다. 합삭(朔)이 자정 근처에 들면 초하루가 하루 달라지고,
// 중기(中氣)가 자정 근처에 들면 윤달이 다른 달에 놓이기도 한다(예: 2012년 한국은 윤3월, 중국은 윤4월).
// 1900~2050년 중 1,978일(3.59%)이 다르다. 음력 일이 달라지면 자미성 위치가 바뀌므로 명반이 달라진다.
//
// 규칙(검증 완료 — tests/lunarkr.test.ts):
//   · 1912-01-01 이전: 중국 표준시 날짜(한국천문연구원 표가 이 기간은 중국 음력과 완전히 같다)
//   · 1912-01-01 이후: 한국 표준시(UTC+9, 1954-03-21~1961-08-09 는 UTC+8:30)의 날짜
//   · 월 번호: 동지가 든 달 = 11월, 동지~동지 사이가 13개월이면 처음으로 중기가 없는 달이 윤달
// 결과는 src/core/lunarkr-data.ts 의 표로 저장한다(실행 환경의 부동소수점 차이에 흔들리지 않게).
//   재생성: node scripts/gen-lunar-kr.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ShouXingUtil: S } = require('lunar-javascript');

export const DAY_MS = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
/** lunar-javascript 천문 함수의 반환값(J2000 기준 일수, UT+8 보정 포함)을 UTC ms 로 */
const toUtcMs = (t) => J2000_MS + (t - 1 / 3) * DAY_MS;
const shuoMs = (k) => toUtcMs(S.shuoHigh(k * Math.PI * 2));
/** 중기: 태양 황경 30°×n. n=0 은 1999년 춘분(라이브러리의 황경 기준점), 동지(270°)는 n%12 === 9 */
const zhongQiMs = (n) => toUtcMs(S.qiAccurate((n * Math.PI) / 6));

/** 중국 표준시(UTC+8) */
export const chineseOffset = () => 480;

const T_KOREA_FROM = Date.UTC(1911, 11, 31, 15, 0); // 1912-01-01 00:00 (UTC+9)
const T_HALF_FROM = Date.UTC(1954, 2, 20, 15, 0); // 1954-03-21 00:00 → UTC+8:30
const T_HALF_TO = Date.UTC(1961, 7, 9, 15, 30); // 1961-08-10 00:00 (UTC+8:30) → UTC+9

/** 한국 음력의 날짜 경계가 되는 표준시(분). 위 규칙 참고 */
export const koreanOffset = (utcMs) => (utcMs < T_KOREA_FROM ? 480 : utcMs < T_HALF_FROM ? 540 : utcMs < T_HALF_TO ? 510 : 540);

export const epochDay = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
export const fromEpochDay = (n) => {
  const t = new Date(n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

/**
 * 음양력 달력 생성. offsetOf(utcMs) = 그 순간의 날짜 경계 표준시(분).
 * 반환 months[i] = { year, num, leap, start(에포크 일수), days } — 동지~동지 구간이 모두 갖춰진 달만 채워진다.
 */
export function buildCalendar(offsetOf, fromYear, toYear) {
  const dayNo = (ms) => Math.floor((ms + offsetOf(ms) * 60000) / DAY_MS);
  const k0 = Math.floor((Date.UTC(fromYear, 5, 1) - J2000_MS) / DAY_MS / 29.530588) - 1;
  const k1 = Math.ceil((Date.UTC(toYear, 11, 31) - J2000_MS) / DAY_MS / 29.530588) + 1;
  const starts = [];
  for (let k = k0; k <= k1; k++) starts.push(dayNo(shuoMs(k)));

  const n0 = (fromYear - 1999) * 12 - 12;
  const n1 = (toYear - 1999) * 12 + 12;
  const zq = [];
  for (let n = n0; n <= n1; n++) zq.push({ n, day: dayNo(zhongQiMs(n)) });

  const monthOfDay = (d) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const zqCount = new Array(starts.length).fill(0);
  for (const z of zq) {
    if (z.day < starts[0]) continue;
    const i = monthOfDay(z.day);
    if (i < starts.length - 1) zqCount[i]++;
  }
  const winter = zq
    .filter((z) => (((z.n % 12) + 12) % 12) === 9 && z.day >= starts[0])
    .map((z) => ({ idx: monthOfDay(z.day), year: 1999 + Math.floor(z.n / 12) }));

  const months = new Array(starts.length - 1).fill(null);
  for (let j = 0; j + 1 < winter.length; j++) {
    const a = winter[j].idx;
    const b = winter[j + 1].idx;
    const G = winter[j].year;
    if (b >= starts.length - 1) break;
    const span = b - a;
    if (span !== 12 && span !== 13) throw new Error(`동지 사이 ${span}개월(${G}년) — 계산 오류`);
    let leapIdx = -1;
    if (span === 13) for (let i = a + 1; i < b; i++) if (zqCount[i] === 0) { leapIdx = i; break; }
    let num = 11;
    let year = G;
    months[a] = { year, num: 11, leap: false };
    for (let i = a + 1; i < b; i++) {
      if (i === leapIdx) { months[i] = { year, num, leap: true }; continue; }
      num = num === 12 ? 1 : num + 1;
      if (num === 1) year = G + 1;
      months[i] = { year, num, leap: false };
    }
  }
  const out = months.map((mo, i) => (mo ? { ...mo, start: starts[i], days: starts[i + 1] - starts[i] } : null));
  return { months: out, monthOfDay };
}

/** 에포크 일수 → 음력 날짜(없으면 null) */
export function lunarOfDay(cal, day) {
  const m = cal.months[cal.monthOfDay(day)];
  return m ? { year: m.year, month: m.num, leap: m.leap, day: day - m.start + 1, monthDays: m.days } : null;
}

/** 음력 연도별 정보: 정월 초하루의 에포크 일수, 윤달 번호(0=없음), 달별 일수(시간순) */
export function yearInfos(cal, fromYear, toYear) {
  const byYear = new Map();
  for (const m of cal.months) {
    if (!m) continue;
    if (!byYear.has(m.year)) byYear.set(m.year, []);
    byYear.get(m.year).push(m);
  }
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const list = (byYear.get(y) ?? []).sort((p, q) => p.start - q.start);
    // 한 해는 정월(1월)부터 12월까지다. 앞쪽에 붙은 전해 11·12월은 전해 표에 속한다.
    const first = list.findIndex((m) => m.num === 1 && !m.leap);
    const months = first < 0 ? [] : list.slice(first);
    if (months.length < 12 || months.length > 13) throw new Error(`${y}년 달 수 ${months.length}`);
    const leapAt = months.findIndex((m) => m.leap);
    out.push({ year: y, newYear: months[0].start, leap: leapAt < 0 ? 0 : months[leapAt].num, lengths: months.map((m) => m.days) });
  }
  return out;
}

/** 연도 정보 → 정수 하나: [정월 초하루가 1월 1일에서 떨어진 일수 6비트][윤달 4비트][달 길이 13비트(1=30일)] */
export function encodeYear(info) {
  const jan1 = epochDay(info.year, 1, 1);
  const ny = info.newYear - jan1;
  if (ny < 0 || ny > 63) throw new Error(`${info.year}년 정월 초하루 위치 ${ny}`);
  let bits = 0;
  info.lengths.forEach((len, i) => {
    if (len !== 29 && len !== 30) throw new Error(`${info.year}년 ${i + 1}번째 달이 ${len}일`);
    if (len === 30) bits |= 1 << (12 - i);
  });
  return (ny << 17) | (info.leap << 13) | bits;
}

/** src/core/lunarkr-data.ts 의 내용 */
export function renderDataModule(infos, meta) {
  const rows = infos.map((i) => `0x${encodeYear(i).toString(16).padStart(6, '0')}`);
  const lines = [];
  for (let i = 0; i < rows.length; i += 8) lines.push(`  ${rows.slice(i, i + 8).join(', ')},`);
  return `// 자동 생성 파일 — 수정하지 마세요. 만든 곳: scripts/gen-lunar-kr.mjs (규칙·검증: scripts/lunar-kr-generator.mjs, tests/lunarkr.test.ts)
// 한국 음력(한국 표준시 기준)의 연도별 정보. 각 값 = [정월 초하루가 1월 1일에서 떨어진 일수 6비트][윤달 번호 4비트][달 길이 13비트: 1=30일, 29일이면 0, 시간순]
// 범위: 음력 ${meta.first}년 ~ ${meta.last}년 (양력 ${meta.firstSolar} ~ ${meta.lastSolar})

export const KR_LUNAR_FIRST_YEAR = ${meta.first};
export const KR_LUNAR_INFO: readonly number[] = [
${lines.join('\n')}
];
`;
}
