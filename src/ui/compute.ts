// 입력 → 정규화 → 명반 → 사주 → 비교 데이터. UI 와 분리한 순수 함수라 화면 없이 검증할 수 있다.

import { buildChart, ChartError } from '../core/chart';
import type { Chart, ChartOptions, YearBasis } from '../core/chart';
import { buildComparison } from '../core/compare';
import type { Comparison } from '../core/compare';
import { defaultSajuEngine } from '../core/saju';
import type { SajuChart } from '../core/saju';
import { normalizeBirth } from '../core/time';
import type { NormalizedBirth, TimeSettings } from '../core/time';
import { toBirthInput } from './state';
import type { FormState, Settings } from './state';

export type Outcome =
  | { kind: 'chart'; norm: NormalizedBirth; chart: Chart; saju: SajuChart; comparison: Comparison }
  | { kind: 'hour-unknown'; norm: NormalizedBirth; options: ChartOptions };

export type ComputeResult = { ok: true; outcome: Outcome } | { ok: false; errors: string[] };

export const chartOptionsOf = (form: FormState, settings: Settings, compat: boolean): ChartOptions => ({
  yearBasis: form.yearBasis as YearBasis,
  lateZi: settings.lateZi,
  leapFix: settings.leapFix,
  compat,
});

export const computeOutcome = (form: FormState, settings: Settings, compat: boolean): ComputeResult => {
  const timeSettings: TimeSettings = { correction: settings.correction, lateZi: settings.lateZi, compat };
  const r = normalizeBirth(toBirthInput(form), timeSettings);
  if (!r.ok) return { ok: false, errors: r.errors };
  const norm = r.value;
  const options = chartOptionsOf(form, settings, compat);
  if (!norm.hourKnown) return { ok: true, outcome: { kind: 'hour-unknown', norm, options } };
  try {
    const chart = buildChart(norm, options);
    const saju = defaultSajuEngine.compute({
      instantUtcMs: norm.instantUtcMs,
      clock: norm.corrected ?? norm.civil,
      hourKnown: true,
      gender: norm.gender,
      lateZi: settings.lateZi,
    });
    return { ok: true, outcome: { kind: 'chart', norm, chart, saju, comparison: buildComparison(chart, saju, norm.tz) } };
  } catch (e) {
    return { ok: false, errors: [e instanceof ChartError ? e.message : '명반을 계산하는 중 문제가 생겼습니다. 입력을 확인해 주세요.'] };
  }
};

/** 오늘 기준 세는나이가 속한 대한 구간의 순번(없으면 0) */
export const currentDecadeIndex = (chart: Chart, today = new Date()): number => {
  const age = today.getFullYear() - chart.meta.baseYear + 1;
  const sorted = [...chart.palaces].sort((a, b) => a.decadalRange[0] - b.decadalRange[0]);
  const i = sorted.findIndex((p) => age >= p.decadalRange[0] && age <= p.decadalRange[1]);
  return i < 0 ? 0 : i;
};
