// 사주 분석(사실·숫자 단계). 문장은 만들지 않는다 — 문장은 saju-read.ts 가 이 결과를 받아 쓴다.
// 설계서 부록 D-6. 전통 이론(자평 명리)의 일부를 규칙으로 옮긴 간이 판정이며 전문가 감수를 받지 않았다.

import { BRANCH_ELEMENT, STEM_ELEMENT, isYangStem, mod } from '../ganzhi';
import type { Element } from '../ganzhi';
import { CHEONEUL_BRANCHES, HIDDEN_STEMS, TEN_GOD_GROUP, GROUPS, lokBranchOf, stageOf, tenGodOf } from '../saju';
import type { SajuPillar, TenGod, TenGodGroup } from '../saju';
import { STRENGTH_CUTS } from './calibration';

export type PillarPos = 'year' | 'month' | 'day' | 'hour';
export const PILLAR_POSITIONS: PillarPos[] = ['year', 'month', 'day', 'hour'];
export const POS_KO: Record<PillarPos, string> = { year: '연주', month: '월주', day: '일주', hour: '시주' };

/** 분석에 필요한 최소 입력(손으로 만든 사주로도 시험할 수 있게 한다) */
export interface SajuBasis {
  year: SajuPillar;
  month: SajuPillar;
  day: SajuPillar;
  hour: SajuPillar | null;
}

// ── 오행 관계 ────────────────────────────────────────────────────────────────
export const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const idx = (e: Element): number => ELEMENT_ORDER.indexOf(e);
const elementAt = (i: number): Element => ELEMENT_ORDER[mod(i, 5)];
/** e 가 생(生)해 주는 오행 */
export const generates = (e: Element): Element => elementAt(idx(e) + 1);
/** e 를 생해 주는 오행 */
export const generatedBy = (e: Element): Element => elementAt(idx(e) + 4);
/** e 가 극(剋)하는 오행 */
export const controls = (e: Element): Element => elementAt(idx(e) + 2);
/** e 를 극하는 오행 */
export const controlledBy = (e: Element): Element => elementAt(idx(e) + 3);

/** 일간 오행 기준으로 십성 그룹에 해당하는 오행 */
export const groupElement = (dayElement: Element, g: TenGodGroup): Element => {
  switch (g) {
    case '비겁': return dayElement;
    case '식상': return generates(dayElement);
    case '재성': return controls(dayElement);
    case '관성': return controlledBy(dayElement);
    default: return generatedBy(dayElement);
  }
};
/** 오행이 일간 기준 어느 십성 그룹인지 */
export const groupOfElement = (dayElement: Element, e: Element): TenGodGroup =>
  GROUPS.find((g) => groupElement(dayElement, g) === e) as TenGodGroup;

// ── 기운 분포(E) ─────────────────────────────────────────────────────────────
/** 천간 자리 가중치(일간 자신은 뺀다) */
export const STEM_POS_WEIGHT: Record<PillarPos, number> = { year: 1, month: 1.5, day: 0, hour: 1.5 };
/** 지지 자리 가중치: 월지(계절)가 가장 크고, 일지·시지·연지 순 */
export const BRANCH_POS_WEIGHT: Record<PillarPos, number> = { year: 1, month: 3, day: 2, hour: 1.5 };
/** 지장간 비중: 1개 [1] / 2개 [0.7, 0.3] / 3개 [0.6, 0.3, 0.1] (본기→중기→여기) */
export const hiddenWeights = (n: number): number[] => (n <= 1 ? [1] : n === 2 ? [0.7, 0.3] : [0.6, 0.3, 0.1]);

export interface Energy {
  byGod: Record<TenGod, number>;
  byGroup: Record<TenGodGroup, number>;
}

const TEN_GODS: TenGod[] = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];

export const energyOf = (b: SajuBasis): Energy => {
  const byGod = Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as Record<TenGod, number>;
  let total = 0;
  for (const pos of PILLAR_POSITIONS) {
    const p = b[pos];
    if (!p) continue;
    if (pos !== 'day') {
      byGod[p.stemGod as TenGod] += STEM_POS_WEIGHT[pos];
      total += STEM_POS_WEIGHT[pos];
    }
    const w = hiddenWeights(p.hidden.length);
    p.hidden.forEach((h, i) => {
      byGod[h.god] += BRANCH_POS_WEIGHT[pos] * w[i];
    });
    total += BRANCH_POS_WEIGHT[pos];
  }
  for (const g of TEN_GODS) byGod[g] /= total;
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<TenGodGroup, number>;
  for (const g of TEN_GODS) byGroup[TEN_GOD_GROUP[g]] += byGod[g];
  return { byGod, byGroup };
};

/** 천간 + 지지(본기 오행) 개수. 존재하는 기둥만 센다 */
export const countElements = (b: SajuBasis): Record<Element, number> => {
  const out: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const pos of PILLAR_POSITIONS) {
    const p = b[pos];
    if (!p) continue;
    out[STEM_ELEMENT[p.stem]]++;
    out[BRANCH_ELEMENT[p.branch]]++;
  }
  return out;
};

// ── 강약 ─────────────────────────────────────────────────────────────────────
export type StrengthClass = 'weak' | 'balanced' | 'strong';
export interface Strength {
  /** 도움 지수 H = E(비겁) + E(인성) */
  index: number;
  cls: StrengthClass;
  /** 월지 본기가 일간을 돕는 십성(비겁·인성)이면 true */
  deukryeong: boolean;
  /** 한쪽으로 극단(분포 상·하위 3%)이면 방향 */
  extreme: 'weak' | 'strong' | null;
}

export const strengthOf = (b: SajuBasis, e: Energy): Strength => {
  const index = e.byGroup.비겁 + e.byGroup.인성;
  const cls: StrengthClass = index < STRENGTH_CUTS.weak ? 'weak' : index >= STRENGTH_CUTS.strong ? 'strong' : 'balanced';
  const g = TEN_GOD_GROUP[b.month.branchGod];
  return {
    index,
    cls,
    deukryeong: g === '비겁' || g === '인성',
    extreme: index < STRENGTH_CUTS.extremeWeak ? 'weak' : index >= STRENGTH_CUTS.extremeStrong ? 'strong' : null,
  };
};

// ── 조후(계절의 한열) ────────────────────────────────────────────────────────
export interface Season {
  branch: number;
  /** 겨울 월지(해·자·축)이면서 수가 3개 이상 → 따뜻한 기운이 필요 */
  cold: boolean;
  /** 여름 월지(사·오·미)이면서 화가 3개 이상 → 식히는 기운이 필요 */
  hot: boolean;
}
export const seasonOf = (b: SajuBasis, counts: Record<Element, number>): Season => {
  const m = b.month.branch;
  return {
    branch: m,
    cold: (m === 11 || m === 0 || m === 1) && counts.water >= 3,
    hot: (m === 5 || m === 6 || m === 7) && counts.fire >= 3,
  };
};

// ── 격국 ─────────────────────────────────────────────────────────────────────
export type GyeokName = '식신격' | '상관격' | '편재격' | '정재격' | '편관격' | '정관격' | '편인격' | '정인격' | '건록격' | '양인격' | '월겁격';
export type GyeokStatus = 'good' | 'bad' | 'plain';
export interface Gyeok {
  name: GyeokName;
  god: TenGod;
  /** 격을 잡은 지장간(천간 인덱스) */
  stem: number;
  /** 천간에 드러난 지장간으로 정했으면 tuchul, 아니면 본기 */
  how: 'tuchul' | 'bonggi';
  status: GyeokStatus;
  /** 성격/패격을 판단한 근거 한 줄(없으면 빈 문자열) */
  note: 'good-jae' | 'good-in' | 'good-sik' | 'good-gwan' | 'good-control' | 'bad-sanggwan' | 'bad-pyeonin' | 'bad-geop' | 'bad-jae' | 'bad-none' | 'plain';
}

const GOD_TO_GYEOK: Partial<Record<TenGod, GyeokName>> = {
  식신: '식신격', 상관: '상관격', 편재: '편재격', 정재: '정재격', 편관: '편관격', 정관: '정관격', 편인: '편인격', 정인: '정인격',
};

export const gyeokOf = (b: SajuBasis, e: Energy, s: Strength): Gyeok => {
  const dayStem = b.day.stem;
  const hidden = HIDDEN_STEMS[b.month.branch];
  const exposed = new Set<number>([b.year.stem, b.month.stem, ...(b.hour ? [b.hour.stem] : [])]);
  let stem = hidden[0];
  let how: Gyeok['how'] = 'bonggi';
  for (const h of hidden) {
    if (exposed.has(h)) {
      stem = h;
      how = 'tuchul';
      break;
    }
  }
  const god = tenGodOf(dayStem, stem);
  let name: GyeokName;
  if (god === '비견' || god === '겁재') {
    const lok = lokBranchOf(dayStem);
    if (b.month.branch === lok) name = '건록격';
    else if (isYangStem(dayStem) && b.month.branch === mod(lok + 1, 12)) name = '양인격';
    else name = '월겁격';
  } else {
    name = GOD_TO_GYEOK[god] as GyeokName;
  }

  const g = e.byGroup;
  const d = e.byGod;
  let status: GyeokStatus = 'plain';
  let note: Gyeok['note'] = 'plain';
  const set = (st: GyeokStatus, n: Gyeok['note']): void => {
    status = st;
    note = n;
  };
  switch (name) {
    case '정관격':
      if (d.상관 >= 0.12 && g.인성 < 0.12) set('bad', 'bad-sanggwan');
      else if (g.재성 >= 0.2 || g.인성 >= 0.2) set('good', 'good-jae');
      break;
    case '편관격':
      if (d.식신 >= 0.12) set('good', 'good-sik');
      else if (g.인성 >= 0.22) set('good', 'good-in');
      else if (s.cls === 'weak') set('bad', 'bad-none');
      break;
    case '식신격':
      if (d.편인 >= 0.12) set('bad', 'bad-pyeonin');
      else if (g.재성 >= 0.2) set('good', 'good-jae');
      break;
    case '상관격':
      if (d.정관 >= 0.1 && g.인성 < 0.12) set('bad', 'bad-sanggwan');
      else if (g.재성 >= 0.2) set('good', 'good-jae');
      else if (g.인성 >= 0.22) set('good', 'good-in');
      break;
    case '정재격':
    case '편재격':
      if (g.비겁 >= 0.35) set('bad', 'bad-geop');
      else if (g.식상 >= 0.2 || g.관성 >= 0.2) set('good', 'good-sik');
      break;
    case '정인격':
      if (g.재성 >= 0.33 && s.cls === 'weak') set('bad', 'bad-jae');
      else if (g.관성 >= 0.2) set('good', 'good-gwan');
      break;
    case '편인격':
      if (d.식신 >= 0.12) set('bad', 'bad-pyeonin');
      else if (g.관성 >= 0.2) set('good', 'good-gwan');
      break;
    default:
      // 건록격·양인격·월겁격: 힘을 덜어 내거나 눌러 줄 쪽이 있어야 한다
      if (g.관성 >= 0.2 || g.식상 >= 0.2 || g.재성 >= 0.2) set('good', 'good-control');
      else if (g.비겁 >= 0.35) set('bad', 'bad-none');
  }
  return { name, god, stem, how, status, note };
};

// ── 용신(간이) ───────────────────────────────────────────────────────────────
export type YongRole = 'yong' | 'hee' | 'han' | 'gu' | 'gi';
export type YongMethod = 'johu' | 'eokbu' | 'balance';
export interface Yongsin {
  element: Element;
  method: YongMethod;
  /** 용신 오행이 일간 기준 어느 십성 그룹인지 */
  group: TenGodGroup;
  /** 조후를 우선했을 때 억부로 본 용신(다를 때만) */
  secondary: { element: Element; method: 'eokbu' | 'balance' } | null;
  roles: Record<Element, YongRole>;
}

const rolesFor = (y: Element): Record<Element, YongRole> => {
  const hee = generatedBy(y);
  const gi = controlledBy(y);
  const gu = generatedBy(gi);
  const out = {} as Record<Element, YongRole>;
  for (const el of ELEMENT_ORDER) out[el] = el === y ? 'yong' : el === hee ? 'hee' : el === gi ? 'gi' : el === gu ? 'gu' : 'han';
  return out;
};

const argminGroup = (e: Energy, list: TenGodGroup[]): TenGodGroup =>
  list.reduce((best, g) => (e.byGroup[g] < e.byGroup[best] ? g : best), list[0]);
const argmaxGroup = (e: Energy, list: TenGodGroup[]): TenGodGroup =>
  list.reduce((best, g) => (e.byGroup[g] > e.byGroup[best] ? g : best), list[0]);

/** 강약으로 본 용신(억부). 중화이면 가장 적은 오행을 채운다 */
const eokbuOf = (dayElement: Element, e: Energy, s: Strength, counts: Record<Element, number>): { element: Element; method: 'eokbu' | 'balance' } => {
  if (s.cls === 'strong') {
    const group = e.byGroup.인성 >= e.byGroup.비겁 ? '재성' : argminGroup(e, ['식상', '관성', '재성']);
    return { element: groupElement(dayElement, group), method: 'eokbu' };
  }
  if (s.cls === 'weak') {
    const drain = argmaxGroup(e, ['재성', '식상', '관성']);
    return { element: groupElement(dayElement, drain === '재성' ? '비겁' : '인성'), method: 'eokbu' };
  }
  const least = ELEMENT_ORDER.reduce((best, el) => (counts[el] < counts[best] ? el : best), ELEMENT_ORDER[0]);
  return { element: least, method: 'balance' };
};

export const yongsinOf = (dayElement: Element, e: Energy, s: Strength, season: Season, counts: Record<Element, number>): Yongsin => {
  const eokbu = eokbuOf(dayElement, e, s, counts);
  let element = eokbu.element;
  let method: YongMethod = eokbu.method;
  let secondary: Yongsin['secondary'] = null;
  if (season.cold || season.hot) {
    element = season.cold ? 'fire' : 'water';
    method = 'johu';
    if (eokbu.element !== element) secondary = eokbu;
  }
  return { element, method, group: groupOfElement(dayElement, element), secondary, roles: rolesFor(element) };
};

// ── 십성 구조 ────────────────────────────────────────────────────────────────
export type StructureId =
  | 'sikSangSaengJae' | 'jaeSaengGwan' | 'gwanInSangSaeng' | 'sikSinJeSal' | 'sangGwanGyeonGwan' | 'sangGwanPaeIn'
  | 'gunGeopJaengJae' | 'jaeDaSinYak' | 'gwanSalHonJap' | 'inDa' | 'biGeopGwaDa' | 'sikSangGwaDa' | 'pyeonInDoSik'
  | 'muJae' | 'muGwan' | 'muIn';

export interface StructureDef {
  id: StructureId;
  name: string;
  /** 전통에서 좋게 보는 구조(good) / 조심하는 구조(caution) / 있고 없음을 알려 주는 것(info) */
  tone: 'good' | 'caution' | 'info';
  test: (e: Energy, s: Strength) => boolean;
  /** 판정에 쓴 값(근거 표시용) */
  value: (e: Energy) => string;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const G = (e: Energy, k: TenGodGroup): string => `${k} ${pct(e.byGroup[k])}`;
const D = (e: Energy, k: TenGod): string => `${k} ${pct(e.byGod[k])}`;

/** 구조 판정의 경계값(비중). 무작위 사주 분포에서 발동률이 너무 높거나 낮지 않게 정했다(검증 V-26) */
export const STRUCTURE_RULES: StructureDef[] = [
  { id: 'sikSangSaengJae', name: '식상생재', tone: 'good', test: (e) => e.byGroup.식상 >= 0.18 && e.byGroup.재성 >= 0.18, value: (e) => `${G(e, '식상')} · ${G(e, '재성')}` },
  { id: 'jaeSaengGwan', name: '재생관', tone: 'good', test: (e) => e.byGroup.재성 >= 0.18 && e.byGroup.관성 >= 0.18, value: (e) => `${G(e, '재성')} · ${G(e, '관성')}` },
  { id: 'gwanInSangSaeng', name: '관인상생', tone: 'good', test: (e) => e.byGroup.관성 >= 0.18 && e.byGroup.인성 >= 0.18, value: (e) => `${G(e, '관성')} · ${G(e, '인성')}` },
  { id: 'sikSinJeSal', name: '식신제살', tone: 'good', test: (e) => e.byGod.식신 >= 0.1 && e.byGod.편관 >= 0.1, value: (e) => `${D(e, '식신')} · ${D(e, '편관')}` },
  { id: 'sangGwanGyeonGwan', name: '상관견관', tone: 'caution', test: (e) => e.byGod.상관 >= 0.1 && e.byGod.정관 >= 0.1, value: (e) => `${D(e, '상관')} · ${D(e, '정관')}` },
  { id: 'sangGwanPaeIn', name: '상관패인', tone: 'good', test: (e) => e.byGod.상관 >= 0.12 && e.byGroup.인성 >= 0.18, value: (e) => `${D(e, '상관')} · ${G(e, '인성')}` },
  { id: 'gunGeopJaengJae', name: '군겁쟁재', tone: 'caution', test: (e) => e.byGroup.비겁 >= 0.35 && e.byGroup.재성 > 0.02 && e.byGroup.재성 <= 0.22, value: (e) => `${G(e, '비겁')} · ${G(e, '재성')}` },
  { id: 'jaeDaSinYak', name: '재다신약', tone: 'caution', test: (e, s) => s.cls === 'weak' && e.byGroup.재성 >= 0.33, value: (e) => G(e, '재성') },
  { id: 'gwanSalHonJap', name: '관살혼잡', tone: 'caution', test: (e) => e.byGod.정관 >= 0.1 && e.byGod.편관 >= 0.1, value: (e) => `${D(e, '정관')} · ${D(e, '편관')}` },
  { id: 'inDa', name: '인성 과다', tone: 'caution', test: (e) => e.byGroup.인성 >= 0.4, value: (e) => G(e, '인성') },
  { id: 'biGeopGwaDa', name: '비겁 과다', tone: 'caution', test: (e) => e.byGroup.비겁 >= 0.4, value: (e) => G(e, '비겁') },
  { id: 'sikSangGwaDa', name: '식상 과다', tone: 'caution', test: (e) => e.byGroup.식상 >= 0.4, value: (e) => G(e, '식상') },
  { id: 'pyeonInDoSik', name: '편인도식', tone: 'caution', test: (e) => e.byGod.편인 >= 0.1 && e.byGod.식신 >= 0.1, value: (e) => `${D(e, '편인')} · ${D(e, '식신')}` },
  { id: 'muJae', name: '재성 없음', tone: 'info', test: (e) => e.byGroup.재성 < 0.03, value: (e) => G(e, '재성') },
  { id: 'muGwan', name: '관성 없음', tone: 'info', test: (e) => e.byGroup.관성 < 0.03, value: (e) => G(e, '관성') },
  { id: 'muIn', name: '인성 없음', tone: 'info', test: (e) => e.byGroup.인성 < 0.03, value: (e) => G(e, '인성') },
];

export interface StructureHit {
  id: StructureId;
  name: string;
  tone: StructureDef['tone'];
  value: string;
}

// ── 합충 ─────────────────────────────────────────────────────────────────────
export type RelationKind = 'stemHe' | 'stemChung' | 'yukHe' | 'samHe' | 'banHe' | 'bangHe' | 'chung';
export interface RelationHit {
  kind: RelationKind;
  /** 관여한 기둥 */
  pos: PillarPos[];
  /** 합이 되는 오행(충에는 없음) */
  element?: Element;
  /** 관여한 글자(천간 또는 지지 인덱스, pos 와 같은 순서) */
  chars: number[];
}

export const RELATION_NAME: Record<RelationKind, string> = {
  stemHe: '천간합', stemChung: '천간충', yukHe: '육합', samHe: '삼합', banHe: '반합', bangHe: '방합', chung: '충',
};

const STEM_HE: Record<number, Element> = { 0: 'earth', 1: 'metal', 2: 'water', 3: 'wood', 4: 'fire' }; // 甲己 乙庚 丙辛 丁壬 戊癸 (낮은 쪽 천간 기준)
const BRANCH_YUKHE: [number, number, Element][] = [
  [0, 1, 'earth'], [2, 11, 'wood'], [3, 10, 'fire'], [4, 9, 'metal'], [5, 8, 'water'], [6, 7, 'fire'],
];
const SAMHE: [number, number, number, Element][] = [[8, 0, 4, 'water'], [11, 3, 7, 'wood'], [2, 6, 10, 'fire'], [5, 9, 1, 'metal']];
const BANGHE: [number, number, number, Element][] = [[2, 3, 4, 'wood'], [5, 6, 7, 'fire'], [8, 9, 10, 'metal'], [11, 0, 1, 'water']];

export const relationsOf = (b: SajuBasis): RelationHit[] => {
  const slots = PILLAR_POSITIONS.filter((p) => b[p]);
  const out: RelationHit[] = [];
  const stem = (p: PillarPos): number => (b[p] as SajuPillar).stem;
  const branch = (p: PillarPos): number => (b[p] as SajuPillar).branch;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const c = slots[j];
      // 천간
      const sa = stem(a);
      const sc = stem(c);
      if (mod(sa - sc, 10) === 5) out.push({ kind: 'stemHe', pos: [a, c], element: STEM_HE[Math.min(sa, sc) % 5], chars: [sa, sc] });
      // 갑경·을신·병임·정계 (무기는 충이 아니다)
      if (Math.abs(sa - sc) === 6) out.push({ kind: 'stemChung', pos: [a, c], chars: [sa, sc] });
      // 지지
      const ba = branch(a);
      const bc = branch(c);
      if (mod(ba - bc, 12) === 6) out.push({ kind: 'chung', pos: [a, c], chars: [ba, bc] });
      for (const [x, y, el] of BRANCH_YUKHE) {
        if ((ba === x && bc === y) || (ba === y && bc === x)) out.push({ kind: 'yukHe', pos: [a, c], element: el, chars: [ba, bc] });
      }
    }
  }
  // 삼합·반합·방합: 서로 다른 기둥의 지지 조합
  const branches = slots.map((p) => ({ p, v: branch(p) }));
  for (const [x, y, z, el] of SAMHE) {
    const found = [x, y, z].map((t) => branches.find((o) => o.v === t));
    if (found.every(Boolean)) {
      out.push({ kind: 'samHe', pos: found.map((o) => (o as { p: PillarPos }).p), element: el, chars: [x, y, z] });
    } else {
      // 반합: 왕지(y) + 생지(x) 또는 왕지(y) + 고지(z)
      for (const other of [x, z]) {
        const fy = branches.find((o) => o.v === y);
        const fo = branches.find((o) => o.v === other);
        if (fy && fo) out.push({ kind: 'banHe', pos: [fy.p, fo.p], element: el, chars: [y, other] });
      }
    }
  }
  for (const [x, y, z, el] of BANGHE) {
    const found = [x, y, z].map((t) => branches.find((o) => o.v === t));
    if (found.every(Boolean)) out.push({ kind: 'bangHe', pos: found.map((o) => (o as { p: PillarPos }).p), element: el, chars: [x, y, z] });
  }
  return out;
};

// ── 도화·귀인 ────────────────────────────────────────────────────────────────
/** 도화(桃花): 申子辰 → 酉 / 巳酉丑 → 午 / 寅午戌 → 卯 / 亥卯未 → 子 */
export const peachBranchOf = (branch: number): number => {
  if ([8, 0, 4].includes(branch)) return 9;
  if ([5, 9, 1].includes(branch)) return 6;
  if ([2, 6, 10].includes(branch)) return 3;
  return 0;
};

// ── 종합 ─────────────────────────────────────────────────────────────────────
export interface SajuAnalysis {
  gender: 'M' | 'F';
  dayStem: number;
  dayElement: Element;
  hourKnown: boolean;
  energy: Energy;
  strength: Strength;
  counts: Record<Element, number>;
  season: Season;
  gyeok: Gyeok;
  yong: Yongsin;
  structures: StructureHit[];
  relations: RelationHit[];
  /** 배우자 신호: 남자 재성 / 여자 관성 */
  spouse: { group: TenGodGroup; energy: number; dayBranchGod: TenGod };
  /** 일간 기준 12운성 */
  dayStage: string;
  /** 도화가 있는 기둥(일지·연지를 기준으로 한 도화 글자가 다른 기둥에 있을 때) */
  peach: PillarPos[];
  /** 천을귀인 글자가 있는 기둥(일간·연간 기준) */
  noble: PillarPos[];
}

export const analyzeSaju = (b: SajuBasis, gender: 'M' | 'F'): SajuAnalysis => {
  const dayStem = b.day.stem;
  const dayElement = STEM_ELEMENT[dayStem];
  const energy = energyOf(b);
  const strength = strengthOf(b, energy);
  const counts = countElements(b);
  const season = seasonOf(b, counts);
  const gyeok = gyeokOf(b, energy, strength);
  const yong = yongsinOf(dayElement, energy, strength, season, counts);
  const structures: StructureHit[] = STRUCTURE_RULES.filter((r) => r.test(energy, strength)).map((r) => ({ id: r.id, name: r.name, tone: r.tone, value: r.value(energy) }));
  const spouseGroup: TenGodGroup = gender === 'M' ? '재성' : '관성';

  // 도화: 일지·연지를 기준으로 한 도화 글자가 (기준이 된 자기 기둥이 아닌) 다른 기둥의 지지에 있을 때
  const peach = PILLAR_POSITIONS.filter((p) => {
    const pil = b[p];
    if (!pil) return false;
    return (p !== 'day' && peachBranchOf(b.day.branch) === pil.branch) || (p !== 'year' && peachBranchOf(b.year.branch) === pil.branch);
  });
  const nobleSet = new Set<number>([...CHEONEUL_BRANCHES[dayStem], ...CHEONEUL_BRANCHES[b.year.stem]]);
  const noble = PILLAR_POSITIONS.filter((p) => b[p] && nobleSet.has((b[p] as SajuPillar).branch));

  return {
    gender,
    dayStem,
    dayElement,
    hourKnown: b.hour !== null,
    energy,
    strength,
    counts,
    season,
    gyeok,
    yong,
    structures,
    relations: relationsOf(b),
    spouse: { group: spouseGroup, energy: energy.byGroup[spouseGroup], dayBranchGod: b.day.branchGod },
    dayStage: stageOf(dayStem, b.day.branch),
    peach,
    noble,
  };
};
