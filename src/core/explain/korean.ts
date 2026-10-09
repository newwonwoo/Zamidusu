// 한국어 조사 처리. 해설 문장을 합성할 때 받침 유무에 따라 이/가, 은/는, 을/를, 과/와, 으로/로 를 맞춘다.

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const DIGIT_BATCHIM = new Set(['0', '1', '3', '6', '7', '8']); // 영 일 삼 육 칠 팔

/** 조사를 붙일 때 기준이 되는 마지막 글자(괄호 꼬리표·따옴표 등 제외) */
const baseChar = (word: string): string => {
  const w = word
    .replace(/\([^)]*\)\s*$/, '')
    .trim()
    .replace(/[^가-힣0-9A-Za-z]+$/, '');
  return w.slice(-1);
};

export const hasBatchim = (word: string): boolean => {
  const ch = baseChar(word);
  if (!ch) return false;
  if (DIGIT_BATCHIM.has(ch)) return true;
  const code = ch.charCodeAt(0);
  if (code >= HANGUL_BASE && code <= HANGUL_END) return (code - HANGUL_BASE) % 28 !== 0;
  return false;
};

const isRieul = (word: string): boolean => {
  const ch = baseChar(word);
  if (ch === '1' || ch === '7' || ch === '8') return true;
  const code = ch.charCodeAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_END && (code - HANGUL_BASE) % 28 === 8;
};

export type JosaType = '이/가' | '은/는' | '을/를' | '과/와' | '으로/로' | '이라/라';

/** 단어 + 알맞은 조사 */
export const josa = (word: string, type: JosaType): string => {
  const [withB, withoutB] = type.split('/');
  if (type === '으로/로') return word + (hasBatchim(word) && !isRieul(word) ? withB : withoutB);
  return word + (hasBatchim(word) ? withB : withoutB);
};

/** 같은 입력에 항상 같은 값을 돌려주는 간단한 해시(문형을 별마다 고르게 나누려고) */
export const stableHash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** 문자 수(한글 한 글자 = 1) */
export const charLength = (s: string): number => Array.from(s).length;
