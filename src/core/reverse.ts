// 역산 입력(F-09, I-10): 명반의 일부 정보(별·궁 위치 등)만 알 때 가능한 출생 조합(연간·생월·생일·생시)을 찾는다.
// 사이트의 역산 엔진은 미확인(U-04)이라 “입력 → 후보 탐색 → 선택” 방식으로 새로 설계했다.
// 계산은 독립 구현(independent.ts)의 전통 공식만 쓰므로 엔진 호출 없이 즉시(수십 ms) 끝난다.

import { BRANCHES, BRANCHES_KO, STEMS, STEMS_KO, isValidGanzhi, mod } from './ganzhi';
import { quickKeys, ziweiBranch } from './independent';
import type { BirthInput, Gender } from './time';
import { lunarToSolar } from './time';

export interface ReverseConstraints {
  yearStem?: number;
  yearBranch?: number;
  month?: number;
  day?: number;
  hourBranch?: number;
  soul?: number;
  body?: number;
  fiveClass?: number;
  ziwei?: number;
  zuofu?: number;
  youbi?: number;
  wenchang?: number;
  wenqu?: number;
  /** 三台·八座는 생일을 가려내는 데 쓴다(자미성 위치만으로는 이틀이 같은 칸에 놓이는 경우가 있다) */
  santai?: number;
  bazuo?: number;
}
export type ConstraintKey = keyof ReverseConstraints;

export const CONSTRAINT_KEYS: ConstraintKey[] = [
  'yearStem', 'yearBranch', 'month', 'day', 'hourBranch', 'soul', 'body', 'fiveClass', 'ziwei', 'zuofu', 'youbi', 'wenchang', 'wenqu', 'santai', 'bazuo',
];

export const CONSTRAINT_LABEL: Record<ConstraintKey, string> = {
  yearStem: '연간', yearBranch: '연지', month: '생월(음력)', day: '생일(음력)', hourBranch: '생시',
  soul: '명궁 위치', body: '신궁 위치', fiveClass: '오행국', ziwei: '자미성 위치',
  zuofu: '좌보 위치', youbi: '우필 위치', wenchang: '문창 위치', wenqu: '문곡 위치',
  santai: '삼태 위치', bazuo: '팔좌 위치',
};

const FIVE_KO: Record<number, string> = { 2: '수이국', 3: '목삼국', 4: '금사국', 5: '토오국', 6: '화육국' };

export const valueLabel = (key: ConstraintKey, v: number): string => {
  switch (key) {
    case 'yearStem': return `${STEMS_KO[v]}(${STEMS[v]})`;
    case 'yearBranch': return `${BRANCHES_KO[v]}(${BRANCHES[v]})`;
    case 'month': return `${v}월`;
    case 'day': return `${v}일`;
    case 'hourBranch': return `${BRANCHES_KO[v]}시`;
    case 'fiveClass': return FIVE_KO[v];
    default: return `${BRANCHES_KO[v]}궁(${BRANCHES[v]})`;
  }
};

export interface ReverseCandidate {
  yearStem: number;
  month: number;
  day: number;
  hourBranch: number;
  /** 연간과 짝이 되는 연지(홀짝이 같은 6개 중 제약에 맞는 것) */
  yearBranches: number[];
}

export interface ReverseConflict {
  kind: 'pair' | 'relax';
  keys: ConstraintKey[];
  message: string;
}

export interface ReverseResult {
  specified: ConstraintKey[];
  /** (연간, 생월, 생일, 생시) 조합 수 */
  count: number;
  candidates: ReverseCandidate[];
  truncated: boolean;
  status: 'empty-input' | 'unique' | 'multiple' | 'none';
  conflicts: ReverseConflict[];
}

const range = (n: number, from = 0): number[] => Array.from({ length: n }, (_, i) => i + from);

/** 제약에 맞는 (연간, 월, 일, 시) 조합을 센다. limit 개까지만 모은다. */
const search = (c: ReverseConstraints, limit: number): { count: number; candidates: ReverseCandidate[] } => {
  const stems = c.yearStem !== undefined ? [c.yearStem] : range(10);
  const months = c.month !== undefined ? [c.month] : range(12, 1);
  const hours = c.hourBranch !== undefined ? [c.hourBranch] : range(12);
  const days = c.day !== undefined ? [c.day] : range(30, 1);
  let count = 0;
  const candidates: ReverseCandidate[] = [];

  for (const stem of stems) {
    // 연지가 지정되면 홀짝이 맞아야 한다
    if (c.yearBranch !== undefined && !isValidGanzhi(stem, c.yearBranch)) continue;
    const branches = c.yearBranch !== undefined ? [c.yearBranch] : range(12).filter((b) => isValidGanzhi(stem, b));
    for (const month of months) {
      const z = mod(4 + (month - 1), 12);
      const y = mod(10 - (month - 1), 12);
      if (c.zuofu !== undefined && c.zuofu !== z) continue;
      if (c.youbi !== undefined && c.youbi !== y) continue;
      for (const hour of hours) {
        if (c.wenchang !== undefined && c.wenchang !== mod(10 - hour, 12)) continue;
        if (c.wenqu !== undefined && c.wenqu !== mod(4 + hour, 12)) continue;
        const k = quickKeys({ yearStem: stem, yearBranch: branches[0], month, day: 1, hourBranch: hour });
        if (c.soul !== undefined && c.soul !== k.soul) continue;
        if (c.body !== undefined && c.body !== k.body) continue;
        if (c.fiveClass !== undefined && c.fiveClass !== k.fiveClass) continue;
        for (const day of days) {
          if (c.ziwei !== undefined && c.ziwei !== ziweiBranch(day, k.fiveClass)) continue;
          if (c.santai !== undefined && c.santai !== mod(z + (day - 1), 12)) continue;
          if (c.bazuo !== undefined && c.bazuo !== mod(y - (day - 1), 12)) continue;
          count++;
          if (candidates.length < limit) candidates.push({ yearStem: stem, month, day, hourBranch: hour, yearBranches: branches });
        }
      }
    }
  }
  return { count, candidates };
};

const specifiedKeys = (c: ReverseConstraints): ConstraintKey[] => CONSTRAINT_KEYS.filter((k) => c[k] !== undefined);
const only = (c: ReverseConstraints, keys: ConstraintKey[]): ReverseConstraints => {
  const out: ReverseConstraints = {};
  for (const k of keys) out[k] = c[k];
  return out;
};

const pairHint = (a: ConstraintKey, b: ConstraintKey): string => {
  const has = (x: ConstraintKey, y: ConstraintKey): boolean => (a === x && b === y) || (a === y && b === x);
  if (has('soul', 'body')) return '신궁은 명궁에서 시진 수의 두 배만큼 떨어진 곳에 놓이므로 두 궁의 간격은 항상 짝수여야 합니다.';
  if (has('zuofu', 'youbi')) return '좌보와 우필은 같은 달에서 서로 마주 보는 방향으로 움직여, 한 달에 위치가 하나씩만 정해집니다.';
  if (has('wenchang', 'wenqu')) return '문창과 문곡은 같은 시진에서 서로 마주 보는 방향으로 움직여, 한 시진에 위치가 하나씩만 정해집니다.';
  return '두 값이 서로 다른 생월·생시·연간을 요구해서 함께 성립할 수 없습니다.';
};

export const reverseSearch = (c: ReverseConstraints, limit = 400): ReverseResult => {
  const specified = specifiedKeys(c);
  if (specified.length === 0) {
    return { specified, count: 0, candidates: [], truncated: false, status: 'empty-input', conflicts: [] };
  }
  const { count, candidates } = search(c, limit);
  const status: ReverseResult['status'] = count === 0 ? 'none' : count === 1 ? 'unique' : 'multiple';
  const conflicts: ReverseConflict[] = [];

  if (status === 'none') {
    // 1) 둘만 놓아도 성립하지 않는 쌍
    for (let i = 0; i < specified.length; i++) {
      for (let j = i + 1; j < specified.length; j++) {
        const keys = [specified[i], specified[j]];
        if (search(only(c, keys), 1).count === 0) {
          conflicts.push({
            kind: 'pair',
            keys,
            message: `${CONSTRAINT_LABEL[keys[0]]} ${valueLabel(keys[0], c[keys[0]] as number)} 와(과) ${CONSTRAINT_LABEL[keys[1]]} ${valueLabel(keys[1], c[keys[1]] as number)} 는 함께 성립할 수 없습니다. ${pairHint(keys[0], keys[1])}`,
          });
        }
      }
    }
    // 2) 쌍은 문제없지만 여럿이 얽힌 경우: 하나를 빼면 가능해지는 항목
    if (conflicts.length === 0) {
      for (const k of specified) {
        const rest = specified.filter((x) => x !== k);
        if (rest.length > 0 && search(only(c, rest), 1).count > 0) {
          conflicts.push({
            kind: 'relax',
            keys: [k],
            message: `${CONSTRAINT_LABEL[k]} ${valueLabel(k, c[k] as number)} 를 빼면 나머지 입력은 모두 성립합니다.`,
          });
        }
      }
    }
  }
  return { specified, count, candidates, truncated: count > candidates.length, status, conflicts };
};

/** 양력이 아닌 음력 연도 중 연간·연지가 맞고 그 달에 그 날짜가 실제로 있는 해(1900~2100) */
export const yearsFor = (c: ReverseCandidate, branch: number): number[] => {
  const years: number[] = [];
  for (let y = 1901; y <= 2099; y++) {
    if (mod(y - 4, 10) !== c.yearStem || mod(y - 4, 12) !== branch) continue;
    if (lunarToSolar(y, c.month, false, c.day)) years.push(y);
  }
  return years;
};

/** 후보 + 대표 연도 + 성별 → 일반 출생 입력(음력, 시 표준) */
export const birthInputOf = (c: ReverseCandidate, year: number, gender: Gender): BirthInput => ({
  calendar: 'lunar',
  leap: false,
  year,
  month: c.month,
  day: c.day,
  hour: c.hourBranch === 0 ? 0 : c.hourBranch * 2,
  minute: 0,
  gender,
  placeId: 'standard',
});
