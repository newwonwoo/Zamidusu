// 사주 대응 문장. “사주에서는 이 칸을 어떻게 보는지 → 이 사주의 값 → 그래서 어떤 편인지”의 순서로 쓴다.
// 개수는 ‘하나도 없습니다 / 적은 편 / 보통 / 많은 편’으로 풀어 쓰고, 뜻은 범주의 일반적인 의미까지만 말한다.
// (재물·직업·배우자 등을 사주와 자미두수가 어떻게 엇갈리는지 비교하는 교차 보기 2단계 = N-05 는 승인 대기 범위다.)
// 모든 문장은 이 프로젝트에서 새로 작성했다. 어조: 단정하지 않고 “~로 봅니다”.

import { BRANCHES, BRANCHES_KO, ELEMENT_KO, STEMS, STEMS_KO } from '../ganzhi';
import type { Element } from '../ganzhi';
import type { PalaceKey } from '../names';
import { CHEONEUL_BRANCHES, MUNCHANG_BRANCH, lokBranchOf, yeokmaBranchOf } from '../saju';
import type { SajuChart, TenGodGroup } from '../saju';
import { josa } from './korean';
import { PALACES } from './palaces';

/** {{용어}} + 조사 (조사는 용어 기준으로 고른다) */
const tj = (word: string, type: Parameters<typeof josa>[1]): string => `{{${word}}}${josa(word, type).slice(word.length)}`;

const stemLabel = (s: number): string => `${STEMS_KO[s]}(${STEMS[s]})`;
const branchLabel = (b: number): string => `${BRANCHES_KO[b]}(${BRANCHES[b]})`;

// ── 개수를 말로 ──────────────────────────────────────────────────────────────
export type Level = 'none' | 'low' | 'mid' | 'high';
export const levelOf = (n: number): Level => (n <= 0 ? 'none' : n === 1 ? 'low' : n === 2 ? 'mid' : 'high');
const LEVEL_WORD: Record<Exclude<Level, 'none'>, string> = { low: '적은 편입니다', mid: '보통입니다', high: '많은 편입니다' };
/** “하나도 없습니다 / 1개로 적은 편입니다 / 2개로 보통입니다 / 3개로 많은 편입니다” */
export const countPhrase = (n: number): string => (n <= 0 ? '하나도 없습니다' : `${n}개로 ${LEVEL_WORD[levelOf(n) as Exclude<Level, 'none'>]}`);
const isHigh = (n: number): boolean => n >= 2;

const count = (saju: SajuChart, g: TenGodGroup): number => saju.godCounts[g];

// ── 일간(나)의 이미지와 태어난 달의 계절 ───────────────────────────────────────
const STEM_IMAGE = [
  '곧게 뻗는 큰 나무처럼 곧고 진취적인',
  '풀과 덩굴처럼 부드럽고 끈질긴',
  '해처럼 밝고 열정적인',
  '촛불처럼 따뜻하고 섬세한',
  '큰 산처럼 묵직하고 믿음직한',
  '논밭의 흙처럼 포용력 있고 가꾸는',
  '바위처럼 단단하고 결단력 있는',
  '보석처럼 섬세하고 깔끔한',
  '큰 강물처럼 넓고 자유로운',
  '비와 이슬처럼 조용하고 감수성이 풍부한',
];
/** 월지(子丑寅…)별 계절 */
const MONTH_SEASON = [
  '한겨울', '늦겨울', '초봄', '한봄', '늦봄', '초여름', '한여름', '늦여름', '초가을', '한가을', '늦가을', '초겨울',
];

// ── 오행과 몸 ────────────────────────────────────────────────────────────────
const ELEMENT_BODY: Record<Element, string> = {
  wood: '간·눈·근육', fire: '심장·혈액순환', earth: '위장·소화기', metal: '폐·호흡기·피부', water: '신장·방광·뼈',
};
const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

// ── 뜻(범주의 일반적인 의미) ──────────────────────────────────────────────────
// 개수를 말로 푼 단계(없음/적은 편/보통/많은 편)와 같은 4단계로 적어, 앞 문장과 뜻이 어긋나지 않게 한다.
type ByLevel = Record<Level, string>;
const SIBLINGS: ByLevel = {
  none: '형제·동료의 도움을 기대하기보다 혼자 해내는 편으로 봅니다.',
  low: '형제·동료와 적당한 거리를 두고 지내는 편으로 봅니다.',
  mid: '형제·동료와 서로 돕고 의지하는 관계로 봅니다.',
  high: '형제·동료 인연이 풍부하지만 경쟁이나 나눔도 따른다고 봅니다.',
};
const SPOUSE: ByLevel = {
  none: '배우자의 신호가 사주에 드러나지 않아, 인연이 늦거나 운이 바뀌는 시기에 들어온다고 보기도 합니다.',
  low: '배우자 인연의 신호가 하나 있어, 한 사람과 깊게 이어지는 편으로 봅니다.',
  mid: '배우자 인연을 뜻하는 기운이 뚜렷한 편으로 봅니다.',
  high: '배우자 기운이 많아 이성 인연이 다양하다고 보기도 하니, 한 사람에게 마음을 모으는 것이 과제입니다.',
};
const CHILDREN: ByLevel = {
  none: '자녀의 신호가 사주에 드러나지 않아, 인연이 늦거나 운이 바뀌는 시기에 들어온다고 보기도 합니다.',
  low: '자녀 인연의 신호가 하나 있어, 자녀와 깊게 이어지는 편으로 봅니다.',
  mid: '자녀 인연을 뜻하는 기운이 뚜렷한 편으로 봅니다.',
  high: '자녀의 기운이 많아 자녀나 아랫사람에게 마음을 많이 쓰는 편으로 봅니다.',
};
const WEALTH: ByLevel = {
  none: '재물 기운이 사주에 없어, 돈은 꾸준한 노력과 시기의 흐름에 더 좌우된다고 봅니다.',
  low: '재물 기운이 작지만 있어, 꾸준히 모으는 쪽으로 봅니다.',
  mid: '재물 기운이 적당히 있어 안정적으로 벌고 쓰는 쪽으로 봅니다.',
  high: '재물 기운이 풍부한 편이지만 쓰임도 크니 관리가 중요하다고 봅니다.',
};
const PROPERTY: ByLevel = {
  none: '집안의 도움이 적어 스스로 터전을 만들어 가는 편으로 봅니다.',
  low: '집안의 도움은 작지만 있어, 스스로의 노력이 더 크게 작용한다고 봅니다.',
  mid: '집안의 도움과 스스로의 노력이 균형을 이루는 편으로 봅니다.',
  high: '보호받는 환경이지만, 스스로 서는 연습도 필요하다고 봅니다.',
};
const PARENTS: ByLevel = {
  none: '부모·윗사람의 도움이 적어 스스로 배우고 준비하는 편으로 봅니다.',
  low: '부모·윗사람의 도움은 작지만 있어, 스스로 준비하는 몫이 더 크다고 봅니다.',
  mid: '부모·윗사람의 도움을 적당히 받는 편으로 봅니다.',
  high: '부모·윗사람의 보호와 가르침을 많이 받는 편으로 봅니다.',
};
const FRIENDS_PEER: ByLevel = {
  none: '가까운 친구보다 혼자 지내는 시간이 편한 편이고',
  low: '친구 인연은 많지 않지만 깊은 편이고',
  mid: '친구 인연은 무난하고',
  high: '친구·동료 인연이 풍부하고',
};
const FRIENDS_RANK: ByLevel = {
  none: '윗사람의 간섭은 적은 편으로 봅니다.',
  low: '윗사람과 가볍게 규율을 지키는 정도로 지낸다고 봅니다.',
  mid: '윗사람과 적당한 규율 속에서 지낸다고 봅니다.',
  high: '윗사람이나 규율의 영향이 큰 편으로 봅니다.',
};
const CAREER = {
  hh: '조직 안에서 맡은 역할을 하면서도 표현력과 재능을 함께 쓰는 쪽으로 봅니다.',
  hl: '조직의 틀과 책임 속에서 안정적으로 일하는 쪽으로 봅니다.',
  lh: '조직의 틀보다 말·기술·아이디어로 일하는 쪽에 가깝다고 봅니다.',
  ll: '일하는 방식이 한쪽으로 크게 기울지 않아 상황에 따라 달라진다고 봅니다.',
};
const FORTUNE = {
  hh: '즐기고 표현하는 힘과 마음을 채우는 힘이 함께 있어 만족감을 느끼기 쉽다고 봅니다.',
  hl: '즐기고 표현하는 쪽으로 마음이 풀리지만, 쉬는 시간은 따로 챙겨야 한다고 봅니다.',
  lh: '공부하거나 생각하며 마음을 채우는 편이고, 표현은 일부러 해야 한다고 봅니다.',
  ll: '마음을 푸는 방법을 의식해서 찾아야 하는 편으로 봅니다.',
};

/** 궁별 사주 대응 문장: 개념(PALACES[...].saju) + 이 사주의 값 + 뜻. 사주 정보가 없으면 개념만. */
export const sajuPalaceText = (key: PalaceKey, saju: SajuChart | null, gender: 'M' | 'F'): string => {
  const concept = PALACES[key].saju;
  if (!saju) return concept;
  const ownGod: TenGodGroup = gender === 'M' ? '재성' : '관성';
  const kidGod: TenGodGroup = gender === 'M' ? '관성' : '식상';
  const body = ((): string => {
    switch (key) {
      case 'life': {
        const dm = saju.dayMaster;
        const mb = saju.month.branch;
        return `이 사주의 ${tj('일간', '은/는')} ${stemLabel(dm.stem)}이고, ${STEM_IMAGE[dm.stem]} 성향으로 봅니다. 태어난 달은 ${branchLabel(mb)}월(${MONTH_SEASON[mb]})입니다.`;
      }
      case 'siblings': {
        const n = count(saju, '비겁');
        return `이 사주에는 ${tj('비겁', '이/가')} ${countPhrase(n)}. ${SIBLINGS[levelOf(n)]}`;
      }
      case 'spouse': {
        const n = count(saju, ownGod);
        return `배우자 자리인 ${tj('일지', '은/는')} ${branchLabel(saju.day.branch)}입니다. 배우자를 뜻하는 ${tj(ownGod, '은/는')} ${countPhrase(n)}. ${SPOUSE[levelOf(n)]}`;
      }
      case 'children': {
        const n = count(saju, kidGod);
        const hour = saju.hour ? `${tj('시주', '은/는')} ${saju.hour.ko}입니다.` : `태어난 시각을 몰라 ${tj('시주', '은/는')} 볼 수 없습니다.`;
        return `${hour} 자녀를 뜻하는 ${tj(kidGod, '은/는')} ${countPhrase(n)}. ${CHILDREN[levelOf(n)]}`;
      }
      case 'wealth': {
        const n = count(saju, '재성');
        return `이 사주에는 ${tj('재성', '이/가')} ${countPhrase(n)}. ${WEALTH[levelOf(n)]}`;
      }
      case 'health': {
        const els = ELEMENT_ORDER.map((e) => ({ e, n: saju.elementCounts[e] }));
        const dist = els.map((x) => `${ELEMENT_KO[x.e]} ${x.n}`).join(' · ');
        const lacking = els.filter((x) => x.n === 0).slice(0, 2);
        const heavy = els.filter((x) => x.n >= 3).slice(0, 2);
        const notes = [
          ...lacking.map((x) => `${ELEMENT_KO[x.e]}(${ELEMENT_BODY[x.e]}) 기운이 없어 이쪽을 챙기면 좋다고 봅니다.`),
          ...heavy.map((x) => `${ELEMENT_KO[x.e]}(${ELEMENT_BODY[x.e]}) 기운이 많아 이쪽이 무거워지기 쉽다고 봅니다.`),
        ];
        if (notes.length === 0) notes.push('기운이 고르게 퍼져 있어 한쪽으로 크게 치우치지 않는 편으로 봅니다.');
        return `사주의 ${saju.hour ? '여덟' : '여섯'} 글자를 ${tj('오행', '으로/로')} 나누면 ${dist}입니다. ${notes.join(' ')}`;
      }
      case 'travel': {
        const yk = yeokmaBranchOf(saju.year.branch);
        const pillars = [saju.year, saju.month, saju.day, ...(saju.hour ? [saju.hour] : [])];
        const present = pillars.some((p) => p.branch === yk);
        const meaning = present
          ? '이동과 변화가 잦거나 움직이는 일을 좋아하는 편으로 봅니다.'
          : '이동과 변화의 기운이 강하게 드러나지는 않아, 한곳에 자리 잡는 편으로 봅니다.';
        return `태어난 해의 띠가 ${branchLabel(saju.year.branch)}이면 ${tj('역마', '은/는')} ${branchLabel(yk)}입니다. 이 사주의 ${saju.hour ? '네' : '세'} 기둥 중에 ${josa(branchLabel(yk), '이/가')} ${present ? '있습니다' : '없습니다'}. ${meaning}`;
      }
      case 'friends': {
        const a = count(saju, '비겁');
        const b = count(saju, '관성');
        return `${tj('비겁', '은/는')} ${countPhrase(a)}. ${tj('관성', '은/는')} ${countPhrase(b)}. ${FRIENDS_PEER[levelOf(a)]} ${FRIENDS_RANK[levelOf(b)]}`;
      }
      case 'career': {
        const g = count(saju, '관성');
        const s = count(saju, '식상');
        const k = `${isHigh(g) ? 'h' : 'l'}${isHigh(s) ? 'h' : 'l'}` as keyof typeof CAREER;
        return `${tj('관성', '은/는')} ${countPhrase(g)}. ${tj('식상', '은/는')} ${countPhrase(s)}. ${CAREER[k]}`;
      }
      case 'property': {
        const n = count(saju, '인성');
        return `${tj('인성', '은/는')} ${countPhrase(n)}. 태어난 달의 기둥인 ${tj('월주', '은/는')} ${saju.month.ko}입니다. ${PROPERTY[levelOf(n)]}`;
      }
      case 'fortune': {
        const s = count(saju, '식상');
        const n = count(saju, '인성');
        const k = `${isHigh(s) ? 'h' : 'l'}${isHigh(n) ? 'h' : 'l'}` as keyof typeof FORTUNE;
        return `${tj('식상', '은/는')} ${countPhrase(s)}. ${tj('인성', '은/는')} ${countPhrase(n)}. ${FORTUNE[k]}`;
      }
      default: {
        const n = count(saju, '인성');
        return `${tj('인성', '은/는')} ${countPhrase(n)}. 윗대의 자리인 ${tj('연주', '은/는')} ${saju.year.ko}, ${tj('월주', '은/는')} ${saju.month.ko}입니다. ${PARENTS[levelOf(n)]}`;
      }
    }
  })();
  return `${concept} ${body}`;
};

// ── 별 단위: 사주의 같은 개념과 직접 대응하는 별 ──────────────────────────────
export interface SajuHints {
  yearStem: number;
  yearBranch: number;
  dayStem?: number;
}

export const sajuStarText = (key: string, h?: SajuHints): string | undefined => {
  switch (key) {
    case '祿存':
      return h
        ? `사주에서 ${tj('건록', '이라/라')} 부르는 자리와 같은 곳입니다. 태어난 해의 윗글자 ${stemLabel(h.yearStem)}의 {{건록}}은 ${branchLabel(lokBranchOf(h.yearStem))}입니다.`
        : `사주에서 ${tj('건록', '이라/라')} 부르는 자리와 같은 곳입니다. 태어난 해의 윗글자를 기준으로 정합니다.`;
    case '天馬':
      return h
        ? `사주의 ${tj('역마', '과/와')} 같은 자리입니다. 태어난 해의 띠가 ${branchLabel(h.yearBranch)}이면 {{역마}}는 ${branchLabel(yeokmaBranchOf(h.yearBranch))}입니다.`
        : `사주의 ${tj('역마', '과/와')} 같은 자리입니다. 태어난 해의 띠를 기준으로 정합니다.`;
    case '天魁':
    case '天鉞':
      return h
        ? `사주의 ${tj('천을귀인', '과/와')} 같은 자리입니다. 태어난 해의 윗글자가 ${stemLabel(h.yearStem)}이면 {{천을귀인}}은 ${branchLabel(CHEONEUL_BRANCHES[h.yearStem][0])}·${branchLabel(CHEONEUL_BRANCHES[h.yearStem][1])}입니다.`
        : `사주의 ${tj('천을귀인', '과/와')} 같은 자리입니다. 태어난 해의 윗글자를 기준으로 정합니다.`;
    case '文昌':
      return `사주에도 같은 이름의 문창귀인이 있지만 정하는 기준이 다릅니다. 사주는 ${tj('일간', '을/를')} 기준으로 정합니다.${h?.dayStem !== undefined ? ` 이 사주의 ${tj('일간', '은/는')} ${stemLabel(h.dayStem)}이고, 그 기준의 문창은 ${branchLabel(MUNCHANG_BRANCH[h.dayStem])}입니다.` : ''} 자미두수는 태어난 시각을 기준으로 놓습니다.`;
    case '華蓋':
      return `사주에도 같은 이름의 화개살이 있습니다. 화개살은 {{신살}}의 하나이며, 태어난 해와 날의 띠를 기준으로 정합니다.`;
    case '咸池':
      return `사주의 ${tj('도화살', '과/와')} 같은 개념입니다. 태어난 해와 날의 띠를 기준으로 정합니다.`;
    case '孤辰':
    case '寡宿':
      return `사주에도 고진·과숙이라는 같은 이름의 ${tj('신살', '이/가')} 있습니다. 태어난 해의 띠를 기준으로 정합니다.`;
    case '紅鸞':
    case '天喜':
      return `사주에도 홍란·천희라는 ${tj('신살', '이/가')} 있습니다. 태어난 해의 띠를 기준으로 정합니다.`;
    case '天德':
    case '月德':
      return '사주의 천덕귀인·월덕귀인과 이름은 같지만 계산 기준이 달라 위치가 다를 수 있습니다.';
    default:
      return undefined;
  }
};
