// 통변(通變) 공통 모델. 자미두수 통변과 사주 통변이 같은 모양의 결과를 내야 두 통변을 나란히 비교할 수 있다.
// 설계서 부록 D. 점수는 규칙 합산이고, 경향 단계는 무작위 명반 분포의 백분위로 나눈 상대 위치다(D-5, D-6).

export type System = 'ziwei' | 'saju';
export const SYSTEM_KO: Record<System, string> = { ziwei: '자미두수', saju: '사주' };

export type Domain = 'self' | 'wealth' | 'career' | 'love' | 'health' | 'people';
export const DOMAINS: Domain[] = ['self', 'wealth', 'career', 'love', 'health', 'people'];
export const DOMAIN_LABEL: Record<Domain, string> = {
  self: '성격·기질', wealth: '재물', career: '직업', love: '연애·결혼', health: '건강', people: '대인·가족',
};
/** 문장 속에서 쓰는 주제어(조사 없이) */
export const DOMAIN_TOPIC: Record<Domain, string> = {
  self: '타고난 바탕', wealth: '재물', career: '일과 직업', love: '연애와 결혼', health: '건강', people: '사람 관계',
};

export type Level = -2 | -1 | 0 | 1 | 2;
export const LEVELS: Level[] = [-2, -1, 0, 1, 2];
export const LEVEL_LABEL: Record<Level, string> = {
  2: '매우 좋은 편', 1: '좋은 편', 0: '무난한 편', [-1]: '신경 쓸 편', [-2]: '특히 조심할 편',
} as Record<Level, string>;
/** 색만으로 구분하지 않도록 기호를 함께 쓴다 */
export const LEVEL_MARK: Record<Level, string> = { 2: '▲▲', 1: '▲', 0: '●', [-1]: '▼', [-2]: '▼▼' } as Record<Level, string>;
/** 경향 단계를 나누는 목표 비율(−2, −1, 0, +1, +2). 무작위 명반 분포의 백분위 10·35·65·90 으로 자른다. */
export const LEVEL_PERCENTILES = [0.1, 0.35, 0.65, 0.9] as const;

/** 점수를 경계값(작은 것부터 4개)으로 자른 단계 */
export const levelOf = (score: number, cuts: readonly [number, number, number, number]): Level => {
  let n = 0;
  for (const c of cuts) if (score >= c) n++;
  return (n - 2) as Level;
};

/** 영역별 핵심 주제. 두 체계가 같은 말을 하는지 가리는 비교 단위다. */
export const THEMES: Record<Domain, Record<string, string>> = {
  self: {
    lead: '앞장서는 리더십', bold: '대담한 돌파력', gentle: '온화한 배려', think: '신중한 분석', feel: '풍부한 감수성',
    social: '넓은 사교성', steady: '원칙과 성실', change: '변화를 즐김', solo: '독립적인 성향',
  },
  wealth: {
    steady: '꾸준히 모으는 힘', earned: '노력으로 버는 돈', swing: '기복이 있는 흐름', chance: '기회를 타는 돈', leak: '새기 쉬운 지출', keeper: '지키는 힘', scarce: '재물 인연의 약함',
  },
  career: {
    leader: '이끄는 역할', expert: '전문성으로 인정받는 힘', organization: '조직 안의 안정', venture: '개척과 사업', creative: '창의와 표현', support: '기획과 보좌', change: '직업의 변동', late: '늦게 피는 성취',
  },
  love: {
    warm: '다정하고 안정적인 관계', passion: '열정과 인연의 풍부함', late: '늦거나 신중한 인연', conflict: '말다툼과 마찰', distance: '독립적인 거리감', unsettled: '관계의 변화',
  },
  health: {
    sturdy: '타고난 체력', stress: '신경과 스트레스', tired: '피로와 과로', accident: '다침과 사고', watch: '꾸준히 살펴야 할 곳',
  },
  people: {
    helpers: '귀인과 조력자', wide: '폭넓은 교류', rivals: '경쟁과 구설', solo: '혼자 서는 편', close: '가족과의 유대', tension: '윗사람·가족과의 마찰',
  },
};
export const themeLabel = (domain: Domain, id: string): string => THEMES[domain][id] ?? id;

export interface Evidence {
  /** 규칙 번호(규칙표에 있어야 한다) */
  rule: string;
  /** 이 명반·사주의 값으로 쓴 설명 */
  text: string;
}

export type PointKind = 'core' | 'power' | 'support' | 'tension' | 'mutagen' | 'pattern' | 'balance' | 'relation' | 'link';

export interface Point {
  kind: PointKind;
  /** 화면에 붙일 작은 제목(예: “별의 힘”) */
  label: string;
  text: string;
}

/** 점수에 영향을 준 사실 하나(비교에서 “왜 이렇게 봤는지”를 말할 때 쓴다) */
export interface Reason {
  rule: string;
  /** 짧은 명사구(예: “재성이 넉넉함”) */
  brief: string;
  delta: number;
}

export interface DomainReading {
  system: System;
  domain: Domain;
  level: Level;
  /** 규칙 합산 점수(경계값으로 단계가 된다) */
  score: number;
  /** “재물 — 좋은 편” 같은 제목 */
  title: string;
  /** 이 영역의 결론(1~2문장) */
  verdict: string;
  points: Point[];
  themes: string[];
  advice: string;
  /** 점수에 영향을 준 사실(영향이 큰 순) */
  reasons: Reason[];
  evidence: Evidence[];
}

export type Verdict = 'agree' | 'complement' | 'conflict';
export const VERDICT_LABEL: Record<Verdict, string> = { agree: '일치', complement: '보완', conflict: '엇갈림' };

/** 총평(한 체계의 전체 결론) */
export interface OverviewParagraph {
  /** 문단 소제목(예: “바탕”) */
  label: string;
  sentences: string[];
}
export interface Overview {
  /** 한 줄 결론 */
  headline: string;
  /** 칩으로 보여 줄 핵심어 */
  keywords: string[];
  paragraphs: OverviewParagraph[];
  advice: string[];
  evidence: Evidence[];
}

/** 10년 단위 흐름 하나(자미두수 대한 또는 사주 대운) */
export interface PeriodReading {
  system: System;
  /** 표시 이름(대한: 대한 명궁 칸, 대운: 간지) */
  label: string;
  startAge: number;
  endAge: number;
  /** 달력 연도 범위 */
  startYear: number;
  endYear: number;
  level: Level;
  score: number;
  /** 같은 사람의 구간끼리 견주는 연속 값(자미두수: 영역 점수를 경계값 폭으로 표준화한 평균, 사주: 대운 점수). 높을수록 낫다 */
  fine: number;
  /** 이 사람의 구간들 가운데 가장 나은 때(best)·가장 신경 쓸 때(worst). 단계(절대 위치)와 별개로, 구간끼리 뚜렷이 다를 때만 붙는다 */
  standing?: 'best' | 'worst';
  standingNote?: string;
  headline: string;
  /** 이 시기에 두드러지는 영역(자미두수: 가장 받쳐 주는 영역, 사주: 대운 십성이 강조하는 영역) */
  highlights: Domain[];
  /** 이 시기에 신경 쓸 영역(자미두수 대한만) */
  cautions?: Domain[];
  /** 영역별 단계(자미두수 대한만) */
  byDomain?: Record<Domain, Level>;
  evidence: Evidence[];
}
