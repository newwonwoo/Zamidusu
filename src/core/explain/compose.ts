// 해설 합성기(N-04). 입력: 별 + 궁 + 밝기 + 사화 + 운 모드 + 사주 정보 → 출력: 새로 쓴 문장 묶음.
// 순수 함수라 화면 없이 전 조합을 생성해 길이·다양성을 검사할 수 있다(검증 V-10, V-11).
//
// 구조: 한 줄 요약 → 쉬운 풀이 → (본명 기준) → 밝기 보정 → 사화 영향 → 사주 대응
// 개선: I-12(밝기·사화·삼방·운 모드에 반응) · I-13(길이 균일) · I-14(별×궁) · 조합 · 용어 · 차성안궁
// 문장 안의 {{용어}} 표시는 glossary.ts 의 용어를 가리킨다.

import { brightnessLabel, to5 } from '../brightness';
import type { Brightness7, BrightnessLabel, BrightnessMode } from '../brightness';
import { borrowedMainStars, scorePalace, surround } from '../chart';
import type { Chart, PalaceScore, View } from '../chart';
import { BRANCHES, BRANCHES_KO, ELEMENT_KO, STEMS, STEMS_KO } from '../ganzhi';
import type { Element } from '../ganzhi';
import { MUTAGEN_LONG_KO, PALACE_KEYS, PALACE_KO, SCOPE_KO, starMeta } from '../names';
import type { Mutagen, PalaceKey, Scope } from '../names';
import { CHEONEUL_BRANCHES, MUNCHANG_BRANCH, lokBranchOf, yeokmaBranchOf } from '../saju';
import type { SajuChart } from '../saju';
import { detectCombos } from './combos';
import type { ComboHit } from './combos';
import { josa, stableHash } from './korean';
import { PALACES } from './palaces';
import { MAIN_PALACE_LINES, ROLE_LINES, STAR_PROFILES } from './stars';
import type { StarProfile } from './stars';

export type BlockKind = 'summary' | 'body' | 'natal' | 'brightness' | 'mutagen' | 'saju';

export interface BlockText {
  kind: BlockKind;
  label: string;
  text: string;
}

export interface MutagenTag {
  mutagen: Mutagen;
  scope: Scope;
}

export interface StarInput {
  key: string;
  brightness?: Brightness7;
  /** 이 별에 붙은 사화(생년 + 선택한 운) */
  mutagens: MutagenTag[];
}

export interface SajuHints {
  yearStem: number;
  yearBranch: number;
  dayStem?: number;
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

const WHEN: Record<Scope, string> = {
  natal: '타고난 흐름에서는', decadal: '이 10년 동안', yearly: '올해는', monthly: '이번 달은', daily: '오늘은', hourly: '이 시각에는',
};
const MUTAGEN_LABEL = '사화';

const strengthOf = (p: StarProfile): string => p.strength ?? p.tag;
const cautionOf = (p: StarProfile): string => p.caution ?? '마음이 쓰이는 일';
const q = (label: string): string => `'${label}'`;

// ── 밝기 ─────────────────────────────────────────────────────────────────────
export const brightnessText = (p: StarProfile, b: Brightness7, mode: BrightnessMode): string => {
  const eff: string = mode === '5' ? to5(b) : b;
  const label = brightnessLabel(b, mode).text;
  const s = strengthOf(p);
  const c = cautionOf(p);
  const head = `{{밝기}}가 ${josa(q(label), '이라/라')}`;
  switch (eff) {
    case 'miao': return `{{밝기}}가 ${josa(q(label), '으로/로')} 가장 좋은 자리라 ${josa(s, '이/가')} 온전히 드러납니다.`;
    case 'wang': return `${head} ${josa(s, '이/가')} 뚜렷하게 나타납니다.`;
    case 'de': return `${head} ${josa(s, '을/를')} 무난하게 발휘합니다.`;
    case 'li': return `${head} 노력한 만큼 ${josa(s, '이/가')} 뒷받침됩니다.`;
    case 'ping': return `${head} ${s}도, ${c}도 비슷한 비중으로 나타납니다.`;
    case 'han':
    case 'bu': return `${head} ${josa(s, '은/는')} 덜 드러나고 ${josa(c, '이/가')} 보이기 쉽습니다.`;
    default: return `${head} ${josa(s, '을/를')} 쓰기 어렵고 ${josa(c, '이/가')} 두드러지기 쉬워 보완이 필요합니다.`;
  }
};

// ── 사화 ─────────────────────────────────────────────────────────────────────
export const mutagenText = (p: StarProfile, tag: MutagenTag, topic: string): string => {
  const long = MUTAGEN_LONG_KO[tag.mutagen];
  const prefix = tag.scope === 'natal' ? '생년' : SCOPE_KO[tag.scope];
  const term = `{{${long}}}${josa(long, '이/가').slice(long.length)}`;
  const head = `${prefix} ${term} 이 별에 붙어`;
  const when = WHEN[tag.scope];
  const s = strengthOf(p);
  const c = cautionOf(p);
  switch (tag.mutagen) {
    case 'lu': return `${head} ${s}에 풍요와 인연이 더해집니다. ${when} ${topic} 쪽에서 얻는 것이 늘기 쉽습니다.`;
    case 'quan': return `${head} ${s}에 추진력과 주도권이 실립니다. ${when} ${topic} 쪽에서 밀어붙이는 힘이 세지니 고집으로 흐르지 않게 살피세요.`;
    case 'ke': return `${head} ${josa(s, '이/가')} 좋은 평판과 인정으로 이어집니다. ${when} ${topic} 쪽에서 도움이 되는 사람이나 문서를 만나기 쉽습니다.`;
    default: return `${head} ${josa(c, '이/가')} 도드라집니다. ${when} ${topic} 쪽에서 걱정이나 막힘이 생기기 쉬우니 서두르지 말고 미리 점검하세요.`;
  }
};

// ── 사주 대응(별 단위: 직접 대응이 있는 별만) ─────────────────────────────────
const stemLabel = (s: number): string => `${STEMS_KO[s]}(${STEMS[s]})`;
const branchLabel = (b: number): string => `${BRANCHES_KO[b]}(${BRANCHES[b]})`;

export const sajuStarText = (key: string, h?: SajuHints): string | undefined => {
  switch (key) {
    case '祿存':
      return h
        ? `사주의 {{12운성}} 중 건록(연간이 가장 힘을 얻는 자리)과 같은 자리입니다. 이 명식의 연간 ${stemLabel(h.yearStem)}의 건록은 ${branchLabel(lokBranchOf(h.yearStem))}입니다.`
        : '사주의 {{12운성}} 중 건록(연간이 가장 힘을 얻는 자리)과 같은 자리입니다.';
    case '天馬':
      return h
        ? `사주의 {{역마}}와 같은 자리입니다. 이 명식의 연지 ${branchLabel(h.yearBranch)}에서 역마는 ${branchLabel(yeokmaBranchOf(h.yearBranch))}입니다.`
        : '사주의 {{역마}}와 같은 자리입니다. 연지를 기준으로 정합니다.';
    case '天魁':
    case '天鉞':
      return h
        ? `사주의 {{천을귀인}}과 같은 자리입니다. 이 명식의 연간 ${stemLabel(h.yearStem)}에서 천을귀인은 ${branchLabel(CHEONEUL_BRANCHES[h.yearStem][0])}·${branchLabel(CHEONEUL_BRANCHES[h.yearStem][1])}입니다.`
        : '사주의 {{천을귀인}}과 같은 자리입니다. 연간을 기준으로 정합니다.';
    case '文昌':
      return `사주에도 같은 이름의 문창귀인이 있지만 기준이 다릅니다. 사주는 일간${h?.dayStem !== undefined ? `(${stemLabel(h.dayStem)}→${branchLabel(MUNCHANG_BRANCH[h.dayStem])})` : ''} 기준, 자미두수는 태어난 시 기준입니다.`;
    case '華蓋':
      return '사주에도 같은 이름의 화개살이 있으며, 연지와 일지를 기준으로 정합니다.';
    case '咸池':
      return '사주의 도화살과 같은 개념으로, 연지와 일지의 삼합을 기준으로 정합니다.';
    case '孤辰':
    case '寡宿':
      return '사주에도 고진·과숙이라는 같은 이름의 신살이 있으며, 연지를 기준으로 정합니다.';
    case '紅鸞':
    case '天喜':
      return '사주에도 홍란·천희라는 신살이 있으며, 연지를 기준으로 정합니다.';
    case '天德':
    case '月德':
      return '사주의 천덕귀인·월덕귀인과 이름은 같지만 계산 기준이 달라 위치가 다를 수 있습니다.';
    default:
      return undefined;
  }
};

// ── 별 하나 ──────────────────────────────────────────────────────────────────
export const composeStar = (input: StarInput, ctx: StarContext): StarExplain => {
  const meta = starMeta(input.key);
  const prof = STAR_PROFILES[input.key];
  if (!prof) throw new Error(`별 사전에 없는 별: ${input.key}`);
  const scoped = PALACES[ctx.scopedPalace];
  const natal = PALACES[ctx.natalPalace];
  const blocks: BlockText[] = [];

  blocks.push({ kind: 'summary', label: '요약', text: `${ctx.borrowed ? '빌려 온 별 · ' : ''}${meta.ko} — ${prof.tag}` });

  if (prof.role === 'main') {
    blocks.push({ kind: 'body', label: '풀이', text: `${prof.essence} ${MAIN_PALACE_LINES[input.key][ctx.scopedPalace]}` });
    if (ctx.scope !== 'natal' && ctx.scopedPalace !== ctx.natalPalace) {
      blocks.push({ kind: 'natal', label: '본명 기준', text: `본명으로는 ${PALACE_KO[ctx.natalPalace]}에 있어, ${MAIN_PALACE_LINES[input.key][ctx.natalPalace]}` });
    }
  } else {
    const lines = ROLE_LINES[prof.role];
    const line = lines[stableHash(input.key) % lines.length](scoped.topic);
    blocks.push({ kind: 'body', label: '풀이', text: `${prof.essence} ${line}` });
    if (ctx.scope !== 'natal' && ctx.scopedPalace !== ctx.natalPalace) {
      const nline = lines[stableHash(input.key) % lines.length](natal.topic);
      blocks.push({ kind: 'natal', label: '본명 기준', text: `본명으로는 ${PALACE_KO[ctx.natalPalace]}에 있어, ${nline}` });
    }
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
  return f ? f(SCOPE_KO[scope], topic) : undefined;
};

const countOf = (saju: SajuChart, g: '비겁' | '식상' | '재성' | '관성' | '인성'): number => saju.godCounts[g];
type God = '비겁' | '식상' | '재성' | '관성' | '인성';
/** “비겁은 0개, 관성은 2개” — 0개도 같은 형식으로 정확히 적는다 */
const counts = (saju: SajuChart, ...gs: God[]): string => gs.map((g) => `${josa(g, '은/는')} ${countOf(saju, g)}개`).join(', ');

/** 궁별 사주 대응 문장(개념 + 이 명식의 실제 값) */
export const sajuPalaceText = (key: PalaceKey, saju: SajuChart | null, gender: 'M' | 'F'): string => {
  const concept = PALACES[key].saju;
  if (!saju) return concept;
  const dm = saju.dayMaster;
  const els = (['wood', 'fire', 'earth', 'metal', 'water'] as Element[]).map((e) => ({ e, n: saju.elementCounts[e] }));
  const personal = ((): string => {
    switch (key) {
      case 'life':
        return `이 명식의 일간은 ${STEMS_KO[dm.stem]}(${STEMS[dm.stem]}, ${dm.yang ? '양' : '음'}${ELEMENT_KO[dm.element]})이고 월지는 ${BRANCHES_KO[saju.month.branch]}입니다.`;
      case 'siblings':
        return `이 명식의 ${counts(saju, '비겁')}입니다.`;
      case 'spouse':
        return `일지는 ${BRANCHES_KO[saju.day.branch]}이고, ${counts(saju, gender === 'M' ? '재성' : '관성')}입니다.`;
      case 'children':
        return `시주는 ${saju.hour ? `${saju.hour.ko}이고` : '알 수 없고'}, ${counts(saju, gender === 'M' ? '관성' : '식상')}입니다.`;
      case 'wealth':
        return `이 명식의 ${counts(saju, '재성')}입니다.`;
      case 'health': {
        const lacking = els.filter((x) => x.n === 0).map((x) => ELEMENT_KO[x.e]);
        return `오행 분포는 ${els.map((x) => `${ELEMENT_KO[x.e]}${x.n}`).join('·')}이고, ${lacking.length ? `빠진 오행은 ${lacking.join('·')}입니다` : '빠진 오행은 없습니다'}.`;
      }
      case 'travel': {
        const yk = yeokmaBranchOf(saju.year.branch);
        const present = [saju.year, saju.month, saju.day, ...(saju.hour ? [saju.hour] : [])].some((p) => p.branch === yk);
        return `연지 ${branchLabel(saju.year.branch)} 기준 역마는 ${branchLabel(yk)}이고, 네 기둥의 지지에 ${present ? '있습니다' : '없습니다'}.`;
      }
      case 'friends':
        return `이 명식의 ${counts(saju, '비겁', '관성')}입니다.`;
      case 'career':
        return `이 명식의 ${counts(saju, '관성', '식상')}입니다.`;
      case 'property':
        return `이 명식의 ${counts(saju, '인성')}이고, 월주는 ${saju.month.ko}입니다.`;
      case 'fortune':
        return `이 명식의 ${counts(saju, '식상', '인성')}입니다.`;
      default:
        return `이 명식의 ${counts(saju, '인성')}이고, 연주는 ${saju.year.ko}입니다.`;
    }
  })();
  return `${concept} ${personal}`;
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
      emptyNotice = `이 칸에는 주성이 없습니다. {{차성안궁}} 방식으로 {{대궁}}인 ${oppName}의 주성 ${list}${josa(list, '을/를').slice(list.length)} 빌려 읽습니다. 빌려 온 별은 힘이 다소 약해서 영향이 부드럽게 나타난다고 봅니다.`;
    } else {
      const sur = surround(branch);
      const trineMains = sur.trine.flatMap((b) => chart.palaces[b].stars.filter((s) => s.group === 'main').map((s) => s.ko));
      emptyNotice = trineMains.length
        ? `이 칸과 맞은편 ${oppName}에 모두 주성이 없습니다. 빌릴 별이 없으므로 {{삼방사정}}의 삼합 칸에 있는 ${trineMains.join('·')}의 분위기를 더 크게 참고합니다.`
        : '이 칸과 맞은편 칸에 모두 주성이 없고 삼합 칸에도 주성이 없습니다. 길성·살성과 사화의 영향을 중심으로 가볍게 읽으세요.';
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

/** 블록 길이 허용 범위(글자 수, 평문 기준). 검증 V-11 에서 모든 조합이 이 범위 안에 있어야 한다. */
export const LENGTH_LIMITS: Record<BlockKind | 'overview' | 'palaceSaju' | 'combo', [number, number]> = {
  summary: [8, 24],
  body: [64, 120],
  natal: [40, 85],
  brightness: [28, 80],
  mutagen: [65, 125],
  saju: [35, 80],
  overview: [50, 90],
  palaceSaju: [38, 100],
  combo: [30, 100],
};

export { BRANCHES, STAR_PROFILES };
