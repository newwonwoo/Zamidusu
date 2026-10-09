// V-14 시나리오 검증 — 원장 §6 시험 입력(T1~T7)과 경계·적대적 입력을 '화면과 같은 경로'(computeOutcome)로 끝까지 통과시킨다.
//   입력 → 정규화 → 명반 → 모든 운 모드 → 궁 해설 → 사주 4기둥 → 비교 데이터
// 환경변수 WRITE_SCENARIOS=1 이면 결과표를 docs/generated/scenarios.md 로 쓴다(품질확인서의 근거 자료).
//   WRITE_SCENARIOS=1 npx vitest run tests/scenarios.test.ts

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { buildView, decadalList, viewForDecade } from '../src/core/chart';
import type { Chart, View } from '../src/core/chart';
import { explainPalace } from '../src/core/explain/compose';
import { BRANCHES, STEMS, isYangStem, mod, tigerStem } from '../src/core/ganzhi';
import { PALACE_KEYS, SCOPES } from '../src/core/names';
import { CUSTOM_ID } from '../src/core/place';
import { lunarMonthDays, normalizeBirth } from '../src/core/time';
import type { YMD } from '../src/core/time';
import { computeOutcome } from '../src/ui/compute';
import type { Outcome } from '../src/ui/compute';
import { defaultForm, defaultSettings } from '../src/ui/state';
import type { FormState, Settings } from '../src/ui/state';
import { compareWithIndependent, inputOf, keyOf, rng } from './helpers';

const SEOUL = '특별·광역시-서울';
const BUSAN = '특별·광역시-부산';
const JEJU = '제주-제주';
const TOKYO = '해외·동아시아-도쿄';

const require_ = createRequire(import.meta.url);
const TYME = require_('tyme4ts');

type ChartOutcome = Extract<Outcome, { kind: 'chart' }>;

const run = (form: Partial<FormState>, settings: Partial<Settings> = {}, compat = false): ChartOutcome => {
  const r = computeOutcome({ ...defaultForm(), ...form }, { ...defaultSettings(), correction: 'none', ...settings }, compat);
  if (!r.ok) throw new Error(`계산 실패: ${r.errors.join(' / ')}`);
  if (r.outcome.kind !== 'chart') throw new Error('명반이 아닌 결과');
  return r.outcome;
};

const errorsOf = (form: Partial<FormState>, settings: Partial<Settings> = {}): string[] => {
  const r = computeOutcome({ ...defaultForm(), ...form }, { ...defaultSettings(), correction: 'none', ...settings }, false);
  return r.ok ? [] : r.errors;
};

/** 명반이 지켜야 하는 구조 불변식. 어긴 항목 설명을 돌려준다. */
const structuralProblems = (chart: Chart): string[] => {
  const bad: string[] = [];
  const m = chart.meta;
  if (chart.palaces.length !== 12) bad.push('궁이 12개가 아니다');
  const mains = chart.palaces.flatMap((p) => p.stars.filter((s) => s.group === 'main').map((s) => s.key));
  if (mains.length !== 14 || new Set(mains).size !== 14) bad.push(`주성이 14개가 아니거나 중복: ${mains.length}`);
  if (chart.palaces.filter((p) => p.isBody).length !== 1 || !chart.palaces[m.bodyBranch].isBody) bad.push('신궁 표지가 하나가 아니다');
  if (chart.palaces[m.soulBranch].natalName !== 'life') bad.push('명궁 칸의 이름이 명궁이 아니다');
  if ([...chart.palaces].map((p) => p.natalName).sort().join() !== [...PALACE_KEYS].sort().join()) bad.push('12궁 이름이 모두 한 번씩이 아니다');
  // 五虎遁: 寅궁의 천간은 연간으로 정해지고 이후 한 칸마다 천간이 하나씩 진행한다
  const tiger = tigerStem(m.yearStem);
  for (let i = 0; i < 12; i++) {
    const b = mod(2 + i, 12);
    if (chart.palaces[b].stem !== mod(tiger + i, 10)) bad.push(`${BRANCHES[b]}궁 천간이 오호둔과 다르다`);
  }
  // 사화는 네 개이고 각각 다른 별
  if (m.yearMutagens.length !== 4 || new Set(m.yearMutagens.map((x) => x.star)).size !== 4) bad.push('생년 사화가 4개가 아니다');
  // 대한: 순행 = 양남·음녀, 시작 나이는 오행국 수, 10년씩 이어짐
  const wantForward = isYangStem(m.yearStem) === (m.gender === 'M');
  if (m.decadalForward !== wantForward) bad.push('대한 방향이 음양·성별 규칙과 다르다');
  if (m.firstDecadalAge !== m.fiveElements.num) bad.push('첫 대한 나이가 오행국 수와 다르다');
  const list = decadalList(chart);
  list.forEach((d, i) => {
    if (d.startAge !== m.firstDecadalAge + 10 * i || d.endAge !== d.startAge + 9) bad.push(`대한 ${i + 1}번 구간이 이어지지 않는다`);
    const want = mod(m.soulBranch + (m.decadalForward ? i : -i), 12);
    if (d.branch !== want) bad.push(`대한 ${i + 1}번이 ${BRANCHES[want]}궁이 아니다(${BRANCHES[d.branch]})`);
  });
  return bad;
};

const isPermutationOfPalaces = (v: View): boolean => [...v.names].sort().join() === [...PALACE_KEYS].sort().join();

/** 한 명반의 모든 운 모드·궁 해설이 끝까지 만들어지는지 */
const pipelineProblems = (o: ChartOutcome): string[] => {
  const bad: string[] = [];
  const { chart, saju } = o;
  const base = chart.meta.baseYear;
  const day: YMD = { y: base + 28, m: 3, d: 10 };
  const views: { label: string; v: View }[] = [{ label: '본명', v: buildView(chart, 'natal', null) }];
  for (const d of decadalList(chart)) views.push({ label: `대한 ${d.startAge}`, v: viewForDecade(chart, d.startAge) });
  for (const scope of SCOPES.filter((s) => s !== 'natal' && s !== 'decadal')) {
    views.push({ label: scope, v: buildView(chart, scope, { date: day, timeIndex: chart.meta.timeBranch }) });
  }
  for (const { label, v } of views) {
    if (!isPermutationOfPalaces(v)) bad.push(`${label}: 궁 이름이 12궁 순열이 아니다`);
    if (v.names[v.lifeBranch] !== 'life') bad.push(`${label}: 운의 명궁 칸 이름이 명궁이 아니다`);
    if (v.scope !== 'natal' && v.mutagens.length !== 4) bad.push(`${label}: 운 사화가 4개가 아니다`);
    if (v.flow.length !== 12) bad.push(`${label}: 운 유성 배열이 12칸이 아니다`);
  }
  // 해설: 본명 12궁 전부 + 운 모드 하나씩(각 12궁)
  for (const { label, v } of [views[0], views[2], views[views.length - 3], views[views.length - 1]]) {
    for (let b = 0; b < 12; b++) {
      const ex = explainPalace(chart, v, b, { saju, mode: '5' });
      if (!ex.title || !ex.overview || !ex.sajuLine) bad.push(`${label}/${BRANCHES[b]}: 궁 해설 빈 항목`);
      if (ex.stars.length !== chart.palaces[b].stars.length) bad.push(`${label}/${BRANCHES[b]}: 별 해설 수 불일치`);
      const texts = [ex.overview, ex.sajuLine, ex.emptyNotice ?? '', ex.scopeNote ?? '', ...ex.stars.flatMap((s) => s.blocks.map((x) => x.text))];
      for (const t of texts) {
        if ((t.match(/\{\{/g) ?? []).length !== (t.match(/\}\}/g) ?? []).length) bad.push(`${label}/${BRANCHES[b]}: 용어 표기 짝이 맞지 않음`);
        if (/undefined|NaN|\[object/.test(t)) bad.push(`${label}/${BRANCHES[b]}: 비정상 문자열 "${t.slice(0, 30)}"`);
      }
    }
  }
  return bad;
};

/** 사주 4기둥을 별개 라이브러리(tyme4ts)로 다시 구한다. 베이징 시각이 아닌 '순간'을 기준으로 하므로 UTC+8 벽시계로 바꿔 넣는다. */
const tymePillars = (o: ChartOutcome): string[] => {
  const b = new Date(o.norm.instantUtcMs + 8 * 3600_000);
  const c = o.norm.corrected ?? o.norm.civil;
  const a = TYME.SolarTime.fromYmdHms(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(), b.getUTCHours(), b.getUTCMinutes(), 0).getLunarHour().getEightChar();
  const d = TYME.SolarTime.fromYmdHms(c.y, c.m, c.d, c.h, c.mi, 0).getLunarHour().getEightChar();
  // 연·월은 실제 순간, 일·시는 (보정한) 시계 시각. 23시대는 설정(익일 자시=sect1)에 따라 라이브러리마다 다르니 제외하고 비교한다.
  return [a.getYear().getName(), a.getMonth().getName(), d.getDay().getName(), d.getHour().getName()];
};

// ── 원장 §6 시험 입력 ────────────────────────────────────────────────────────
interface Scenario {
  id: string;
  label: string;
  form: Partial<FormState>;
  settings?: Partial<Settings>;
}
const SCENARIOS: Scenario[] = [
  { id: 'T1', label: '1980-07-22 남 사시', form: { year: 1980, month: 7, day: 22, hour: 10, gender: 'M' } },
  { id: 'T2', label: '1984-01-30 남 14시', form: { year: 1984, month: 1, day: 30, hour: 14, gender: 'M' } },
  { id: 'T3', label: '1990-03-10 여 14시', form: { year: 1990, month: 3, day: 10, hour: 14, gender: 'F' } },
  { id: 'T4', label: '1991-09-05 여 8시', form: { year: 1991, month: 9, day: 5, hour: 8, gender: 'F' } },
  { id: 'T5-표준', label: '1990-03-10 남 13:10 · 표준시', form: { year: 1990, month: 3, day: 10, hour: 13, minute: 10, gender: 'M', placeId: 'standard' } },
  { id: 'T5-서울', label: '1990-03-10 남 13:10 · 서울(진태양시)', form: { year: 1990, month: 3, day: 10, hour: 13, minute: 10, gender: 'M', placeId: SEOUL }, settings: { correction: 'true' } },
  { id: 'T6', label: '1990-01-30 남 12시', form: { year: 1990, month: 1, day: 30, hour: 12, gender: 'M' } },
  { id: 'T6-입춘', label: '1990-01-30 남 12시 · 입춘 기준', form: { year: 1990, month: 1, day: 30, hour: 12, gender: 'M', yearBasis: 'ipchun' } },
];

const table: string[][] = [];

describe('원장 시험 입력 T1~T6 (끝에서 끝까지)', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id}: ${sc.label}`, () => {
      const o = run(sc.form, sc.settings);
      const f = { ...defaultForm(), ...sc.form };
      expect(structuralProblems(o.chart)).toEqual([]);
      expect(pipelineProblems(o)).toEqual([]);

      // 명반 ↔ 독립 구현 (연주 기준은 시험 입력의 설정을 따른다)
      const basis = f.yearBasis === 'ipchun' ? 'ipchun' : 'lunarNewYear';
      const e = o.norm.engineDate;
      const hb = o.norm.timeIndex as number;
      const diffs = compareWithIndependent(sc.id, o.chart, keyOf(e.y, e.m, e.d, hb, basis), f.gender);
      expect(diffs).toEqual([]);

      // 사주 4기둥 ↔ 다른 라이브러리 (23시대 제외)
      if (o.norm.corrected && o.norm.corrected.h !== 23) {
        const got = [o.saju.year.ganzhi, o.saju.month.ganzhi, o.saju.day.ganzhi, o.saju.hour!.ganzhi];
        expect(got).toEqual(tymePillars(o));
      }

      const m = o.chart.meta;
      const ziwei = o.chart.palaces.find((p) => p.stars.some((s) => s.key === '紫微'))!.branch;
      table.push([
        sc.id, sc.label,
        `${m.lunar.year}-${m.lunar.leap ? '윤' : ''}${m.lunar.month}-${m.lunar.day}`,
        `${STEMS[m.yearStem]}${BRANCHES[m.yearBranch]}`,
        m.fiveElements.hanja,
        `${BRANCHES[m.soulBranch]}/${BRANCHES[m.bodyBranch]}`,
        BRANCHES[ziwei],
        m.decadalForward ? `순행 ${m.firstDecadalAge}세~` : `역행 ${m.firstDecadalAge}세~`,
        [o.saju.year.ganzhi, o.saju.month.ganzhi, o.saju.day.ganzhi, o.saju.hour!.ganzhi].join(' '),
        `${diffs.length}건`,
      ]);
    });
  }

  it('T5: 같은 생일시를 표준시로 보면 未시, 서울 진태양시로 보면 午시 — 명반이 달라진다(I-07 개선)', () => {
    const std = run({ year: 1990, month: 3, day: 10, hour: 13, minute: 10, placeId: 'standard' });
    const seoul = run({ year: 1990, month: 3, day: 10, hour: 13, minute: 10, placeId: SEOUL }, { correction: 'true' });
    expect(std.chart.meta.timeBranch).toBe(7);
    expect(seoul.chart.meta.timeBranch).toBe(6);
    const pos = (c: Chart, key: string) => c.palaces.find((p) => p.stars.some((s) => s.key === key))?.branch;
    expect(pos(std.chart, '文昌')).not.toBe(pos(seoul.chart, '文昌'));
  });

  it('T7: 1930~2020 매년 7월 1일(91건)이 전 구간 통과하고 독립 구현과 일치한다', () => {
    const bad: string[] = [];
    for (let y = 1930; y <= 2020; y++) {
      const o = run({ year: y, month: 7, day: 1, hour: 12, gender: y % 2 ? 'M' : 'F' });
      const e = o.norm.engineDate;
      bad.push(...compareWithIndependent(`T7-${y}`, o.chart, keyOf(e.y, e.m, e.d, 6, 'lunarNewYear'), o.chart.meta.gender));
      bad.push(...structuralProblems(o.chart).map((x) => `${y}: ${x}`));
    }
    expect(bad).toEqual([]);
  });

  it('음력 입력(1990-1-4)은 양력 1990-01-30 입력과 같은 명반을 만든다', () => {
    const a = run({ calendar: 'lunar', year: 1990, month: 1, day: 4, hour: 12 });
    const b = run({ calendar: 'solar', year: 1990, month: 1, day: 30, hour: 12 });
    expect(JSON.stringify(a.chart.palaces)).toBe(JSON.stringify(b.chart.palaces));
    expect(a.chart.meta.solarDate).toBe(b.chart.meta.solarDate);
  });

  it('시를 모르면 명반 대신 시 모름 결과(12시진 비교용)를 돌려준다', () => {
    const r = computeOutcome({ ...defaultForm(), hour: null }, { ...defaultSettings(), correction: 'none' }, false);
    expect(r.ok && r.outcome.kind).toBe('hour-unknown');
  });
});

describe('경계 입력', () => {
  it('범위 양끝: 1900-02-01·2100-12-31 정오는 계산되고, 1900-01-31 은 거절된다', () => {
    expect(structuralProblems(run({ year: 1900, month: 2, day: 1, hour: 12 }).chart)).toEqual([]);
    expect(structuralProblems(run({ year: 2100, month: 12, day: 31, hour: 12 }).chart)).toEqual([]);
    expect(errorsOf({ year: 1900, month: 1, day: 31, hour: 12 }).join(' ')).toMatch(/1900-02-01/);
  });

  it('2100-12-31 23:30: 익일 자시로는 범위를 벗어나 거절하고, 당일 자시로는 계산한다', () => {
    expect(errorsOf({ year: 2100, month: 12, day: 31, hour: 23, minute: 30 }, { lateZi: 'next' }).join(' ')).toMatch(/범위/);
    expect(structuralProblems(run({ year: 2100, month: 12, day: 31, hour: 23, minute: 30 }, { lateZi: 'current' }).chart)).toEqual([]);
  });

  it('1999-12-31 23:30(해가 바뀌는 자시): 익일 자시면 2000-01-01 子시로 계산하고 일주도 다음 날이다', () => {
    const next = run({ year: 1999, month: 12, day: 31, hour: 23, minute: 30 }, { lateZi: 'next' });
    const cur = run({ year: 1999, month: 12, day: 31, hour: 23, minute: 30 }, { lateZi: 'current' });
    expect(next.chart.meta.solarDate).toBe('2000-1-1');
    expect(cur.chart.meta.solarDate).toBe('1999-12-31');
    expect(next.chart.meta.timeBranch).toBe(0);
    expect(cur.chart.meta.timeBranch).toBe(0);
    const day1 = run({ year: 2000, month: 1, day: 1, hour: 12 }).saju.day.ganzhi;
    const day0 = run({ year: 1999, month: 12, day: 31, hour: 12 }).saju.day.ganzhi;
    expect(next.saju.day.ganzhi).toBe(day1); // 익일 자시: 일주 = 다음 날
    expect(cur.saju.day.ganzhi).toBe(day0); // 당일 자시: 일주 = 당일
  });

  it('음력 설 전날 23:30(2023-01-21): 익일 자시면 새해(癸卯·정월 1일), 당일 자시면 묵은해(壬寅·12월 30일)', () => {
    const next = run({ year: 2023, month: 1, day: 21, hour: 23, minute: 30 }, { lateZi: 'next' });
    const cur = run({ year: 2023, month: 1, day: 21, hour: 23, minute: 30 }, { lateZi: 'current' });
    expect([next.chart.meta.lunar.month, next.chart.meta.lunar.day]).toEqual([1, 1]);
    expect(STEMS[next.chart.meta.yearStem] + BRANCHES[next.chart.meta.yearBranch]).toBe('癸卯');
    expect([cur.chart.meta.lunar.month, cur.chart.meta.lunar.day]).toEqual([12, 30]);
    expect(STEMS[cur.chart.meta.yearStem] + BRANCHES[cur.chart.meta.yearBranch]).toBe('壬寅');
    // 사주의 연주는 입춘(2/4)이 기준이므로 두 경우 모두 같다(壬寅)
    expect(next.saju.year.ganzhi).toBe('壬寅');
    expect(cur.saju.year.ganzhi).toBe('壬寅');
  });

  it('윤달 보정: 2020 윤4월 10일은 4월, 20일은 5월로 보고(기본), 보정을 끄면 둘 다 4월이다', () => {
    const early = { calendar: 'lunar' as const, leap: true, year: 2020, month: 4, day: 10, hour: 12 };
    const late = { ...early, day: 20 };
    const e1 = run(early, { leapFix: true }).chart;
    const l1 = run(late, { leapFix: true }).chart;
    const e0 = run(early, { leapFix: false }).chart;
    const l0 = run(late, { leapFix: false }).chart;
    expect(JSON.stringify(e1.palaces)).toBe(JSON.stringify(e0.palaces)); // 전반(≤15일)은 보정과 무관
    expect(JSON.stringify(l1.palaces)).not.toBe(JSON.stringify(l0.palaces)); // 후반은 다음 달로 본다
    const fixed = run({ calendar: 'lunar', leap: false, year: 2020, month: 5, day: 20, hour: 12 }, { leapFix: false }).chart;
    expect(l1.meta.soulBranch).toBe(fixed.meta.soulBranch); // 보정한 윤4월 20일 = 평달 5월 20일의 명궁
  });

  it('서머타임 공백·중복·표준시 변경일(1987-05-10 02:30, 1987-10-11 02:30, 1954-03-21 00:10)에도 예외 없이 계산된다', () => {
    for (const [y, m, d, h, mi] of [[1987, 5, 10, 2, 30], [1987, 10, 11, 2, 30], [1954, 3, 21, 0, 10], [1961, 8, 10, 0, 10]] as const) {
      for (const correction of ['none', 'lmt', 'true'] as const) {
        const o = run({ year: y, month: m, day: d, hour: h, minute: mi, placeId: SEOUL }, { correction });
        expect(structuralProblems(o.chart)).toEqual([]);
      }
    }
  });

  it('동쪽 도시의 보정으로 날짜가 넘어간다(도쿄 23:50 → 다음 날 0시대, 子시)', () => {
    const r = normalizeBirth(inputOf(2001, 5, 5, 23, 'M', { minute: 50, placeId: TOKYO }), { correction: 'lmt', lateZi: 'next', compat: false });
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.value.corrected).toMatchObject({ y: 2001, m: 5, d: 6, h: 0 });
    expect(r.value.timeIndex).toBe(0);
    expect(r.value.shiftedDay).toBe(false);
    expect(r.value.engineDate).toEqual({ y: 2001, m: 5, d: 6 });
  });

  it('입춘 기준 + 익일 자시 + 설 전후가 겹치는 날도 사주 연주와 같은 해로 나온다(2021 입춘 23:59)', () => {
    const o = run({ year: 2021, month: 2, day: 3, hour: 23, minute: 30, yearBasis: 'ipchun' }, { lateZi: 'next' });
    expect(STEMS[o.chart.meta.yearStem] + BRANCHES[o.chart.meta.yearBranch]).toBe(o.saju.year.ganzhi);
  });
});

// 29일뿐인 음력 달의 30일(달 길이는 해마다 다르므로 달력에서 찾아 쓴다)
const SHORT_LUNAR_MONTH_DAY_30: Partial<FormState> = (() => {
  for (let y = 1990; y < 2030; y++) for (let m = 1; m <= 12; m++) if (lunarMonthDays(y, m, false) === 29) return { calendar: 'lunar', year: y, month: m, day: 30 };
  throw new Error('29일짜리 달을 찾지 못함');
})();

describe('적대적 입력', () => {
  const bad: Partial<FormState>[] = [
    { year: Number.NaN }, { year: 1899 }, { year: 2101 }, { year: 2000.5 }, { month: 0 }, { month: 13 }, { day: 0 }, { day: 32 },
    { month: 2, day: 30 }, { year: 2023, month: 2, day: 29 }, { month: 4, day: 31 }, { hour: 24 }, { hour: -1 }, { minute: 60 }, { minute: -1 },
    { calendar: 'lunar', year: 1991, month: 3, day: 10, leap: true }, SHORT_LUNAR_MONTH_DAY_30,
    { placeId: CUSTOM_ID, customLon: '' }, { placeId: CUSTOM_ID, customLon: '181' }, { placeId: CUSTOM_ID, customLon: 'abc' },
  ];
  it.each(bad.map((b, i) => [i, JSON.stringify(b), b] as const))('거절 %i: %s — 예외 없이 한국어 안내를 돌려준다', (_i, _s, form) => {
    const errs = errorsOf(form);
    expect(errs.length).toBeGreaterThan(0);
    for (const e of errs) expect(e).toMatch(/[가-힣]/);
  });

  it('무작위 입력 400건(잘못된 값 포함): 예외가 없고, 통과한 입력은 모두 구조 불변식을 만족한다', () => {
    const r = rng(20250207);
    const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
    let okCount = 0;
    let rejected = 0;
    const problems: string[] = [];
    for (let i = 0; i < 400; i++) {
      const form: FormState = {
        ...defaultForm(),
        gender: pick(['M', 'F'] as const),
        calendar: pick(['solar', 'solar', 'lunar'] as const),
        leap: r() < 0.2,
        year: pick([1899, 1900, 1901, 1927, 1950, 1987, 1988, 1990, 2000, 2024, 2099, 2100, 2101, 1900 + Math.floor(r() * 200)]),
        month: pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
        day: pick([0, 1, 5, 15, 16, 28, 29, 30, 31, 32]),
        hour: r() < 0.1 ? null : pick([-1, 0, 1, 11, 12, 22, 23, 23, 24]),
        minute: pick([0, 0, 30, 59, 60]),
        placeId: pick(['standard', SEOUL, BUSAN, JEJU, TOKYO, 'abroad']),
        yearBasis: pick(['lunarNewYear', 'ipchun'] as const),
      };
      const settings: Partial<Settings> = {
        correction: pick(['none', 'lmt', 'true'] as const),
        lateZi: pick(['next', 'current'] as const),
        leapFix: r() < 0.5,
      };
      let result;
      try {
        result = computeOutcome(form, { ...defaultSettings(), ...settings }, false);
      } catch (e) {
        problems.push(`예외: ${JSON.stringify(form)} ${(e as Error).message}`);
        continue;
      }
      if (!result.ok) {
        rejected++;
        if (result.errors.length === 0) problems.push(`빈 오류 목록: ${JSON.stringify(form)}`);
        continue;
      }
      okCount++;
      if (result.outcome.kind === 'chart') {
        for (const p of structuralProblems(result.outcome.chart)) problems.push(`${JSON.stringify(form)} ${p}`);
      }
    }
    expect(problems).toEqual([]);
    expect(okCount).toBeGreaterThan(40);
    expect(rejected).toBeGreaterThan(40);
  });
});

if (process.env.WRITE_SCENARIOS) {
  describe('결과표 쓰기', () => {
    it('docs/generated/scenarios.md', () => {
      const head = ['번호', '입력', '음력(연-월-일)', '연주', '오행국', '명궁/신궁', '자미성', '대한', '사주 4주(년 월 일 시)', '독립 구현 불일치'];
      const lines = [
        '# 시나리오 실행 결과표 (자동 생성)',
        '',
        '`WRITE_SCENARIOS=1 npx vitest run tests/scenarios.test.ts` 로 만든 표입니다. 같은 입력이 화면과 같은 경로(`computeOutcome`)를 통과한 결과입니다.',
        '',
        `| ${head.join(' | ')} |`,
        `|${head.map(() => '---').join('|')}|`,
        ...table.map((r) => `| ${r.join(' | ')} |`),
        '',
      ];
      fs.mkdirSync('docs/generated', { recursive: true });
      fs.writeFileSync('docs/generated/scenarios.md', lines.join('\n'));
      expect(table.length).toBe(SCENARIOS.length);
    });
  });
}
