// V-29 통변 문장 규칙(설계 부록 D, 요구 T-07·T-08): 쉬운 해설 규칙(부록 B)을 새 통변 전체에 적용한다.
//   문장 60자 이하 · 전문용어는 {{ }} 표시 · 한 덩어리 안에서 같은 말 되풀이 금지 · 괄호 중첩 금지 · 풀이가 문장을 되풀이하지 않음 · 단정·공포 어조 금지.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLOSSARY, TERM_PATTERN, plainText, termsIn } from '../src/core/glossary';
import { DISCLAIMER, DOMAINS, THEMES, buildTongbyeon, whyOf } from '../src/core/tongbyeon';
import type { Tongbyeon } from '../src/core/tongbyeon';
import { MAX_OVERLAP, MAX_SENTENCE, formatProblem, len, sentencesOf, unmarkedJargon, worstOverlap } from './readability';
import { renderTongbyeon } from './render';
import { sajuOfChart, tbSample } from './tbsample';
import { makeChart } from './helpers';

interface Block {
  label: string;
  texts: string[];
  /** 한 덩어리 안에서 뜻 겹침을 검사할지(칩 목록 같은 것은 제외) */
  overlap: boolean;
  /** 같은 문장이 두 번 나오지 않는지만 검사(여러 항목을 모은 카드용) */
  uniqueOnly?: boolean;
}

/** 화면에 글로 나오는 모든 통변 문장을 덩어리별로 모은다(근거 보기의 기술적 값은 제외) */
export const blocksOf = (tb: Tongbyeon): Block[] => {
  const b: Block[] = [];
  const z = tb.ziwei;
  const s = tb.saju;
  for (const [name, ov] of [['자미두수 총평', z.overview], ['사주 총평', s.overview]] as const) {
    b.push({ label: `${name} 한 줄`, texts: [ov.headline], overlap: false });
    for (const p of ov.paragraphs) b.push({ label: `${name} ${p.label}`, texts: p.sentences, overlap: true });
    b.push({ label: `${name} 조언`, texts: ov.advice, overlap: true });
    b.push({ label: `${name} 핵심어`, texts: ov.keywords, overlap: false });
  }
  for (const sys of [z, s]) {
    for (const d of DOMAINS) {
      const r = sys.domains[d];
      b.push({ label: `${r.system} ${d} 카드 결론`, texts: [r.verdict, r.advice], overlap: true });
      for (const p of r.points) b.push({ label: `${r.system} ${d} 카드 ${p.label}`, texts: [p.text], overlap: true });
      b.push({ label: `${r.system} ${d} 카드 전체`, texts: [r.verdict, ...r.points.map((p) => p.text), r.advice], overlap: false, uniqueOnly: true });
      b.push({ label: `${r.system} ${d} 근거 요약`, texts: r.reasons.map((x) => x.brief), overlap: false });
      b.push({ label: `${r.system} ${d} 이렇게 본 이유`, texts: whyOf(r), overlap: false });
      b.push({ label: `${r.system} ${d} 주제`, texts: r.themes.map((t) => THEMES[d][t]), overlap: false });
    }
  }
  for (const p of [...z.decades, ...s.daeun]) {
    b.push({ label: `${p.system} 시기 ${p.label}`, texts: [p.headline], overlap: true });
    if (p.standingNote) b.push({ label: `${p.system} 시기 위치 ${p.label}`, texts: [p.standingNote], overlap: false });
  }
  for (const note of [z.decadeNote, s.daeunNote]) if (note) b.push({ label: '시기 목록 안내', texts: [note], overlap: false });
  const c = tb.comparison;
  b.push({ label: '비교 요약', texts: c.summary, overlap: true });
  for (const d of c.domains) {
    b.push({ label: `비교 ${d.domain}`, texts: [d.headline, ...(d.nuance ? [d.nuance] : []), d.lens, d.reading], overlap: true });
  }
  for (const p of c.periods) b.push({ label: `시기 비교 ${p.ziwei.label}`, texts: [p.note], overlap: false });
  b.push({ label: '고지', texts: tb.disclaimer, overlap: false });
  return b;
};

const parenDepth = (line: string): number => {
  let d = 0;
  let max = 0;
  for (const ch of line) {
    if (ch === '(') max = Math.max(max, ++d);
    else if (ch === ')') d--;
  }
  return max;
};
const pairsOf = (t: string): Set<string> => {
  const x = t.replace(/[^가-힣0-9]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < x.length - 1; i++) out.add(x.slice(i, i + 2));
  return out;
};
const glossRepeats = (sentence: string): string[] => {
  const rest = pairsOf(sentence.replace(TERM_PATTERN, ''));
  const out: string[] = [];
  for (const term of termsIn(sentence)) {
    const g = pairsOf(GLOSSARY[term]?.short ?? '');
    if (g.size < 4) continue;
    let same = 0;
    for (const x of g) if (rest.has(x)) same++;
    if (same / g.size >= 0.5) out.push(term);
  }
  return out;
};

/** 10년 구간의 개수를 열두 개로 말하는 표현(명반은 열두 칸이지만 구간은 100세까지만 다뤄 10개다 — 3차 독자 시험에서 목록은 10개인데 문장은 열두 구간이라고 한 것이 걸렸다) */
const COUNT_WORDING = /열두 ?(구간|10년)|12 ?(구간|개 구간)/;

/** 단정·공포를 부르는 말(통변은 “~한 편입니다/~하기 쉽습니다” 로 쓴다) */
const FORBIDDEN = ['반드시', '틀림없이', '절대', '확실히', '무조건', '죽', '사망', '이혼합니다', '망합니다', '저주', '재앙', '불행해집니다', '병에 걸립니다', '암에'];

const problemsOf = (block: Block): string[] => {
  const bad: string[] = [];
  for (const text of block.texts) {
    for (const sx of sentencesOf(text)) if (len(sx) > MAX_SENTENCE) bad.push(`${block.label}: ${len(sx)}자 문장 “${sx}”`);
    const j = unmarkedJargon(text);
    if (j.length) bad.push(`${block.label}: 표시 없는 전문용어 ${j.join(',')} — “${plainText(text).slice(0, 70)}”`);
    for (const t of termsIn(text)) if (!GLOSSARY[t]) bad.push(`${block.label}: 사전에 없는 용어 ${t}`);
    const f = formatProblem(text);
    if (f) bad.push(`${block.label}: ${f} — “${plainText(text).slice(0, 70)}”`);
    for (const w of FORBIDDEN) if (plainText(text).includes(w)) bad.push(`${block.label}: 단정·공포 어조 “${w}” — “${plainText(text).slice(0, 70)}”`);
    if (COUNT_WORDING.test(plainText(text))) bad.push(`${block.label}: 10년 구간 수를 열두 개로 말함(구간은 100세까지 10개) — “${plainText(text).slice(0, 70)}”`);
    for (const sx of sentencesOf(text)) {
      const g = glossRepeats(sx);
      if (g.length) bad.push(`${block.label}: 용어 풀이가 문장을 되풀이 ${g.join(',')} — “${plainText(sx)}”`);
    }
  }
  if (block.overlap || block.uniqueOnly) {
    const all = block.texts.flatMap((t) => sentencesOf(t));
    if (block.overlap) {
      const ws = worstOverlap(all);
      if (ws.score >= MAX_OVERLAP) bad.push(`${block.label}: 뜻 겹침 ${ws.score.toFixed(2)} “${ws.pair?.join(' ‖ ')}”`);
    }
    if (new Set(all).size !== all.length) bad.push(`${block.label}: 같은 문장이 두 번`);
  }
  return bad;
};

describe('V-29 통변 문장 규칙 (무작위 명반 300개 × 자미두수·사주·비교 전체)', () => {
  it('문장 길이 · 용어 표시 · 서식 · 되풀이 · 어조 위반이 0건', () => {
    const sample = tbSample(300, 2026101);
    const seen = new Set<string>();
    const bad: string[] = [];
    let blocks = 0;
    let sentences = 0;
    const lens: number[] = [];
    for (const c of sample) {
      for (const block of blocksOf(c.tb)) {
        blocks++;
        for (const t of block.texts) for (const sx of sentencesOf(t)) {
          sentences++;
          lens.push(len(sx));
        }
        for (const p of problemsOf(block)) {
          if (seen.has(p)) continue;
          seen.add(p);
          bad.push(p);
        }
      }
    }
    const sorted = [...lens].sort((a, b) => a - b);
    // eslint-disable-next-line no-console
    console.log('TONGBYEON_SENTENCES', JSON.stringify({ charts: sample.length, blocks, sentences, mean: +(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1), p50: sorted[Math.floor(sorted.length * 0.5)], p90: sorted[Math.floor(sorted.length * 0.9)], max: sorted[sorted.length - 1] }));
    // eslint-disable-next-line no-console
    if (bad.length > 0) console.log(`TB_TEXT_PROBLEMS ${bad.length}\n${bad.slice(0, 120).join('\n')}`);
    expect(bad.slice(0, 25)).toEqual([]);
  });

  it('풀이를 붙여 읽어도 괄호 안에 괄호가 없다(문단 단위, 화면 순서대로 첫 등장에만 풀이)', () => {
    const sample = tbSample(300, 2026101);
    const bad: string[] = [];
    for (const c of sample) {
      for (const block of blocksOf(c.tb)) {
        const seen = new Set<string>();
        for (const t of block.texts) {
          const line = plainText(t, true, seen);
          if (parenDepth(line) > 1) bad.push(`${block.label}: 괄호 중첩 “${line.slice(0, 90)}”`);
        }
      }
    }
    expect(Array.from(new Set(bad)).slice(0, 15)).toEqual([]);
  });

  it('고지 문구는 설계(T-08)의 네 가지를 모두 말한다', () => {
    const t = DISCLAIMER.join(' ');
    expect(DISCLAIMER).toHaveLength(4);
    expect(t).toContain('간이 통변');
    expect(t).toContain('전문가 감수를 받지 않았습니다');
    expect(t).toContain('상대 위치');
    expect(t).toContain('진단·투자·법률 조언이 아닙니다');
    expect(t).toContain('판정하지 않습니다');
  });
});

describe('통변 샘플 문서', () => {
  it.runIf(Boolean(process.env.WRITE_TONGBYEON_DOCS))('실제 출생 3건의 통변 전문을 docs/generated/tongbyeon-sample.md 로 쓴다 (WRITE_TONGBYEON_DOCS=1)', () => {
    const cases: { label: string; y: number; m: number; d: number; branch: number; gender: 'M' | 'F' }[] = [
      { label: '1990-01-30 남 12시(午시) — 시나리오 T6와 같은 입력', y: 1990, m: 1, d: 30, branch: 6, gender: 'M' },
      { label: '1975-04-20 여 08시(辰시)', y: 1975, m: 4, d: 20, branch: 4, gender: 'F' },
      { label: '2001-11-05 남 00시(子시)', y: 2001, m: 11, d: 5, branch: 0, gender: 'M' },
    ];
    const lines = [
      '# 통변 샘플 (자동 생성)',
      '',
      '`WRITE_TONGBYEON_DOCS=1 npx vitest run tests/tongbyeon-text.test.ts -t "샘플"` 로 만든 문서입니다. 화면의 **종합 통변 · 사주 통변 · 통변 비교** 세 탭을 평문으로 옮긴 것으로, 기준 연도는 2026년, 시각은 표준시 그대로(보정 없음), 밝기는 5단계입니다.',
      '용어 풀이는 탭마다 처음 나올 때 한 번만 괄호로 붙입니다(화면에서는 용어를 눌러 보는 풀이입니다). 근거 보기(규칙 번호)는 접혀 있어 여기서는 뺐습니다.',
      '규칙 기반 간이 통변이며 전문가 감수를 받지 않았습니다. 경향 단계(▲▲ ▲ ● ▼ ▼▼)는 앞날의 예언이 아니라 무작위 출생 분포에서의 상대 위치입니다.',
      '',
    ];
    for (const c of cases) {
      const chart = makeChart(c.y, c.m, c.d, c.branch, c.gender);
      const tb = buildTongbyeon(chart, sajuOfChart(chart, c.gender), { mode: '5', todayYear: 2026 });
      lines.push(renderTongbyeon(tb, c.label));
    }
    fs.writeFileSync('docs/generated/tongbyeon-sample.md', lines.join('\n'));
    expect(lines.join('\n').length).toBeGreaterThan(5000);
  });
});
