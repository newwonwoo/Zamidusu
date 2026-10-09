// 화면과 같은 순서·같은 용어 풀이(처음 나올 때 한 번)로 칸 해설을 평문으로 옮긴다.
// docs/generated/explain-sample.md 를 만들고(WRITE_EXPLAIN_SAMPLE=1), 독자 시험(V-22)의 입력을 만드는 데 쓴다.
import { plainText } from '../src/core/glossary';
import { PALACE_KO } from '../src/core/names';
import type { PalaceExplain, StarExplain } from '../src/core/explain/compose';

const KIND_LABEL: Record<string, string> = { body: '풀이', natal: '본명 기준', brightness: '밝기', mutagen: '', saju: '사주와 같은 점' };

/** 화면의 용어 첫 등장 순서(flattenTexts)와 같은 순서로 풀이를 붙인 뒤, 화면에 보이는 배치대로 조립한다 */
export const renderPalace = (p: PalaceExplain, opts: { gloss?: boolean; heading?: string } = {}): string => {
  const gloss = opts.gloss ?? true;
  const seen = new Set<string>();
  const R = (t: string): string => plainText(t, gloss, seen);
  const overview = R(p.overview);
  const scopeNote = p.scopeNote ? R(p.scopeNote) : '';
  const head = R(p.glance.headline);
  const pts = p.glance.points.map((x) => R(x.text));
  const empty = p.emptyNotice ? R(p.emptyNotice) : '';
  const combos = p.combos.map((c) => ({ c, where: R(c.where), text: R(c.text) }));
  const flows = p.flowNotes.map((f) => R(f));
  const cards = new Map<StarExplain, string[]>();
  const all = [...p.stars, ...p.borrowed];
  // 접힌 “사주와 같은 점” 블록은 화면과 같이 맨 뒤에서 풀이를 붙인다
  for (const s of all) cards.set(s, s.blocks.map((b) => (b.kind === 'saju' ? '' : R(b.text))));
  const saju = R(p.sajuLine);
  for (const s of all) s.blocks.forEach((b, i) => { if (b.kind === 'saju') cards.get(s)![i] = R(b.text); });

  const lines: string[] = [];
  lines.push(`## ${opts.heading ?? `${p.title} (${p.subtitle})`}`, '', overview);
  if (scopeNote) lines.push('', scopeNote);
  lines.push('', '**한눈에 보기**', '', head, '');
  p.glance.points.forEach((x, i) => lines.push(`- ${x.label}: ${pts[i]}`));
  lines.push('', `함께 읽는 칸: ${p.surround.map((s) => `${PALACE_KO[s.name]}(${s.ganzhi}·${s.role})`).join(', ')}`);
  if (empty) lines.push('', empty);
  if (combos.length) {
    lines.push('', '**조합 해설**', '');
    for (const x of combos) lines.push(`- ${x.c.name}(${x.c.hanja}) — ${x.where}: ${x.text}`);
  }
  if (flows.length) {
    lines.push('', '**이 칸에 흐르는 운**', '');
    for (const f of flows) lines.push(`- ${f}`);
  }
  const star = (s: StarExplain, prefix: string): void => {
    const texts = cards.get(s)!;
    lines.push('', `${prefix}${s.blocks[0].text}`);
    s.blocks.slice(1).forEach((b, i) => {
      const label = b.kind === 'mutagen' ? b.label : KIND_LABEL[b.kind] || b.label;
      lines.push(`  - ${label}: ${texts[i + 1]}`);
    });
  };
  if (p.stars.length) lines.push('', '**별 해설**');
  for (const s of p.stars) star(s, '- ');
  if (p.borrowed.length) lines.push('', '**빌려 온 별**');
  for (const s of p.borrowed) star(s, '- ');
  lines.push('', '**사주로 보면**', '', saju);
  return lines.join('\n');
};
