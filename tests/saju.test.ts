// V-12 사주 4기둥(N-02, D-1) · V-13 사주 비교 근거(C-2, C-3, D-2, D-3, D-4)
// 독립 검증 수단: ① 일주 JDN 산술 ② 오호둔·오서둔 산술 ③ 24절기 시각을 태양 황경 천문식(Meeus)으로 재계산
//                ④ 같은 저자의 재설계판 tyme4ts(절기 데이터는 같은 계열이라 부분 독립)
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  CHEONEUL_BRANCHES, HIDDEN_STEMS, MUNCHANG_BRANCH, lokBranchOf, lunarJavascriptEngine, stageOf, tenGodOf, yeokmaBranchOf,
} from '../src/core/saju';
import type { SajuInput } from '../src/core/saju';
import { SOLAR_TERMS, solarTermsOfYear, surroundingJie } from '../src/core/solarterms';
import { BRANCHES, STEMS, mod, ratStem, stemOfBranchFromYear } from '../src/core/ganzhi';
import { hourToBranch } from '../src/core/time';
import { Solar } from '../src/core/lunarlib';
import { makeChart, positionOf, randomSolarDate, rng } from './helpers';

const require_ = createRequire(import.meta.url);
const T = require_('tyme4ts');
const BJ = 8 * 3600 * 1000;

/** 베이징 벽시계 시각을 그대로 시계·순간으로 쓰는 입력(라이브러리 단독 EightChar 와 같은 조건) */
const inputAtBeijing = (y: number, m: number, d: number, h: number, mi: number, gender: 'M' | 'F' = 'M', lateZi: 'next' | 'current' = 'next'): SajuInput => ({
  instantUtcMs: Date.UTC(y, m - 1, d, h, mi) - BJ,
  clock: { y, m, d, h, mi },
  hourKnown: true,
  gender,
  lateZi,
});

// ── 독립 산술 ────────────────────────────────────────────────────────────────
const jdn = (y: number, m: number, d: number): number => {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
const dayIndex60 = (y: number, m: number, d: number): number => mod(jdn(y, m, d) + 49, 60);
const addDay = (y: number, m: number, d: number, n: number) => {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const JIE_BRANCH: Record<string, number> = {
  小寒: 1, 立春: 2, 驚蟄: 3, 清明: 4, 立夏: 5, 芒種: 6, 小暑: 7, 立秋: 8, 白露: 9, 寒露: 10, 立冬: 11, 大雪: 0,
};

const arithmeticPillars = (inp: SajuInput): string[] => {
  // 연주·월주: 절기 순간과 비교 (라이브러리 절기표를 쓰되 산술은 독립)
  const wallYear = new Date(inp.instantUtcMs + BJ).getUTCFullYear();
  const lichun = solarTermsOfYear(wallYear).find((t) => t.def.han === '立春')!.utcMs;
  const yearForPillar = inp.instantUtcMs >= lichun ? wallYear : wallYear - 1;
  const yStem = mod(yearForPillar - 4, 10);
  const yBranch = mod(yearForPillar - 4, 12);
  const prevJie = surroundingJie(inp.instantUtcMs).prev;
  const mBranch = JIE_BRANCH[prevJie.def.han];
  const mStem = stemOfBranchFromYear(yStem, mBranch);
  // 일주: 시계 날짜. 23시대 익일 자시이면 다음 날
  const c = inp.clock;
  const shift = c.h === 23 && inp.lateZi === 'next' ? 1 : 0;
  const dd = addDay(c.y, c.m, c.d, shift);
  const dIdx = dayIndex60(dd.y, dd.m, dd.d);
  // 시주: 23시대는 어느 설정이든 다음 날 천간으로 오서둔
  const hd = addDay(c.y, c.m, c.d, c.h === 23 ? 1 : 0);
  const hStem = mod(ratStem(dayIndex60(hd.y, hd.m, hd.d) % 10) + hourToBranch(c.h), 10);
  return [
    STEMS[yStem] + BRANCHES[yBranch],
    STEMS[mStem] + BRANCHES[mBranch],
    STEMS[dIdx % 10] + BRANCHES[dIdx % 12],
    STEMS[hStem] + BRANCHES[hourToBranch(c.h)],
  ];
};

// ── 태양 황경(Meeus 저정밀식, 정확도 약 0.01° ≈ 15분) ─────────────────────────
const sunLongitude = (utcMs: number): number => {
  const jd = utcMs / 86400000 + 2440587.5 + 69 / 86400; // ΔT ≈ 69초 근사
  const t = (jd - 2451545.0) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = ((357.52911 + 35999.05029 * t - 0.0001537 * t * t) * Math.PI) / 180;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) + (0.019993 - 0.000101 * t) * Math.sin(2 * m) + 0.000289 * Math.sin(3 * m);
  const omega = ((125.04 - 1934.136 * t) * Math.PI) / 180;
  return mod(l0 + c - 0.00569 - 0.00478 * Math.sin(omega), 360);
};
const TERM_LONGITUDE: Record<string, number> = {
  小寒: 285, 大寒: 300, 立春: 315, 雨水: 330, 驚蟄: 345, 春分: 0, 清明: 15, 穀雨: 30, 立夏: 45, 小滿: 60, 芒種: 75, 夏至: 90,
  小暑: 105, 大暑: 120, 立秋: 135, 處暑: 150, 白露: 165, 秋分: 180, 寒露: 195, 霜降: 210, 立冬: 225, 小雪: 240, 大雪: 255, 冬至: 270,
};

describe('V-12 사주 4기둥', () => {
  it('T6(1990-01-30 12시): 사주 己巳 丁丑 乙未 壬午 — 원장 N-02/D-1', () => {
    const s = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 0, 30, 12, 0) - 9 * 3600 * 1000, // 한국 시각 12:00
      clock: { y: 1990, m: 1, d: 30, h: 12, mi: 0 }, hourKnown: true, gender: 'M', lateZi: 'next',
    });
    expect([s.year.ganzhi, s.month.ganzhi, s.day.ganzhi, s.hour!.ganzhi]).toEqual(['己巳', '丁丑', '乙未', '壬午']);
    // 자미두수는 같은 입력에서 庚午년 정월 — 두 체계가 다르다
    const chart = makeChart(1990, 1, 30, 6, 'M');
    expect(STEMS[chart.meta.yearStem] + BRANCHES[chart.meta.yearBranch]).toBe('庚午');
    expect(chart.meta.lunar.month).toBe(1);
  });

  it('한국 시각 입력은 UTC+8 절기표와 비교하도록 순간 기준으로 처리한다(절기 직전 1시간 구간)', () => {
    // 1990 입춘 = 10:14 (UTC+8) = 11:14 (KST). KST 10:30 은 아직 입춘 전, 11:30 은 입춘 후.
    const before = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 1, 4, 10, 30) - 9 * 3600 * 1000, clock: { y: 1990, m: 2, d: 4, h: 10, mi: 30 }, hourKnown: true, gender: 'M', lateZi: 'next',
    });
    const after = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 1, 4, 11, 30) - 9 * 3600 * 1000, clock: { y: 1990, m: 2, d: 4, h: 11, mi: 30 }, hourKnown: true, gender: 'M', lateZi: 'next',
    });
    expect(before.year.ganzhi).toBe('己巳');
    expect(before.month.ganzhi).toBe('丁丑');
    expect(after.year.ganzhi).toBe('庚午');
    expect(after.month.ganzhi).toBe('戊寅');
  });

  it('무작위 800건: 연·월·일·시주가 독립 산술(JDN·오호둔·오서둔)과 일치한다', () => {
    const r = rng(1010);
    const bad: string[] = [];
    for (let i = 0; i < 800; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2099);
      const h = Math.floor(r() * 24);
      const mi = Math.floor(r() * 60);
      const lateZi = r() < 0.5 ? 'next' : 'current';
      const inp = inputAtBeijing(y, m, d, h, mi, 'M', lateZi);
      const s = lunarJavascriptEngine.compute(inp);
      const got = [s.year.ganzhi, s.month.ganzhi, s.day.ganzhi, s.hour!.ganzhi];
      const want = arithmeticPillars(inp);
      if (got.join() !== want.join()) bad.push(`${y}-${m}-${d} ${h}:${mi} ${lateZi} 엔진=${got} 산술=${want}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('12절 경계 ±90초: 월주(입춘은 연주도)가 정확히 그 순간에 바뀐다', () => {
    const bad: string[] = [];
    for (const year of [1905, 1950, 1990, 2024, 2077]) {
      for (const t of solarTermsOfYear(year).filter((x) => x.def.jie)) {
        const mk = (offsetSec: number) => {
          const ms = t.utcMs + offsetSec * 1000;
          const w = new Date(ms + BJ);
          return lunarJavascriptEngine.compute(inputAtBeijing(w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes()));
        };
        const a = mk(-90);
        const b = mk(+90);
        if (a.month.branch === b.month.branch) bad.push(`${year} ${t.def.han}: 월지가 안 바뀜`);
        if (b.month.branch !== JIE_BRANCH[t.def.han]) bad.push(`${year} ${t.def.han}: 월지 ${b.month.branch}`);
        if (t.def.han === '立春' && a.year.ganzhi === b.year.ganzhi) bad.push(`${year} 입춘: 연주가 안 바뀜`);
        if (t.def.han !== '立春' && a.year.ganzhi !== b.year.ganzhi && t.def.han !== '小寒') bad.push(`${year} ${t.def.han}: 연주가 바뀜`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('tyme4ts(같은 저자의 재설계판) 300건과 4기둥이 일치한다', () => {
    const r = rng(77);
    const bad: string[] = [];
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2099);
      const h = Math.floor(r() * 23); // 23시대는 설정 의존이라 제외
      const mi = Math.floor(r() * 60);
      const s = lunarJavascriptEngine.compute(inputAtBeijing(y, m, d, h, mi));
      const ec = T.SolarTime.fromYmdHms(y, m, d, h, mi, 0).getLunarHour().getEightChar();
      const want = [ec.getYear().getName(), ec.getMonth().getName(), ec.getDay().getName(), ec.getHour().getName()];
      const got = [s.year.ganzhi, s.month.ganzhi, s.day.ganzhi, s.hour!.ganzhi];
      if (got.join() !== want.join()) bad.push(`${y}-${m}-${d} ${h}:${mi} 엔진=${got} tyme=${want}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('24절기 시각: 태양 황경 천문식과 25분 이내로 일치한다(40개 연도 × 24절기)', () => {
    let worst = 0;
    const bad: string[] = [];
    for (let year = 1905; year <= 2095; year += 5) {
      for (const t of solarTermsOfYear(year)) {
        const target = TERM_LONGITUDE[t.def.han];
        let diff = sunLongitude(t.utcMs) - target;
        diff = ((diff + 540) % 360) - 180; // −180~180
        const minutes = (diff / 0.98565) * 1440; // 태양은 하루에 약 0.98565° 이동
        worst = Math.max(worst, Math.abs(minutes));
        if (Math.abs(minutes) > 25) bad.push(`${year} ${t.def.han}: ${minutes.toFixed(1)}분`);
      }
    }
    expect(bad).toEqual([]);
    expect(worst).toBeLessThan(25);
  });

  it('십성·지장간·12운성이 라이브러리의 값과 일치한다(300건)', () => {
    const map: Record<string, string> = {
      比肩: '비견', 劫财: '겁재', 食神: '식신', 伤官: '상관', 偏财: '편재', 正财: '정재', 七杀: '편관', 正官: '정관', 偏印: '편인', 正印: '정인',
    };
    const stageMap: Record<string, string> = {
      长生: '장생', 沐浴: '목욕', 冠带: '관대', 临官: '건록', 帝旺: '제왕', 衰: '쇠', 病: '병', 死: '사', 墓: '묘', 绝: '절', 胎: '태', 养: '양',
    };
    const r = rng(303);
    const bad: string[] = [];
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2099);
      const h = Math.floor(r() * 23);
      const s = lunarJavascriptEngine.compute(inputAtBeijing(y, m, d, h, 10));
      const ec = Solar.fromYmdHms(y, m, d, h, 10, 0).getLunar().getEightChar();
      ec.setSect(1);
      const lib = [
        { p: s.year, gan: ec.getYearShiShenGan(), zhi: ec.getYearShiShenZhi(), hide: ec.getYearHideGan(), stage: ec.getYearDiShi() },
        { p: s.month, gan: ec.getMonthShiShenGan(), zhi: ec.getMonthShiShenZhi(), hide: ec.getMonthHideGan(), stage: ec.getMonthDiShi() },
        { p: s.day, gan: ec.getDayShiShenGan(), zhi: ec.getDayShiShenZhi(), hide: ec.getDayHideGan(), stage: ec.getDayDiShi() },
        { p: s.hour!, gan: ec.getTimeShiShenGan(), zhi: ec.getTimeShiShenZhi(), hide: ec.getTimeHideGan(), stage: ec.getTimeDiShi() },
      ];
      for (const x of lib) {
        if (x.p.stemGod !== '일간' && map[x.gan] !== x.p.stemGod) bad.push(`${y}-${m}-${d} 천간십성 ${x.gan}≠${x.p.stemGod}`);
        const zhiGods = x.zhi.map((g: string) => map[g]);
        if (zhiGods.join() !== x.p.hidden.map((hh) => hh.god).join()) bad.push(`${y}-${m}-${d} 지장간십성 ${zhiGods}≠${x.p.hidden.map((hh) => hh.god)}`);
        if (x.hide.join() !== x.p.hidden.map((hh) => STEMS[hh.stem]).join()) bad.push(`${y}-${m}-${d} 지장간 ${x.hide}`);
        if (stageMap[x.stage] !== x.p.stage) bad.push(`${y}-${m}-${d} 12운성 ${x.stage}≠${x.p.stage}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('십성 정의 점검: 乙 일간 기준 己=편재, 丁=식신, 壬=정인, 乙=비견, 甲=겁재', () => {
    expect(tenGodOf(1, 5)).toBe('편재');
    expect(tenGodOf(1, 3)).toBe('식신');
    expect(tenGodOf(1, 8)).toBe('정인');
    expect(tenGodOf(1, 1)).toBe('비견');
    expect(tenGodOf(1, 0)).toBe('겁재');
    expect(HIDDEN_STEMS).toHaveLength(12);
  });

  it('대운: 방향과 시작 나이가 “절기까지 날수 ÷ 3” 규칙과 맞는다(300건)', () => {
    const r = rng(404);
    const bad: string[] = [];
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2090);
      const h = Math.floor(r() * 24);
      const gender = r() < 0.5 ? 'M' : 'F';
      const inp = inputAtBeijing(y, m, d, h, 20, gender);
      const s = lunarJavascriptEngine.compute(inp);
      const yangYear = s.year.stem % 2 === 0;
      const wantForward = yangYear === (gender === 'M');
      if (s.daeun.forward !== wantForward) bad.push(`${y}-${m}-${d} 방향`);
      const jie = surroundingJie(inp.instantUtcMs);
      const days = wantForward ? (jie.next.utcMs - inp.instantUtcMs) / 86400000 : (inp.instantUtcMs - jie.prev.utcMs) / 86400000;
      const years = days / 3;
      const got = s.daeun.startYears + s.daeun.startMonths / 12 + s.daeun.startDays / 360;
      if (Math.abs(got - years) > 0.12) bad.push(`${y}-${m}-${d} 시작나이 ${got.toFixed(2)} ≠ ${years.toFixed(2)}`);
      // 첫 대운 간지: 월주의 다음(순행) 또는 이전(역행) 60갑자
      const monthIdx = [...Array(60).keys()].find((n) => n % 10 === s.month.stem && n % 12 === s.month.branch)!;
      const want1 = mod(monthIdx + (wantForward ? 1 : -1), 60);
      if (s.daeun.list[0].ganzhi !== STEMS[want1 % 10] + BRANCHES[want1 % 12]) bad.push(`${y}-${m}-${d} 첫 대운 ${s.daeun.list[0].ganzhi}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('시를 모르고 그날 절기가 들면 월주 불확실 안내가 붙는다', () => {
    // 1990-02-04 는 입춘일
    const s = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 1, 4, 12, 0) - 9 * 3600 * 1000, clock: { y: 1990, m: 2, d: 4, h: 12, mi: 0 }, hourKnown: false, gender: 'M', lateZi: 'next',
    });
    expect(s.hour).toBeNull();
    expect(s.notes.some((n) => n.includes('입춘'))).toBe(true);
    const plain = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 0, 30, 12, 0) - 9 * 3600 * 1000, clock: { y: 1990, m: 1, d: 30, h: 12, mi: 0 }, hourKnown: false, gender: 'M', lateZi: 'next',
    });
    expect(plain.notes).toEqual([]);
  });

  it('12절/24절기 정의: 절 12개, 24개, 정식 이름이 라이브러리 표와 모두 대응한다', () => {
    expect(SOLAR_TERMS).toHaveLength(24);
    expect(SOLAR_TERMS.filter((t) => t.jie)).toHaveLength(12);
    for (const y of [1900, 2000, 2100]) expect(solarTermsOfYear(y)).toHaveLength(24);
  });
});

describe('V-13 사주 비교 근거', () => {
  it('C-3 (T7: 1930~2020 매년 7월 1일, 91년): 녹존=건록, 천마=역마, 천괴·천월=천을귀인', () => {
    const bad: string[] = [];
    let n = 0;
    for (let y = 1930; y <= 2020; y++) {
      const chart = makeChart(y, 7, 1, 6, 'M');
      const stem = chart.meta.yearStem;
      const branch = chart.meta.yearBranch;
      if (positionOf(chart, '祿存') !== lokBranchOf(stem)) bad.push(`${y} 녹존`);
      if (positionOf(chart, '天馬') !== yeokmaBranchOf(branch)) bad.push(`${y} 천마`);
      const pair = [positionOf(chart, '天魁'), positionOf(chart, '天鉞')].sort((a, b) => (a as number) - (b as number));
      const want = [...CHEONEUL_BRANCHES[stem]].sort((a, b) => a - b);
      if (pair.join() !== want.join()) bad.push(`${y} 괴월 ${pair} ≠ ${want}`);
      n++;
    }
    expect(n).toBe(91);
    expect(bad).toEqual([]);
  });

  it('C-3 보조: 사주 12운성 표에서 구한 건록 위치가 자미두수 녹존 표와 열 가지 천간 모두 같다', () => {
    for (let s = 0; s < 10; s++) expect(stageOf(s, lokBranchOf(s))).toBe('건록');
  });

  it('D-2: 문창은 사주(일간 기준)와 자미두수(생시 기준)가 다른 규칙이다 — T6에서 午 대 辰', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const saju = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 0, 30, 12, 0) - 9 * 3600 * 1000, clock: { y: 1990, m: 1, d: 30, h: 12, mi: 0 }, hourKnown: true, gender: 'M', lateZi: 'next',
    });
    expect(MUNCHANG_BRANCH[saju.day.stem]).toBe(BRANCHES.indexOf('午'));
    expect(positionOf(chart, '文昌')).toBe(BRANCHES.indexOf('辰'));
    // 두 규칙이 우연히 같아지는 비율은 낮다(10 일간 × 12 시진 120쌍 중 10쌍 = 약 8%)
    let same = 0;
    for (let stem = 0; stem < 10; stem++) for (let hb = 0; hb < 12; hb++) if (MUNCHANG_BRANCH[stem] === mod(10 - hb, 12)) same++;
    expect(same).toBe(10);
  });

  it('D-3 (300건): 자미두수 장생12신의 시작 위치는 오행국으로 정해진다(水二·土五 申, 木三 亥, 金四 巳, 火六 寅)', () => {
    const r = rng(505);
    const want: Record<number, number> = { 2: 8, 5: 8, 3: 11, 4: 5, 6: 2 };
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2099);
      const chart = makeChart(y, m, d, Math.floor(r() * 12), r() < 0.5 ? 'M' : 'F');
      const start = chart.palaces.find((p) => p.twelve.changsheng === '長生')!.branch;
      expect(start, `${y}-${m}-${d}`).toBe(want[chart.meta.fiveElements.num]);
    }
  });

  it('D-4: 자미두수의 첫 대한 시작 나이는 오행국 수(2·3·4·5·6세), 사주 대운수는 절기까지 날수에 따라 달라진다', () => {
    const r = rng(606);
    const saju = new Set<number>();
    for (let i = 0; i < 120; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2090);
      const chart = makeChart(y, m, d, 5, 'M');
      expect([2, 3, 4, 5, 6]).toContain(chart.meta.firstDecadalAge);
      expect(chart.meta.firstDecadalAge).toBe(chart.meta.fiveElements.num);
      saju.add(lunarJavascriptEngine.compute(inputAtBeijing(y, m, d, 12, 0)).daeun.startYears);
    }
    expect(saju.size).toBeGreaterThanOrEqual(8); // 0~10 사이로 넓게 흩어진다
  });

  it('C-2 (300건): 연간이 같으면 대운 방향(사주)과 대한 방향(자미두수)이 같다', () => {
    const r = rng(707);
    let compared = 0;
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1901, 2090);
      const gender = r() < 0.5 ? 'M' : 'F';
      const chart = makeChart(y, m, d, 5, gender);
      const s = lunarJavascriptEngine.compute({
        instantUtcMs: Date.UTC(y, m - 1, d, 10, 0) - 9 * 3600 * 1000, clock: { y, m, d, h: 10, mi: 0 }, hourKnown: true, gender, lateZi: 'next',
      });
      if (s.year.stem !== chart.meta.yearStem) continue; // 설~입춘 사이 출생: 연간이 달라 방향도 달라질 수 있다
      expect(s.daeun.forward).toBe(chart.meta.decadalForward);
      compared++;
    }
    expect(compared).toBeGreaterThan(250);
  });

  it('C-2 주의: T6는 설~입춘 사이라 연간이 다르고(庚 대 己) 두 방향도 다르다', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const s = lunarJavascriptEngine.compute({
      instantUtcMs: Date.UTC(1990, 0, 30, 12, 0) - 9 * 3600 * 1000, clock: { y: 1990, m: 1, d: 30, h: 12, mi: 0 }, hourKnown: true, gender: 'M', lateZi: 'next',
    });
    expect(chart.meta.decadalForward).toBe(true); // 庚(양) 남 → 순행
    expect(s.daeun.forward).toBe(false); // 己(음) 남 → 역행
  });
});
