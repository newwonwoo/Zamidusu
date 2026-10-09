// 해설 합성기(N-04). 입력: 별 + 궁 + 밝기 + 사화 + 운 모드 + 사주 정보 → 출력: 새로 쓴 문장 묶음.
// 순수 함수라 화면 없이 전 조합을 생성해 문장 규칙·다양성을 검사할 수 있다(검증 V-10, V-11, V-19, V-20).
//
// 구조: 한눈에 보기(결론) → 별 카드[ 한 줄 요약 → 풀이 → (본명 기준) → 밝기 → 사화 → 사주 대응 ] → 사주로 보면
// 개선: I-12(밝기·사화·삼방·운 모드에 반응) · I-14(별×궁) · 조합 · 용어 · 차성안궁 · 쉬운 해설(E-01~E-10, 설계서 부록 B)
// 문장 안의 {{용어}} 표시는 glossary.ts 의 용어를 가리킨다.

import { brightnessLabel } from '../brightness';
import type { Brightness7, BrightnessLabel, BrightnessMode } from '../brightness';
import { borrowedMainStars, scorePalace, surround } from '../chart';
import type { Chart, PalaceScore, View } from '../chart';
import { PALACE_KEYS, PALACE_KO, SCOPE_KO, starMeta } from '../names';
import type { Mutagen, PalaceKey, Scope } from '../names';
import type { SajuChart } from '../saju';
import { detectCombos } from './combos';
import type { ComboHit } from './combos';
import { buildGlance } from './glance';
import type { Glance } from './glance';
import { josa } from './korean';
import { PALACES } from './palaces';
import { WHEN, mutagenEffects, mutagenSubject, powerParts } from './phrases';
import type { MutagenTag } from './phrases';
import { sajuPalaceText, sajuStarText } from './sajutext';
import type { SajuHints } from './sajutext';
import { MAIN_PALACE_LINES, STAR_PROFILES } from './stars';
import type { StarProfile } from './stars';

export type { MutagenTag, SajuHints, Glance };
export { sajuPalaceText, sajuStarText };

/** 한 문장의 최대 길이(글자 수, 평문). 모든 조합의 모든 문장이 이 안에 있어야 한다(검증 V-19). 분량 자체에는 제한이 없다. */
export const MAX_SENTENCE_CHARS = 60;

export type BlockKind = 'summary' | 'body' | 'natal' | 'brightness' | 'mutagen' | 'saju';

export interface BlockText {
  kind: BlockKind;
  label: string;
  text: string;
}

export interface StarInput {
  key: string;
  brightness?: Brightness7;
  /** 이 별에 붙은 사화(생년 + 선택한 운 모드) */
  mutagens: MutagenTag[];
}

export interface StarContext {
  scope: Scope;
  /** 이 칸의 (운 모드에서의) 궁 이름 */
  scopedPalace: PalaceKey;
  natalPalace: PalaceKey;
  mode: BrightnessMode;
  saju?: SajuHints;
  /** 차성안궁으로 빌려 온 별 */
  borrowed?: boolean;
}

export interface StarExplain {
  key: string;
  ko: string;
  hanja: string;
  borrowed: boolean;
  blocks: BlockText[];
}

const MUTAGEN_LABEL = '사화';
const q = (label: string): string => `'${label}'`;

// ── 밝기 ─────────────────────────────────────────────────────────────────────
/** “이 별의 밝기는 ‘함’으로, 힘이 가장 약한 자리입니다. …” — 첫 문장이 기호의 뜻을 말하고 둘째 문장이 결과를 말한다. */
export const brightnessText = (p: StarProfile, b: Brightness7, mode: BrightnessMode): string => {
  const pw = powerParts(b, mode, p);
  return `이 별의 {{밝기}}는 ${josa(q(pw.label), '으로/로')}, ${pw.phrase}입니다. ${pw.effect}${pw.extra ? ` ${pw.extra}` : ''}`;
};

// ── 사화 ─────────────────────────────────────────────────────────────────────
export const mutagenText = (p: StarProfile, tag: MutagenTag, topic: string): string =>
  `${mutagenSubject(tag)} 이 별에 붙어 있습니다. ${mutagenEffects(p, tag, topic).join(' ')}`;

// ── 별 하나 ──────────────────────────────────────────────────────────────────
export const composeStar = (input: StarInput, ctx: StarContext): StarExplain => {
  const meta = starMeta(input.key);
  const prof = STAR_PROFILES[input.key];
  if (!prof) throw new Error(`별 사전에 없는 별: ${input.key}`);
  const scoped = PALACES[ctx.scopedPalace];
  const blocks: BlockText[] = [];

  blocks.push({ kind: 'summary', label: '요약', text: `${ctx.borrowed ? '빌려 온 별 · ' : ''}${meta.ko} — ${prof.tag}` });

  if (prof.role === 'main') {
    blocks.push({ kind: 'body', label: '풀이', text: `${prof.essence} ${MAIN_PALACE_LINES[input.key][ctx.scopedPalace]}` });
    if (ctx.scope !== 'natal' && ctx.scopedPalace !== ctx.natalPalace) {
      blocks.push({ kind: 'natal', label: '본명 기준', text: `본명으로는 ${PALACE_KO[ctx.natalPalace]}에 있는 별입니다. ${MAIN_PALACE_LINES[input.key][ctx.natalPalace]}` });
    }
  } else {
    // 보좌·살성·잡성: 별의 뜻만 적는다. 이 칸에서의 영향은 한눈에 보기의 역할별 문장(roles.ts)이 맡는다.
    blocks.push({ kind: 'body', label: '풀이', text: prof.essence });
  }

  if (ctx.borrowed) return { key: input.key, ko: meta.ko, hanja: meta.hanja, borrowed: true, blocks };

  if (input.brightness && prof.strength) {
    blocks.push({ kind: 'brightness', label: '밝기', text: brightnessText(prof, input.brightness, ctx.mode) });
  }
  for (const tag of input.mutagens) {
    blocks.push({
      kind: 'mutagen',
      label: tag.scope === 'natal' ? `생년 ${MUTAGEN_LABEL}` : `${SCOPE_KO[tag.scope]} ${MUTAGEN_LABEL}`,
      text: mutagenText(prof, tag, scoped.topic),
    });
  }
  const saju = sajuStarText(input.key, ctx.saju);
  if (saju) blocks.push({ kind: 'saju', label: '사주 대응', text: saju });
  return { key: input.key, ko: meta.ko, hanja: meta.hanja, borrowed: false, blocks };
};

// ── 궁 단위 ──────────────────────────────────────────────────────────────────
export interface PalaceExplain {
  branch: number;
  ganzhi: string;
  scopedName: PalaceKey;
  natalName: PalaceKey;
  title: string;
  subtitle: string;
  overview: string;
  /** 운 모드일 때 이 칸을 어떻게 읽는지 */
  scopeNote?: string;
  /** 결론과 핵심 항목(쉬운 말) */
  glance: Glance;
  sajuLine: string;
  /** 주성이 없을 때(차성안궁) 안내 */
  emptyNotice?: string;
  stars: StarExplain[];
  borrowed: StarExplain[];
  flowNotes: string[];
  combos: ComboHit[];
  /** 함께 읽는 삼방사정 칸(자기 자신 제외) */
  surround: { branch: number; name: PalaceKey; ganzhi: string; role: '삼합' | '대궁' }[];
  score: PalaceScore;
}

const FLOW_LINES: Record<string, (scopeLabel: string, topic: string) => string> = {
  祿: (s, t) => `${s} 녹존이 흘러 들어와 ${t}에서 꾸준한 이득이 보태집니다.`,
  羊: (s, t) => `${s} 경양이 들어와 ${t}에서 날카로운 긴장이 생기기 쉽습니다.`,
  陀: (s, t) => `${s} 타라가 들어와 ${t}에서 일이 더디고 얽히기 쉽습니다.`,
  昌: (s, t) => `${s} 문창이 들어와 ${t}에서 글과 문서 쪽 기회가 열립니다.`,
  曲: (s, t) => `${s} 문곡이 들어와 ${t}에서 말과 표현 쪽 기회가 열립니다.`,
  魁: (s, t) => `${s} 천괴가 들어와 ${t}에서 윗사람의 도움이 닿기 쉽습니다.`,
  鉞: (s, t) => `${s} 천월이 들어와 ${t}에서 뜻밖의 도움이 닿기 쉽습니다.`,
  馬: (s, t) => `${s} 천마가 들어와 ${t}에서 이동과 변화가 생기기 쉽습니다.`,
  鸞: (s, t) => `${s} 홍란이 들어와 ${t}에서 인연과 만남이 늘기 쉽습니다.`,
  喜: (s, t) => `${s} 천희가 들어와 ${t}에서 기쁜 소식이 따르기 쉽습니다.`,
  解: (s, t) => `${s} 년해가 들어와 ${t}에서 걱정이 한결 가벼워집니다.`,
};

const flowNoteOf = (key: string, scope: Scope, topic: string): string | undefined => {
  const base = key === '年解' ? '解' : key[1];
  const f = FLOW_LINES[base];
  return f ? f(`{{${SCOPE_KO[scope]}}}`, topic) : undefined;
};

const toStarInput = (s: { key: string; brightness?: Brightness7; mutagen?: Mutagen }, view: View): StarInput => {
  const tags: MutagenTag[] = [];
  if (s.mutagen) tags.push({ mutagen: s.mutagen, scope: 'natal' });
  for (const m of view.mutagens) if (m.star === s.key) tags.push({ mutagen: m.mutagen, scope: m.scope });
  return { key: s.key, brightness: s.brightness, mutagens: tags };
};

export const explainPalace = (
  chart: Chart, view: View, branch: number, opts: { saju: SajuChart | null; mode: BrightnessMode },
): PalaceExplain => {
  const palace = chart.palaces[branch];
  const scopedName = view.names[branch];
  const natalName = palace.natalName;
  const scoped = PALACES[scopedName];
  const hints: SajuHints = {
    yearStem: chart.meta.yearStem,
    yearBranch: chart.meta.yearBranch,
    dayStem: opts.saju?.day.stem,
  };
  const ctx: StarContext = { scope: view.scope, scopedPalace: scopedName, natalPalace: natalName, mode: opts.mode, saju: hints };

  const stars = palace.stars.map((s) => composeStar(toStarInput(s, view), ctx));
  const borrowedViews = borrowedMainStars(chart, branch);
  const borrowed = borrowedViews.map((s) => composeStar({ key: s.key, mutagens: [] }, { ...ctx, borrowed: true }));

  let emptyNotice: string | undefined;
  if (palace.stars.every((s) => s.group !== 'main')) {
    const opp = chart.palaces[(branch + 6) % 12];
    const oppName = PALACE_KO[view.names[opp.branch]];
    if (borrowedViews.length > 0) {
      const list = borrowedViews.map((s) => s.ko).join('·');
      emptyNotice = `이 칸에는 주성이 없습니다. 그래서 {{차성안궁}} 방식으로, 맞은편 칸인 ${oppName}의 주성 ${list}${josa(list, '을/를').slice(list.length)} 빌려 읽습니다. 빌려 온 별은 힘이 다소 약해서 영향이 부드럽게 나타난다고 봅니다.`;
    } else {
      const sur = surround(branch);
      const trineMains = sur.trine.flatMap((b) => chart.palaces[b].stars.filter((s) => s.group === 'main').map((s) => s.ko));
      emptyNotice = trineMains.length
        ? `이 칸과 맞은편 ${oppName}에는 모두 주성이 없습니다. 빌릴 별이 없으므로 {{삼방사정}}의 {{삼합}} 칸에 있는 ${trineMains.join('·')}의 분위기를 더 크게 참고합니다.`
        : '이 칸과 맞은편 칸에는 모두 주성이 없고 {{삼합}} 칸에도 주성이 없습니다. 길성·살성과 {{사화}}의 영향을 중심으로 가볍게 읽으세요.';
    }
  }

  let scopeNote: string | undefined;
  if (view.scope !== 'natal') {
    scopeNote =
      scopedName === natalName
        ? `이 칸은 {{${SCOPE_KO[view.scope]}}} 기준으로도 ${PALACE_KO[scopedName]}이라 본명과 같은 주제로 읽습니다. ${WHEN[view.scope]} ${scoped.topic} 쪽 일이 두드러지기 쉽습니다.`
        : `이 칸은 {{${SCOPE_KO[view.scope]}}} 기준 ${PALACE_KO[scopedName]}에 해당합니다(본명으로는 ${PALACE_KO[natalName]}). ${WHEN[view.scope]} ${scoped.topic} 쪽 일로 드러나기 쉽습니다.`;
  }

  const flowNotes = view.flow[branch]
    .map((f) => flowNoteOf(f.key, f.scope, scoped.topic))
    .filter((x): x is string => Boolean(x));

  const sur = surround(branch);
  return {
    branch,
    ganzhi: palace.ganzhi,
    scopedName,
    natalName,
    title: PALACE_KO[scopedName],
    subtitle: view.scope === 'natal' ? palace.ganzhi : `본명 ${PALACE_KO[natalName]} · ${palace.ganzhi}`,
    overview: scoped.overview,
    scopeNote,
    glance: buildGlance(chart, view, branch, scopedName, opts.mode),
    sajuLine: sajuPalaceText(scopedName, opts.saju, chart.meta.gender),
    emptyNotice,
    stars,
    borrowed,
    flowNotes,
    combos: detectCombos(chart, branch),
    surround: [
      ...sur.trine.map((b) => ({ branch: b, name: view.names[b], ganzhi: chart.palaces[b].ganzhi, role: '삼합' as const })),
      { branch: sur.opposite, name: view.names[sur.opposite], ganzhi: chart.palaces[sur.opposite].ganzhi, role: '대궁' as const },
    ],
    score: scorePalace(palace, opts.mode),
  };
};

// ── 요약표 ───────────────────────────────────────────────────────────────────
export interface SummaryRow {
  branch: number;
  ganzhi: string;
  scopedName: PalaceKey;
  natalName: PalaceKey;
  mains: { key: string; ko: string; hanja: string; brightness?: BrightnessLabel; mutagen?: Mutagen }[];
  borrowedFrom: string[];
  mutagens: Mutagen[];
  score: PalaceScore;
  isLife: boolean;
  isBody: boolean;
}

/** 12궁을 궁 이름 순서(명궁→부모)로 정리한 요약표 */
export const buildSummary = (chart: Chart, view: View, mode: BrightnessMode): SummaryRow[] => {
  const rows = chart.palaces.map((p): SummaryRow => ({
    branch: p.branch,
    ganzhi: p.ganzhi,
    scopedName: view.names[p.branch],
    natalName: p.natalName,
    mains: p.stars
      .filter((s) => s.group === 'main')
      .map((s) => ({ key: s.key, ko: s.ko, hanja: s.hanja, brightness: s.brightness ? brightnessLabel(s.brightness, mode) : undefined, mutagen: s.mutagen })),
    borrowedFrom: borrowedMainStars(chart, p.branch).map((s) => s.ko),
    mutagens: p.stars.flatMap((s) => (s.mutagen ? [s.mutagen] : [])),
    score: scorePalace(p, mode),
    isLife: p.branch === view.lifeBranch,
    isBody: p.isBody,
  }));
  return rows.sort((a, b) => PALACE_KEYS.indexOf(a.scopedName) - PALACE_KEYS.indexOf(b.scopedName));
};

export { STAR_PROFILES };
