// 쉬운 해설 검사 도구(설계서 부록 B, 검증 V-19). 문장 나누기, 전문용어 미표시 탐지, 문장 간 뜻 겹침 측정.

import { TERM_PATTERN, plainText } from '../src/core/glossary';

/** 한 문장 최대 글자 수(src 의 MAX_SENTENCE_CHARS 와 같은 값을 독립적으로 적어 둔다) */
export const MAX_SENTENCE = 60;

/** {{용어}} 표시를 걷어낸 평문을 문장으로 나눈다(마침표·물음표·느낌표 뒤 공백 기준) */
export const sentencesOf = (text: string): string[] =>
  plainText(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

export const len = (s: string): number => Array.from(s).length;

const HANGUL = '가-힣';
/** 한 글자짜리처럼 일반 낱말과 섞이기 쉬운 용어는 조사까지만 붙은 ‘낱말’일 때만 잡는다 */
const word = (t: string): RegExp => new RegExp(`(?<![${HANGUL}])${t}(?:이|가|은|는|을|를|과|와|의|도|에|으로|로)?(?![${HANGUL}])`);
const sub = (t: string): RegExp => new RegExp(t);

/** 사주·자미두수 전문용어. 본문에서는 {{ }} 표시 없이 쓰지 않는다(화면이 처음 나올 때 풀이를 붙인다). */
export const JARGON: { term: string; re: RegExp }[] = [
  // 일반 낱말 속에 섞이지 않는 말은 부분 일치로 잡는다
  ...['관성', '식상', '비겁', '재성', '인성', '일간', '월지', '연지', '일지', '연간', '월주', '연주', '시주', '일주', '12운성', '건록', '역마',
    '천을귀인', '도화살', '신살', '오행', '차성안궁', '대궁', '삼방사정', '삼합', '사화', '화록', '화권', '화과', '동궁',
    '십성', '지장간', '천간', '간지', '대운', '장생12신', '월건', '밝기'].map((t) => ({ term: t, re: sub(t) })),
  // 일반 낱말과 섞이기 쉬운 말(사소한·소화기·충돌…)은 ‘낱말’일 때만 잡는다
  ...['충', '협', '지지', '소한', '화기'].map((t) => ({ term: t, re: word(t) })),
  // “대한”은 ‘대하다’의 꼴(선하게 대한 마음)과 구별하려고 운 이름으로 쓰인 경우만 잡는다
  { term: '대한', re: /(?<![가-힣])대한 (?:기준|녹존|경양|타라|문창|문곡|천괴|천월|천마|홍란|천희|년해|사화)/ },
];

/** 어느 경우에도 쓰지 않는 말(표시를 해도 안 된다) */
export const BANNED = ['명식'];

/** {{ }} 로 표시되지 않은 채 쓰인 전문용어와 금지어 목록 */
export const unmarkedJargon = (text: string): string[] => {
  const stripped = text.replace(TERM_PATTERN, '');
  const found = JARGON.filter((j) => j.re.test(stripped)).map((j) => j.term);
  for (const b of BANNED) if (plainText(text).includes(b)) found.push(b);
  return found;
};

const bigrams = (s: string): Set<string> => {
  const t = s.replace(/[^가-힣0-9]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};

/** 두 문장의 뜻 겹침(문자 2-gram 자카드, 0~1) */
export const overlap = (a: string, b: string): number => {
  const x = bigrams(a);
  const y = bigrams(b);
  let inter = 0;
  for (const g of x) if (y.has(g)) inter++;
  return inter / (x.size + y.size - inter || 1);
};

/** 한 덩어리 안에서 가장 많이 겹치는 문장 쌍 */
export const worstOverlap = (sentences: string[]): { score: number; pair: [string, string] | null } => {
  let score = 0;
  let pair: [string, string] | null = null;
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const v = overlap(sentences[i], sentences[j]);
      if (v > score) {
        score = v;
        pair = [sentences[i], sentences[j]];
      }
    }
  }
  return { score, pair };
};

/** 겹침 허용 한계: 이 이상이면 같은 말을 되풀이한 것으로 본다 */
export const MAX_OVERLAP = 0.45;

/** 서식 이상(남은 표시, undefined, 이중 공백, 공백 앞 구두점) */
export const formatProblem = (text: string): string | null => {
  const t = plainText(text);
  if (/undefined|\[object|NaN|\{\{|\}\}/.test(t)) return '비정상 문자열 또는 남은 표시';
  if (/\s{2,}/.test(t)) return '이중 공백';
  if (/ [,.]/.test(t)) return '공백 뒤 구두점';
  return null;
};
