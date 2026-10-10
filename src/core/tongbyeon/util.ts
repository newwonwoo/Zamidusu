// 통변 문장 합성용 작은 도우미.
import { BRANCHES, BRANCHES_KO, STEMS, STEMS_KO } from '../ganzhi';
import { josa } from '../explain/korean';
import type { JosaType } from '../explain/korean';

/** {{용어}} + 조사(조사는 용어 기준으로 고른다) */
export const tj = (word: string, type: JosaType): string => `{{${word}}}${josa(word, type).slice(word.length)}`;
/** {{용어}} (조사는 뒤에 직접 붙인다) */
export const tm = (word: string): string => `{{${word}}}`;
/** 일반 낱말 + 조사 */
export const jo = (word: string, type: JosaType): string => josa(word, type);

export const stemLabel = (s: number): string => `${STEMS_KO[s]}(${STEMS[s]})`;
export const branchLabel = (b: number): string => `${BRANCHES_KO[b]}(${BRANCHES[b]})`;
/** “丁亥” → “정해(丁亥)” (한자만 적으면 읽지 못하는 사람이 많다) */
export const ganzhiLabel = (gz: string): string => {
  const si = STEMS.indexOf(gz[0] as never);
  const bi = BRANCHES.indexOf(gz[1] as never);
  return si < 0 || bi < 0 ? gz : `${STEMS_KO[si]}${BRANCHES_KO[bi]}(${gz})`;
};

/** 0~1 비중을 “23%” 로 */
export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** 점수를 +0.55 / −0.20 처럼 부호를 붙여 */
export const signed = (v: number, digits = 2): string => {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(digits)}`;
};

/** 목록을 “가·나·다” 로 */
export const dot = (list: string[]): string => list.join('·');

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const AUTO_TERMS = ['12운성', '건록', '재성', '관성', '비겁', '식상', '인성', '일간', '일지', '월지', '오행', '천을귀인'];
const AUTO_WORD_TERMS = ['합', '충'];
const PARTICLE = '(?:으로|이|가|은|는|을|를|과|와|의|도|에|로)?';

/**
 * 짧은 근거 문구 속의 전문용어에 {{ }} 표시를 자동으로 붙인다(이미 표시된 곳은 건드리지 않는다).
 * 합·충처럼 일반 낱말과 섞이기 쉬운 말은 앞뒤가 한글이 아닌 ‘낱말’일 때만 붙인다.
 */
export const autoMark = (text: string): string => {
  const parts = text.split(/(\{\{[^{}]+\}\})/);
  return parts
    .map((part) => {
      if (part.startsWith('{{')) return part;
      let out = part;
      for (const t of AUTO_TERMS) out = out.split(t).join(`{{${t}}}`);
      for (const t of AUTO_WORD_TERMS) {
        out = out.replace(new RegExp(`(?<![가-힣{])${t}(?=${PARTICLE}(?![가-힣]))`, 'g'), `{{${t}}}`);
      }
      return out;
    })
    .join('');
};

/** 이미 {{ }} 로 표시한 곳은 건드리지 않고, 나머지에서 주어진 용어만 표시한다(긴 용어부터) */
export const markTerms = (text: string, terms: readonly string[]): string => {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  return text
    .split(/(\{\{[^{}]+\}\})/)
    .map((part) => {
      if (part.startsWith('{{')) return part;
      let out = part;
      for (const t of sorted) out = out.split(t).join(`{{${t}}}`);
      return out;
    })
    .join('');
};
