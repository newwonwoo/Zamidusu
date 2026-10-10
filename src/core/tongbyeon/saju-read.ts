// 사주 통변(通變): 사실(saju-analysis)을 영역별 결론·본문·근거로 엮는다. 설계서 부록 D-6.
// 각 규칙은 점수(delta)와 문장·근거·주제를 함께 낸다 — 점수와 설명이 어긋나지 않게 한 곳에서 만든다.
// 규칙 번호(S-xxx)는 규칙표(RULES)에 있고, 근거 목록에 그대로 나타난다.

import { ELEMENT_HANJA, ELEMENT_KO, STEMS_KO } from '../ganzhi';
import type { Element } from '../ganzhi';
import { MONTH_SEASON, STEM_IMAGE, ELEMENT_BODY } from '../explain/sajutext';
import { HIDDEN_STEMS, stageOf, TEN_GOD_GROUP } from '../saju';
import type { SajuChart, TenGodGroup } from '../saju';
import { BRANCH_ELEMENT } from '../ganzhi';
import { SAJU_CUTS, SAJU_PERIOD_CUTS } from './calibration';
import { STANDING_MIN_SPREAD, adviceOf, bestDomains, flatNoteOf, markStanding, spreadAdvice, verdictWithThemes, worstDomains } from './common-text';
import {
  GYEOK_LINE, GYEOK_NOTE_LINE, GYEOK_THEMES, STAGE_LINE, STEM_THEMES, STRUCTURE_KEYWORD, STRUCTURE_LINE, STRUCTURE_ORDER, gyeokLabel, stageLabel,
} from './saju-text';
import { POS_KO, analyzeSaju, groupElement } from './saju-analysis';
import type { PillarPos, RelationHit, RelationKind, SajuAnalysis, SajuBasis, YongRole } from './saju-analysis';
import { DOMAINS, DOMAIN_LABEL, LEVEL_LABEL, THEMES, levelOf } from './types';
import type { Domain, DomainReading, Evidence, Level, Overview, PeriodReading, Point, PointKind, Reason } from './types';
import { josa } from '../explain/korean';
import { autoMark, dot, jo, pct, signed, stemLabel, tj, tm } from './util';

interface Hit {
  rule: string;
  delta: number;
  kind: PointKind;
  label: string;
  /** 본문 문장(없으면 근거에만 나타난다) */
  text?: string;
  /** 근거에 적을 이 사주의 값 */
  ev: string;
  /** 비교에서 쓰는 짧은 명사구 */
  brief: string;
  themes?: Record<string, number>;
}

const elLabel = (e: Element): string => `${ELEMENT_KO[e]}(${ELEMENT_HANJA[e]})`;
const ROLE_DELTA: Record<YongRole, number> = { yong: 0.4, hee: 0.2, han: 0, gu: -0.2, gi: -0.4 };
const ROLE_KO: Record<YongRole, string> = { yong: '용신', hee: '희신', han: '한신', gu: '구신', gi: '기신' };

const roleOfGroup = (a: SajuAnalysis, g: TenGodGroup): { role: YongRole; element: Element } => {
  const element = groupElement(a.dayElement, g);
  return { role: a.yong.roles[element], element };
};

/** 용신 관계를 한 규칙으로: 그 그룹의 오행이 용신·희신이면 +, 기신·구신이면 − */
const roleHit = (rule: string, a: SajuAnalysis, g: TenGodGroup, topic: string, scale = 1): Hit | null => {
  const { role, element } = roleOfGroup(a, g);
  if (role === 'han') return null;
  const delta = ROLE_DELTA[role] * scale;
  const good = role === 'yong' || role === 'hee';
  const head = `${tj(g, '은/는')} ${elLabel(element)} 기운이고,`;
  // 그룹의 양이 적어도 이 문장이 나온다(재성이 적은데 용신이면 “도움이 되는 쪽”이 앞 문장과 어긋나 읽힌다) —
  // 그래서 “지금 도움이 된다”가 아니라 “이 기운이 채워지는 때에 도움을 받는다”고 쓴다
  const text =
    role === 'yong' ? `${head} 이 기운은 ${tm('용신')}에 해당합니다. 이 기운이 채워지는 때에 ${topic}에서 도움을 받기 쉽습니다.`
      : role === 'hee' ? `${head} 이 기운은 ${tm('희신')}에 해당합니다. 이 기운이 채워지는 때에 ${topic}에서 도움을 받기 쉽습니다.`
        : role === 'gi' ? `${head} 이 기운은 ${tm('기신')}에 해당합니다. ${topic}에서는 욕심이 균형을 흔들 수 있습니다.`
          : `${head} 이 기운은 ${tm('기신')}을 키워 주는 기운입니다. ${topic}에서는 욕심이 균형을 흔들 수 있습니다.`;
  return {
    rule, delta, kind: 'balance', label: '필요한 기운과의 관계', text,
    ev: `${g} 오행 ${elLabel(element)} = ${ROLE_KO[role]}`,
    brief: good ? `${g}이 필요한 기운` : `${g}이 피할 기운`,
  };
};

const has = (a: SajuAnalysis, kind: RelationKind, pos?: PillarPos): RelationHit[] =>
  a.relations.filter((r) => r.kind === kind && (pos === undefined || r.pos.includes(pos)));
const partnerOf = (r: RelationHit, pos: PillarPos): PillarPos => r.pos.find((p) => p !== pos) as PillarPos;
const hasStructure = (a: SajuAnalysis, id: string): boolean => a.structures.some((s) => s.id === id);

// ── 성격·기질 ────────────────────────────────────────────────────────────────
const selfHits = (a: SajuAnalysis, b: SajuBasis): Hit[] => {
  const hits: Hit[] = [];
  const themes: Record<string, number> = {};
  const add = (id: string, w: number): void => {
    themes[id] = (themes[id] ?? 0) + w;
  };
  STEM_THEMES[a.dayStem].forEach((t, i) => add(t, i === 0 ? 1.0 : 0.8));
  GYEOK_THEMES[a.gyeok.name].forEach((t, i) => add(t, i === 0 ? 0.8 : 0.6));
  if (a.strength.cls === 'strong') {
    add('lead', 0.5);
    add('bold', 0.3);
  }
  if (a.strength.cls === 'weak') {
    add('gentle', 0.5);
    add('think', 0.3);
  }

  hits.push({
    rule: 'S-SE1', delta: 0, kind: 'core', label: '타고난 성향',
    text: `${tj('일간', '이/가')} ${jo(stemLabel(a.dayStem), '이라/라')} ${STEM_IMAGE[a.dayStem]} 성향입니다.`,
    ev: `일간 ${stemLabel(a.dayStem)}`, brief: `일간 ${STEMS_KO[a.dayStem]}`, themes,
  });

  const sp = pct(a.strength.index);
  const s = a.strength;
  const strengthLines =
    s.cls === 'strong'
      ? [`${tj('일간', '을/를')} 돕는 기운이 ${sp}로 많은 편이라 {{신강}}입니다.`, '자기 힘이 충분해 추진력과 자존심이 강합니다.', '힘을 덜어 내는 쪽(표현·재물·일)에 쓸 때 빛납니다.']
      : s.cls === 'weak'
        ? [`${tj('일간', '을/를')} 돕는 기운이 ${sp}로 적은 편이라 {{신약}}입니다.`, '환경과 주변 사람의 영향을 많이 받습니다.', '힘을 보태 주는 사람·공부·휴식이 중요합니다.']
        : [`${tj('일간', '을/를')} 돕는 기운이 ${sp}로 알맞아 {{중화}}에 가깝습니다.`, '힘이 한쪽으로 치우치지 않아 상황에 맞게 조절하기 쉽습니다.'];
  if (s.extreme) strengthLines.push('분포상 한쪽으로 크게 쏠려 있어 특수한 구조일 수 있습니다. 전문가의 확인을 권합니다.');
  hits.push({
    rule: 'S-SE2', delta: s.extreme ? -0.6 : s.cls === 'balanced' ? 0.6 : 0, kind: 'balance', label: '힘의 세기',
    text: strengthLines.join(' '),
    ev: `도움 지수(비겁+인성) ${sp} → ${s.cls === 'strong' ? '신강' : s.cls === 'weak' ? '신약' : '중화'}${s.extreme ? ' · 분포 극단' : ''}`,
    brief: s.extreme ? '힘이 크게 한쪽으로 쏠림' : s.cls === 'balanced' ? '힘의 균형' : s.cls === 'strong' ? '힘이 센 편' : '힘이 약한 편',
  });

  hits.push({
    rule: 'S-SE3', delta: s.deukryeong ? 0.4 : 0, kind: 'balance', label: '태어난 달의 도움',
    text: s.deukryeong
      ? `태어난 달의 기운이 ${tj('일간', '을/를')} 도와 {{득령}}했습니다. 바탕이 든든한 편입니다.`
      : `태어난 달의 기운은 ${tj('일간', '을/를')} 돕지 않아 스스로 힘을 길러야 합니다.`,
    ev: `월지 ${b.month.ko[1]} 본기 십성 ${b.month.branchGod} → ${s.deukryeong ? '득령' : '실령'}`,
    brief: s.deukryeong ? '태어난 달의 도움' : '태어난 달의 도움 없음',
  });

  const gd = a.gyeok.status === 'good' ? 0.6 : a.gyeok.status === 'bad' ? -0.6 : 0;
  hits.push({
    rule: 'S-SE4', delta: gd, kind: 'core', label: '격국(큰 틀)',
    text: `${tj('격국', '은/는')} ${gyeokLabel(a.gyeok.name)}입니다. ${GYEOK_LINE[a.gyeok.name]} ${GYEOK_NOTE_LINE[a.gyeok.note]}`,
    ev: `월지 지장간 ${stemLabel(a.gyeok.stem)}(${a.gyeok.god})을 ${a.gyeok.how === 'tuchul' ? '천간에 드러난 것으로' : '본기로'} 잡아 ${a.gyeok.name}, ${a.gyeok.status === 'good' ? '성격' : a.gyeok.status === 'bad' ? '패격' : '평'} 표시`,
    brief: a.gyeok.status === 'good' ? `${gyeokLabel(a.gyeok.name)}이 잘 이루어짐` : a.gyeok.status === 'bad' ? `${gyeokLabel(a.gyeok.name)}이 흔들림` : gyeokLabel(a.gyeok.name),
  });

  const stage = a.dayStage;
  const sd = ['장생', '관대', '건록', '제왕'].includes(stage) ? 0.3 : ['쇠', '병', '사', '묘', '절'].includes(stage) ? -0.3 : 0;
  hits.push({
    rule: 'S-SE5', delta: sd, kind: 'core', label: '뿌리의 힘',
    text: `${tm('일지')}에서 ${tm('일간')}의 {{12운성}}은 '${stage === '건록' ? tm('건록') : stageLabel(stage)}'입니다. ${STAGE_LINE[stage]}`,
    ev: `일지에서 일간의 12운성 = ${stageLabel(stage)}`, brief: `일지 12운성 ${stageLabel(stage)}`,
  });

  const missing = (Object.keys(a.counts) as Element[]).filter((e) => a.counts[e] === 0);
  const heavy = (Object.keys(a.counts) as Element[]).filter((e) => a.counts[e] >= 4);
  if (missing.length === 0) {
    hits.push({
      rule: 'S-SE6', delta: heavy.length ? 0 : 0.3, kind: 'balance', label: '오행의 균형',
      text: heavy.length ? undefined : `다섯 ${tj('오행', '이/가')} 모두 있어 바탕의 균형이 좋습니다.`,
      ev: `오행 분포 ${(['wood', 'fire', 'earth', 'metal', 'water'] as Element[]).map((e) => `${ELEMENT_KO[e]}${a.counts[e]}`).join(' ')}`, brief: '오행이 고름',
    });
  } else if (missing.length >= 2 || heavy.length) {
    hits.push({
      rule: 'S-SE6', delta: -0.3, kind: 'balance', label: '오행의 균형',
      text: missing.length >= 2
        ? `${dot(missing.map((e) => elLabel(e)))} 기운이 없어 한쪽으로 기운 면이 있습니다.`
        : `${elLabel(heavy[0])} 기운이 ${a.counts[heavy[0]]}개로 많아 한쪽으로 기운 면이 있습니다.`,
      ev: `오행 분포 ${(['wood', 'fire', 'earth', 'metal', 'water'] as Element[]).map((e) => `${ELEMENT_KO[e]}${a.counts[e]}`).join(' ')}`, brief: '오행이 한쪽으로 기움',
    });
  }

  if (a.season.cold || a.season.hot) {
    hits.push({
      rule: 'S-SE7', delta: -0.3, kind: 'balance', label: '계절의 치우침',
      text: a.season.cold
        ? `${MONTH_SEASON[a.season.branch]}에 태어나 물이 많아 차가운 사주입니다. 따뜻한 기운이 필요합니다.`
        : `${MONTH_SEASON[a.season.branch]}에 태어나 불이 많아 뜨거운 사주입니다. 식혀 주는 기운이 필요합니다.`,
      ev: `월지 ${MONTH_SEASON[a.season.branch]} + ${a.season.cold ? '수' : '화'} ${a.counts[a.season.cold ? 'water' : 'fire']}개 → ${a.season.cold ? '한' : '열'} 치우침`, brief: a.season.cold ? '사주가 차가움' : '사주가 뜨거움',
    });
  }
  return hits;
};

// ── 크기 구간(재성·관성·비겁·인성 공통) ───────────────────────────────────────
type Band = 'none' | 'low' | 'fair' | 'rich' | 'many' | 'excess';
const bandOf = (v: number): Band => (v < 0.03 ? 'none' : v < 0.1 ? 'low' : v < 0.18 ? 'fair' : v < 0.3 ? 'rich' : v < 0.4 ? 'many' : 'excess');

// ── 재물 ─────────────────────────────────────────────────────────────────────
const wealthHits = (a: SajuAnalysis, b: SajuBasis): Hit[] => {
  const hits: Hit[] = [];
  const g = a.energy.byGroup;
  const d = a.energy.byGod;
  const v = g.재성;
  const band = bandOf(v);
  const TEXT: Record<Band, [number, string, string, string]> = {
    none: [-1.0, `${tj('재성', '이/가')} 거의 없습니다.`, '재물은 꾸준한 노력과 시기의 흐름에 더 좌우됩니다.', '재성이 거의 없음'],
    low: [-0.4, `${tj('재성', '이/가')} 적은 편입니다.`, '한 곳에 집중해 모으는 쪽이 어울립니다.', '재성이 적은 편'],
    fair: [0.2, `${tj('재성', '이/가')} 보통 수준입니다.`, '안정된 수입을 만들기 쉽습니다.', '재성이 보통'],
    rich: [0.6, `${tj('재성', '이/가')} 넉넉한 편입니다.`, '재물을 다루는 감각이 있습니다.', '재성이 넉넉함'],
    many: [0.4, `${tj('재성', '이/가')} 많은 편입니다.`, '재물에 대한 관심과 쓰임이 모두 큽니다.', '재성이 많은 편'],
    excess: [0.2, `${tj('재성', '이/가')} 매우 많습니다.`, '기회가 많은 만큼 흩어지기도 쉽습니다.', '재성이 매우 많음'],
  };
  const [bd, t1, t2, br] = TEXT[band];
  hits.push({ rule: 'S-WE1', delta: bd, kind: 'core', label: '재물 기운', text: `${t1} ${t2}`, ev: `재성 비중 ${pct(v)} (${br})`, brief: br });

  const s = a.strength;
  if (s.cls === 'strong' && v >= 0.1) {
    hits.push({ rule: 'S-WE2', delta: 0.6, kind: 'balance', label: '받아 낼 힘', text: `${tj('신강', '이라/라')} 재물을 감당할 힘이 있습니다.`, ev: `신강 + 재성 ${pct(v)}`, brief: '재물을 감당할 힘' });
  } else if (s.cls === 'balanced' && v >= 0.1) {
    hits.push({ rule: 'S-WE2', delta: 0.3, kind: 'balance', label: '받아 낼 힘', text: '힘이 균형 잡혀 있어 재물을 무리 없이 다룹니다.', ev: `중화 + 재성 ${pct(v)}`, brief: '재물을 무리 없이 다룸' });
  } else if (s.cls === 'strong' && v < 0.1) {
    hits.push({ rule: 'S-WE2', delta: -0.2, kind: 'balance', label: '받아 낼 힘', text: '힘은 센데 재물 쪽 기운이 비어 있어 기회를 일부러 찾아야 합니다.', ev: `신강 + 재성 ${pct(v)}`, brief: '힘은 센데 재물 쪽이 빔' });
  }

  if (hasStructure(a, 'sikSangSaengJae')) {
    hits.push({ rule: 'S-WE3', delta: 0.5, kind: 'pattern', label: '재능이 재물로', text: `${tm('식상생재')} 구조라 재능을 살려 돈을 버는 길이 열려 있습니다.`, ev: `식상 ${pct(g.식상)} · 재성 ${pct(g.재성)}`, brief: '재능이 재물로 이어짐', themes: { earned: 1 } });
  }
  if (hasStructure(a, 'jaeDaSinYak')) {
    hits.push({ rule: 'S-WE4', delta: -0.7, kind: 'pattern', label: '재물이 버거움', text: `${tj('재다신약', '이라/라')} 재물이 들어와도 감당하기 버겁습니다.`, ev: `신약 + 재성 ${pct(v)}`, brief: '재물이 버거움', themes: { swing: 1, leak: 0.6 } });
  }
  if (hasStructure(a, 'gunGeopJaengJae')) {
    hits.push({ rule: 'S-WE5', delta: -0.7, kind: 'pattern', label: '재물을 나눔', text: `${tj('군겁쟁재', '이라/라')} 경쟁자·동료와 재물을 나누기 쉽습니다. 동업과 보증은 신중히 하세요.`, ev: `비겁 ${pct(g.비겁)} · 재성 ${pct(g.재성)}`, brief: '경쟁자와 재물을 나눔', themes: { leak: 1, swing: 0.4 } });
  }

  const exposed = (['year', 'month', 'hour'] as PillarPos[]).filter((p) => b[p] && TEN_GOD_GROUP[b[p]!.stemGod as '비견'] === '재성');
  if (exposed.length > 0) {
    hits.push({ rule: 'S-WE6', delta: 0.2, kind: 'support', label: '드러난 재물', text: `${tj('재성', '이/가')} ${tm('천간')}에 드러나 있어 재물 기회가 눈에 잘 띕니다.`, ev: `재성이 천간(${exposed.map((p) => POS_KO[p]).join('·')})에 있음`, brief: '재물 기회가 드러남' });
  }
  if (a.gyeok.name === '정재격' || a.gyeok.name === '편재격') {
    const gd = a.gyeok.status === 'good' ? 0.3 : a.gyeok.status === 'bad' ? -0.3 : 0;
    hits.push({ rule: 'S-WE7', delta: gd, kind: 'core', label: '재물을 따르는 틀', text: `재물을 중심으로 하는 ${tm('격국')}(${a.gyeok.name})입니다. ${GYEOK_NOTE_LINE[a.gyeok.note]}`, ev: `격국 ${a.gyeok.name} (${a.gyeok.status})`, brief: gd > 0 ? '재격이 잘 이루어짐' : gd < 0 ? '재격이 흔들림' : '재격' });
  }
  const rh = roleHit('S-WE8', a, '재성', '재물');
  if (rh) hits.push(rh);

  // 주제
  const t: Record<string, number> = {};
  const add = (id: string, w: number): void => {
    t[id] = (t[id] ?? 0) + w;
  };
  if (d.정재 >= 0.12) add('steady', 1);
  if (d.편재 >= 0.12) add('chance', 1);
  if (hasStructure(a, 'sikSangSaengJae') || (g.식상 >= 0.18 && v >= 0.1)) add('earned', 0.9);
  if (hasStructure(a, 'jaeDaSinYak') || d.편재 >= 0.2) add('swing', 0.9);
  if (hasStructure(a, 'gunGeopJaengJae') || d.겁재 >= 0.18) add('leak', 0.9);
  if ((d.정재 >= 0.12 && s.cls === 'strong') || (g.인성 >= 0.2 && v >= 0.1)) add('keeper', 0.8);
  if (hasStructure(a, 'muJae') || band === 'low') add('scarce', 1);
  if (hits[0]) hits[0].themes = t;
  return hits;
};

// ── 직업 ─────────────────────────────────────────────────────────────────────
const careerHits = (a: SajuAnalysis, b: SajuBasis): Hit[] => {
  const hits: Hit[] = [];
  const g = a.energy.byGroup;
  const d = a.energy.byGod;
  const v = g.관성;
  const band = bandOf(v);
  const TEXT: Record<Band, [number, string, string, string]> = {
    none: [-0.6, `${tj('관성', '이/가')} 거의 없습니다.`, '조직의 틀보다 스스로 길을 만드는 쪽입니다.', '관성이 거의 없음'],
    low: [-0.1, `${tj('관성', '이/가')} 적은 편입니다.`, '규율보다 자율이 어울립니다.', '관성이 적은 편'],
    fair: [0.3, `${tj('관성', '이/가')} 보통 수준입니다.`, '책임을 맡는 일에 무리가 없습니다.', '관성이 보통'],
    rich: [0.6, `${tj('관성', '이/가')} 넉넉한 편입니다.`, '조직과 직위를 얻는 힘이 있습니다.', '관성이 넉넉함'],
    many: [0.2, `${tj('관성', '이/가')} 많은 편입니다.`, '책임이 무거워 압박을 느끼기도 합니다.', '관성이 많은 편'],
    excess: [-0.2, `${tj('관성', '이/가')} 매우 많습니다.`, '책임과 압박이 커서 쉼이 필요합니다.', '관성이 매우 많음'],
  };
  const [bd, t1, t2, br] = TEXT[band];
  hits.push({ rule: 'S-CA1', delta: bd, kind: 'core', label: '직업 기운', text: `${t1} ${t2}`, ev: `관성 비중 ${pct(v)} (${br})`, brief: br });

  const s = a.strength;
  if (s.cls === 'strong' && v >= 0.1) {
    hits.push({ rule: 'S-CA2', delta: 0.5, kind: 'balance', label: '책임을 감당할 힘', text: `${tj('신강', '이라/라')} 직위의 책임을 감당할 힘이 있습니다.`, ev: `신강 + 관성 ${pct(v)}`, brief: '책임을 감당할 힘' });
  } else if (s.cls === 'weak' && v >= 0.3) {
    hits.push({ rule: 'S-CA2', delta: -0.7, kind: 'balance', label: '압박이 큼', text: `${tm('신약')}인데 ${tj('관성', '이/가')} 많아 압박이 크게 느껴집니다.`, ev: `신약 + 관성 ${pct(v)}`, brief: '압박이 크게 느껴짐' });
  }
  if (hasStructure(a, 'gwanInSangSaeng')) hits.push({ rule: 'S-CA3', delta: 0.5, kind: 'pattern', label: '압박을 받아 주는 구조', text: `${tj('관인상생', '이라/라')} 책임의 압박을 배움과 귀인이 받아 줍니다.`, ev: `관성 ${pct(g.관성)} · 인성 ${pct(g.인성)}`, brief: '압박을 배움과 귀인이 받아 줌', themes: { organization: 1, expert: 0.6 } });
  if (hasStructure(a, 'sikSinJeSal')) hits.push({ rule: 'S-CA4', delta: 0.4, kind: 'pattern', label: '재능으로 푸는 압박', text: `${tj('식신제살', '이라/라')} 어려운 압박도 재능과 여유로 풀어 갑니다.`, ev: `식신 ${pct(d.식신)} · 편관 ${pct(d.편관)}`, brief: '압박을 재능으로 풂', themes: { expert: 0.8, leader: 0.6 } });
  if (hasStructure(a, 'sangGwanGyeonGwan')) hits.push({ rule: 'S-CA5', delta: -0.6, kind: 'pattern', label: '윗사람과의 마찰', text: `${tj('상관견관', '이라/라')} 윗사람·규율과 부딪히기 쉽습니다. 말과 태도를 다듬으세요.`, ev: `상관 ${pct(d.상관)} · 정관 ${pct(d.정관)}`, brief: '윗사람과 마찰하기 쉬움', themes: { change: 0.8 } });
  if (hasStructure(a, 'gwanSalHonJap')) hits.push({ rule: 'S-CA6', delta: -0.4, kind: 'pattern', label: '역할의 복잡함', text: `${tj('관살혼잡', '이라/라')} 직장과 역할이 복잡해지기 쉽습니다.`, ev: `정관 ${pct(d.정관)} · 편관 ${pct(d.편관)}`, brief: '직장과 역할이 복잡함', themes: { change: 0.9 } });
  if (a.gyeok.name === '정관격' || a.gyeok.name === '편관격') {
    const gd = a.gyeok.status === 'good' ? 0.5 : a.gyeok.status === 'bad' ? -0.5 : 0;
    hits.push({ rule: 'S-CA7', delta: gd, kind: 'core', label: '직위를 따르는 틀', text: `직위와 책임을 중심으로 하는 ${tm('격국')}(${a.gyeok.name})입니다. ${GYEOK_NOTE_LINE[a.gyeok.note]}`, ev: `격국 ${a.gyeok.name} (${a.gyeok.status})`, brief: gd > 0 ? '관격이 잘 이루어짐' : gd < 0 ? '관격이 흔들림' : '관격' });
  }
  if (g.식상 >= 0.3 && v < 0.1) {
    hits.push({ rule: 'S-CA8', delta: 0, kind: 'pattern', label: '재능으로 서는 길', text: `${tj('식상', '이/가')} 강하고 ${tj('관성', '은/는')} 약해 조직보다 재능으로 서는 일에 어울립니다.`, ev: `식상 ${pct(g.식상)} · 관성 ${pct(v)}`, brief: '재능으로 서는 길', themes: { expert: 0.9, creative: 1 } });
  }
  const rh = roleHit('S-CA9', a, '관성', '일과 직위', 0.75);
  if (rh) hits.push(rh);

  const t: Record<string, number> = {};
  const add = (id: string, w: number): void => {
    t[id] = (t[id] ?? 0) + w;
  };
  if (d.정관 >= 0.12 || hasStructure(a, 'gwanInSangSaeng')) add('organization', 1);
  if (d.편관 >= 0.12 && s.cls === 'strong') add('leader', 1);
  if (g.인성 >= 0.2) add('expert', 0.8);
  if (g.식상 >= 0.25) add('creative', 0.9);
  if ((g.재성 >= 0.25 && s.cls === 'strong') || g.비겁 >= 0.3) add('venture', 0.8);
  if (g.인성 >= 0.18 && g.관성 >= 0.12) add('support', 0.8);
  if (hasStructure(a, 'gwanSalHonJap') || has(a, 'chung', 'month').length > 0) add('change', 0.9);
  if (hits[0]) hits[0].themes = { ...(hits[0].themes ?? {}), ...t };
  void b;
  return hits;
};

// ── 연애·결혼 ────────────────────────────────────────────────────────────────
const loveHits = (a: SajuAnalysis, b: SajuBasis): Hit[] => {
  const hits: Hit[] = [];
  const sg = a.spouse.group;
  const v = a.spouse.energy;
  const band = bandOf(v);
  const TEXT: Record<Band, [number, string, string, string]> = {
    none: [-0.7, `배우자를 뜻하는 ${tj(sg, '이/가')} 거의 없습니다.`, '인연이 늦거나 운이 바뀔 때 들어온다고 봅니다.', '배우자 신호가 거의 없음'],
    low: [-0.2, `배우자를 뜻하는 ${tj(sg, '이/가')} 적은 편입니다.`, '한 사람과 깊게 이어지는 편입니다.', '배우자 신호가 적은 편'],
    fair: [0.6, `배우자를 뜻하는 ${tj(sg, '이/가')} 뚜렷한 편입니다.`, '인연이 자연스럽게 이어집니다.', '배우자 신호가 뚜렷함'],
    rich: [0.6, `배우자를 뜻하는 ${tj(sg, '이/가')} 뚜렷한 편입니다.`, '인연이 자연스럽게 이어집니다.', '배우자 신호가 뚜렷함'],
    many: [0.2, `배우자를 뜻하는 ${tj(sg, '이/가')} 많은 편입니다.`, '이성 인연이 다양해 마음을 모으는 것이 과제입니다.', '배우자 신호가 많은 편'],
    excess: [0.2, `배우자를 뜻하는 ${tj(sg, '이/가')} 매우 많습니다.`, '이성 인연이 다양해 마음을 모으는 것이 과제입니다.', '배우자 신호가 매우 많음'],
  };
  const [bd, t1, t2, br] = TEXT[band];
  hits.push({ rule: 'S-LO1', delta: bd, kind: 'core', label: '배우자 신호', text: `${t1} ${t2}`, ev: `${sg}(배우자 신호) 비중 ${pct(v)}`, brief: br });

  const dg = TEN_GOD_GROUP[a.spouse.dayBranchGod];
  const dayName = tm('일지');
  let lo: [number, string, string] | null = null;
  if (dg === sg) lo = [0.6, `${dayName} 배우자를 뜻하는 기운이 앉아 있어 배우자 자리가 든든합니다.`, '배우자 자리에 배우자 기운'];
  else if (dg === '인성') lo = [0.3, `${dayName} 돌봐 주는 기운이 앉아 있어 따뜻하게 챙기는 관계가 됩니다.`, '배우자 자리에 돌봄의 기운'];
  else if (dg === '식상') lo = [0.1, `${dayName} 표현의 기운이 앉아 있어 감정 표현이 풍부합니다.`, '배우자 자리에 표현의 기운'];
  else if (dg === '비겁') lo = [-0.4, `${dayName} 나와 같은 기운이 앉아 있어 서로 자기 주장이 강합니다.`, '배우자 자리에 나와 같은 기운'];
  else lo = [0, `${dayName} 현실과 책임의 기운이 앉아 있어 관계에서도 현실 감각이 앞섭니다.`, '배우자 자리에 현실의 기운'];
  hits.push({ rule: 'S-LO2', delta: lo[0], kind: 'support', label: '배우자 자리', text: lo[1], ev: `일지 본기 십성 ${a.spouse.dayBranchGod} (${dg})`, brief: lo[2] });

  const dayChung = has(a, 'chung', 'day');
  if (dayChung.length > 0) {
    const p = partnerOf(dayChung[0], 'day');
    hits.push({
      rule: 'S-LO3', delta: -0.8, kind: 'relation', label: '배우자 자리의 충',
      text: `${tm('일지')}가 ${tm(POS_KO[p])}의 ${tm('지지')}와 ${tm('충')}합니다. 배우자 자리가 흔들리기 쉬우니 서로의 속도를 존중하세요.`,
      ev: `일지가 ${POS_KO[p]} 지지와 충`, brief: '배우자 자리가 충을 받음', themes: { conflict: 1, unsettled: 0.8 },
    });
  }
  const dayHe = [...has(a, 'yukHe', 'day'), ...has(a, 'samHe', 'day'), ...has(a, 'banHe', 'day')];
  if (dayHe.length > 0) {
    hits.push({ rule: 'S-LO4', delta: 0.4, kind: 'relation', label: '배우자 자리의 합', text: `${tm('일지')}가 다른 ${tm('지지')}와 ${tm('합')}해 배우자 자리가 안정되기 쉽습니다.`, ev: `일지의 합 ${dayHe.length}건`, brief: '배우자 자리가 합으로 안정', themes: { warm: 1 } });
  }
  if (a.peach.length > 0) {
    hits.push({ rule: 'S-LO5', delta: 0.1, kind: 'support', label: '매력의 기운', text: `${tj('도화살', '이/가')} 있어 이성에게 매력을 얻기 쉽습니다.`, ev: `도화 글자가 ${a.peach.map((p) => POS_KO[p]).join('·')}에 있음`, brief: '매력의 기운(도화)', themes: { passion: 1 } });
  }
  const dayEl = BRANCH_ELEMENT[b.day.branch];
  const role = a.yong.roles[dayEl];
  if (role !== 'han') {
    const good = role === 'yong' || role === 'hee';
    hits.push({
      rule: 'S-LO6', delta: good ? 0.3 : -0.3, kind: 'balance', label: '배우자 자리와 필요한 기운',
      text: good
        ? `${tm('일지')}의 ${tm('오행')} ${jo(elLabel(dayEl), '이/가')} 필요한 기운이라 배우자 자리가 균형을 도와줍니다.`
        : `${tm('일지')}의 ${tm('오행')} ${jo(elLabel(dayEl), '이/가')} 피하는 게 좋은 기운이라 배우자 자리에서 마음 쓸 일이 생기기 쉽습니다.`,
      ev: `일지 오행 ${elLabel(dayEl)} = ${ROLE_KO[role]}`, brief: good ? '배우자 자리가 필요한 기운' : '배우자 자리가 피할 기운',
    });
  }

  // 주제
  const t: Record<string, number> = {};
  const add = (id: string, w: number): void => {
    t[id] = (t[id] ?? 0) + w;
  };
  if (dg === sg && ['정재', '정관'].includes(a.spouse.dayBranchGod)) add('warm', 1);
  if (dg === '인성') add('warm', 0.8);
  if (dg === sg && ['편재', '편관'].includes(a.spouse.dayBranchGod)) add('passion', 0.9);
  if (v >= 0.3) add('passion', 0.8);
  if (a.dayStage === '목욕') add('passion', 0.5);
  if (band === 'none') add('late', 1);
  if (dg === '비겁') {
    add('distance', 0.9);
    add('conflict', 0.5);
  }
  if (band === 'none' || band === 'low') add('distance', 0.4);
  if (hasStructure(a, 'gwanSalHonJap') && a.gender === 'F') add('unsettled', 0.8);
  if (hasStructure(a, 'jaeDaSinYak') && a.gender === 'M') add('unsettled', 0.6);
  hits[0].themes = t;
  return hits;
};

// ── 건강 ─────────────────────────────────────────────────────────────────────
const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const healthHits = (a: SajuAnalysis): Hit[] => {
  const hits: Hit[] = [];
  const g = a.energy.byGroup;
  const dist = ELEMENT_ORDER.map((e) => `${ELEMENT_KO[e]}${a.counts[e]}`).join(' ');
  const maxEl = ELEMENT_ORDER.reduce((best, e) => (a.counts[e] > a.counts[best] ? e : best), ELEMENT_ORDER[0]);
  const maxN = a.counts[maxEl];
  const missing = ELEMENT_ORDER.filter((e) => a.counts[e] === 0);

  hits.push({
    rule: 'S-HE0', delta: 0, kind: 'core', label: '오행 분포',
    text: `사주의 ${a.hourKnown ? '여덟' : '여섯'} 글자를 ${tj('오행', '으로/로')} 나누면 ${ELEMENT_ORDER.map((e) => `${ELEMENT_KO[e]} ${a.counts[e]}`).join(' · ')}입니다.`,
    ev: `오행 분포 ${dist}`, brief: '오행 분포',
  });

  if (maxN >= 4) {
    hits.push({
      rule: 'S-HE1', delta: maxN >= 5 ? -0.7 : -0.3, kind: 'balance', label: '한쪽으로 쏠린 기운',
      text: `${elLabel(maxEl)} 기운이 ${maxN}개로 ${maxN >= 5 ? '크게 쏠려 있습니다' : '많은 편입니다'}. ${ELEMENT_BODY[maxEl]} 쪽을 꾸준히 살피세요.`,
      ev: `최다 오행 ${elLabel(maxEl)} ${maxN}개`, brief: `${ELEMENT_KO[maxEl]} 기운이 쏠림`, themes: { watch: 0.8, stress: maxEl === 'fire' ? 0.8 : 0.3 },
    });
  }
  if (missing.length > 0) {
    const shown = missing.slice(0, 2);
    hits.push({
      rule: 'S-HE2', delta: Math.max(-0.6, -0.3 * missing.length), kind: 'balance', label: '모자란 기운',
      text: `${dot(shown.map((e) => elLabel(e)))} 기운이 없어 ${dot(shown.map((e) => ELEMENT_BODY[e]))} 쪽이 약해지기 쉽다고 봅니다.`,
      ev: `없는 오행 ${missing.map((e) => elLabel(e)).join('·')}`, brief: `${missing.map((e) => ELEMENT_KO[e]).join('·')} 기운이 없음`, themes: { watch: 0.7 },
    });
  }
  if (a.season.cold || a.season.hot) {
    hits.push({
      rule: 'S-HE3', delta: -0.4, kind: 'balance', label: '계절의 치우침',
      text: a.season.cold ? '겨울에 태어나 몸이 차가워지기 쉽습니다. 따뜻하게 지내세요.' : '여름에 태어나 열이 쌓이기 쉽습니다. 수분과 휴식을 챙기세요.',
      ev: `월지 ${MONTH_SEASON[a.season.branch]} + ${a.season.cold ? '수' : '화'} ${a.counts[a.season.cold ? 'water' : 'fire']}개`, brief: a.season.cold ? '몸이 차가워지기 쉬움' : '열이 쌓이기 쉬움', themes: { stress: 0.8 },
    });
  }
  if (a.strength.extreme) {
    hits.push({
      rule: 'S-HE4', delta: -0.4, kind: 'balance', label: '힘의 쏠림',
      text: a.strength.extreme === 'weak' ? '힘이 많이 약한 편이라 쉬는 시간이 중요합니다.' : '힘이 넘치는 편이라 한꺼번에 몰아 쓰다 지치기 쉽습니다.',
      ev: `도움 지수 ${pct(a.strength.index)} (분포 극단)`, brief: a.strength.extreme === 'weak' ? '힘이 많이 약함' : '힘이 넘쳐 지치기 쉬움', themes: { tired: 1 },
    });
  }
  const jiChung = [...has(a, 'chung', 'day'), ...has(a, 'chung', 'month')];
  if (jiChung.length > 0) {
    hits.push({
      rule: 'S-HE5', delta: -0.4, kind: 'relation', label: '흔들리는 리듬',
      text: `${tm('일지')}나 ${tm('월지')}가 다른 ${tm('지지')}와 ${tm('충')}해 생활 리듬이 흔들리기 쉬우니 무리하거나 다치지 않게 조심하세요.`,
      ev: `일지·월지의 충 ${jiChung.length}건`, brief: '생활 리듬이 흔들림', themes: { stress: 0.9, accident: 0.4 },
    });
  }
  if (missing.length === 0 && maxN <= 3 && a.strength.cls !== 'weak' && !a.strength.extreme) {
    hits.push({
      rule: 'S-HE6', delta: 0.6, kind: 'balance', label: '고른 바탕',
      text: `다섯 ${tj('오행', '이/가')} 고르고 힘이 알맞아 체력의 바탕이 안정적입니다.`,
      ev: `오행 고름(최다 ${maxN}개, 결핍 없음) + 힘 ${a.strength.cls}`, brief: '오행이 고르고 힘이 알맞음', themes: { sturdy: 1 },
    });
  }
  if (g.식상 >= 0.4) {
    hits.push({
      rule: 'S-HE7', delta: -0.3, kind: 'balance', label: '기운을 쓰는 일이 많음',
      text: `${tj('식상', '이/가')} 많아 기운을 쓰는 일이 많습니다. 과로하지 않게 쉬세요.`,
      ev: `식상 ${pct(g.식상)}`, brief: '기운을 쓰는 일이 많음', themes: { tired: 0.9 },
    });
  }
  const sd = ['장생', '관대', '건록', '제왕'].includes(a.dayStage) ? 0.3 : ['병', '사', '절'].includes(a.dayStage) ? -0.3 : 0;
  if (sd !== 0) {
    hits.push({
      rule: 'S-HE8', delta: sd, kind: 'support', label: '뿌리의 힘',
      text: sd > 0 ? `${tm('일지')}에서 ${tm('일간')}의 뿌리가 단단해 체력의 바탕이 받쳐 줍니다.` : `${tm('일지')}에서 ${tm('일간')}의 뿌리가 약해 에너지 관리가 중요합니다.`,
      ev: `일지에서 일간의 12운성 = ${stageLabel(a.dayStage)}`, brief: sd > 0 ? '일간의 뿌리가 단단' : '일간의 뿌리가 약함', themes: sd > 0 ? { sturdy: 0.7 } : { tired: 0.6 },
    });
  }
  if (has(a, 'chung').length > 0 && (a.energy.byGod.편관 >= 0.2 || a.gyeok.name === '양인격')) {
    hits.push({
      rule: 'S-HE9', delta: 0, kind: 'tension' as PointKind, label: '다침 주의',
      text: `강한 기운과 ${tm('충')}이 겹쳐 있어 급한 움직임과 운동에서 다치지 않게 주의하세요.`,
      ev: `충 ${has(a, 'chung').length}건 + (편관 ${pct(a.energy.byGod.편관)} 또는 양인격)`, brief: '다침에 주의', themes: { accident: 1 },
    });
  }
  hits[0].themes = { sturdy: 0 };
  return hits;
};

// ── 대인·가족 ────────────────────────────────────────────────────────────────
const peopleHits = (a: SajuAnalysis): Hit[] => {
  const hits: Hit[] = [];
  const g = a.energy.byGroup;
  const d = a.energy.byGod;
  const bi = g.비겁;
  const inn = g.인성;

  const biText: [number, string, string, string] =
    bi < 0.03 ? [-0.4, `${tj('비겁', '이/가')} 거의 없습니다.`, '형제·동료의 도움보다 혼자 해내는 편입니다.', '비겁이 거의 없음']
      : bi < 0.1 ? [-0.1, `${tj('비겁', '이/가')} 적은 편입니다.`, '형제·동료와 적당한 거리를 두고 지냅니다.', '비겁이 적은 편']
        : bi < 0.3 ? [0.4, `${tj('비겁', '이/가')} 알맞습니다.`, '서로 돕는 동료·형제 인연이 있습니다.', '비겁이 알맞음']
          : bi < 0.4 ? [-0.2, `${tj('비겁', '이/가')} 많은 편입니다.`, '경쟁과 나눔도 따릅니다.', '비겁이 많은 편']
            : [-0.5, `${tj('비겁', '이/가')} 매우 많습니다.`, '경쟁과 구설에 신경 쓰세요.', '비겁이 매우 많음'];
  hits.push({ rule: 'S-PE1', delta: biText[0], kind: 'core', label: '동료·형제', text: `${biText[1]} ${biText[2]}`, ev: `비겁 비중 ${pct(bi)}`, brief: biText[3] });

  const inText: [number, string, string, string] | null =
    inn < 0.03 ? [-0.3, `${tj('인성', '이/가')} 거의 없습니다.`, '보호막이 얇아 스스로 기댈 곳을 만들어야 합니다.', '인성이 거의 없음']
      : inn >= 0.1 && inn < 0.4 ? [0.4, `${tj('인성', '이/가')} 알맞습니다.`, '윗사람·부모의 보호와 배움이 따릅니다.', '인성이 알맞음']
        : inn >= 0.4 ? [-0.2, `${tj('인성', '이/가')} 많은 편입니다.`, '의존하거나 생각이 많아지기 쉽습니다.', '인성이 많은 편']
          : null;
  if (inText) hits.push({ rule: 'S-PE2', delta: inText[0], kind: 'core', label: '윗사람·보호', text: `${inText[1]} ${inText[2]}`, ev: `인성 비중 ${pct(inn)}`, brief: inText[3] });

  if (a.noble.length > 0) {
    hits.push({ rule: 'S-PE3', delta: 0.4, kind: 'support', label: '귀인', text: `${tj('천을귀인', '이/가')} 있어 어려울 때 도와주는 사람이 나타나기 쉽습니다.`, ev: `천을귀인 글자가 ${a.noble.map((p) => POS_KO[p]).join('·')}에 있음`, brief: '귀인의 도움', themes: { helpers: 1 } });
  }
  const he = [...has(a, 'yukHe'), ...has(a, 'samHe'), ...has(a, 'banHe'), ...has(a, 'bangHe')];
  if (he.length > 0) {
    hits.push({ rule: 'S-PE4', delta: 0.3, kind: 'relation', label: '묶이는 인연', text: `${tm('지지')}가 서로 ${tm('합')}해 협력하고 묶이는 인연이 있습니다.`, ev: `합 ${he.length}건`, brief: '협력하고 묶이는 인연', themes: { wide: 0.7, helpers: 0.4 } });
  }
  const ch = has(a, 'chung');
  const monthCh = has(a, 'chung', 'month');
  if (ch.length >= 2) {
    hits.push({ rule: 'S-PE5', delta: -0.5, kind: 'relation', label: '잦은 변동', text: `${tj('충', '이/가')} 여러 곳에 있어 관계의 변동이 잦은 편입니다.`, ev: `충 ${ch.length}건`, brief: '관계의 변동이 잦음', themes: { tension: 1 } });
  } else if (monthCh.length > 0) {
    hits.push({ rule: 'S-PE5', delta: -0.3, kind: 'relation', label: '월지의 충', text: `${tm('월주')}의 ${tm('지지')}가 ${tm('충')}해 형제·직장 쪽 마찰이 생기기 쉽습니다.`, ev: '월지의 충 1건', brief: '형제·직장과 마찰', themes: { tension: 0.9 } });
  }
  if (hasStructure(a, 'gwanSalHonJap')) {
    hits.push({ rule: 'S-PE6', delta: -0.2, kind: 'pattern', label: '윗사람과의 관계', text: `${tj('관살혼잡', '이라/라')} 윗사람·조직과의 관계가 복잡해지기 쉽습니다.`, ev: `정관 ${pct(d.정관)} · 편관 ${pct(d.편관)}`, brief: '윗사람과의 관계가 복잡', themes: { tension: 0.6 } });
  }
  if (g.식상 >= 0.1 && g.식상 < 0.35) {
    hits.push({ rule: 'S-PE7', delta: 0.2, kind: 'support', label: '표현의 힘', text: `${tj('식상', '이/가')} 알맞아 말과 표현으로 사람을 모으는 힘이 있습니다.`, ev: `식상 비중 ${pct(g.식상)}`, brief: '표현으로 사람을 모음', themes: { wide: 0.9 } });
  }

  const t: Record<string, number> = {};
  const add = (id: string, w: number): void => {
    t[id] = (t[id] ?? 0) + w;
  };
  if (inn >= 0.1 && inn < 0.4) add('helpers', 0.8);
  if (inn >= 0.1 && inn < 0.4 && bi >= 0.1 && bi < 0.3) add('close', 0.9);
  if (bi >= 0.3 || hasStructure(a, 'gunGeopJaengJae')) add('rivals', 1);
  if (bi < 0.1 && inn < 0.1) add('solo', 1);
  hits[0].themes = t;
  return hits;
};

// ── 영역 조립 ────────────────────────────────────────────────────────────────
const round2 = (v: number): number => Math.round(v * 100) / 100;

const topThemes = (domain: Domain, hits: Hit[]): string[] => {
  const w: Record<string, number> = {};
  for (const h of hits) for (const [id, v] of Object.entries(h.themes ?? {})) w[id] = (w[id] ?? 0) + v;
  const order = Object.keys(THEMES[domain]);
  return Object.entries(w)
    .filter(([id, v]) => v > 0 && order.includes(id))
    .sort((x, y) => y[1] - x[1] || order.indexOf(x[0]) - order.indexOf(y[0]))
    .slice(0, 3)
    .map(([id]) => id);
};

const MAX_POINTS = 7;

export const assembleSajuDomain = (domain: Domain, hits: Hit[]): DomainReading => {
  const score = round2(hits.reduce((s, h) => s + h.delta, 0));
  const level: Level = levelOf(score, SAJU_CUTS[domain]);
  const withText = hits.filter((h) => h.text);
  // 영향이 작은 문장부터 덜어 내되, 앞쪽 두 문장(핵심)은 항상 둔다
  const keep = new Set(withText.slice(0, 2));
  const rest = withText.slice(2).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, MAX_POINTS - 2);
  rest.forEach((h) => keep.add(h));
  const points: Point[] = withText.filter((h) => keep.has(h)).map((h) => ({ kind: h.kind, label: h.label, text: h.text as string }));
  const reasons: Reason[] = hits
    .filter((h) => h.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .map((h) => ({ rule: h.rule, brief: autoMark(h.brief), delta: h.delta }));
  const evidence: Evidence[] = hits.map((h) => ({ rule: h.rule, text: `${h.ev}${h.delta !== 0 ? ` → ${signed(h.delta)}` : ''}` }));
  evidence.push({ rule: 'S-SUM', text: `영역 점수 합계 ${signed(score)} → 단계 ${LEVEL_LABEL[level]}` });
  const themes = topThemes(domain, hits);
  return {
    system: 'saju',
    domain,
    level,
    score,
    title: `${DOMAIN_LABEL[domain]} — ${LEVEL_LABEL[level]}`,
    verdict: verdictWithThemes(domain, level, themes),
    points,
    themes,
    advice: adviceOf(domain, level),
    reasons,
    evidence,
  };
};

export const sajuDomainHits = (a: SajuAnalysis, b: SajuBasis): Record<Domain, Hit[]> => ({
  self: selfHits(a, b),
  wealth: wealthHits(a, b),
  career: careerHits(a, b),
  love: loveHits(a, b),
  health: healthHits(a),
  people: peopleHits(a),
});

// ── 대운 ─────────────────────────────────────────────────────────────────────
const ROLE_SCORE: Record<YongRole, number> = { yong: 2, hee: 1, han: 0, gu: -1, gi: -2 };
const GROUP_DOMAIN: Record<TenGodGroup, Domain> = { 재성: 'wealth', 관성: 'career', 인성: 'self', 식상: 'career', 비겁: 'people' };
const PERIOD_LINE: Record<Level, string> = {
  2: '필요한 기운이 겹쳐 흐름이 가장 순한 시기입니다.',
  1: '균형에 도움이 되는 기운이 들어오는 편안한 시기입니다.',
  0: '특별히 돕지도 방해하지도 않는 무난한 시기입니다.',
  [-1]: '균형을 흔드는 기운이 섞여 신경 쓸 일이 생기기 쉬운 시기입니다.',
  [-2]: '피하는 게 좋은 기운이 겹쳐 특히 조심해야 하는 시기입니다.',
} as Record<Level, string>;
const GROUP_PERIOD: Record<TenGodGroup, string> = {
  재성: '재물과 현실의 일이 커지는 시기입니다.',
  관성: '직장과 책임, 직위의 변화가 크게 다가오는 시기입니다.',
  인성: '배움과 문서, 윗사람의 도움이 늘어나는 시기입니다.',
  식상: '재능과 표현을 펼치고 활동이 늘어나는 시기입니다.',
  비겁: '동료와 협력하고 경쟁하는 일이 늘어나는 시기입니다.',
};

export const readDaeun = (saju: SajuChart, a: SajuAnalysis, b: SajuBasis): PeriodReading[] => {
  const list: PeriodReading[] = saju.daeun.list.map((item) => {
    const branchChar = item.ganzhi[1];
    const branchIdx = '子丑寅卯辰巳午未申酉戌亥'.indexOf(branchChar);
    const stemIdx = '甲乙丙丁戊己庚辛壬癸'.indexOf(item.ganzhi[0]);
    const stemEl = (['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'] as Element[])[stemIdx];
    const branchEl = BRANCH_ELEMENT[branchIdx];
    const sRole = a.yong.roles[stemEl];
    const bRole = a.yong.roles[branchEl];
    let score = (ROLE_SCORE[sRole] + ROLE_SCORE[bRole]) / 2;
    const notes: string[] = [];
    const evidence: Evidence[] = [
      { rule: 'S-DA1', text: `대운 ${item.ganzhi}: 천간 ${elLabel(stemEl)} = ${ROLE_KO[sRole]}(${signed(ROLE_SCORE[sRole], 0)}), 지지 ${elLabel(branchEl)} = ${ROLE_KO[bRole]}(${signed(ROLE_SCORE[bRole], 0)}) → 평균 ${signed(score)}` },
    ];
    if (branchIdx >= 0 && (branchIdx - b.day.branch + 12) % 12 === 6) {
      score -= 0.5;
      notes.push(`이 ${tm('대운')}의 ${tm('지지')}가 ${tm('일지')}와 ${tm('충')}해 환경과 인연의 변화가 큽니다.`);
      evidence.push({ rule: 'S-DA2', text: `대운 지지가 일지와 충 → ${signed(-0.5)}` });
    } else if (branchIdx >= 0 && ((branchIdx + b.day.branch) % 12 === 1 || [[2, 11], [3, 10], [4, 9], [5, 8], [6, 7]].some(([x, y]) => (x === branchIdx && y === b.day.branch) || (y === branchIdx && x === b.day.branch)))) {
      score += 0.3;
      notes.push(`이 ${tm('대운')}의 ${tm('지지')}가 ${tm('일지')}와 ${tm('합')}해 인연이 묶이고 안정되기 쉽습니다.`);
      evidence.push({ rule: 'S-DA3', text: `대운 지지가 일지와 육합 → ${signed(0.3)}` });
    }
    score = round2(score);
    const level = levelOf(score, SAJU_PERIOD_CUTS);
    const groups = Array.from(new Set([TEN_GOD_GROUP[item.stemGod], TEN_GOD_GROUP[item.branchGod]]));
    const highlights = Array.from(new Set<Domain>([...groups.map((g) => GROUP_DOMAIN[g]), ...(groups.includes(a.spouse.group) ? (['love'] as Domain[]) : [])]));
    const main = TEN_GOD_GROUP[item.stemGod];
    const extra: string[] = [];
    if (stemEl === a.yong.element || branchEl === a.yong.element) extra.push(`${tm('용신')}인 ${elLabel(a.yong.element)} 기운이 들어오는 ${tm('대운')}입니다.`);
    if (groups.includes(a.spouse.group)) extra.push('이 시기의 기운은 배우자를 뜻하기도 해, 연애·결혼도 두드러지기 쉽습니다.');
    evidence.push({ rule: 'S-DA4', text: `대운 십성 ${item.stemGod}·${item.branchGod} → 강조 ${highlights.map((d) => DOMAIN_LABEL[d]).join('·')}` });
    evidence.push({ rule: 'S-DA5', text: `합계 ${signed(score)} → 단계 ${LEVEL_LABEL[level]}` });
    return {
      system: 'saju' as const,
      label: `${item.ko}(${item.ganzhi}) 대운`,
      startAge: item.startAge,
      endAge: item.endAge,
      startYear: item.startYear,
      endYear: item.startYear + 9,
      level,
      score,
      fine: score,
      headline: [PERIOD_LINE[level], GROUP_PERIOD[main], ...extra, ...notes].join(' '),
      highlights,
      evidence,
    };
  });
  markStanding(list, STANDING_MIN_SPREAD.saju);
  return list;
};

// ── 총평 ─────────────────────────────────────────────────────────────────────
export interface SajuTongbyeon {
  analysis: SajuAnalysis;
  overview: Overview;
  domains: Record<Domain, DomainReading>;
  daeun: PeriodReading[];
  /** 대운끼리 차이가 작아 가장 나은 때·신경 쓸 때를 짚지 않았을 때의 안내 */
  daeunNote?: string;
}

const strengthWord = (a: SajuAnalysis): string => (a.strength.cls === 'strong' ? '{{신강}}' : a.strength.cls === 'weak' ? '{{신약}}' : '{{중화}}');

export const buildSajuOverview = (a: SajuAnalysis, b: SajuBasis, domains: Record<Domain, DomainReading>): Overview => {
  const g = a.gyeok;
  const y = a.yong;
  const headline = `${stemLabel(a.dayStem)} ${tm('일간')}의 ${strengthWord(a)} 사주이며, ${tj('격국', '은/는')} ${gyeokLabel(g.name)}, ${tj('용신', '은/는')} ${elLabel(y.element)}입니다.`;

  const paragraphs: Overview['paragraphs'] = [];
  const self = domains.self;
  paragraphs.push({ label: '바탕', sentences: self.points.slice(0, 1).map((p) => p.text).concat([`${MONTH_SEASON[b.month.branch]}에 태어난 사주입니다.`]) });
  paragraphs.push({ label: '힘의 세기', sentences: (self.points.find((p) => p.label === '힘의 세기')?.text ?? '').split(/(?<=[.!?])\s+/).concat([self.points.find((p) => p.label === '태어난 달의 도움')?.text ?? '']).filter(Boolean) });
  paragraphs.push({ label: '격국(큰 틀)', sentences: [`${tj('격국', '은/는')} ${gyeokLabel(g.name)}입니다.`, GYEOK_LINE[g.name], GYEOK_NOTE_LINE[g.note]] });

  const yongLines: string[] = [];
  if (y.method === 'johu') yongLines.push(a.season.cold ? `겨울에 물이 많은 사주라 따뜻한 ${tm('조후')} 기운이 먼저 필요합니다.` : `여름에 불이 많은 사주라 식혀 주는 ${tm('조후')} 기운이 먼저 필요합니다.`);
  else if (y.method === 'eokbu') yongLines.push(a.strength.cls === 'strong' ? '힘이 센 사주라 힘을 덜어 내거나 눌러 주는 기운이 필요합니다.' : '힘이 약한 사주라 힘을 보태 주는 기운이 필요합니다.');
  else yongLines.push(`균형이 잡힌 사주라 가장 모자란 ${tm('오행')}을 채우는 쪽으로 봅니다.`);
  const hee = (['wood', 'fire', 'earth', 'metal', 'water'] as Element[]).find((e) => y.roles[e] === 'hee') as Element;
  const gi = (['wood', 'fire', 'earth', 'metal', 'water'] as Element[]).find((e) => y.roles[e] === 'gi') as Element;
  yongLines.push(`${tj('용신', '은/는')} ${elLabel(y.element)} 기운입니다. ${tj('희신', '은/는')} ${elLabel(hee)}, 피하는 게 좋은 ${tj('기신', '은/는')} ${elLabel(gi)}입니다.`);
  if (y.secondary) yongLines.push(`힘의 균형만 보면 ${jo(elLabel(y.secondary.element), '이/가')} 필요하지만 계절을 먼저 맞췄습니다.`);
  yongLines.push(`${tm('용신')}은 보는 방법에 따라 전문가마다 다르게 잡기도 합니다.`);
  paragraphs.push({ label: '필요한 기운(용신)', sentences: yongLines });

  const structs = STRUCTURE_ORDER.filter((id) => a.structures.some((s) => s.id === id)).slice(0, 3);
  if (structs.length > 0) paragraphs.push({ label: '십성 구조(기운끼리의 짜임)', sentences: structs.map((id) => STRUCTURE_LINE[id]) });

  const rel = relationSentences(a.relations, 3).map((x) => x);
  if (rel.length > 0) paragraphs.push({ label: '글자끼리의 관계', sentences: rel });

  // 영역별 구체적인 조언은 아래 영역 카드에 있다. 여기서는 용신과 방향만 말한다
  const bestSet = bestDomains(domains);
  const worstSet = worstDomains(domains);
  const advice = [
    `${tm('용신')}인 ${elLabel(y.element)} 기운이 들어오는 해와 ${tm('대운')}에 중요한 일을 준비하면 흐름을 타기 쉽다고 봅니다. 10년 운마다 들어오는지는 아래 흐름에서 볼 수 있습니다.`,
    spreadAdvice(bestSet, worstSet) ?? '영역마다 크게 앞서거나 처지는 곳이 없으니, 하고 싶은 일부터 차근차근 시작해 보세요.',
  ];

  const keywords = [strengthWord(a), gyeokLabel(g.name), `${tm('용신')} ${ELEMENT_KO[y.element]}`, ...structs.slice(0, 2).map((id) => STRUCTURE_KEYWORD[id])];

  const evidence: Evidence[] = [
    { rule: 'S-OV1', text: `기운 분포 ${(['비겁', '식상', '재성', '관성', '인성'] as TenGodGroup[]).map((k) => `${k} ${pct(a.energy.byGroup[k])}`).join(' · ')}` },
    { rule: 'S-OV2', text: `도움 지수 ${pct(a.strength.index)} → ${a.strength.cls}${a.strength.deukryeong ? ' · 득령' : ''}` },
    { rule: 'S-OV3', text: `격국 ${g.name} (${g.status}) · 용신 ${elLabel(y.element)} (${y.method})` },
  ];
  return { headline, keywords, paragraphs, advice, evidence };
};

/** 기둥이 전통적으로 뜻하는 자리 */
const PILLAR_AREA: Record<PillarPos, string> = { year: '초년·조상', month: '직장·부모', day: '나·배우자', hour: '자녀·말년' };

const KIND_ORDER: RelationKind[] = ['chung', 'yukHe', 'samHe', 'banHe', 'bangHe', 'stemHe', 'stemChung'];

/** 글자끼리의 관계를 종류별로 묶어 문장으로 쓴다(같은 종류가 여러 개여도 한 문장). 일주·월주가 낀 것을 먼저 */
export const relationSentences = (relations: RelationHit[], max = 3): string[] => {
  const weight = (r: RelationHit): number => (r.pos.includes('day') ? 0 : r.pos.includes('month') ? 1 : 2);
  const out: string[] = [];
  const keyOf = (r: RelationHit): string => `${r.pos.join('-')}:${r.element}`;
  const yuk = relations.filter((r) => r.kind === 'yukHe');
  const stemHe = relations.filter((r) => r.kind === 'stemHe');
  // 같은 두 기둥이 천간도 지지도 합하면 한 문장으로 말한다
  const both = stemHe.length > 0 && stemHe.every((r) => yuk.some((y) => keyOf(y) === keyOf(r)));
  for (const kind of KIND_ORDER) {
    const group = relations.filter((r) => r.kind === kind).sort((x, y) => weight(x) - weight(y));
    if (group.length === 0) continue;
    if (both && kind === 'stemHe') continue;
    const names = (r: RelationHit): string => dot(r.pos.map((p) => tm(POS_KO[p])));
    const single = group.length === 1;
    const listOf = (f: (r: RelationHit) => string): string => `${group.slice(0, 2).map(f).join(', ')}${group.length > 2 ? ' 등' : ''}`;
    const areas = (r: RelationHit): string => `${josa(PILLAR_AREA[r.pos[0]], '과/와')} ${PILLAR_AREA[r.pos[1]]}`;
    // 같은 종류의 관계가 여럿이어도 기운이 모두 같을 때만 그 기운을 말한다(‘기운’ 뒤에는 받침이 있어 으로·이·을)
    const elems = Array.from(new Set(group.map((r) => r.element)));
    const kiun = elems.length === 1 ? `${elLabel(elems[0] as Element)} 기운` : '각각의 기운';
    switch (kind) {
      case 'chung':
        out.push(`${listOf(names)}의 ${tm('지지')}가 서로 ${tm('충')}합니다. ${single ? `${areas(group[0])} 쪽에서` : '그 기둥이 뜻하는 자리에서'} 변동이 생기기 쉽습니다.`);
        break;
      case 'yukHe':
        out.push(
          both
            ? `${tm('천간')}과 ${tm('지지')}가 모두 ${tm('합')}해 ${listOf(names)}에서 ${kiun}으로 단단히 묶입니다. ${single ? `${areas(group[0])} 쪽에서` : '그 기둥끼리'} 협력이 쉽습니다.`
            : `${tm('지지')}의 ${tm('합')}이 ${listOf(names)} 사이에 있어 ${kiun}으로 묶입니다. ${single ? `${areas(group[0])} 쪽에서` : '그 기둥끼리'} 협력이 쉽습니다.`,
        );
        break;
      case 'samHe':
        out.push(`${tm('지지')}의 ${tm('합')}으로 ${listOf(names)}에 ${kiun}이 크게 모입니다.`);
        break;
      case 'banHe':
        out.push(`${tm('지지')}의 반쯤 이루어진 ${tm('합')}이 ${listOf(names)} 사이에 있어 ${kiun}이 모이려 합니다.`);
        break;
      case 'bangHe':
        out.push(`${listOf(names)}의 ${tm('지지')}가 같은 계절로 모여 ${kiun}이 강해집니다.`);
        break;
      case 'stemHe':
        out.push(`${listOf(names)}의 ${tm('천간')}이 서로 이끌려 ${kiun}을 띱니다.`);
        break;
      default:
        out.push(`${listOf(names)}의 ${tm('천간')}이 서로 부딪힙니다. 말과 생각의 충돌이 생기기 쉽습니다.`);
    }
  }
  return out.slice(0, max);
};

export const readSaju = (saju: SajuChart, gender: 'M' | 'F'): SajuTongbyeon => {
  const b: SajuBasis = { year: saju.year, month: saju.month, day: saju.day, hour: saju.hour };
  const analysis = analyzeSaju(b, gender);
  const hits = sajuDomainHits(analysis, b);
  const domains = Object.fromEntries(DOMAINS.map((d) => [d, assembleSajuDomain(d, hits[d])])) as Record<Domain, DomainReading>;
  const daeun = readDaeun(saju, analysis, b);
  return { analysis, overview: buildSajuOverview(analysis, b, domains), domains, daeun, daeunNote: flatNoteOf(daeun) };
};

export { HIDDEN_STEMS, stageOf };
