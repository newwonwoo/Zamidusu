// 두 체계가 함께 쓰는 문장표. 같은 경향 단계에는 같은 결론 문장을 써서, 비교할 때 말의 높낮이가 맞게 한다.
import { josa } from '../explain/korean';
import { DOMAIN_LABEL, LEVEL_LABEL, themeLabel } from './types';
import type { Domain, Level, PeriodReading, System } from './types';
import { signed } from './util';

/** 영역별 결론 한 줄(경향 단계마다 하나). 단정하지 않고 “~한 편입니다” 로 맺는다 */
export const VERDICT_LINE: Record<Domain, Record<Level, string>> = {
  self: {
    2: '타고난 바탕이 단단하고 균형이 좋은 편입니다.',
    1: '타고난 바탕이 안정적인 편입니다.',
    0: '타고난 바탕은 무난하며, 환경에 따라 달라지는 편입니다.',
    [-1]: '타고난 바탕에 한쪽으로 기운 면이 있어 스스로 조절이 필요한 편입니다.',
    [-2]: '타고난 바탕이 크게 한쪽으로 쏠려 있어 균형을 잡는 노력이 특히 필요합니다.',
  } as Record<Level, string>,
  wealth: {
    2: '재물을 모으고 불리는 힘이 두드러지는 편입니다.',
    1: '재물의 흐름이 받쳐 주는 편입니다.',
    0: '재물은 무난하며, 관리하기에 따라 달라지는 편입니다.',
    [-1]: '재물은 새는 곳을 단속하며 모아야 하는 편입니다.',
    [-2]: '재물에서는 기복과 지출을 특히 조심해야 하는 편입니다.',
  } as Record<Level, string>,
  career: {
    2: '일과 직업에서 힘이 두드러지게 받쳐 주는 편입니다.',
    1: '일과 직업의 흐름이 받쳐 주는 편입니다.',
    0: '일과 직업은 무난하며, 선택과 준비에 따라 달라지는 편입니다.',
    [-1]: '일과 직업에서 마찰이나 변동에 대비해야 하는 편입니다.',
    [-2]: '일과 직업에서 압박과 변동을 특히 조심해야 하는 편입니다.',
  } as Record<Level, string>,
  love: {
    2: '연애와 결혼의 복이 두드러지는 편입니다.',
    1: '연애와 결혼에서 인연이 순조롭게 이어지는 편입니다.',
    0: '연애와 결혼은 무난하며, 서로 맞춰 가기에 달린 편입니다.',
    [-1]: '연애와 결혼에서 마찰과 엇갈림에 신경 써야 하는 편입니다.',
    [-2]: '연애와 결혼에서 갈등과 엇갈림을 특히 조심해야 하는 편입니다.',
  } as Record<Level, string>,
  health: {
    2: '타고난 체력이 튼튼하고 균형이 좋은 편입니다.',
    1: '타고난 체력이 받쳐 주는 편입니다.',
    0: '건강은 무난하며, 생활 습관에 따라 달라지는 편입니다.',
    [-1]: '건강은 한쪽으로 기운 곳을 꾸준히 살펴야 하는 편입니다.',
    [-2]: '건강은 피로와 한쪽으로 쏠린 곳을 특히 잘 살펴야 하는 편입니다.',
  } as Record<Level, string>,
  people: {
    2: '사람 복이 두드러지는 편입니다.',
    1: '사람 관계에서 도움을 받기 쉬운 편입니다.',
    0: '사람 관계는 무난하며, 노력한 만큼 돌아오는 편입니다.',
    [-1]: '사람 관계에서 마찰이나 거리감에 신경 써야 하는 편입니다.',
    [-2]: '사람 관계에서 갈등과 외로움을 특히 조심해야 하는 편입니다.',
  } as Record<Level, string>,
};

/** 영역별 조언(좋음 / 무난 / 신경 쓸 편) */
export const ADVICE_LINE: Record<Domain, { pos: string; mid: string; neg: string }> = {
  self: {
    pos: '강점을 믿고 맡은 일에 꾸준히 쓰세요.',
    mid: '상황에 맞춰 강점을 골라 쓰세요.',
    neg: '치우친 면을 알고, 반대 성향의 사람과 함께 일하세요.',
  },
  wealth: {
    pos: '벌어들이는 힘이 있을 때 모으는 습관을 함께 만드세요.',
    mid: '수입과 지출을 기록하면 흐름이 안정됩니다.',
    neg: '큰 지출과 빌려주는 일은 한 번 더 확인하세요.',
  },
  career: {
    pos: '맡은 역할을 넓혀 가며 신뢰를 쌓으세요.',
    mid: '적성에 맞는 분야를 정하고 준비하세요.',
    neg: '큰 이직과 변화는 준비를 마친 뒤에 하세요.',
  },
  love: {
    pos: '좋은 인연일수록 말로 표현하며 가꾸세요.',
    mid: '서로의 속도를 맞추는 대화가 중요합니다.',
    neg: '다툼이 생기면 한 박자 쉬고 말하세요.',
  },
  health: {
    pos: '좋은 체력을 믿고 무리하지 않는 리듬을 지키세요.',
    mid: '수면·식사·운동의 리듬을 일정하게 지키세요.',
    neg: '정기 검진을 받고 피로가 쌓이기 전에 쉬세요.',
  },
  people: {
    pos: '도움받은 만큼 먼저 베풀면 관계가 더 단단해집니다.',
    mid: '자주 연락하고 작은 약속을 지키세요.',
    neg: '말을 아끼고 믿을 만한 소수와 깊게 지내세요.',
  },
};

export const adviceOf = (domain: Domain, level: Level): string =>
  level >= 1 ? ADVICE_LINE[domain].pos : level === 0 ? ADVICE_LINE[domain].mid : ADVICE_LINE[domain].neg;

/** 각 체계가 그 영역을 무엇으로 보는지(비교 설명의 “렌즈”) */
export const LENS: Record<'ziwei' | 'saju', Record<Domain, string>> = {
  ziwei: {
    self: '명궁에 앉은 별과 그 별이 앉은 자리의 힘',
    wealth: '재백궁과 전택궁의 별, 생년 {{사화}}',
    career: '관록궁과 천이궁의 별, 생년 {{사화}}',
    love: '부처궁의 별과 인연을 뜻하는 별',
    health: '질액궁의 별과 긴장을 주는 별',
    people: '노복궁·천이궁·부모궁의 별',
  },
  saju: {
    self: '{{일간}}의 힘과 태어난 달의 계절, {{격국}}',
    wealth: '{{재성}}의 크기와 {{일간}}이 받아 낼 힘',
    career: '{{관성}}·{{식상}}의 균형과 {{격국}}',
    love: '{{일지}}와 배우자를 뜻하는 기운, 글자끼리의 {{합}}과 {{충}}',
    health: '{{오행}}의 균형과 계절, 글자끼리의 {{충}}',
    people: '{{비겁}}·{{인성}}의 균형과 귀인, {{합}}과 {{충}}',
  },
};

/** 주제의 좋고 나쁨(결론 문장에 “다만 …” 또는 “그래도 …”를 덧붙일 때 쓴다). 나머지는 중립 */
export const THEME_VALENCE: Record<Domain, { pos: string[]; neg: string[] }> = {
  self: { pos: [], neg: [] },
  wealth: { pos: ['steady', 'earned', 'chance', 'keeper'], neg: ['swing', 'leak', 'scarce'] },
  career: { pos: ['leader', 'expert', 'organization', 'venture', 'creative', 'support'], neg: ['change'] },
  love: { pos: ['warm', 'passion'], neg: ['conflict', 'unsettled'] },
  health: { pos: ['sturdy'], neg: ['stress', 'tired', 'accident', 'watch'] },
  people: { pos: ['helpers', 'wide', 'close'], neg: ['rivals', 'tension'] },
};

/**
 * 결론 문장 = 단계 문장 + (단계와 어긋나는 주제가 있으면 한 문장).
 * 좋은 단계인데 조심할 주제가 있으면 “다만 …에는 유의하세요.”, 나쁜 단계인데 살릴 주제가 있으면 “그래도 …은 살릴 수 있는 강점입니다.”
 */
export const verdictWithThemes = (domain: Domain, level: Level, themes: string[]): string => {
  const base = VERDICT_LINE[domain][level];
  const v = THEME_VALENCE[domain];
  if (level >= 1) {
    const neg = themes.filter((t) => v.neg.includes(t)).slice(0, 2).map((t) => themeLabel(domain, t));
    if (neg.length > 0) return `${base} 다만 ${neg.join('·')}에는 유의하세요.`;
  }
  if (level <= -1) {
    const pos = themes.filter((t) => v.pos.includes(t)).slice(0, 2).map((t) => themeLabel(domain, t));
    if (pos.length > 0) return `${base} 그래도 ${josa(pos.join('·'), '은/는')} 살릴 수 있는 강점입니다.`;
  }
  return base;
};

// ── 한 사람 안에서의 위치(가장 나은 때 · 가장 신경 쓸 때) ───────────────────────────────────
// 경향 단계는 무작위 출생 전체에서의 위치라, 한 사람의 10년 구간이 모두 같은 단계로 나올 수 있다.
// 그래서 구간끼리의 차이가 뚜렷할 때만 그 사람 안에서 가장 나은 때와 가장 신경 쓸 때를 따로 짚는다.
// 구간 수는 100세까지만 다뤄 10개이므로 “열두”처럼 개수를 말하지 않는다(3차 독자 시험에서 목록은 10개인데 문장은 열두 구간이라고 해 혼란을 줬다).
export const STANDING_NOTE: Record<System, Record<'best' | 'worst', string>> = {
  ziwei: { best: '이 명반의 10년 운 가운데서는 상대적으로 가장 나은 때입니다.', worst: '이 명반의 10년 운 가운데서는 상대적으로 가장 신경 쓸 때입니다.' },
  saju: { best: '이 사주의 10년 운 가운데서는 상대적으로 가장 나은 때입니다.', worst: '이 사주의 10년 운 가운데서는 상대적으로 가장 신경 쓸 때입니다.' },
};

/** 구간끼리 차이가 작아 가장 나은 때·신경 쓸 때를 짚지 않았을 때 목록 위에 붙이는 안내 */
export const FLAT_NOTE: Record<System, string> = {
  ziwei: '이 명반은 10년마다의 차이가 작아, 구간 대부분이 비슷한 단계로 나옵니다.',
  saju: '이 사주는 10년 운마다의 차이가 작아, 구간 대부분이 비슷한 단계로 나옵니다.',
};

/** 구간 값(fine)의 최대·최소가 minSpread 이상 벌어졌을 때, 최댓값에 해당하는 구간(들)에 best, 최솟값에 해당하는 구간(들)에 worst 를 붙인다(동점이면 모두) */
export const markStanding = (periods: PeriodReading[], minSpread: number): void => {
  if (periods.length < 3) return;
  const max = Math.max(...periods.map((p) => p.fine));
  const min = Math.min(...periods.map((p) => p.fine));
  if (max - min < minSpread) return;
  for (const p of periods) {
    const kind = Math.abs(p.fine - max) < 1e-9 ? 'best' : Math.abs(p.fine - min) < 1e-9 ? 'worst' : null;
    if (!kind) continue;
    p.standing = kind;
    // 단계(절대 위치)와 방향이 어긋날 때(가장 나은 때가 ‘무난’ 이하, 가장 신경 쓸 때가 ‘무난’ 이상)는 단계를 함께 밝힌다
    const caveat = (kind === 'best' && p.level <= 0) || (kind === 'worst' && p.level >= 0) ? ` 다만 단계는 ‘${LEVEL_LABEL[p.level]}’입니다.` : '';
    p.standingNote = `${STANDING_NOTE[p.system][kind]}${caveat}`;
    p.evidence.push({
      rule: p.system === 'ziwei' ? 'ZT-03' : 'S-DA6',
      text: `구간 값 ${signed(p.fine)} — 같은 사람의 구간 중 ${kind === 'best' ? '최대' : '최소'}(최대 ${signed(max)} · 최소 ${signed(min)}, 폭 ${(max - min).toFixed(2)} ≥ ${minSpread})`,
    });
  }
};

/** 구간 목록에 위치 표시가 하나도 붙지 않았을 때(구간끼리 차이가 작을 때) 목록 위에 붙일 안내. 붙었으면 없음 */
export const flatNoteOf = (periods: PeriodReading[]): string | undefined =>
  periods.length >= 3 && !periods.some((p) => p.standing) ? FLAT_NOTE[periods[0].system] : undefined;

/** 구간끼리 뚜렷이 다르다고 볼 최소 폭: 자미두수(표준화 평균) 0.15 — 무작위 300명의 5% 지점, 사주(대운 점수) 1.0 — 같은 표본의 5% 지점 1.5 보다 낮게 */
export const STANDING_MIN_SPREAD: Record<System, number> = { ziwei: 0.15, saju: 1.0 };

// ── 총평: 가장 앞선 영역들 · 가장 처진 영역들 ────────────────────────────────────────
/** 여섯 영역(성격 포함) 가운데, 가장 높은 단계가 +1 이상이면 그 단계의 영역들(점수 높은 순), 아니면 빈 목록 */
export const bestDomains = (domains: Record<Domain, { level: Level; score: number }>): Domain[] => {
  const all = Object.keys(domains) as Domain[];
  const top = Math.max(...all.map((d) => domains[d].level));
  return top >= 1 ? all.filter((d) => domains[d].level === top).sort((a, b) => domains[b].score - domains[a].score) : [];
};
/** 여섯 영역(성격 포함) 가운데, 가장 낮은 단계가 −1 이하이면 그 단계의 영역들(점수 낮은 순), 아니면 빈 목록 */
export const worstDomains = (domains: Record<Domain, { level: Level; score: number }>): Domain[] => {
  const all = Object.keys(domains) as Domain[];
  const low = Math.min(...all.map((d) => domains[d].level));
  return low <= -1 ? all.filter((d) => domains[d].level === low).sort((a, b) => domains[a].score - domains[b].score) : [];
};

/** 영역 이름 나열: 하나 “재물”, 둘 “재물과 직업”, 셋 이상 “재물, 직업, 건강” */
export const domainList = (ds: Domain[]): string => {
  const names = ds.map((d) => DOMAIN_LABEL[d]);
  return names.length === 1 ? names[0] : names.length === 2 ? `${josa(names[0], '과/와')} ${names[1]}` : names.join(', ');
};

/** 총평의 조언 한 줄. 영역별 조언은 아래 영역 카드에 있으므로 여기서는 방향만 말한다 */
export const spreadAdvice = (best: Domain[], worst: Domain[]): string | null => {
  if (best.length > 0 && worst.length > 0) return `${domainList(best)}의 강점을 살리고, ${josa(domainList(worst), '은/는')} 먼저 점검하세요.`;
  if (best.length > 0) return `${domainList(best)}의 강점을 살리세요.`;
  if (worst.length > 0) return `${josa(domainList(worst), '은/는')} 먼저 점검하세요.`;
  return null;
};
