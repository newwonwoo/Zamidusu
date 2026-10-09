// V-19·V-20 쉬운 해설(설계서 부록 B, 요구 E-01~E-10): 사용자 결정 “해설은 분량 무관, 이해하기 쉬워야 함”.
//   분량에는 제한이 없고, 대신 문장은 짧게(60자 이하) · 전문용어는 풀이 표시 · 같은 말을 되풀이하지 않기 · 결론(한눈에 보기)을 먼저 보여 준다.
//   모든 조합을 만들어 규칙을 어긴 곳이 0건인지 확인한다. (포국·사주 4기둥 값 자체는 다른 테스트가 확인한다 — E-09)
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildComparison } from '../src/core/compare';
import { buildView, decadalList, viewForDecade } from '../src/core/chart';
import type { Chart, View } from '../src/core/chart';
import { GLOSSARY, TERM_PATTERN, plainText, termsIn } from '../src/core/glossary';
import { MAX_SENTENCE_CHARS, composeStar, explainPalace } from '../src/core/explain/compose';
import type { PalaceExplain, StarContext } from '../src/core/explain/compose';
import { PALACES } from '../src/core/explain/palaces';
import { ROLE_GROUP_LABEL, ROLE_META, ROLE_ORDER, ROLE_PALACE_LINES } from '../src/core/explain/roles';
import { MAIN_PALACE_LINES, STAR_PROFILES } from '../src/core/explain/stars';
import { sajuPalaceText } from '../src/core/explain/sajutext';
import { MUTAGENS, PALACE_KEYS, SCOPES, STAR_META } from '../src/core/names';
import type { Mutagen, Scope } from '../src/core/names';
import { lunarJavascriptEngine } from '../src/core/saju';
import type { SajuChart } from '../src/core/saju';
import type { Brightness7 } from '../src/core/brightness';
import { makeChart, rng } from './helpers';
import { JARGON, MAX_OVERLAP, MAX_SENTENCE, formatProblem, len, sentencesOf, unmarkedJargon, worstOverlap } from './readability';
import { renderPalace } from './render';

const B7: Brightness7[] = ['miao', 'wang', 'de', 'li', 'ping', 'bu', 'xian'];

/** 한 텍스트의 규칙 위반을 모은다 */
const textProblems = (label: string, text: string): string[] => {
  const bad: string[] = [];
  for (const s of sentencesOf(text)) if (len(s) > MAX_SENTENCE) bad.push(`${label}: ${len(s)}자 문장 “${s}”`);
  const j = unmarkedJargon(text);
  if (j.length) bad.push(`${label}: 표시 없는 전문용어 ${j.join(',')} — “${plainText(text).slice(0, 60)}”`);
  for (const t of termsIn(text)) if (!GLOSSARY[t]) bad.push(`${label}: 사전에 없는 용어 ${t}`);
  const f = formatProblem(text);
  if (f) bad.push(`${label}: ${f} — “${plainText(text).slice(0, 60)}”`);
  return bad;
};

const sajuOf = (chart: Chart, gender: 'M' | 'F'): SajuChart =>
  lunarJavascriptEngine.compute({ instantUtcMs: chart.norm.instantUtcMs, clock: chart.norm.corrected!, hourKnown: true, gender, lateZi: 'next' });

const randomCharts = (n: number, seed: number): { chart: Chart; saju: SajuChart }[] => {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const gender = r() < 0.5 ? 'M' : 'F';
    const chart = makeChart(1930 + Math.floor(r() * 90), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28), Math.floor(r() * 12), gender);
    return { chart, saju: sajuOf(chart, gender) };
  });
};

/** 한 줄 안의 괄호 중첩 깊이 */
const parenDepth = (line: string): number => {
  let d = 0;
  let max = 0;
  for (const ch of line) {
    if (ch === '(') max = Math.max(max, ++d);
    else if (ch === ')') d--;
  }
  return max;
};

/** 글자쌍(2-gram) 집합 — 한글·숫자만 */
const pairsOf = (t: string): Set<string> => {
  const x = t.replace(/[^가-힣0-9]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < x.length - 1; i++) out.add(x.slice(i, i + 2));
  return out;
};

/** 한 문장 안의 {{용어}} 풀이가 같은 문장의 나머지와 같은 말을 되풀이하면 그 용어를 돌려준다 (풀이 글자쌍의 절반 이상이 문장에 이미 있음) */
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

const viewsOf = (chart: Chart, r: () => number): View[] => {
  const target = { date: { y: 2020 + Math.floor(r() * 12), m: 1 + Math.floor(r() * 12), d: 1 + Math.floor(r() * 28) }, timeIndex: Math.floor(r() * 12) };
  const list = decadalList(chart);
  return SCOPES.map((scope: Scope) =>
    scope === 'natal' ? buildView(chart, 'natal', null)
      : scope === 'decadal' ? viewForDecade(chart, list[Math.floor(r() * list.length)].startAge)
        : buildView(chart, scope, target));
};

describe('V-19 문안 규칙: 분량 제한 없이 문장은 짧게·용어는 표시·되풀이 금지', () => {
  it('상수: 한 문장 최대 글자 수가 설계서(60자)와 같다', () => {
    expect(MAX_SENTENCE_CHARS).toBe(60);
    expect(MAX_SENTENCE).toBe(MAX_SENTENCE_CHARS);
    expect(JARGON.length).toBeGreaterThanOrEqual(40);
  });

  it('역할 × 궁 문장 13 × 12 = 156개: 모두 있고, 서로 다르고, 규칙을 지킨다', () => {
    const all = new Set<string>();
    let n = 0;
    const bad: string[] = [];
    expect(Object.keys(ROLE_PALACE_LINES).sort()).toEqual(Object.keys(ROLE_META).sort());
    expect(ROLE_ORDER.slice().sort()).toEqual(Object.keys(ROLE_META).sort());
    for (const [role, lines] of Object.entries(ROLE_PALACE_LINES)) {
      expect(Object.keys(lines).sort(), role).toEqual([...PALACE_KEYS].sort());
      for (const [pk, line] of Object.entries(lines)) {
        n++;
        all.add(line);
        bad.push(...textProblems(`${role}/${pk}`, line));
        expect(sentencesOf(line).length, `${role}/${pk}`).toBeGreaterThanOrEqual(1);
      }
      expect(Object.values(ROLE_META[role as keyof typeof ROLE_META].label).length).toBeGreaterThan(0);
    }
    expect(bad).toEqual([]);
    expect(n).toBe(156);
    expect(all.size).toBe(156);
    expect(Object.keys(ROLE_GROUP_LABEL)).toHaveLength(3);
    // 모든 비주성 별이 어느 한 역할에 속한다
    for (const [k, meta] of Object.entries(STAR_META)) {
      if (meta.group === 'main') continue;
      expect(ROLE_META[STAR_PROFILES[k].role as keyof typeof ROLE_META], k).toBeTruthy();
    }
  });

  it('주성 168문장(14 × 12)과 별 사전의 모든 문장이 규칙을 지킨다', () => {
    const bad: string[] = [];
    for (const [key, lines] of Object.entries(MAIN_PALACE_LINES)) for (const [pk, line] of Object.entries(lines)) bad.push(...textProblems(`주성 ${key}/${pk}`, line));
    for (const [key, p] of Object.entries(STAR_PROFILES)) {
      bad.push(...textProblems(`별 ${key} 뜻`, p.essence), ...textProblems(`별 ${key} 요약`, p.tag));
      if (p.strength) bad.push(...textProblems(`별 ${key} 장점`, p.strength));
      if (p.caution) bad.push(...textProblems(`별 ${key} 주의`, p.caution));
      const ws = worstOverlap(sentencesOf(p.essence));
      if (ws.score >= MAX_OVERLAP) bad.push(`별 ${key} 뜻 문장 겹침 ${ws.score.toFixed(2)}`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('모든 별 카드 조합(별 66 × 궁 12 × 본명궁 12 × 운 6 × 밝기 7 × 사화 5 × 모드 2): 문장 길이·용어 표시·되풀이·서식', () => {
    const bad: string[] = [];
    const lens: number[] = [];
    const cache = new Map<string, string[]>();
    const sent = (t: string): string[] => {
      let v = cache.get(t);
      if (!v) cache.set(t, (v = sentencesOf(t)));
      return v;
    };
    const checked = new Set<string>();
    let blocks = 0;
    let cards = 0;
    for (const key of Object.keys(STAR_META)) {
      const prof = STAR_PROFILES[key];
      const isMain = STAR_META[key].group === 'main';
      const bs: (Brightness7 | undefined)[] = prof.strength ? [undefined, ...B7] : [undefined];
      const tags: (Mutagen | undefined)[] = ['左輔', '右弼', '文昌', '文曲'].includes(key) || isMain ? [undefined, ...MUTAGENS] : [undefined];
      for (const scope of SCOPES) {
        for (const scoped of PALACE_KEYS) {
          // 본명 기준 블록은 주성에만 있으므로, 다른 별은 본명궁을 돌려 볼 필요가 없다
          for (const natal of isMain ? PALACE_KEYS : [scoped]) {
            if (scope === 'natal' && natal !== scoped) continue;
            for (const b of bs) {
              for (const m of tags) {
                // 5단계/7단계 표시는 밝기 문장에만 영향을 준다
                for (const mode of b ? (['5', '7'] as const) : (['5'] as const)) {
                  if (b && mode === '5' && b === 'de') continue;
                  const ctx: StarContext = { scope, scopedPalace: scoped, natalPalace: natal, mode, saju: { yearStem: 6, yearBranch: 6, dayStem: 1 } };
                  const r = composeStar({ key, brightness: b, mutagens: m ? [{ mutagen: m, scope }] : [] }, ctx);
                  cards++;
                  const cardSentences: string[] = [];
                  for (const blk of r.blocks) {
                    blocks++;
                    for (const x of sent(blk.text)) cardSentences.push(x);
                    if (checked.has(blk.text)) continue;
                    checked.add(blk.text);
                    const label = `${key} ${blk.kind} ${scope} ${scoped}/${natal}`;
                    for (const x of sent(blk.text)) lens.push(len(x));
                    bad.push(...textProblems(label, blk.text));
                    const ws = worstOverlap(sent(blk.text));
                    if (ws.score >= MAX_OVERLAP) bad.push(`${label}: 한 블록 안에서 뜻이 겹침 ${ws.score.toFixed(2)} “${ws.pair?.join(' ‖ ')}”`);
                  }
                  if (new Set(cardSentences).size !== cardSentences.length) bad.push(`${key} ${scope} ${scoped}/${natal}: 한 카드에 같은 문장이 두 번`);
                }
              }
            }
          }
        }
      }
    }
    expect(blocks).toBeGreaterThan(40000);
    const sorted = [...lens].sort((a, b) => a - b);
    const stat = { cards, blocks, uniqueBlocks: checked.size, sentences: lens.length, mean: +(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1), p50: sorted[Math.floor(sorted.length * 0.5)], p90: sorted[Math.floor(sorted.length * 0.9)], max: sorted[sorted.length - 1] };
    // eslint-disable-next-line no-console
    console.log('STAR_CARD_SENTENCES', JSON.stringify(stat));
    expect(bad.slice(0, 12)).toEqual([]);
    expect(stat.max).toBeLessThanOrEqual(MAX_SENTENCE);
    expect(stat.p90).toBeLessThanOrEqual(48);
  });

  it('용어 풀이가 같은 문장의 말을 되풀이하지 않는다(무작위 명반 60개 × 본명·대한 × 12칸)', () => {
    const r = rng(5);
    const bad = new Set<string>();
    let sentences = 0;
    for (const { chart, saju } of randomCharts(60, 5)) {
      const views = [buildView(chart, 'natal', null), viewForDecade(chart, decadalList(chart)[2].startAge)];
      for (const view of views) {
        for (let b = 0; b < 12; b++) {
          const p = explainPalace(chart, view, b, { saju, mode: r() < 0.5 ? '5' : '7' });
          const texts = [p.overview, p.sajuLine, p.glance.headline, ...p.glance.points.map((x) => x.text), ...p.combos.map((c) => c.text), ...p.flowNotes,
            ...[...p.stars, ...p.borrowed].flatMap((s) => s.blocks.map((blk) => blk.text))];
          if (p.emptyNotice) texts.push(p.emptyNotice);
          if (p.scopeNote) texts.push(p.scopeNote);
          for (const t of texts) {
            for (const sent of t.split(/(?<=[.!?])\s+/)) {
              sentences++;
              for (const term of glossRepeats(sent)) bad.add(`${term}: ${plainText(sent).slice(0, 70)}`);
            }
          }
        }
      }
    }
    expect(sentences).toBeGreaterThan(50000);
    expect([...bad].slice(0, 8)).toEqual([]);
  });

  it('용어 사전: 풀이는 60자 이하, 자기 이름 외에 다른 전문용어를 쓰지 않는다', () => {
    const bad: string[] = [];
    for (const [term, e] of Object.entries(GLOSSARY)) {
      if (len(e.short) > 60) bad.push(`${term}: 풀이 ${len(e.short)}자`);
      if (/[()]/.test(e.short)) bad.push(`${term}: 짧은 풀이는 괄호 안에 쓰이므로 괄호를 쓰지 않는다 — “${e.short}”`);
      for (const txt of [e.short, e.more ?? '']) {
        const others = JARGON.filter((j) => j.term !== term && j.re.test(txt) && !term.includes(j.term) && !j.term.includes(term)).map((j) => j.term);
        // 풀이 안에서 다른 사전 용어를 쓰는 것은 막지 않되, ‘짧은 풀이’에서는 일상어만 쓴다
        if (txt === e.short && others.length) bad.push(`${term}: 짧은 풀이에 전문용어 ${others.join(',')}`);
      }
      if (/명식/.test(e.short + (e.more ?? ''))) bad.push(`${term}: 금지어 명식`);
    }
    expect(bad).toEqual([]);
  });
});

describe('V-20 결론(한눈에 보기)과 사주 대응 문장', () => {
  it('모든 칸 × 운 모드 6종(무작위 명반 120개 × 12칸 × 6)에 한눈에 보기가 있고 규칙을 지킨다', () => {
    const r = rng(20261009);
    const bad: string[] = [];
    let palaces = 0;
    let groups = 0;
    let borrowedNotices = 0;
    const headlineSentences: number[] = [];
    for (const { chart, saju } of randomCharts(120, 7)) {
      for (const view of viewsOf(chart, r)) {
        for (let b = 0; b < 12; b++) {
          const p: PalaceExplain = explainPalace(chart, view, b, { saju, mode: r() < 0.5 ? '5' : '7' });
          palaces++;
          const g = p.glance;
          const label = `${view.scope} ${p.title}(${b})`;
          bad.push(...textProblems(`${label} 결론`, g.headline));
          for (const pt of g.points) bad.push(...textProblems(`${label} ${pt.kind}/${pt.label}`, pt.text));
          const hs = sentencesOf(g.headline);
          headlineSentences.push(hs.length);
          if (hs.length < 1 || hs.length > 5) bad.push(`${label}: 결론 문장 수 ${hs.length}`);
          if (new Set(hs).size !== hs.length) bad.push(`${label}: 결론에 같은 문장 반복`);
          const texts = g.points.map((x) => x.text);
          if (new Set(texts).size !== texts.length) bad.push(`${label}: 항목 문장 중복`);

          const palace = chart.palaces[b];
          const mains = palace.stars.filter((s) => s.group === 'main');
          const topic = PALACES[p.scopedName].topic;
          if (mains.length > 0) {
            if (!plainText(g.headline).includes(topic)) bad.push(`${label}: 결론에 칸의 주제(${topic})가 없음`);
            if (!g.headline.includes('강점이고') || !g.headline.includes('조심할 점입니다')) bad.push(`${label}: 결론에 강점·조심할 점이 없음`);
            if (!plainText(g.headline).includes(`중심이 되는 별은 ${mains.map((m) => m.ko).join('·')}입니다`)) bad.push(`${label}: 결론에 중심 별이 없음`);
            for (const m of mains) {
              const pt = g.points.find((x) => x.kind === 'star' && x.label === m.ko);
              if (!pt || pt.text !== MAIN_PALACE_LINES[m.key][p.scopedName]) bad.push(`${label}: 중심 별 ${m.ko} 항목이 별×궁 문장과 다름`);
              if (m.brightness && !g.points.some((x) => x.kind === 'power' && x.text.startsWith(m.ko))) bad.push(`${label}: ${m.ko} 별의 힘 항목 없음`);
            }
          } else if (p.borrowed.length > 0) {
            borrowedNotices++;
            if (!g.headline.includes('빌려 읽습니다')) bad.push(`${label}: 차성안궁 안내 없음`);
            for (const s of p.borrowed) if (!g.points.some((x) => x.kind === 'borrow' && x.label === `빌려 온 ${s.ko}`)) bad.push(`${label}: 빌려 온 ${s.ko} 항목 없음`);
          } else if (!/중심이 되는 별이 없어|별이 없어/.test(g.headline)) {
            bad.push(`${label}: 빈 칸 안내 없음`);
          }
          // 사화: 생년 + 선택한 운
          const expectMut = palace.stars.filter((s) => s.mutagen).length + view.mutagens.filter((m) => palace.stars.some((s) => s.key === m.star)).length;
          if (g.points.filter((x) => x.kind === 'mutagen').length !== expectMut) bad.push(`${label}: 사화 항목 수 불일치`);
          // 함께 있는 별: 역할마다 한 줄, 문장은 역할 × 궁 표와 같다
          const roles = new Set(palace.stars.filter((s) => s.group !== 'main').map((s) => STAR_PROFILES[s.key].role));
          for (const role of roles) {
            groups++;
            const meta = ROLE_META[role as keyof typeof ROLE_META];
            const pt = g.points.find((x) => x.kind === 'group' && x.label === meta.label);
            if (!pt || !pt.text.endsWith(ROLE_PALACE_LINES[role as keyof typeof ROLE_PALACE_LINES][p.scopedName])) bad.push(`${label}: 역할 ${role} 항목이 표와 다름`);
          }
          if (g.points.filter((x) => x.kind === 'group').length !== roles.size) bad.push(`${label}: 역할 항목 수 불일치`);
          // 칸 단위 나머지 문장
          bad.push(...textProblems(`${label} 개요`, p.overview), ...textProblems(`${label} 사주`, p.sajuLine));
          if (p.scopeNote) bad.push(...textProblems(`${label} 시기 안내`, p.scopeNote));
          if (p.emptyNotice) bad.push(...textProblems(`${label} 빈 궁 안내`, p.emptyNotice));
          for (const c of p.combos) bad.push(...textProblems(`${label} 조합 ${c.name}`, c.text), ...textProblems(`${label} 조합 위치`, c.where));
          for (const f of p.flowNotes) bad.push(...textProblems(`${label} 유성`, f));
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('GLANCE_COVERAGE', JSON.stringify({ palaces, groups, borrowedNotices, headlineMax: Math.max(...headlineSentences) }));
    expect(palaces).toBe(120 * 6 * 12);
    expect(borrowedNotices).toBeGreaterThan(100);
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('용어 풀이를 붙여 읽어도 괄호 안에 괄호가 없다(무작위 명반 40개 × 6 운 × 12칸)', () => {
    const r = rng(77);
    const bad: string[] = [];
    let palaces = 0;
    for (const { chart, saju } of randomCharts(40, 11)) {
      for (const view of viewsOf(chart, r)) {
        for (let b = 0; b < 12; b++) {
          palaces++;
          const text = renderPalace(explainPalace(chart, view, b, { saju, mode: r() < 0.5 ? '5' : '7' }));
          for (const line of text.split('\n')) if (parenDepth(line) > 1) bad.push(`${view.scope} ${b}: ${line.slice(0, 100)}`);
        }
      }
    }
    expect(palaces).toBe(40 * 6 * 12);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('결론은 시기를 따른다: 본명은 따로 말하지 않고 운 모드는 시기를 앞에 붙인다', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const saju = sajuOf(chart, 'M');
    const natal = buildView(chart, 'natal', null);
    const wealth = chart.palaces.find((p) => p.natalName === 'wealth')!.branch;
    const n = explainPalace(chart, natal, wealth, { saju, mode: '5' }).glance.headline;
    expect(n.startsWith('돈을 벌고 쓰는 방식에서 중심이 되는 별은 거문입니다.')).toBe(true);
    const target = { date: { y: 2026, m: 10, d: 9 }, timeIndex: 6 };
    const y = buildView(chart, 'yearly', target);
    const yw = y.names.indexOf('wealth');
    expect(explainPalace(chart, y, yw, { saju, mode: '5' }).glance.headline.startsWith('올해 돈을 벌고 쓰는 방식에서 중심이 되는 별은')).toBe(true);
    const d = viewForDecade(chart, decadalList(chart)[2].startAge);
    expect(explainPalace(chart, d, d.names.indexOf('wealth'), { saju, mode: '5' }).glance.headline.startsWith('이 10년 동안 돈을 벌고 쓰는 방식에서 중심이 되는 별은')).toBe(true);
  });

  it('T6 관록궁: 태양(함·생년 화록)의 결론과 항목', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const saju = sajuOf(chart, 'M');
    const natal = buildView(chart, 'natal', null);
    const b = chart.palaces.find((p) => p.natalName === 'career')!.branch;
    const g = explainPalace(chart, natal, b, { saju, mode: '5' }).glance;
    expect(plainText(g.headline)).toBe(
      '일과 직업, 사회적 위치에서 중심이 되는 별은 태양입니다. 태양은 공정함과 베푸는 힘이 강점이고, 남을 챙기다 스스로 지치는 면은 조심할 점입니다. 태양은 힘이 가장 약한 자리에 있어 강점이 잘 드러나지 않으니 조심할 점을 먼저 챙기세요.',
    );
    const kinds = g.points.map((x) => x.kind);
    expect(kinds.slice(0, 3)).toEqual(['star', 'power', 'mutagen']);
    expect(plainText(g.points[1].text)).toContain("태양은 힘이 가장 약한 자리('함')에 있습니다.");
    expect(plainText(g.points[2].text)).toContain('생년 화록이 태양에 붙어 있습니다.');
    expect(g.points.filter((x) => x.kind === 'group').map((x) => x.label)).toEqual(['명예와 인정의 별', '걱정과 마찰의 별']);
  });

  it('사주 대응 문장: 개념 → 이 사주의 값 → 뜻 순서이고, 개수를 말로 풀어 쓴다(무작위 사주 400개 × 12칸 × 남녀)', () => {
    const bad: string[] = [];
    const meanings: Record<string, Set<string>> = {};
    const COUNT = /(하나도 없습니다|\d개로 (적은 편|보통|많은 편)입니다)/;
    for (const { chart, saju } of randomCharts(400, 11)) {
      for (const pk of PALACE_KEYS) {
        for (const g of ['M', 'F'] as const) {
          const t = sajuPalaceText(pk, saju, g);
          const label = `사주 ${pk}/${g}`;
          bad.push(...textProblems(label, t));
          if (!t.startsWith(PALACES[pk].saju)) bad.push(`${label}: 개념 문장으로 시작하지 않음`);
          if (!['life', 'health', 'travel'].includes(pk) && !COUNT.test(plainText(t))) bad.push(`${label}: 개수를 말로 풀지 않음`);
          const last = sentencesOf(t).slice(-1)[0];
          (meanings[pk] ??= new Set()).add(last);
          if (!/(봅니다|합니다|입니다)\.$/.test(last)) bad.push(`${label}: 뜻 문장으로 끝나지 않음 “${last}”`);
        }
      }
      void chart;
    }
    expect(bad.slice(0, 12)).toEqual([]);
    // 뜻 문장이 실제로 값에 따라 갈라진다(한 가지로 고정되지 않음)
    for (const pk of ['siblings', 'spouse', 'children', 'wealth', 'property', 'parents'] as const) expect(meanings[pk].size, pk).toBe(4);
    for (const pk of ['career', 'fortune'] as const) expect(meanings[pk].size, pk).toBe(4);
    expect(meanings.travel.size).toBe(2);
    expect(meanings.life.size).toBeGreaterThanOrEqual(8);
  });

  it('사주 정보가 없으면(시 모름 등) 개념 문장만 나온다 — 풀이 표시는 그대로 유효', () => {
    for (const pk of PALACE_KEYS) {
      const t = sajuPalaceText(pk, null, 'F');
      expect(t).toBe(PALACES[pk].saju);
      expect(textProblems(`개념 ${pk}`, t)).toEqual([]);
    }
  });

  it('시를 모르는 사주(여섯 글자)도 같은 구조로 풀어 쓴다', () => {
    const chart = makeChart(1985, 5, 17, 3, 'F');
    const saju = lunarJavascriptEngine.compute({ instantUtcMs: chart.norm.instantUtcMs, clock: chart.norm.corrected!, hourKnown: false, gender: 'F', lateZi: 'next' });
    for (const pk of PALACE_KEYS) expect(textProblems(`시 모름 ${pk}`, sajuPalaceText(pk, saju, 'F'))).toEqual([]);
    expect(plainText(sajuPalaceText('children', saju, 'F'))).toContain('태어난 시각을 몰라 시주는 볼 수 없습니다.');
    expect(plainText(sajuPalaceText('health', saju, 'F'))).toContain('여섯 글자');
  });
});

describe('E-10 사주 비교 탭: 본문의 전문용어는 풀이 표시, 문장은 짧게', () => {
  it('알림·공통점·차이점 본문과 실측 문장(무작위 명반 60개)', () => {
    const bad: string[] = [];
    // 실측 문장 중 화면 테스트가 원문 그대로를 찾는 곳(대운수·첫 대한)은 표시를 달지 않는다
    const EXEMPT_LIVE = /대운수|첫 대한/;
    for (const { chart, saju } of randomCharts(60, 23)) {
      const cmp = buildComparison(chart, saju, 'Asia/Seoul');
      for (const line of cmp.notice.lines) bad.push(...textProblems(`알림`, line));
      for (const it of cmp.items) {
        bad.push(...textProblems(`${it.id} 본문`, it.body));
        for (const l of it.live) {
          if (EXEMPT_LIVE.test(l.text)) continue;
          // 열두 단계의 이름(건록 등)은 값으로 적힌 것이지 용어로 쓴 것이 아니다
          bad.push(...textProblems(`${it.id} 실측`, l.text).filter((x) => !(it.id === 'C-4' && /표시 없는 전문용어 건록/.test(x))));
        }
        for (const j of unmarkedJargon(it.title)) bad.push(`${it.id} 제목에 전문용어 ${j}`);
      }
    }
    expect(Array.from(new Set(bad)).slice(0, 12)).toEqual([]);
  });

  it('근거 목록은 본문과 분리돼 있다(제목·본문·실측 문장 어디에도 내부 번호가 없다)', () => {
    const { chart, saju } = randomCharts(1, 5)[0];
    const cmp = buildComparison(chart, saju, 'Asia/Seoul');
    const INTERNAL = /원장|V-\d|T\d|R-\d|U-\d/;
    for (const it of cmp.items) {
      expect(INTERNAL.test(it.title + it.body + it.live.map((l) => l.text).join(' ')), it.id).toBe(false);
      expect(it.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe('용어 표시 형식', () => {
  it('TERM_PATTERN 은 중첩 없는 {{용어}} 만 잡는다', () => {
    expect('{{밝기}}는 {{화록}}이'.match(TERM_PATTERN)).toHaveLength(2);
  });
});

describe('문서용 해설 샘플(T6)', () => {
  it('화면과 같은 순서·풀이로 12칸을 평문으로 옮긴다 (WRITE_EXPLAIN_SAMPLE=1 이면 docs/generated/explain-sample.md 를 쓴다)', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const saju = sajuOf(chart, 'M');
    const natal = buildView(chart, 'natal', null);
    const parts: string[] = [];
    for (const key of PALACE_KEYS) {
      const b = chart.palaces.find((p) => p.natalName === key)!.branch;
      parts.push(renderPalace(explainPalace(chart, natal, b, { saju, mode: '5' })));
    }
    const dec = viewForDecade(chart, decadalList(chart)[1].startAge);
    const yr = buildView(chart, 'yearly', { date: { y: 2026, m: 10, d: 9 }, timeIndex: 6 });
    const extra = [
      renderPalace(explainPalace(chart, dec, dec.lifeBranch, { saju, mode: '5' }), { heading: '[대한 12~21세] 명궁' }),
      renderPalace(explainPalace(chart, yr, yr.names.indexOf('wealth'), { saju, mode: '5' }), { heading: '[유년 2026] 재백궁' }),
    ];
    const doc = [
      '# 해설 샘플 — 시나리오 T6 (1990-01-30 남 12시, 한국 음력)',
      '',
      '`WRITE_EXPLAIN_SAMPLE=1 npx vitest run tests/readability.test.ts` 로 만든 문서입니다. 화면의 “궁 해설” 탭과 같은 순서·같은 용어 풀이(처음 나올 때 한 번)로 옮긴 글이며,',
      '설계서 부록 B(쉬운 해설)의 결과물입니다. 한눈에 보기 → 별 해설 → 사주로 보면 순서이고, 해설은 전통 이론에 따른 참고용입니다.',
      '화면에만 있는 것: “해설 읽는 법” 안내, 12궁 요약표, “함께 읽는 칸” 아래의 삼합·대궁 안내 줄, 접기/펼치기(별 카드 속 “사주와 같은 점”은 화면에서 접혀 있고 여기서는 펼쳐 적었습니다).',
      '',
      '# 본명 12궁',
      '',
      parts.join('\n\n---\n\n'),
      '',
      '# 운 모드 예',
      '',
      extra.join('\n\n---\n\n'),
      '',
    ].join('\n');
    expect(doc.length).toBeGreaterThan(20000);
    for (const t of [...parts, ...extra]) for (const line of t.split('\n')) expect(formatProblem(line.trim()), line.slice(0, 60)).toBeNull();
    if (process.env.WRITE_EXPLAIN_SAMPLE) fs.writeFileSync('docs/generated/explain-sample.md', doc);
  });
});
