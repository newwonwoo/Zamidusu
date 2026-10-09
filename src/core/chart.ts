// 명반 포국 래퍼. 엔진(iztro)의 결과를 화면·해설이 쓰는 평범한 객체(Chart)로 옮기고,
// 운 모드(대한·유년·유월·유일·유시) 뷰, 삼방사정, 지수를 제공한다.
// iztro 의 config 는 전역 상태이므로 계산 직전마다 명시적으로 지정한다.

import { astro } from 'iztro';
import { setBirthYearOverride } from 'lunar-lite';
import type { Brightness7, BrightnessMode } from './brightness';
import { averageScore, parseBrightness } from './brightness';
import { applyCompat, compatDecadalNames } from './compat';
import {
  BRANCHES, STEMS, branchIndex, ganzhiName, mod, stemIndex,
} from './ganzhi';
import {
  MUTAGENS, PALACE_KEYS, SCOPE_KO, mutagenFromZh, palaceKeyFromZh, parseFlowStar, sortStars, starMeta,
} from './names';
import type { FlowStarMeta, Mutagen, PalaceKey, Scope, StarGroup, StarTone, TwelveSeries } from './names';
import { ipchunYearOf } from './solarterms';
import { addDays, solarToLunar } from './time';
import type { Gender, LateZiMode, LunarDate, NormalizedBirth, YMD } from './time';

export type YearBasis = 'lunarNewYear' | 'ipchun';

export interface ChartOptions {
  /** 연도 기준(N-03): 음력 설(기본, 사이트와 동일) / 입춘 */
  yearBasis: YearBasis;
  lateZi: LateZiMode;
  /** 윤달 후반(16일~)을 다음 달로 보정 */
  leapFix: boolean;
  /** 원본 호환 모드(검증 전용) */
  compat: boolean;
}
export const DEFAULT_CHART_OPTIONS: ChartOptions = { yearBasis: 'lunarNewYear', lateZi: 'next', leapFix: true, compat: false };

export interface StarView {
  key: string;
  ko: string;
  hanja: string;
  group: StarGroup;
  tone: StarTone;
  brightness?: Brightness7;
  /** 생년 사화 */
  mutagen?: Mutagen;
}

export interface PalaceView {
  /** 지지 인덱스(0=子) */
  branch: number;
  stem: number;
  ganzhi: string;
  natalName: PalaceKey;
  stars: StarView[];
  twelve: Record<TwelveSeries, string>;
  decadalRange: [number, number];
  ages: number[];
  isBody: boolean;
}

export type FiveElementsKey = 'water2' | 'wood3' | 'metal4' | 'earth5' | 'fire6';
export const FIVE_ELEMENTS: Record<string, { key: FiveElementsKey; num: number; ko: string; hanja: string }> = {
  水二局: { key: 'water2', num: 2, ko: '수이국', hanja: '水二局' },
  木三局: { key: 'wood3', num: 3, ko: '목삼국', hanja: '木三局' },
  金四局: { key: 'metal4', num: 4, ko: '금사국', hanja: '金四局' },
  土五局: { key: 'earth5', num: 5, ko: '토오국', hanja: '土五局' },
  火六局: { key: 'fire6', num: 6, ko: '화육국', hanja: '火六局' },
};

export interface ChartMeta {
  gender: Gender;
  /** 엔진에 넘긴 양력일 'YYYY-M-D' */
  solarDate: string;
  lunar: LunarDate;
  yearStem: number;
  yearBranch: number;
  /** 명반 연도 기준으로 나이 1세가 되는 양력 연도 */
  baseYear: number;
  timeBranch: number;
  fiveElements: { key: FiveElementsKey; num: number; ko: string; hanja: string };
  soulBranch: number;
  bodyBranch: number;
  soulStar: string;
  bodyStar: string;
  /** 생년 사화: 록·권·과·기 순 */
  yearMutagens: { star: string; mutagen: Mutagen }[];
  decadalForward: boolean;
  firstDecadalAge: number;
}

export interface Chart {
  norm: NormalizedBirth;
  options: ChartOptions;
  meta: ChartMeta;
  /** 지지 인덱스 순서(0=子 … 11=亥) */
  palaces: PalaceView[];
  /** 호환 모드에서 적용한 변환 기록(I-xx) */
  compatApplied: string[];
}

type Astrolabe = ReturnType<typeof astro.bySolar>;
const engineMap = new WeakMap<Chart, Astrolabe>();

const applyEngineConfig = (o: ChartOptions): void => {
  const exact = o.yearBasis === 'ipchun';
  astro.config({
    yearDivide: exact ? 'exact' : 'normal',
    horoscopeDivide: exact ? 'exact' : 'normal',
    ageDivide: 'normal',
    // 엔진에는 0~11 시진만 전달하므로(자시 이월은 time.ts 가 처리) 이 값은 영향이 없다. 명시적으로 고정.
    dayDivide: 'current',
    algorithm: 'default',
  });
};

const ymdStr = (v: YMD): string => `${v.y}-${v.m}-${v.d}`;

/**
 * 입춘 기준 연주(N-03).
 * 엔진(lunar-lite)은 입춘 기준의 연주를 '날짜' 단위로만 판정해서, 입춘 당일에는 절입 시각 전에 태어나도
 * 새해로 본다(한국 시계와 중국 표준시의 날짜 차이로 전후 하루도 어긋날 수 있다).
 * 그래서 실제 출생 순간으로 정한 연주를 그 날짜에 한해 엔진이 대신 쓰게 한다.
 * 이 기능은 lunar-lite 패치(patches/lunar-lite+0.2.8.patch, postinstall 로 적용)가 제공한다.
 * 한계: 유년·유월 등 운의 경계는 날짜 단위 그대로다(설계서 U-02).
 */
const withBirthYear = <T>(norm: NormalizedBirth, options: ChartOptions, run: () => T): T => {
  if (options.yearBasis !== 'ipchun') return run();
  const y = ipchunYearOf(norm.instantUtcMs);
  const d = norm.engineDate;
  setBirthYearOverride({ year: d.y, month: d.m, date: d.d, gan: STEMS[mod(y - 4, 10)], zhi: BRANCHES[mod(y - 4, 12)] });
  try {
    return run();
  } finally {
    setBirthYearOverride(null);
  }
};

export const toStarView = (raw: { name: string; brightness?: string; mutagen?: string }): StarView => {
  const meta = starMeta(raw.name);
  const view: StarView = { key: meta.key, ko: meta.ko, hanja: meta.hanja, group: meta.group, tone: meta.tone };
  const b = parseBrightness(raw.brightness);
  if (b) view.brightness = b;
  const m = mutagenFromZh(raw.mutagen);
  if (m) view.mutagen = m;
  return view;
};

const baseYearOf = (solarYear: number, stem: number, branch: number): number => {
  const matches = (y: number): boolean => mod(y - 4, 10) === stem && mod(y - 4, 12) === branch;
  return matches(solarYear) ? solarYear : solarYear - 1;
};

export class ChartError extends Error {}

export const buildChart = (norm: NormalizedBirth, options: ChartOptions): Chart => {
  if (norm.timeIndex === null) throw new ChartError('출생 시각을 모르면 명반을 만들 수 없습니다. 시진을 선택해 주세요.');
  applyEngineConfig(options);
  const gender = norm.gender === 'M' ? '男' : '女';
  const timeIndex = norm.timeIndex;
  const a = withBirthYear(norm, options, () => astro.bySolar(ymdStr(norm.engineDate), timeIndex, gender, options.leapFix, 'zh-TW'));

  const palaces: PalaceView[] = new Array(12);
  for (const p of a.palaces) {
    const branch = branchIndex(p.earthlyBranch);
    const stem = stemIndex(p.heavenlyStem);
    const stars = sortStars([...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map(toStarView));
    palaces[branch] = {
      branch,
      stem,
      ganzhi: ganzhiName(stem, branch),
      natalName: palaceKeyFromZh(p.name),
      stars,
      twelve: { changsheng: p.changsheng12, boshi: p.boshi12, jiangqian: p.jiangqian12, suiqian: p.suiqian12 },
      decadalRange: [p.decadal.range[0], p.decadal.range[1]],
      ages: [...p.ages],
      isBody: p.isBodyPalace,
    };
  }

  const ymut: { star: string; mutagen: Mutagen }[] = [];
  for (const m of MUTAGENS) {
    for (const p of palaces) for (const s of p.stars) if (s.mutagen === m) ymut.push({ star: s.key, mutagen: m });
  }

  const rawYear = a.rawDates.chineseDate.yearly;
  const yearStem = stemIndex(rawYear[0]);
  const yearBranch = branchIndex(rawYear[1]);
  const fe = FIVE_ELEMENTS[a.fiveElementsClass];
  if (!fe) throw new ChartError(`알 수 없는 오행국: ${a.fiveElementsClass}`);

  const firstAge = Math.min(...palaces.map((p) => p.decadalRange[0]));
  const first = palaces.find((p) => p.decadalRange[0] === firstAge) as PalaceView;
  const second = palaces.find((p) => p.decadalRange[0] === firstAge + 10) as PalaceView;
  const forward = mod(second.branch - first.branch, 12) === 1;

  const meta: ChartMeta = {
    gender: norm.gender,
    solarDate: ymdStr(norm.engineDate),
    lunar: solarToLunar(norm.engineDate),
    yearStem,
    yearBranch,
    baseYear: baseYearOf(norm.engineDate.y, yearStem, yearBranch),
    timeBranch: norm.timeIndex,
    fiveElements: fe,
    soulBranch: branchIndex(a.earthlyBranchOfSoulPalace),
    bodyBranch: branchIndex(a.earthlyBranchOfBodyPalace),
    soulStar: a.soul,
    bodyStar: a.body,
    yearMutagens: ymut,
    decadalForward: forward,
    firstDecadalAge: firstAge,
  };

  const chart: Chart = { norm, options, meta, palaces, compatApplied: [] };
  engineMap.set(chart, a);
  if (options.compat) applyCompat(chart);
  return chart;
};

// ── 삼방사정 ─────────────────────────────────────────────────────────────────
export interface Surround {
  self: number;
  /** 삼합 두 칸 */
  trine: [number, number];
  /** 대궁(충) */
  opposite: number;
}
/** R-04: 삼방사정은 +4, +8(삼합), +6(대궁) */
export const surround = (branch: number): Surround => ({
  self: mod(branch, 12),
  trine: [mod(branch + 4, 12), mod(branch + 8, 12)],
  opposite: mod(branch + 6, 12),
});
export const surroundSet = (branch: number): Set<number> => {
  const s = surround(branch);
  return new Set([s.self, s.opposite, ...s.trine]);
};

/** 4×4 격자의 지지 배치(남쪽 위). null 은 가운데 정보 블록 자리 */
export const GRID_ROWS: (number | null)[][] = [
  [5, 6, 7, 8],
  [4, null, null, 9],
  [3, null, null, 10],
  [2, 1, 0, 11],
];

// ── 지수(I-11) ───────────────────────────────────────────────────────────────
export interface PalaceScore {
  /** 주성 밝기 평균(없으면 null) */
  brightness: number | null;
  good: number;
  bad: number;
  /** 길성 ÷ (길성+흉성) × 100 (둘 다 0이면 null) */
  ratio: number | null;
}

export const scorePalace = (p: PalaceView, mode: BrightnessMode): PalaceScore => {
  const mains = p.stars.filter((s) => s.group === 'main' && s.brightness).map((s) => s.brightness as Brightness7);
  const good = p.stars.filter((s) => s.group === 'good').length + p.stars.filter((s) => s.mutagen && s.mutagen !== 'ji').length;
  const bad = p.stars.filter((s) => s.group === 'bad').length + p.stars.filter((s) => s.mutagen === 'ji').length;
  return {
    brightness: averageScore(mains, mode),
    good,
    bad,
    ratio: good + bad > 0 ? Math.round((100 * good) / (good + bad)) : null,
  };
};

/** 주성이 없는 궁이면 대궁의 주성을 빌려 읽는다(차성안궁). 주성이 있으면 빈 배열 */
export const borrowedMainStars = (chart: Chart, branch: number): StarView[] => {
  const own = chart.palaces[branch];
  if (own.stars.some((s) => s.group === 'main')) return [];
  return chart.palaces[mod(branch + 6, 12)].stars.filter((s) => s.group === 'main');
};

// ── 운 모드 뷰 ───────────────────────────────────────────────────────────────
export interface FlowStar extends FlowStarMeta {}
export interface ScopeMutagen {
  star: string;
  mutagen: Mutagen;
  scope: Scope;
}
export interface ViewTarget {
  date: YMD;
  /** 0~11 (子~亥) */
  timeIndex: number;
}

export interface View {
  scope: Scope;
  target: ViewTarget | null;
  /** 선택한 운의 명궁이 놓인 지지 */
  lifeBranch: number;
  /** 지지별 궁 이름(운 모드에서는 그 운의 이름) */
  names: PalaceKey[];
  flow: FlowStar[][];
  /** 선택한 운의 사화(본명 제외). 본명이면 빈 배열 */
  mutagens: ScopeMutagen[];
  yearlyTwelve?: { suiqian: string[]; jiangqian: string[] };
  /** 유년 모드에서 소한(작은 한도)이 놓인 지지 */
  ageBranch?: number;
  info: {
    ganzhi: string | null;
    nominalAge: number | null;
    rangeLabel: string | null;
    lunar: LunarDate | null;
  };
}

const emptyFlow = (): FlowStar[][] => Array.from({ length: 12 }, () => []);

const natalView = (chart: Chart): View => ({
  scope: 'natal',
  target: null,
  lifeBranch: chart.meta.soulBranch,
  names: chart.palaces.map((p) => p.natalName),
  flow: emptyFlow(),
  mutagens: [],
  info: { ganzhi: null, nominalAge: null, rangeLabel: null, lunar: null },
});

const SCOPE_FIELD = { decadal: 'decadal', yearly: 'yearly', monthly: 'monthly', daily: 'daily', hourly: 'hourly' } as const;

/** 대한 구간(시작 나이)을 고르기 위한 기준일: 그 나이가 되는 해의 7월 1일 */
export const decadalTargetDate = (chart: Chart, startAge: number): YMD => ({
  y: chart.meta.baseYear + startAge - 1, m: 7, d: 1,
});

export const buildView = (chart: Chart, scope: Scope, target: ViewTarget | null): View => {
  if (scope === 'natal' || !target) return natalView(chart);
  const a = engineMap.get(chart);
  if (!a) throw new ChartError('엔진 정보를 찾을 수 없습니다(직렬화된 명반은 운 모드를 계산할 수 없습니다).');
  applyEngineConfig(chart.options);
  const h = a.horoscope(ymdStr(target.date), target.timeIndex);
  const item = h[SCOPE_FIELD[scope]];

  const names: PalaceKey[] = new Array(12);
  const flow = emptyFlow();
  item.palaceNames.forEach((zh: string, i: number) => {
    names[mod(i + 2, 12)] = palaceKeyFromZh(zh);
  });
  (item.stars ?? []).forEach((list: { name: string }[], i: number) => {
    for (const s of list) {
      const meta = parseFlowStar(s.name);
      if (meta) flow[mod(i + 2, 12)].push(meta);
    }
  });

  const lifeBranch = mod(item.index + 2, 12);
  const mutagens: ScopeMutagen[] = item.mutagen.map((star: string, i: number) => ({
    star: starMeta(star).key, mutagen: MUTAGENS[i], scope,
  }));

  const view: View = {
    scope,
    target,
    lifeBranch,
    names,
    flow,
    mutagens,
    info: {
      ganzhi: `${item.heavenlyStem}${item.earthlyBranch}`,
      nominalAge: h.age.nominalAge,
      rangeLabel: null,
      lunar: solarToLunar(target.date),
    },
  };

  if (scope === 'decadal') {
    const p = chart.palaces[lifeBranch];
    view.info.rangeLabel = `${p.decadalRange[0]}~${p.decadalRange[1]}세`;
    if (chart.options.compat) view.names = compatDecadalNames();
  }
  if (scope === 'yearly') {
    const dec = h.yearly.yearlyDecStar;
    const sui: string[] = new Array(12);
    const jiang: string[] = new Array(12);
    dec.suiqian12.forEach((n: string, i: number) => (sui[mod(i + 2, 12)] = n));
    dec.jiangqian12.forEach((n: string, i: number) => (jiang[mod(i + 2, 12)] = n));
    view.yearlyTwelve = { suiqian: sui, jiangqian: jiang };
    view.ageBranch = mod(h.age.index + 2, 12);
  }
  return view;
};

/** 대한 구간 12개(시작 나이순)와 각 구간의 궁 */
export const decadalList = (chart: Chart): { startAge: number; endAge: number; branch: number }[] =>
  chart.palaces
    .map((p) => ({ startAge: p.decadalRange[0], endAge: p.decadalRange[1], branch: p.branch }))
    .sort((x, y) => x.startAge - y.startAge);

/** 대한 시작 나이로 그 구간을 대표하는 기준일·시진을 만든다. 검증용으로 실제 대한 칸을 확인해 돌려준다. */
export const viewForDecade = (chart: Chart, startAge: number): View => {
  const date = decadalTargetDate(chart, startAge);
  const v = buildView(chart, 'decadal', { date, timeIndex: chart.meta.timeBranch });
  return v;
};

/** 이 명반에서 기준일의 만 나이가 아닌 “세는 나이(허세)” */
export const nominalAgeAt = (chart: Chart, date: YMD): number => date.y - chart.meta.baseYear + 1;

export const shiftDate = addDays;

export { BRANCHES, STEMS, PALACE_KEYS, SCOPE_KO };
