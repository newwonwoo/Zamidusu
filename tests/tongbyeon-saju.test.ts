// V-24 사주 통변 규칙의 정확성(설계 부록 D-6, 요구 T-03): 구현(src/core/tongbyeon/saju-analysis.ts)을
// 교과서 표(십성표·지장간표·합충표)를 직접 적은 독립 구현과 무작위 사주 20,000개로 전수 대조한다.
// 독립 구현은 구현의 보조 함수를 쓰지 않고 이 파일 안의 표와 산술만 쓴다(경계값 상수만 같은 파일 calibration.ts 를 읽는다).
import { describe, expect, it } from 'vitest';
import { BRANCHES, STEMS } from '../src/core/ganzhi';
import { HIDDEN_STEMS, makePillar, tenGodOf } from '../src/core/saju';
import { STRENGTH_CUTS } from '../src/core/tongbyeon/calibration';
import { analyzeSaju, energyOf, relationsOf } from '../src/core/tongbyeon/saju-analysis';
import { assembleSajuDomain, sajuDomainHits } from '../src/core/tongbyeon/saju-read';
import { DOMAINS } from '../src/core/tongbyeon/types';
import type { SajuBasis } from '../src/core/tongbyeon/saju-analysis';
import { rng } from './helpers';

// ── 교과서 표(독립) ──────────────────────────────────────────────────────────
/** 일간(행) × 상대 천간(열: 甲乙丙丁戊己庚辛壬癸) → 십성 */
const TEN: string[][] = [
  '비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인',
  '겁재 비견 상관 식신 정재 편재 정관 편관 정인 편인',
  '편인 정인 비견 겁재 식신 상관 편재 정재 편관 정관',
  '정인 편인 겁재 비견 상관 식신 정재 편재 정관 편관',
  '편관 정관 편인 정인 비견 겁재 식신 상관 편재 정재',
  '정관 편관 정인 편인 겁재 비견 상관 식신 정재 편재',
  '편재 정재 편관 정관 편인 정인 비견 겁재 식신 상관',
  '정재 편재 정관 편관 정인 편인 겁재 비견 상관 식신',
  '식신 상관 편재 정재 편관 정관 편인 정인 비견 겁재',
  '상관 식신 정재 편재 정관 편관 정인 편인 겁재 비견',
].map((r) => r.split(' '));
const GROUP: Record<string, string> = { 비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성' };
/** 지장간(본기 → 중기 → 여기), 子丑寅卯辰巳午未申酉戌亥 */
const HID: number[][] = [[9], [5, 9, 7], [0, 2, 4], [1], [4, 1, 9], [2, 6, 4], [3, 5], [5, 3, 1], [6, 8, 4], [7], [4, 7, 3], [8, 0]];
const STEM_EL = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
const BRANCH_EL = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
const LOK = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
/** 오행 상생 순서: 목 → 화 → 토 → 금 → 수 → 목 */
const ORDER = ['목', '화', '토', '금', '수'];
const gen = (e: string): string => ORDER[(ORDER.indexOf(e) + 1) % 5];
const ctl = (e: string): string => ORDER[(ORDER.indexOf(e) + 2) % 5];
const ctlBy = (e: string): string => ORDER[(ORDER.indexOf(e) + 3) % 5];
const genBy = (e: string): string => ORDER[(ORDER.indexOf(e) + 4) % 5];

type Slot = { stem: number; branch: number } | null;
type Four = [Slot, Slot, Slot, Slot]; // 연·월·일·시

const randomFour = (r: () => number): Four => {
  const pillar = (): Slot => {
    const stem = Math.floor(r() * 10);
    const branch = (Math.floor(r() * 6) * 2 + (stem % 2)) % 12;
    return { stem, branch };
  };
  return [pillar(), pillar(), pillar(), r() < 0.1 ? null : pillar()];
};

const basisOf = (f: Four): SajuBasis => {
  const dayStem = (f[2] as { stem: number }).stem;
  const mk = (s: Slot, isDay: boolean) => (s ? makePillar(STEMS[s.stem] + BRANCHES[s.branch], dayStem, isDay) : null);
  return { year: mk(f[0], false)!, month: mk(f[1], false)!, day: mk(f[2], true)!, hour: mk(f[3], false) };
};

// ── 독립 구현 ────────────────────────────────────────────────────────────────
const oracleEnergy = (f: Four): { god: Record<string, number>; group: Record<string, number> } => {
  const day = f[2] as { stem: number; branch: number };
  const god: Record<string, number> = {};
  let total = 0;
  const addGod = (g: string, w: number): void => {
    god[g] = (god[g] ?? 0) + w;
  };
  const SW = [1, 1.5, 0, 1.5];
  const BW = [1, 3, 2, 1.5];
  f.forEach((p, i) => {
    if (!p) return;
    if (i !== 2) {
      addGod(TEN[day.stem][p.stem], SW[i]);
      total += SW[i];
    }
    const hid = HID[p.branch];
    const w = hid.length === 1 ? [1] : hid.length === 2 ? [0.7, 0.3] : [0.6, 0.3, 0.1];
    hid.forEach((h, k) => addGod(TEN[day.stem][h], BW[i] * w[k]));
    total += BW[i];
  });
  for (const k of Object.keys(god)) god[k] /= total;
  const group: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const [g, v] of Object.entries(god)) group[GROUP[g]] += v;
  return { god, group };
};

const oracleCounts = (f: Four): Record<string, number> => {
  const c: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of f) if (p) {
    c[STEM_EL[p.stem]]++;
    c[BRANCH_EL[p.branch]]++;
  }
  return c;
};

const GYEOK_OF: Record<string, string> = { 식신: '식신격', 상관: '상관격', 편재: '편재격', 정재: '정재격', 편관: '편관격', 정관: '정관격', 편인: '편인격', 정인: '정인격' };

const oracleGyeok = (f: Four, strengthCls: string, e: ReturnType<typeof oracleEnergy>): { name: string; status: string } => {
  const day = f[2] as { stem: number; branch: number };
  const month = f[1] as { stem: number; branch: number };
  const exposed = [f[0]?.stem, month.stem, f[3]?.stem].filter((x): x is number => x !== undefined);
  const hid = HID[month.branch];
  let pick = hid[0];
  for (const h of hid) {
    if (exposed.includes(h)) {
      pick = h;
      break;
    }
  }
  const god = TEN[day.stem][pick];
  let name: string;
  if (god === '비견' || god === '겁재') {
    if (month.branch === LOK[day.stem]) name = '건록격';
    else if (day.stem % 2 === 0 && month.branch === (LOK[day.stem] + 1) % 12) name = '양인격';
    else name = '월겁격';
  } else name = GYEOK_OF[god];
  const g = e.group;
  const d = e.god;
  let status = 'plain';
  switch (name) {
    case '정관격':
      if (d.상관 >= 0.12 && g.인성 < 0.12) status = 'bad';
      else if (g.재성 >= 0.2 || g.인성 >= 0.2) status = 'good';
      break;
    case '편관격':
      if (d.식신 >= 0.12) status = 'good';
      else if (g.인성 >= 0.22) status = 'good';
      else if (strengthCls === 'weak') status = 'bad';
      break;
    case '식신격':
      if (d.편인 >= 0.12) status = 'bad';
      else if (g.재성 >= 0.2) status = 'good';
      break;
    case '상관격':
      if (d.정관 >= 0.1 && g.인성 < 0.12) status = 'bad';
      else if (g.재성 >= 0.2 || g.인성 >= 0.22) status = 'good';
      break;
    case '정재격':
    case '편재격':
      if (g.비겁 >= 0.35) status = 'bad';
      else if (g.식상 >= 0.2 || g.관성 >= 0.2) status = 'good';
      break;
    case '정인격':
      if (g.재성 >= 0.33 && strengthCls === 'weak') status = 'bad';
      else if (g.관성 >= 0.2) status = 'good';
      break;
    case '편인격':
      if (d.식신 >= 0.12) status = 'bad';
      else if (g.관성 >= 0.2) status = 'good';
      break;
    default:
      if (g.관성 >= 0.2 || g.식상 >= 0.2 || g.재성 >= 0.2) status = 'good';
      else if (g.비겁 >= 0.35) status = 'bad';
  }
  return { name, status };
};

const oracleYong = (f: Four, e: ReturnType<typeof oracleEnergy>, cls: string, counts: Record<string, number>): { element: string; method: string; roles: Record<string, string> } => {
  const day = f[2] as { stem: number; branch: number };
  const month = f[1] as { stem: number; branch: number };
  const dm = STEM_EL[day.stem];
  const elOf: Record<string, string> = { 비겁: dm, 식상: gen(dm), 재성: ctl(dm), 관성: ctlBy(dm), 인성: genBy(dm) };
  const g = e.group;
  const argmin = (list: string[]): string => list.reduce((b, x) => (g[x] < g[b] ? x : b), list[0]);
  const argmax = (list: string[]): string => list.reduce((b, x) => (g[x] > g[b] ? x : b), list[0]);
  let element: string;
  let method = 'eokbu';
  if (cls === 'strong') element = elOf[g.인성 >= g.비겁 ? '재성' : argmin(['식상', '관성', '재성'])];
  else if (cls === 'weak') element = elOf[argmax(['재성', '식상', '관성']) === '재성' ? '비겁' : '인성'];
  else {
    element = ORDER.reduce((b, x) => (counts[x] < counts[b] ? x : b), ORDER[0]);
    method = 'balance';
  }
  const m = month.branch;
  const cold = (m === 11 || m === 0 || m === 1) && counts['수'] >= 3;
  const hot = (m === 5 || m === 6 || m === 7) && counts['화'] >= 3;
  if (cold || hot) {
    element = cold ? '화' : '수';
    method = 'johu';
  }
  const hee = genBy(element);
  const gi = ctlBy(element);
  const gu = genBy(gi);
  const roles: Record<string, string> = {};
  for (const x of ORDER) roles[x] = x === element ? 'yong' : x === hee ? 'hee' : x === gi ? 'gi' : x === gu ? 'gu' : 'han';
  return { element, method, roles };
};

const POS = ['year', 'month', 'day', 'hour'];
const SAMHE: [number, number, number, string][] = [[8, 0, 4, '수'], [11, 3, 7, '목'], [2, 6, 10, '화'], [5, 9, 1, '금']];
const BANGHE: [number, number, number, string][] = [[2, 3, 4, '목'], [5, 6, 7, '화'], [8, 9, 10, '금'], [11, 0, 1, '수']];
const YUKHE: [number, number, string][] = [[0, 1, '토'], [2, 11, '목'], [3, 10, '화'], [4, 9, '금'], [5, 8, '수'], [6, 7, '화']];
const STEMHE: Record<string, string> = { '0-5': '토', '1-6': '금', '2-7': '수', '3-8': '목', '4-9': '화' };
const EN: Record<string, string> = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };

const oracleRelations = (f: Four): string[] => {
  const out: string[] = [];
  const idx = [0, 1, 2, 3].filter((i) => f[i]);
  const key = (kind: string, ps: number[], el = ''): string => `${kind}:${ps.map((i) => POS[i]).sort().join('+')}:${el}`;
  for (let a = 0; a < idx.length; a++) {
    for (let b = a + 1; b < idx.length; b++) {
      const i = idx[a];
      const j = idx[b];
      const pa = f[i] as { stem: number; branch: number };
      const pb = f[j] as { stem: number; branch: number };
      const lo = Math.min(pa.stem, pb.stem);
      const hi = Math.max(pa.stem, pb.stem);
      if (hi - lo === 5) out.push(key('stemHe', [i, j], STEMHE[`${lo}-${hi}`]));
      if (hi - lo === 6) out.push(key('stemChung', [i, j]));
      const bl = Math.min(pa.branch, pb.branch);
      const bh = Math.max(pa.branch, pb.branch);
      if (bh - bl === 6) out.push(key('chung', [i, j]));
      for (const [x, y, el] of YUKHE) if (bl === Math.min(x, y) && bh === Math.max(x, y)) out.push(key('yukHe', [i, j], el));
    }
  }
  const first = (v: number): number | undefined => idx.find((i) => (f[i] as { branch: number }).branch === v);
  for (const [x, y, z, el] of SAMHE) {
    const px = first(x);
    const py = first(y);
    const pz = first(z);
    if (px !== undefined && py !== undefined && pz !== undefined) out.push(key('samHe', [px, py, pz], el));
    else {
      if (py !== undefined && px !== undefined) out.push(key('banHe', [py, px], el));
      if (py !== undefined && pz !== undefined) out.push(key('banHe', [py, pz], el));
    }
  }
  for (const [x, y, z, el] of BANGHE) {
    const px = first(x);
    const py = first(y);
    const pz = first(z);
    if (px !== undefined && py !== undefined && pz !== undefined) out.push(key('bangHe', [px, py, pz], el));
  }
  return out.sort();
};

const STRUCT: Record<string, (g: Record<string, number>, d: Record<string, number>, cls: string) => boolean> = {
  sikSangSaengJae: (g) => g.식상 >= 0.18 && g.재성 >= 0.18,
  jaeSaengGwan: (g) => g.재성 >= 0.18 && g.관성 >= 0.18,
  gwanInSangSaeng: (g) => g.관성 >= 0.18 && g.인성 >= 0.18,
  sikSinJeSal: (_g, d) => d.식신 >= 0.1 && d.편관 >= 0.1,
  sangGwanGyeonGwan: (_g, d) => d.상관 >= 0.1 && d.정관 >= 0.1,
  sangGwanPaeIn: (g, d) => d.상관 >= 0.12 && g.인성 >= 0.18,
  gunGeopJaengJae: (g) => g.비겁 >= 0.35 && g.재성 > 0.02 && g.재성 <= 0.22,
  jaeDaSinYak: (g, _d, cls) => cls === 'weak' && g.재성 >= 0.33,
  gwanSalHonJap: (_g, d) => d.정관 >= 0.1 && d.편관 >= 0.1,
  inDa: (g) => g.인성 >= 0.4,
  biGeopGwaDa: (g) => g.비겁 >= 0.4,
  sikSangGwaDa: (g) => g.식상 >= 0.4,
  pyeonInDoSik: (_g, d) => d.편인 >= 0.1 && d.식신 >= 0.1,
  muJae: (g) => g.재성 < 0.03,
  muGwan: (g) => g.관성 < 0.03,
  muIn: (g) => g.인성 < 0.03,
};

describe('V-24 사주 통변: 독립 구현과의 대조', () => {
  it('십성표 100칸: 구현의 십성 계산이 교과서 표와 같다', () => {
    for (let d = 0; d < 10; d++) for (let o = 0; o < 10; o++) expect(tenGodOf(d, o), `${STEMS[d]}→${STEMS[o]}`).toBe(TEN[d][o]);
  });

  it('지장간표 12지지와 건록 위치가 교과서 표와 같다', () => {
    for (let b = 0; b < 12; b++) expect(HIDDEN_STEMS[b], BRANCHES[b]).toEqual(HID[b]);
  });

  it('무작위 사주 20,000개: 기운 분포·강약·득령·격국·용신·구조·합충이 독립 구현과 전부 같다', () => {
    const r = rng(240901);
    const bad: string[] = [];
    const seen = { cls: { weak: 0, balanced: 0, strong: 0 }, johu: 0, balance: 0, eokbu: 0, hourless: 0, relations: 0 };
    for (let n = 0; n < 20000; n++) {
      const f = randomFour(r);
      const b = basisOf(f);
      const gender = r() < 0.5 ? 'M' : 'F';
      const a = analyzeSaju(b, gender);
      const oe = oracleEnergy(f);
      const label = `#${n} ${f.map((p) => (p ? STEMS[p.stem] + BRANCHES[p.branch] : '--')).join(' ')}`;

      // 기운 분포
      const e = energyOf(b);
      for (const g of Object.keys(oe.god)) if (Math.abs(e.byGod[g as '비견'] - oe.god[g]) > 1e-9) bad.push(`${label}: 십성 ${g} ${e.byGod[g as '비견']} ≠ ${oe.god[g]}`);
      for (const g of Object.keys(oe.group)) if (Math.abs(e.byGroup[g as '비겁'] - oe.group[g]) > 1e-9) bad.push(`${label}: 그룹 ${g}`);
      const sum = Object.values(e.byGroup).reduce((s, x) => s + x, 0);
      if (Math.abs(sum - 1) > 1e-9) bad.push(`${label}: 비중 합 ${sum}`);

      // 강약·득령
      const H = oe.group.비겁 + oe.group.인성;
      const cls = H < STRENGTH_CUTS.weak ? 'weak' : H >= STRENGTH_CUTS.strong ? 'strong' : 'balanced';
      if (a.strength.cls !== cls) bad.push(`${label}: 강약 ${a.strength.cls} ≠ ${cls}`);
      const month = f[1] as { branch: number };
      const deuk = ['비겁', '인성'].includes(GROUP[TEN[(f[2] as { stem: number }).stem][HID[month.branch][0]]]);
      if (a.strength.deukryeong !== deuk) bad.push(`${label}: 득령`);
      const ext = H < STRENGTH_CUTS.extremeWeak ? 'weak' : H >= STRENGTH_CUTS.extremeStrong ? 'strong' : null;
      if (a.strength.extreme !== ext) bad.push(`${label}: 극단`);
      seen.cls[cls]++;

      // 격국
      const og = oracleGyeok(f, cls, oe);
      if (a.gyeok.name !== og.name || a.gyeok.status !== og.status) bad.push(`${label}: 격국 ${a.gyeok.name}/${a.gyeok.status} ≠ ${og.name}/${og.status}`);

      // 용신
      const counts = oracleCounts(f);
      const oy = oracleYong(f, oe, cls, counts);
      const en = EN[a.yong.element];
      if (en !== oy.element || a.yong.method !== oy.method) bad.push(`${label}: 용신 ${en}/${a.yong.method} ≠ ${oy.element}/${oy.method}`);
      for (const el of Object.keys(a.yong.roles)) if (a.yong.roles[el as 'wood'] !== oy.roles[EN[el]]) bad.push(`${label}: 역할 ${el}`);
      seen[oy.method as 'johu' | 'balance' | 'eokbu']++;

      // 구조
      const ids = Object.keys(STRUCT).filter((id) => STRUCT[id](oe.group, oe.god, cls)).sort();
      const got = a.structures.map((s) => s.id).sort();
      if (JSON.stringify(ids) !== JSON.stringify(got)) bad.push(`${label}: 구조 ${got.join(',')} ≠ ${ids.join(',')}`);

      // 합충
      const rel = oracleRelations(f);
      const gotRel = relationsOf(b)
        .map((x) => `${x.kind}:${[...x.pos].sort().join('+')}:${x.element ? EN[x.element] : ''}`)
        .sort();
      if (JSON.stringify(rel) !== JSON.stringify(gotRel)) bad.push(`${label}: 합충 ${gotRel.join('|')} ≠ ${rel.join('|')}`);
      seen.relations += rel.length;
      if (!f[3]) seen.hourless++;

      // 배우자 신호
      const spouseGroup = gender === 'M' ? '재성' : '관성';
      if (a.spouse.group !== spouseGroup || Math.abs(a.spouse.energy - oe.group[spouseGroup]) > 1e-9) bad.push(`${label}: 배우자 신호`);
      if (bad.length > 20) break;
    }
    // eslint-disable-next-line no-console
    console.log('TONGBYEON_SAJU_ORACLE', JSON.stringify({ sets: 20000, ...seen }));
    // 표본이 모든 갈래를 지나갔는지(독립 구현이 일부 경로만 확인하는 것을 막는다)
    expect(seen.cls.weak).toBeGreaterThan(4000);
    expect(seen.cls.strong).toBeGreaterThan(4000);
    expect(seen.cls.balanced).toBeGreaterThan(4000);
    expect(seen.johu).toBeGreaterThan(1000);
    expect(seen.balance).toBeGreaterThan(1000);
    expect(seen.hourless).toBeGreaterThan(1500);
    expect(seen.relations).toBeGreaterThan(20000);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('용신 역할 5가지는 항상 서로 다른 오행에 하나씩 놓인다', () => {
    const r = rng(7);
    for (let n = 0; n < 2000; n++) {
      const a = analyzeSaju(basisOf(randomFour(r)), 'M');
      expect(Object.values(a.yong.roles).sort()).toEqual(['gi', 'gu', 'han', 'hee', 'yong']);
      expect(a.yong.roles[a.yong.element]).toBe('yong');
    }
  });
});

// ── 영역 점수: 규칙표(src/core/tongbyeon/rules.ts 의 설명)를 보고 다시 적은 독립 점수표 ─────────────────────────────
const STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
const CHANGSHENG = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
const CHEONEUL: number[][] = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];
const peachOf = (b: number): number => ([8, 0, 4].includes(b) ? 9 : [5, 9, 1].includes(b) ? 6 : [2, 6, 10].includes(b) ? 3 : 0);

const band = (v: number): 'none' | 'low' | 'fair' | 'rich' | 'many' | 'excess' => (v < 0.03 ? 'none' : v < 0.1 ? 'low' : v < 0.18 ? 'fair' : v < 0.3 ? 'rich' : v < 0.4 ? 'many' : 'excess');
const ROLE: Record<string, number> = { yong: 0.4, hee: 0.2, han: 0, gu: -0.2, gi: -0.4 };

const oracleScores = (f: Four, gender: 'M' | 'F'): Record<string, number> => {
  const day = f[2] as { stem: number; branch: number };
  const month = f[1] as { stem: number; branch: number };
  const e = oracleEnergy(f);
  const g = e.group;
  const H = g.비겁 + g.인성;
  const cls = H < STRENGTH_CUTS.weak ? 'weak' : H >= STRENGTH_CUTS.strong ? 'strong' : 'balanced';
  const extreme = H < STRENGTH_CUTS.extremeWeak || H >= STRENGTH_CUTS.extremeStrong;
  const deuk = ['비겁', '인성'].includes(GROUP[TEN[day.stem][HID[month.branch][0]]]);
  const og = oracleGyeok(f, cls, e);
  const counts = oracleCounts(f);
  const yong = oracleYong(f, e, cls, counts);
  const rel = oracleRelations(f).map((x) => {
    const [kind, pos] = x.split(':');
    return { kind, pos: pos.split('+') };
  });
  const dm = STEM_EL[day.stem];
  const elOfGroup: Record<string, string> = { 비겁: dm, 식상: gen(dm), 재성: ctl(dm), 관성: ctlBy(dm), 인성: genBy(dm) };
  const roleOf = (grp: string): number => ROLE[yong.roles[elOfGroup[grp]]];
  const stage = STAGES[day.stem % 2 === 0 ? (((day.branch - CHANGSHENG[day.stem]) % 12) + 12) % 12 : (((CHANGSHENG[day.stem] - day.branch) % 12) + 12) % 12];
  const st = (id: string): boolean => STRUCT[id](g, e.god, cls);
  const involves = (kind: string[], p: string): number => rel.filter((r) => kind.includes(r.kind) && r.pos.includes(p)).length;
  const hasEl = oracleCounts(f);
  void hasEl;
  const m = month.branch;
  const cold = (m === 11 || m === 0 || m === 1) && counts['수'] >= 3;
  const hot = (m === 5 || m === 6 || m === 7) && counts['화'] >= 3;
  const missing = ORDER.filter((x) => counts[x] === 0);
  const maxN = Math.max(...ORDER.map((x) => counts[x]));
  const heavy4 = ORDER.filter((x) => counts[x] >= 4);
  const goodStage = ['장생', '관대', '건록', '제왕'].includes(stage);

  const out: Record<string, number> = {};
  // 성격·기질
  let v = 0;
  v += extreme ? -0.6 : cls === 'balanced' ? 0.6 : 0;
  v += deuk ? 0.4 : 0;
  v += og.status === 'good' ? 0.6 : og.status === 'bad' ? -0.6 : 0;
  v += goodStage ? 0.3 : ['쇠', '병', '사', '묘', '절'].includes(stage) ? -0.3 : 0;
  v += missing.length === 0 ? (heavy4.length ? 0 : 0.3) : missing.length >= 2 || heavy4.length ? -0.3 : 0;
  v += cold || hot ? -0.3 : 0;
  out.self = v;
  // 재물
  v = { none: -1.0, low: -0.4, fair: 0.2, rich: 0.6, many: 0.4, excess: 0.2 }[band(g.재성)];
  if (cls === 'strong' && g.재성 >= 0.1) v += 0.6;
  else if (cls === 'balanced' && g.재성 >= 0.1) v += 0.3;
  else if (cls === 'strong' && g.재성 < 0.1) v += -0.2;
  v += st('sikSangSaengJae') ? 0.5 : 0;
  v += st('jaeDaSinYak') ? -0.7 : 0;
  v += st('gunGeopJaengJae') ? -0.7 : 0;
  const stemsExposed = [f[0], f[1], f[3]].filter((p): p is { stem: number; branch: number } => !!p);
  v += stemsExposed.some((p) => GROUP[TEN[day.stem][p.stem]] === '재성') ? 0.2 : 0;
  if (og.name === '정재격' || og.name === '편재격') v += og.status === 'good' ? 0.3 : og.status === 'bad' ? -0.3 : 0;
  v += roleOf('재성');
  out.wealth = v;
  // 직업
  v = { none: -0.6, low: -0.1, fair: 0.3, rich: 0.6, many: 0.2, excess: -0.2 }[band(g.관성)];
  if (cls === 'strong' && g.관성 >= 0.1) v += 0.5;
  else if (cls === 'weak' && g.관성 >= 0.3) v += -0.7;
  v += st('gwanInSangSaeng') ? 0.5 : 0;
  v += st('sikSinJeSal') ? 0.4 : 0;
  v += st('sangGwanGyeonGwan') ? -0.6 : 0;
  v += st('gwanSalHonJap') ? -0.4 : 0;
  if (og.name === '정관격' || og.name === '편관격') v += og.status === 'good' ? 0.5 : og.status === 'bad' ? -0.5 : 0;
  v += roleOf('관성') * 0.75;
  out.career = v;
  // 연애·결혼
  const sg = gender === 'M' ? '재성' : '관성';
  const sv = g[sg];
  v = sv < 0.03 ? -0.7 : sv < 0.1 ? -0.2 : sv < 0.3 ? 0.6 : 0.2;
  const dg = GROUP[TEN[day.stem][HID[day.branch][0]]];
  v += dg === sg ? 0.6 : dg === '인성' ? 0.3 : dg === '식상' ? 0.1 : dg === '비겁' ? -0.4 : 0;
  v += involves(['chung'], 'day') > 0 ? -0.8 : 0;
  v += involves(['yukHe', 'samHe', 'banHe'], 'day') > 0 ? 0.4 : 0;
  const pillars = [f[0], f[1], f[2], f[3]];
  const peach = pillars.some((p, i) => p && ((i !== 2 && peachOf(day.branch) === p.branch) || (i !== 0 && peachOf((f[0] as { branch: number }).branch) === p.branch)));
  v += peach ? 0.1 : 0;
  const dayRole = yong.roles[BRANCH_EL[day.branch]];
  v += dayRole === 'yong' || dayRole === 'hee' ? 0.3 : dayRole === 'gi' || dayRole === 'gu' ? -0.3 : 0;
  out.love = v;
  // 건강
  v = maxN >= 5 ? -0.7 : maxN === 4 ? -0.3 : 0;
  v += missing.length > 0 ? Math.max(-0.6, -0.3 * missing.length) : 0;
  v += cold || hot ? -0.4 : 0;
  v += extreme ? -0.4 : 0;
  v += involves(['chung'], 'day') + involves(['chung'], 'month') > 0 ? -0.4 : 0;
  v += missing.length === 0 && maxN <= 3 && cls !== 'weak' && !extreme ? 0.6 : 0;
  v += g.식상 >= 0.4 ? -0.3 : 0;
  v += goodStage ? 0.3 : ['병', '사', '절'].includes(stage) ? -0.3 : 0;
  out.health = v;
  // 대인·가족
  v = g.비겁 < 0.03 ? -0.4 : g.비겁 < 0.1 ? -0.1 : g.비겁 < 0.3 ? 0.4 : g.비겁 < 0.4 ? -0.2 : -0.5;
  v += g.인성 < 0.03 ? -0.3 : g.인성 >= 0.4 ? -0.2 : g.인성 >= 0.1 ? 0.4 : 0;
  const nobleSet = new Set([...CHEONEUL[day.stem], ...CHEONEUL[(f[0] as { stem: number }).stem]]);
  v += pillars.some((p) => p && nobleSet.has(p.branch)) ? 0.4 : 0;
  v += rel.some((r) => ['yukHe', 'samHe', 'banHe', 'bangHe'].includes(r.kind)) ? 0.3 : 0;
  const chungN = rel.filter((r) => r.kind === 'chung').length;
  v += chungN >= 2 ? -0.5 : involves(['chung'], 'month') > 0 ? -0.3 : 0;
  v += st('gwanSalHonJap') ? -0.2 : 0;
  v += g.식상 >= 0.1 && g.식상 < 0.35 ? 0.2 : 0;
  out.people = v;
  return out;
};

describe('V-24 사주 통변: 영역 점수가 규칙표대로 계산된다', () => {
  it('무작위 사주 12,000개 × 6영역: 구현의 영역 점수가 규칙표를 옮겨 적은 독립 점수표와 같다(소수 둘째 자리)', () => {
    const r = rng(240902);
    const bad: string[] = [];
    for (let n = 0; n < 12000; n++) {
      const f = randomFour(r);
      const b = basisOf(f);
      const gender = r() < 0.5 ? 'M' : 'F';
      const hits = sajuDomainHits(analyzeSaju(b, gender), b);
      const want = oracleScores(f, gender);
      for (const d of DOMAINS) {
        const got = assembleSajuDomain(d, hits[d]).score;
        const w = Math.round(want[d] * 100) / 100;
        if (Math.abs(got - w) > 1e-9) bad.push(`#${n} ${d}: ${got} ≠ ${w} (${f.map((p) => (p ? STEMS[p.stem] + BRANCHES[p.branch] : '--')).join(' ')} ${gender})`);
      }
      if (bad.length > 20) break;
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
