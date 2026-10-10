// 통변 진입점: 자미두수 종합 통변 + 사주 통변 + 두 통변의 비교. 순수 함수라 화면 없이 전수 검증할 수 있다.
import type { BrightnessMode } from '../brightness';
import type { Chart } from '../chart';
import type { SajuChart } from '../saju';
import { compareAll } from './compare';
import type { TongbyeonComparison } from './compare';
import { readSaju } from './saju-read';
import type { SajuTongbyeon } from './saju-read';
import { readZiwei } from './ziwei-read';
import type { ZiweiTongbyeon } from './ziwei-read';

export interface TongbyeonOptions {
  mode: BrightnessMode;
  /** “지금”으로 볼 달력 연도(결정성을 위해 주입할 수 있다). 기본은 현재 연도 */
  todayYear?: number;
}

export interface Tongbyeon {
  ziwei: ZiweiTongbyeon;
  saju: SajuTongbyeon;
  comparison: TongbyeonComparison;
  now: { year: number; ziweiDecade: number; sajuDaeun: number };
  disclaimer: string[];
}

export const DISCLAIMER: string[] = [
  '규칙으로 옮긴 간이 통변이며 전문가 감수를 받지 않았습니다. 참고용으로만 읽으세요.',
  '경향 단계는 점수를 무작위 명반 분포의 순위로 나눈 상대 위치입니다. 앞날을 맞히는 예언이 아닙니다.',
  '건강·재물·관계에 관한 내용은 생활 점검의 참고이며 진단·투자·법률 조언이 아닙니다.',
  '두 체계가 엇갈릴 때 어느 쪽이 맞는지 이 사이트는 판정하지 않습니다.',
];

export const buildTongbyeon = (chart: Chart, saju: SajuChart, opts: TongbyeonOptions): Tongbyeon => {
  const year = opts.todayYear ?? new Date().getFullYear();
  const ziwei = readZiwei(chart, { mode: opts.mode }, year);
  const sajuReading = readSaju(saju, chart.meta.gender);
  const comparison = compareAll(ziwei.domains, sajuReading.domains, ziwei.decades, sajuReading.daeun);
  const idx = (list: { startYear: number; endYear: number }[]): number => list.findIndex((p) => year >= p.startYear && year <= p.endYear);
  return {
    ziwei,
    saju: sajuReading,
    comparison,
    now: { year, ziweiDecade: idx(ziwei.decades), sajuDaeun: idx(sajuReading.daeun) },
    disclaimer: DISCLAIMER,
  };
};

export { whyOf } from './compare';
export type { TongbyeonComparison, SajuTongbyeon, ZiweiTongbyeon };
export * from './types';
