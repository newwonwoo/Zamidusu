// 천간·지지·오행·음양의 기초 상수와 도우미. 다른 모듈은 이 파일의 인덱스 규칙을 따른다.
// 지지 인덱스: 子=0, 丑=1, 寅=2 … 亥=11 / 천간 인덱스: 甲=0 … 癸=9

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;
export const ZODIAC_KO = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'] as const;

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const ELEMENT_KO: Record<Element, string> = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
export const ELEMENT_HANJA: Record<Element, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

export const STEM_ELEMENT: readonly Element[] = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
export const BRANCH_ELEMENT: readonly Element[] = [
  'water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water',
];

/** 음수에도 안전한 나머지 */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export const stemIndex = (ch: string): number => (STEMS as readonly string[]).indexOf(ch);
export const branchIndex = (ch: string): number => (BRANCHES as readonly string[]).indexOf(ch);

export const isYangStem = (stem: number): boolean => mod(stem, 2) === 0;
export const isYangBranch = (branch: number): boolean => mod(branch, 2) === 0;

export const ganzhiName = (stem: number, branch: number): string => STEMS[mod(stem, 10)] + BRANCHES[mod(branch, 12)];
export const ganzhiKo = (stem: number, branch: number): string => STEMS_KO[mod(stem, 10)] + BRANCHES_KO[mod(branch, 12)];

/** 60갑자 번호(0~59) → [천간, 지지]. 천간·지지의 홀짝이 같아야 유효하다. */
export const isValidGanzhi = (stem: number, branch: number): boolean => mod(stem, 2) === mod(branch, 2);

/** 五虎遁: 연간 → 寅월(=寅궁)의 천간. 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲 */
export const tigerStem = (yearStem: number): number => mod(2 * (yearStem % 5) + 2, 10);

/** 五鼠遁: 일간 → 子시의 천간. 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬 */
export const ratStem = (dayStem: number): number => mod(2 * (dayStem % 5), 10);

/** 특정 연간에서 지지 b 위치(궁/월)의 천간 */
export const stemOfBranchFromYear = (yearStem: number, branch: number): number =>
  mod(tigerStem(yearStem) + mod(branch - 2, 12), 10);
