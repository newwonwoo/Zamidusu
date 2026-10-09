// V-13 보강: 사주 비교 데이터(N-01) — 근거 구분 집계, 달력 기준 알림, 실측값
import { describe, expect, it } from 'vitest';
import { buildComparison, EVIDENCE_LABEL } from '../src/core/compare';
import { lunarJavascriptEngine } from '../src/core/saju';
import { GLOSSARY, plainText, termsIn } from '../src/core/glossary';
import { fmtInstant } from '../src/core/format';
import { normalizeBirth } from '../src/core/time';
import type { BirthInput } from '../src/core/time';
import { buildChart, DEFAULT_CHART_OPTIONS } from '../src/core/chart';
import type { ChartOptions } from '../src/core/chart';
import { NO_CORRECTION, inputOf } from './helpers';

const build = (input: BirthInput, opts: Partial<ChartOptions> = {}) => {
  const r = normalizeBirth(input, NO_CORRECTION);
  if (!r.ok) throw new Error(r.errors.join());
  const norm = r.value;
  const chart = buildChart(norm, { ...DEFAULT_CHART_OPTIONS, ...opts });
  const saju = lunarJavascriptEngine.compute({
    instantUtcMs: norm.instantUtcMs, clock: norm.corrected ?? norm.civil, hourKnown: norm.hourKnown, gender: norm.gender, lateZi: 'next',
  });
  return { norm, chart, saju, cmp: buildComparison(chart, saju, norm.tz) };
};

describe('사주 비교(N-01)', () => {
  it('T6: 연주가 달라 알림이 뜨고 문장에 사주 己巳 丁丑 · 자미두수 庚午 정월이 들어간다', () => {
    const { cmp } = build(inputOf(1990, 1, 30, 12, 'M'));
    expect(cmp.notice.level).toBe('year-differs');
    expect(cmp.notice.lines[0]).toContain('己巳년 丁丑월');
    expect(cmp.notice.lines[0]).toContain('庚午년 음력 1월 4일');
    expect(cmp.notice.lines.join(' ')).toContain('입춘');
    expect(cmp.notice.lines.join(' ')).toContain('“입춘”으로 바꾸면');
    expect(cmp.columns.map((c) => c.same)).toEqual([true, null, false, false]);
  });

  it('입춘 기준으로 바꾸면 연주가 같아진다(N-03)', () => {
    const { cmp, chart } = build(inputOf(1990, 1, 30, 12, 'M'), { yearBasis: 'ipchun' });
    expect(cmp.notice.yearDiffers).toBe(false);
    expect(chart.meta.fiveElements.hanja).toBe('金四局');
    expect(cmp.columns[3].same).toBe(true);
    expect(cmp.columns[3].ziweiNote).toBe('입춘 기준');
  });

  it('원장 §7 근거 구분 집계: 코드·시험 5 · 화면 관찰 2 · 자료 인용 2 · 전통 표 인용 1 (10항목)', () => {
    const { cmp } = build(inputOf(1984, 7, 1, 12, 'F'));
    expect(cmp.items.map((i) => i.id)).toEqual(['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'D-1', 'D-2', 'D-3', 'D-4', 'D-5']);
    expect(cmp.evidenceCounts).toEqual({ code: 5, screen: 2, source: 2, tradition: 1 });
    expect(cmp.items.filter((i) => i.side === 'common')).toHaveLength(5);
    expect(cmp.items.filter((i) => i.side === 'diff')).toHaveLength(5);
    expect(EVIDENCE_LABEL.tradition).toBe('전통 표 인용');
    for (const it of cmp.items) {
      expect(it.evidence.length).toBeGreaterThan(0);
      expect(it.live.length).toBeGreaterThan(0);
      expect(it.body.length).toBeGreaterThan(30);
    }
    // D-2 는 자미 쪽 코드 확인 + 사주 쪽 전통 표 인용을 함께 표기
    const d2 = cmp.items.find((i) => i.id === 'D-2')!;
    expect(d2.evidence.map((e) => e.kind).sort()).toEqual(['code', 'tradition']);
  });

  it('실측값: C-3 은 항상 일치(match)로 나오고, D-2/D-3 는 이 명식에서 differ 가 흔하다', () => {
    const { cmp } = build(inputOf(1990, 1, 30, 12, 'M'));
    const c3 = cmp.items.find((i) => i.id === 'C-3')!;
    expect(c3.live.every((l) => l.status === 'match')).toBe(true);
    const d2 = cmp.items.find((i) => i.id === 'D-2')!;
    expect(d2.live[0].status).toBe('differ');
    expect(d2.live[0].text).toContain('午');
    expect(d2.live[0].text).toContain('辰');
    const d4 = cmp.items.find((i) => i.id === 'D-4')!;
    expect(d4.live[0].text).toContain('사주 대운수 8');
    expect(d4.live[0].text).toContain('첫 대한 2세');
    const c2 = cmp.items.find((i) => i.id === 'C-2')!;
    expect(c2.live[0].status).toBe('differ'); // T6 는 연간이 달라 방향이 갈림
    expect(c2.live[1].text).toContain('해가 바뀌는 기준');
  });

  it('연주가 같은 생일에서는 C-2 가 일치로 나온다', () => {
    const { cmp } = build(inputOf(1984, 7, 1, 12, 'M'));
    expect(cmp.items.find((i) => i.id === 'C-2')!.live[0].status).toBe('match');
    expect(cmp.notice.level).not.toBe('year-differs');
  });

  it('시각 서식: 1990 입춘은 한국 시각 11:14', () => {
    const { saju, norm } = build(inputOf(1990, 2, 4, 12, 'M'));
    expect(saju.jie.prev.han).toBe('立春');
    expect(fmtInstant(saju.jie.prev.utcMs, norm.tz)).toBe('1990년 2월 4일 11:14');
  });

  it('용어집: 해설에서 쓰는 모든 {{용어}} 표기가 등록돼 있고 평문 변환이 동작한다', () => {
    const sample = '{{사화}}가 붙은 {{명궁}}은 {{삼방사정}}으로 읽습니다.';
    expect(termsIn(sample)).toEqual(['사화', '명궁', '삼방사정']);
    for (const t of termsIn(sample)) expect(GLOSSARY[t]).toBeTruthy();
    expect(plainText(sample)).toBe('사화가 붙은 명궁은 삼방사정으로 읽습니다.');
    expect(plainText(sample, true)).toContain('사화(생년 천간으로 정해지는');
    // 같은 용어는 처음 한 번만 풀이를 붙인다
    expect(plainText('{{사화}} {{사화}}', true)).toBe(`사화(${GLOSSARY['사화'].short}) 사화`);
  });
});
