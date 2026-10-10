// 화면과 같은 순서·같은 용어 풀이(처음 나올 때 한 번)로 칸 해설을 평문으로 옮긴다.
// docs/generated/explain-sample.md 를 만들고(WRITE_EXPLAIN_SAMPLE=1), 독자 시험(V-22)의 입력을 만드는 데 쓴다.
import { plainText } from '../src/core/glossary';
import { PALACE_KO } from '../src/core/names';
import type { PalaceExplain, StarExplain } from '../src/core/explain/compose';
import { DOMAINS, DOMAIN_LABEL, LEVEL_LABEL, LEVEL_MARK, VERDICT_LABEL, themeLabel, whyOf } from '../src/core/tongbyeon';
import type { Domain, DomainReading, Overview, PeriodReading, Tongbyeon } from '../src/core/tongbyeon';

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

/**
 * 통변(종합 통변 · 사주 통변 · 통변 비교)을 화면과 같은 순서의 평문으로 옮긴다. 탭마다 용어 풀이는 처음 나올 때 한 번만 붙인다.
 * 화면에서 접혀 있는 것(성격·기질 카드의 풀이, 근거 보기)은 뺀다. docs/generated/tongbyeon-sample.md 와 독자 시험의 입력을 만든다(WRITE_TONGBYEON_DOCS=1).
 */
export const renderTongbyeon = (tb: Tongbyeon, heading: string): string => {
  const out: string[] = [`## ${heading}`, ''];
  const system = (name: string, ov: Overview, domains: Record<Domain, DomainReading>, periods: PeriodReading[], nowIdx: number, periodNote?: string): void => {
    const seen = new Set<string>();
    const R = (t: string): string => plainText(t, true, seen);
    // 화면과 같은 순서로 풀이를 붙인다: 총평 → (성격을 뺀) 영역 카드 → 10년 흐름
    const headlineText = R(ov.headline);
    const paragraphs = ov.paragraphs.map((p) => ({ label: p.label, text: p.sentences.map(R).join(' ') }));
    const adviceText = ov.advice.map(R);
    const cards = new Map<Domain, { verdict: string; why: string[]; points: { label: string; text: string }[]; advice: string }>();
    for (const d of DOMAINS) {
      if (d === 'self') continue;
      const r = domains[d];
      cards.set(d, { verdict: R(r.verdict), why: whyOf(r).map(R), points: r.points.map((p) => ({ label: p.label, text: R(p.text) })), advice: R(r.advice) });
    }
    const periodText = periods.map((p) => R(p.headline));
    const selfR = domains.self;
    const selfCard = { verdict: R(selfR.verdict), why: whyOf(selfR).map(R), advice: R(selfR.advice) };

    out.push(`### ${name}`, '', `**${headlineText}**`, '', `핵심어: ${ov.keywords.map((k) => plainText(k)).join(' · ')}`, '');
    for (const p of paragraphs) out.push(`**${p.label}** — ${p.text}`, '');
    out.push('**종합 조언**', '', ...adviceText.map((a) => `- ${a}`), '');
    for (const d of DOMAINS) {
      const r = domains[d];
      const c = d === 'self' ? { ...selfCard, points: [] as { label: string; text: string }[] } : (cards.get(d) as NonNullable<ReturnType<typeof cards.get>>);
      out.push(`#### ${DOMAIN_LABEL[d]} — ${LEVEL_MARK[r.level]} ${LEVEL_LABEL[r.level]}`, '', c.verdict, '');
      out.push(`핵심 주제: ${r.themes.map((t) => themeLabel(d, t)).join(' · ') || '없음'}`);
      if (c.why.length > 0) out.push(`이렇게 본 이유: ${c.why.join(' · ')}`);
      out.push('');
      if (d === 'self') out.push('_(“풀이 자세히 보기”는 화면에서 접혀 있어 여기서는 뺐습니다.)_', '');
      for (const p of c.points) out.push(`- ${p.label}: ${p.text}`);
      out.push('', `조언: ${c.advice}`, '');
    }
    out.push('#### 10년 단위 흐름', '');
    if (periodNote) out.push(`_${periodNote}_`, '');
    periods.forEach((p, i) => {
      out.push(`- ${p.label}(${p.system === 'saju' ? '만 ' : ''}${p.startAge}~${p.endAge}세, ${p.startYear}~${p.endYear}년) ${LEVEL_MARK[p.level]}${i === nowIdx ? ' [지금]' : ''}${p.standingNote ? ` **${p.standingNote}**` : ''} ${periodText[i]}`);
      if (p.highlights.length > 0) out.push(`  - ${p.system === 'ziwei' ? '받쳐 주는 영역' : '강조되는 영역'}: ${p.highlights.map((d) => DOMAIN_LABEL[d]).join(', ')}`);
      if (p.cautions && p.cautions.length > 0) out.push(`  - 신경 쓸 영역: ${p.cautions.map((d) => DOMAIN_LABEL[d]).join(', ')}`);
    });
    out.push('');
  };
  system('자미두수 종합 통변', tb.ziwei.overview, tb.ziwei.domains, tb.ziwei.decades, tb.now.ziweiDecade, tb.ziwei.decadeNote);
  system('사주 통변', tb.saju.overview, tb.saju.domains, tb.saju.daeun, tb.now.sajuDaeun, tb.saju.daeunNote);

  const seen = new Set<string>();
  const R = (t: string): string => plainText(t, true, seen);
  const c = tb.comparison;
  // 화면은 요약 → 영역마다 렌즈 → 두 쪽의 이유 순서로 풀이를 붙인다
  const summaryText = c.summary.map(R);
  const sides = c.domains.map((d) => ({ lens: R(d.lens), whyZ: d.whyZiwei.map(R), whyS: d.whySaju.map(R) }));
  out.push('### 통변 비교', '', ...summaryText.map((x) => `- ${x}`), '');
  c.domains.forEach((d, i) => {
    const sd = sides[i];
    out.push(`#### ${DOMAIN_LABEL[d.domain]} — ${VERDICT_LABEL[d.verdict]}`, '', `${d.headline}${d.nuance ? ` ${d.nuance}` : ''}`, '');
    out.push(`- 자미두수 ${LEVEL_MARK[d.ziwei.level]} ${LEVEL_LABEL[d.ziwei.level]}${sd.whyZ.length ? ` — 근거: ${sd.whyZ.join(' · ')}` : ''}`);
    out.push(`- 사주 ${LEVEL_MARK[d.saju.level]} ${LEVEL_LABEL[d.saju.level]}${sd.whyS.length ? ` — 근거: ${sd.whyS.join(' · ')}` : ''}`);
    const list = (label: string, xs: string[]): void => {
      out.push(`- ${label}: ${xs.length ? xs.map((x) => plainText(x)).join(' · ') : '없음'}`);
    };
    list('두 체계가 함께 말한 것', d.shared);
    list('자미두수만 말한 것', d.onlyZiwei);
    list('사주만 말한 것', d.onlySaju);
    // 같은 판정의 읽는 법은 첫 카드에만 적는다(화면과 같음)
    out.push('', sd.lens, '');
    if (c.domains.findIndex((x) => x.verdict === d.verdict) === i) out.push(`**읽는 법** ${d.reading}`, '');
  });
  out.push('#### 10년 단위 시기 비교', '');
  for (const p of c.periods) out.push(`- ${p.ziwei.label}(${p.ziwei.startYear}~${p.ziwei.endYear}년)${p.saju ? ` ↔ ${p.saju.label}(${p.saju.startYear}~${p.saju.endYear}년)` : ''} ${p.verdict ? VERDICT_LABEL[p.verdict] : '짝 없음'}: ${R(p.note)}`);
  out.push('');
  return out.join('\n');
};
