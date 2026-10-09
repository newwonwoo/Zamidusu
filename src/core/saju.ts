// 사주 4기둥(절기 기반)과 십성·12운성·지장간·대운. 원장 N-02: iztro 의 chineseDate 는 월주가 음력 기준이라 쓰지 않는다.
//
// 시간 기준을 둘로 나눈다(설계서 4-2 보강):
//  · 연주·월주·대운 — 절기는 우주의 한 순간이므로 “실제 출생 순간(UTC)”으로 비교한다.
//    라이브러리의 절기표는 UTC+8 기준이라 순간을 UTC+8 벽시계로 바꿔 넣는다.
//  · 일주·시주 — 보정한 시계 시각(진태양시 등)의 날짜·시를 쓴다.
// 사주 계산 엔진은 결정 #3(재사용/신규)에 따라 교체될 수 있도록 SajuEngine 인터페이스 뒤에 둔다.

import { Solar } from './lunarlib';
import {
  BRANCHES, BRANCHES_KO, BRANCH_ELEMENT, STEMS, STEMS_KO, STEM_ELEMENT, isYangStem, mod,
} from './ganzhi';
import type { Element } from './ganzhi';
import { surroundingJie } from './solarterms';
import type { Gender, LateZiMode, Wall } from './time';

// ── 십성 ─────────────────────────────────────────────────────────────────────
export type TenGod = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';
export type TenGodGroup = '비겁' | '식상' | '재성' | '관성' | '인성';
export const TEN_GOD_GROUP: Record<TenGod, TenGodGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};
export const GROUPS: TenGodGroup[] = ['비겁', '식상', '재성', '관성', '인성'];

const EL_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const GOD_TABLE: [TenGod, TenGod][] = [
  ['비견', '겁재'], // 같은 오행
  ['식신', '상관'], // 내가 생함
  ['편재', '정재'], // 내가 극함
  ['편관', '정관'], // 나를 극함
  ['편인', '정인'], // 나를 생함
];

/**
 * 일간 기준 다른 천간의 십성. 오행 상생 순서(목→화→토→금→수)에서 (상대−일간) 차이가
 * 0 같음 / 1 내가 생함 / 2 내가 극함 / 3 나를 극함 / 4 나를 생함 이다. 음양까지 같으면 앞 이름(비견·식신·편재·편관·편인).
 */
export const tenGodOf = (dayStem: number, other: number): TenGod => {
  const diff = mod(EL_ORDER.indexOf(STEM_ELEMENT[other]) - EL_ORDER.indexOf(STEM_ELEMENT[dayStem]), 5);
  const samePolarity = isYangStem(dayStem) === isYangStem(other);
  return GOD_TABLE[diff][samePolarity ? 0 : 1];
};

// ── 지장간(본기 → 중기 → 여기 순) ────────────────────────────────────────────
const H = (s: string): number => STEMS.indexOf(s as (typeof STEMS)[number]);
export const HIDDEN_STEMS: number[][] = [
  [H('癸')], [H('己'), H('癸'), H('辛')], [H('甲'), H('丙'), H('戊')], [H('乙')], [H('戊'), H('乙'), H('癸')], [H('丙'), H('庚'), H('戊')],
  [H('丁'), H('己')], [H('己'), H('丁'), H('乙')], [H('庚'), H('壬'), H('戊')], [H('辛')], [H('戊'), H('辛'), H('丁')], [H('壬'), H('甲')],
];

// ── 12운성(일간 기준; 양간 순행, 음간 역행) ───────────────────────────────────
export const STAGES_KO = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'] as const;
/** 천간별 장생 지지: 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯 */
export const CHANGSHENG_BRANCH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
export const stageIndexOf = (stem: number, branch: number): number =>
  mod(isYangStem(stem) ? branch - CHANGSHENG_BRANCH[stem] : CHANGSHENG_BRANCH[stem] - branch, 12);
export const stageOf = (stem: number, branch: number): (typeof STAGES_KO)[number] => STAGES_KO[stageIndexOf(stem, branch)];
/** 건록(= 자미두수 녹존과 같은 자리)의 지지 */
export const lokBranchOf = (stem: number): number => mod(isYangStem(stem) ? CHANGSHENG_BRANCH[stem] + 3 : CHANGSHENG_BRANCH[stem] - 3, 12);

// ── 신살 표(전통 표) ─────────────────────────────────────────────────────────
/** 천을귀인(일간·연간 기준): 甲戊庚 丑未 / 乙己 子申 / 丙丁 亥酉 / 辛 寅午 / 壬癸 巳卯 */
export const CHEONEUL_BRANCHES: [number, number][] = [
  [1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5],
];
/** 문창귀인(일간 기준): 甲巳 乙午 丙申 丁酉 戊申 己酉 庚亥 辛子 壬寅 癸卯 */
export const MUNCHANG_BRANCH = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
/** 지지의 삼합 묶음: 0 申子辰 / 1 巳酉丑 / 2 寅午戌 / 3 亥卯未 */
const tripleOf = (b: number): 0 | 1 | 2 | 3 => {
  if ([8, 0, 4].includes(b)) return 0;
  if ([5, 9, 1].includes(b)) return 1;
  if ([2, 6, 10].includes(b)) return 2;
  return 3;
};
/** 역마(연지·일지 기준): 申子辰 → 寅 / 巳酉丑 → 亥 / 寅午戌 → 申 / 亥卯未 → 巳 */
export const yeokmaBranchOf = (branch: number): number => [2, 11, 8, 5][tripleOf(branch)];

// ── 결과 타입 ────────────────────────────────────────────────────────────────
export interface SajuPillar {
  stem: number;
  branch: number;
  ganzhi: string;
  ko: string;
  /** 천간의 십성(일주는 '일간') */
  stemGod: TenGod | '일간';
  /** 지지 본기의 십성 */
  branchGod: TenGod;
  hidden: { stem: number; god: TenGod }[];
  /** 일간 기준 12운성 */
  stage: string;
}
export interface DaeunItem {
  ganzhi: string;
  ko: string;
  /** 시작 나이(만 나이, 대운수부터 10년 간격) */
  startAge: number;
  endAge: number;
  startYear: number;
  stemGod: TenGod;
  branchGod: TenGod;
}
export interface SajuChart {
  engine: string;
  year: SajuPillar;
  month: SajuPillar;
  day: SajuPillar;
  hour: SajuPillar | null;
  dayMaster: { stem: number; element: Element; yang: boolean };
  /** 천간(일간 제외)과 지지 본기의 십성 묶음 개수 */
  godCounts: Record<TenGodGroup, number>;
  /** 천간 + 지지 본기 오행 개수 */
  elementCounts: Record<Element, number>;
  jie: { prev: { han: string; ko: string; utcMs: number }; next: { han: string; ko: string; utcMs: number } };
  daeun: {
    forward: boolean;
    startYears: number;
    startMonths: number;
    startDays: number;
    startUtcMs: number;
    list: DaeunItem[];
  };
  notes: string[];
}

export interface SajuInput {
  /** 실제 출생 순간(UTC ms) — 연주·월주·대운 */
  instantUtcMs: number;
  /** 일주·시주에 쓸 시계 시각(보정 반영). 시를 모르면 hourKnown=false */
  clock: Wall;
  hourKnown: boolean;
  gender: Gender;
  lateZi: LateZiMode;
}

export interface SajuEngine {
  name: string;
  compute(input: SajuInput): SajuChart;
}

// ── lunar-javascript 기반 구현 ───────────────────────────────────────────────
const BEIJING_MS = 8 * 3600 * 1000;
const parsePair = (gz: string): { stem: number; branch: number } => ({ stem: H(gz[0]), branch: BRANCHES.indexOf(gz[1] as (typeof BRANCHES)[number]) });

const makePillar = (gz: string, dayStem: number, isDay: boolean): SajuPillar => {
  const { stem, branch } = parsePair(gz);
  const hidden = HIDDEN_STEMS[branch].map((h) => ({ stem: h, god: tenGodOf(dayStem, h) }));
  return {
    stem,
    branch,
    ganzhi: STEMS[stem] + BRANCHES[branch],
    ko: STEMS_KO[stem] + BRANCHES_KO[branch],
    stemGod: isDay ? '일간' : tenGodOf(dayStem, stem),
    branchGod: hidden[0].god,
    hidden,
    stage: stageOf(dayStem, branch),
  };
};

export const lunarJavascriptEngine: SajuEngine = {
  name: 'lunar-javascript (절기 기반)',
  compute(input) {
    const notes: string[] = [];
    const sect = input.lateZi === 'next' ? 1 : 2;

    // A) 실제 순간 → UTC+8 벽시계 → 연주·월주·대운
    const b = new Date(input.instantUtcMs + BEIJING_MS);
    const solarA = Solar.fromYmdHms(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(), b.getUTCHours(), b.getUTCMinutes(), b.getUTCSeconds());
    const ecA = solarA.getLunar().getEightChar();

    // B) 보정한 시계 시각 → 일주·시주
    const c = input.clock;
    const solarB = Solar.fromYmdHms(c.y, c.m, c.d, input.hourKnown ? c.h : 12, input.hourKnown ? c.mi : 0, 0);
    const ecB = solarB.getLunar().getEightChar();
    ecB.setSect(sect);

    const dayGz: string = ecB.getDay();
    const dayStem = H(dayGz[0]);
    const year = makePillar(ecA.getYear(), dayStem, false);
    const month = makePillar(ecA.getMonth(), dayStem, false);
    const day = makePillar(dayGz, dayStem, true);
    const hour = input.hourKnown ? makePillar(ecB.getTime(), dayStem, false) : null;

    if (input.hourKnown && c.h === 23) {
      notes.push(
        input.lateZi === 'next'
          ? '자시 앞부분(보정 후 23시대) 출생: 일주를 다음 날로 봅니다(설정: 익일 자시).'
          : '자시 앞부분(보정 후 23시대) 출생: 일주는 당일로 두고 시주만 다음 날의 천간으로 정합니다(설정: 당일 자시, 야자시).',
      );
    }

    const pillars = [year, month, day, ...(hour ? [hour] : [])];
    const godCounts: Record<TenGodGroup, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    const elementCounts: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    for (const p of pillars) {
      if (p.stemGod !== '일간') godCounts[TEN_GOD_GROUP[p.stemGod]]++;
      godCounts[TEN_GOD_GROUP[p.branchGod]]++;
      elementCounts[STEM_ELEMENT[p.stem]]++;
      elementCounts[BRANCH_ELEMENT[p.branch]]++;
    }

    const jie = surroundingJie(input.instantUtcMs);
    if (!input.hourKnown) {
      // 시를 모르면 순간이 확정되지 않는다(정오로 가정). 그날 절(節)이 들어 있으면 월주가 달라질 수 있다.
      const lo = input.instantUtcMs - 12 * 3600 * 1000;
      const hi = input.instantUtcMs + 12 * 3600 * 1000;
      for (const t of [jie.prev, jie.next]) {
        if (t.utcMs >= lo && t.utcMs < hi) notes.push(`출생 시각을 모르는데 이날 ${t.def.ko}(절기)이 들어 있어 월주가 정확하지 않을 수 있습니다.`);
      }
    }

    const yun = ecA.getYun(input.gender === 'M' ? 1 : 0, 2);
    const forward: boolean = yun.isForward();
    const startYears: number = yun.getStartYear();
    const startMonths: number = yun.getStartMonth();
    const startDays: number = yun.getStartDay();
    const startSolar = yun.getStartSolar();
    const startUtcMs = Date.UTC(startSolar.getYear(), startSolar.getMonth() - 1, startSolar.getDay(), startSolar.getHour(), startSolar.getMinute(), startSolar.getSecond()) - BEIJING_MS;

    const list: DaeunItem[] = [];
    const dys = yun.getDaYun(9);
    for (let i = 1; i < dys.length; i++) {
      const gz: string = dys[i].getGanZhi();
      const { stem, branch } = parsePair(gz);
      list.push({
        ganzhi: gz,
        ko: STEMS_KO[stem] + BRANCHES_KO[branch],
        startAge: startYears + (i - 1) * 10,
        endAge: startYears + (i - 1) * 10 + 9,
        startYear: dys[i].getStartYear(),
        stemGod: tenGodOf(dayStem, stem),
        branchGod: tenGodOf(dayStem, HIDDEN_STEMS[branch][0]),
      });
    }

    return {
      engine: this.name,
      year, month, day, hour,
      dayMaster: { stem: dayStem, element: STEM_ELEMENT[dayStem], yang: isYangStem(dayStem) },
      godCounts,
      elementCounts,
      jie: {
        prev: { han: jie.prev.def.han, ko: jie.prev.def.ko, utcMs: jie.prev.utcMs },
        next: { han: jie.next.def.han, ko: jie.next.def.ko, utcMs: jie.next.utcMs },
      },
      daeun: { forward, startYears, startMonths, startDays, startUtcMs, list },
      notes,
    };
  },
};

export const defaultSajuEngine: SajuEngine = lunarJavascriptEngine;
