import { GLOSSARY, TERM_PATTERN } from '../core/glossary';

export interface Segment {
  text: string;
  /** 용어이면 용어 이름 */
  term?: string;
  /** 이 화면에서 처음 나온 용어(풀이를 붙여 보여 준다) */
  first?: boolean;
}

const segmentsOf = (seen: Set<string>, text: string): Segment[] => {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TERM_PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ text: text.slice(last, idx) });
    const term = m[1];
    if (GLOSSARY[term]) {
      out.push({ text: term, term, first: !seen.has(term) });
      seen.add(term);
    } else {
      out.push({ text: term });
    }
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
};

/**
 * 여러 문장을 화면에 나오는 순서대로 훑으며 {{용어}} 를 분해한다.
 * 같은 용어는 처음 한 번만 first=true 로 표시해 쉬운 풀이를 함께 보여 준다(N-04 “용어”).
 */
export const annotate = (texts: string[]): Segment[][] => {
  const seen = new Set<string>();
  return texts.map((text) => segmentsOf(seen, text));
};

/**
 * 한 번 부를 때마다 “지금까지 나온 용어”를 기억하는 분해기. 화면 한 덩어리를 그릴 때 보이는 순서대로 부른다.
 * 부모 컴포넌트의 렌더 안에서만 부르고(자식에게는 결과를 넘긴다), 렌더마다 새로 만든다 — StrictMode 의 이중 호출에도 같은 결과가 나온다.
 */
export const makeAnnotator = (): ((text: string) => Segment[]) => {
  const seen = new Set<string>();
  return (text) => segmentsOf(seen, text);
};

export function TermText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (!s.term) return <span key={i}>{s.text}</span>;
        const entry = GLOSSARY[s.term];
        return s.first ? (
          <span key={i} className="term-first">
            <span className="term">{s.term}</span>
            <span className="gloss">{` (${entry.short})`}</span>
          </span>
        ) : (
          <abbr key={i} className="term" title={entry.more ? `${entry.short}. ${entry.more}` : entry.short}>
            {s.text}
          </abbr>
        );
      })}
    </>
  );
}

/** 한 덩어리 텍스트를 바로 그릴 때 쓰는 단축 컴포넌트(자기 안에서만 첫 등장 처리) */
export function Text({ children }: { children: string }) {
  return <TermText segments={annotate([children])[0]} />;
}
