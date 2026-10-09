// V-10 해설 반응성(I-11, I-12) · V-11 길이 균일·궁별 다양성(I-13, I-14) · R-07 범위 · N-04 구성 요소
import { describe, expect, it } from 'vitest';
import { plainText } from '../src/core/glossary';
import { josa, hasBatchim } from '../src/core/explain/korean';
import { STAR_META, MUTAGENS, PALACE_KEYS, PALACE_KO, SCOPES, MUTAGEN_LONG_KO } from '../src/core/names';
import type { PalaceKey, Scope } from '../src/core/names';
import { MAIN_PALACE_LINES, STAR_PROFILES } from '../src/core/explain/stars';
import { ROLE_META, ROLE_PALACE_LINES } from '../src/core/explain/roles';
import { PALACES } from '../src/core/explain/palaces';
import {
  buildSummary, composeStar, explainPalace, brightnessText, mutagenText, sajuPalaceText,
} from '../src/core/explain/compose';
import type { StarContext } from '../src/core/explain/compose';
import type { Brightness7 } from '../src/core/brightness';
import { buildView, viewForDecade, decadalList } from '../src/core/chart';
import { lunarJavascriptEngine } from '../src/core/saju';
import { makeChart } from './helpers';

const B7: Brightness7[] = ['miao', 'wang', 'de', 'li', 'ping', 'bu', 'xian'];
const plain = (t: string): string => plainText(t);

const ctxOf = (scope: Scope, scoped: PalaceKey, natal: PalaceKey, mode: '5' | '7' = '5'): StarContext => ({
  scope, scopedPalace: scoped, natalPalace: natal, mode, saju: { yearStem: 6, yearBranch: 6, dayStem: 1 },
});

describe('조사 처리', () => {
  it('받침 유무에 따라 이/가·은/는·을/를·과/와·으로/로·이라/라를 맞춘다', () => {
    expect(josa('재물', '이/가')).toBe('재물이');
    expect(josa('마음', '은/는')).toBe('마음은');
    expect(josa('가정', '을/를')).toBe('가정을');
    expect(josa('형제·동료와의 관계', '과/와')).toBe('형제·동료와의 관계와');
    expect(josa('방식', '과/와')).toBe('방식과');
    expect(josa('묘', '으로/로')).toBe('묘로');
    expect(josa('함', '으로/로')).toBe('함으로');
    expect(josa('불', '으로/로')).toBe('불로'); // ㄹ 받침은 “로”
    expect(josa("'왕'", '이라/라')).toBe("'왕'이라");
    expect(josa("'묘'", '이라/라')).toBe("'묘'라");
    expect(josa('천월(月)', '이/가')).toBe('천월(月)이');
    expect(josa('면', '이/가')).toBe('면이');
    expect(hasBatchim('3')).toBe(true);
    expect(hasBatchim('2')).toBe(false);
  });
});

describe('R-07 범위: 별 이름 전부에 해설이 있다', () => {
  it('이름표의 모든 별(66개)에 사전이 있고, 주성은 12궁 문장을 모두 갖는다', () => {
    const keys = Object.keys(STAR_META);
    expect(keys).toHaveLength(14 + 8 + 6 + 38);
    for (const k of keys) expect(STAR_PROFILES[k], `사전에 없음: ${k}`).toBeTruthy();
    for (const k of keys.filter((x) => STAR_META[x].group === 'main')) {
      expect(Object.keys(MAIN_PALACE_LINES[k]).sort()).toEqual([...PALACE_KEYS].sort());
    }
    for (const role of Object.keys(ROLE_META)) expect(Object.keys(ROLE_PALACE_LINES[role as keyof typeof ROLE_PALACE_LINES])).toHaveLength(12);
    for (const k of PALACE_KEYS) expect(PALACES[k].topic.length).toBeGreaterThan(5);
  });
});

describe('V-10 반응성: 밝기·사화·운 모드·궁에 따라 문장이 바뀐다 (I-12)', () => {
  it('밝기: 7단계는 7가지, 5단계는 5가지 서로 다른 문장', () => {
    const p = STAR_PROFILES['紫微'];
    expect(new Set(B7.map((b) => brightnessText(p, b, '7'))).size).toBe(7);
    expect(new Set(B7.map((b) => brightnessText(p, b, '5'))).size).toBe(5);
    expect(brightnessText(p, 'miao', '5')).toContain("'묘'로");
    expect(brightnessText(p, 'xian', '5')).toContain('보완하면 도움이 됩니다');
    expect(brightnessText(p, 'xian', '5')).toContain('힘이 가장 약한 자리입니다');
  });

  it('사화: 네 가지가 모두 다르고, 운 모드마다 접두어와 시기 표현이 달라진다', () => {
    const p = STAR_PROFILES['武曲'];
    const topic = PALACES.wealth.topic;
    expect(new Set(MUTAGENS.map((m) => mutagenText(p, { mutagen: m, scope: 'natal' }, topic))).size).toBe(4);
    expect(new Set(SCOPES.map((s) => mutagenText(p, { mutagen: 'lu', scope: s }, topic))).size).toBe(6);
    expect(mutagenText(p, { mutagen: 'ji', scope: 'yearly' }, topic)).toContain('유년');
    expect(mutagenText(p, { mutagen: 'ji', scope: 'yearly' }, topic)).toContain('올해');
    expect(mutagenText(p, { mutagen: 'lu', scope: 'decadal' }, topic)).toContain('이 10년 동안');
    for (const m of MUTAGENS) expect(mutagenText(p, { mutagen: m, scope: 'natal' }, topic)).toContain(`{{${MUTAGEN_LONG_KO[m]}}}`);
  });

  it('블록 구성: 밝기·사화·사주 대응은 있을 때만 붙는다', () => {
    const base = composeStar({ key: '紫微', mutagens: [] }, ctxOf('natal', 'life', 'life'));
    expect(base.blocks.map((b) => b.kind)).toEqual(['summary', 'body']);
    const lok = composeStar({ key: '祿存', mutagens: [] }, ctxOf('natal', 'wealth', 'wealth'));
    expect(lok.blocks.map((b) => b.kind)).toEqual(['summary', 'body', 'saju']); // 녹존은 사주 건록과 직접 대응
    const withBr = composeStar({ key: '文昌', brightness: 'de', mutagens: [{ mutagen: 'ke', scope: 'natal' }] }, ctxOf('natal', 'parents', 'parents'));
    expect(withBr.blocks.map((b) => b.kind)).toEqual(['summary', 'body', 'brightness', 'mutagen', 'saju']);
    const two = composeStar(
      { key: '太陽', brightness: 'miao', mutagens: [{ mutagen: 'lu', scope: 'natal' }, { mutagen: 'ji', scope: 'yearly' }] }, ctxOf('yearly', 'career', 'career'),
    );
    expect(two.blocks.filter((b) => b.kind === 'mutagen').map((b) => b.label)).toEqual(['생년 사화', '유년 사화']);
  });

  it('운 모드: 본명과 다른 궁 이름이면 “본명 기준” 블록이 더해지고, 같으면 생략된다', () => {
    const a = composeStar({ key: '天機', mutagens: [] }, ctxOf('decadal', 'wealth', 'travel'));
    expect(a.blocks.map((b) => b.kind)).toEqual(['summary', 'body', 'natal']);
    expect(a.blocks[2].text).toContain('본명으로는 천이궁');
    const same = composeStar({ key: '天機', mutagens: [] }, ctxOf('decadal', 'travel', 'travel'));
    expect(same.blocks.map((b) => b.kind)).toEqual(['summary', 'body']);
    const nat = composeStar({ key: '天機', mutagens: [] }, ctxOf('natal', 'wealth', 'wealth'));
    expect(nat.blocks.map((b) => b.kind)).toEqual(['summary', 'body']);
    // 운 모드의 풀이는 그 시기의 궁(재백)을 따르고, 궁이 바뀌면 풀이도 바뀐다
    expect(a.blocks[1].text).toBe(nat.blocks[1].text);
    const career = composeStar({ key: '天機', mutagens: [] }, ctxOf('decadal', 'career', 'travel'));
    expect(career.blocks[1].text).not.toBe(a.blocks[1].text);
  });

  it('차성안궁: 빌려 온 별은 요약·풀이만 갖고 “빌려 온 별”로 표시된다', () => {
    const b = composeStar({ key: '天機', mutagens: [{ mutagen: 'lu', scope: 'natal' }], brightness: 'wang' }, { ...ctxOf('natal', 'life', 'life'), borrowed: true });
    expect(b.borrowed).toBe(true);
    expect(b.blocks.map((x) => x.kind)).toEqual(['summary', 'body']);
    expect(b.blocks[0].text.startsWith('빌려 온 별 · ')).toBe(true);
  });
});

describe('V-11 궁별 다양성(I-14) — 분량 균일(I-13)은 사용자 결정으로 목표에서 뺐다(설계서 부록 B, 문장 규칙은 readability.test.ts)', () => {
  it('주성의 12궁 풀이는 모두 다르다(14 × 12 = 168, 중복 0). 그 밖의 별은 역할 × 궁 문장(13 × 12 = 156)이 궁마다 다르다', () => {
    for (const key of Object.keys(STAR_META).filter((k) => STAR_META[k].group === 'main')) {
      const bodies = PALACE_KEYS.map((pk) => composeStar({ key, mutagens: [] }, ctxOf('natal', pk, pk)).blocks[1].text);
      expect(new Set(bodies).size, key).toBe(12);
    }
    const lines = new Set<string>();
    for (const [role, byPalace] of Object.entries(ROLE_PALACE_LINES)) {
      expect(new Set(Object.values(byPalace)).size, role).toBe(12);
      for (const l of Object.values(byPalace)) lines.add(l);
    }
    expect(lines.size).toBe(156);
  });

  it('같은 궁의 서로 다른 주성 풀이도 겹치지 않는다(14 × 12 = 168문장 전부 유일)', () => {
    const all = new Set<string>();
    for (const lines of Object.values(MAIN_PALACE_LINES)) for (const l of Object.values(lines)) all.add(l);
    expect(all.size).toBe(168);
  });

  it('주성 동궁 조합 24종이 등록돼 있다', async () => {
    const mod = await import('../src/core/explain/combos');
    expect(mod.MAIN_PAIR_COUNT).toBe(24);
  });
});

describe('궁 단위 해설(T6)', () => {
  const chart = makeChart(1990, 1, 30, 6, 'M');
  const saju = lunarJavascriptEngine.compute({
    instantUtcMs: chart.norm.instantUtcMs, clock: chart.norm.corrected!, hourKnown: true, gender: 'M', lateZi: 'next',
  });
  const natal = buildView(chart, 'natal', null);
  const at = (b: number) => explainPalace(chart, natal, b, { saju, mode: '5' });

  it('명궁(申): 주성이 없어 대궁(천이궁)의 주성 천기·태음을 빌려 읽는다(차성안궁)', () => {
    const p = at(chart.meta.soulBranch);
    expect(p.title).toBe('명궁');
    expect(p.emptyNotice).toContain('천이궁');
    expect(p.emptyNotice).toContain('천기·태음');
    expect(p.emptyNotice).toContain('{{차성안궁}}');
    expect(p.borrowed.map((s) => s.ko)).toEqual(['천기', '태음']);
    expect(p.stars.map((s) => s.ko)).toEqual(['녹존', '천마', '고신', '봉고', '해신']);
  });

  it('명궁(申): 녹존 + 천마 → 녹마교치, 사주 대응 문장에 이 명식의 일간(乙)이 들어간다', () => {
    const p = at(chart.meta.soulBranch);
    expect(p.combos.map((c) => c.name)).toContain('녹마교치');
    expect(plain(p.sajuLine)).toContain('이 사주의 일간은 을(乙)');
    expect(plain(p.sajuLine)).toContain('풀과 덩굴처럼 부드럽고 끈질긴 성향');
    expect(plain(p.sajuLine)).toContain('태어난 달은 축(丑)월(늦겨울)');
    // 개수 표현: 0개도 같은 형식
    expect(plain(at(chart.palaces.find((x) => x.natalName === 'siblings')!.branch).sajuLine)).toContain('이 사주에는 비겁이 하나도 없습니다');
    expect(plain(at(chart.palaces.find((x) => x.natalName === 'fortune')!.branch).sajuLine)).toContain('식상은 3개로 많은 편입니다. 인성은 1개로 적은 편입니다');
    const lok = p.stars.find((s) => s.key === '祿存')!;
    expect(lok.blocks.map((b) => b.kind)).toContain('saju');
    expect(plain(lok.blocks.find((b) => b.kind === 'saju')!.text)).toContain('경(庚)의 건록은 신(申)');
  });

  it('형제궁(未): 염정 + 칠살 → 염살동궁, 밝기·사화 블록이 별에 따라 붙는다', () => {
    const b = chart.palaces.find((p) => p.natalName === 'siblings')!.branch;
    const p = at(b);
    expect(p.combos.map((c) => c.name)).toContain('염살동궁');
    const kinds = p.stars.find((s) => s.key === '七殺')!.blocks.map((x) => x.kind);
    expect(kinds).toEqual(['summary', 'body', 'brightness']);
  });

  it('복덕궁(戌): 천동 화기 → 사화 블록(생년 화기)', () => {
    const b = chart.palaces.find((p) => p.natalName === 'fortune')!.branch;
    const p = at(b);
    const dong = p.stars.find((s) => s.key === '天同')!;
    const m = dong.blocks.find((x) => x.kind === 'mutagen')!;
    expect(m.label).toBe('생년 사화');
    expect(m.text).toContain('{{화기}}');
    expect(p.score.bad).toBeGreaterThan(0);
  });

  it('대한 모드: 시기 안내와 운 사화/운 유성 문장이 나온다', () => {
    const age = decadalList(chart)[1].startAge; // 12세 구간: 酉궁이 대한 명궁
    const v = viewForDecade(chart, age);
    const p = explainPalace(chart, v, v.lifeBranch, { saju, mode: '5' });
    expect(p.title).toBe('명궁');
    expect(p.scopeNote).toContain('{{대한}} 기준 명궁에 해당합니다');
    const allFlow = Array.from({ length: 12 }, (_, b) => explainPalace(chart, v, b, { saju, mode: '5' }).flowNotes).flat();
    expect(allFlow.length).toBeGreaterThanOrEqual(10); // 대한 유성 10종이 각 칸에 흩어진다
    expect(plain(allFlow.join(' '))).toContain('대한 녹존');
    expect(allFlow.join(' ')).toContain('{{대한}} 녹존');
    const other = explainPalace(chart, v, chart.meta.soulBranch, { saju, mode: '5' });
    expect(other.title).toBe('형제궁'); // 본명 명궁(申)은 이 대한에서 형제궁
    expect(other.subtitle).toContain('본명 명궁');
    expect(other.scopeNote).toContain('본명으로는 명궁');
  });

  it('요약표: 12행이 명궁→부모 순서이고 명궁 행은 신궁이기도 하다', () => {
    const rows = buildSummary(chart, natal, '5');
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.scopedName)).toEqual(PALACE_KEYS);
    expect(rows[0].isLife && rows[0].isBody).toBe(true);
    expect(rows[0].borrowedFrom).toEqual(['천기', '태음']);
    const wealth = rows.find((r) => r.scopedName === 'wealth')!;
    expect(wealth.mains.map((m) => m.ko)).toEqual(['거문']);
    expect(wealth.mains[0].brightness?.text).toBe('함');
  });

  it('사주 정보가 없어도(시 모름 등) 개념 문장만으로 동작한다', () => {
    expect(sajuPalaceText('wealth', null, 'M')).toBe(PALACES.wealth.saju);
    const wealthBranch = chart.palaces.find((x) => x.natalName === 'wealth')!.branch;
    const p = explainPalace(chart, natal, wealthBranch, { saju: null, mode: '7' });
    expect(p.sajuLine).toContain('재성');
  });

  it('모든 궁(12)과 모든 운 모드(6)에서 오류 없이 해설이 만들어진다', () => {
    const target = { date: { y: 2026, m: 10, d: 9 }, timeIndex: 6 };
    for (const scope of SCOPES) {
      const v = scope === 'natal' ? natal : scope === 'decadal' ? viewForDecade(chart, decadalList(chart)[3].startAge) : buildView(chart, scope, target);
      for (let b = 0; b < 12; b++) {
        const p = explainPalace(chart, v, b, { saju, mode: '5' });
        expect(PALACE_KO[p.scopedName]).toBe(p.title);
        for (const s of p.stars) expect(s.blocks.length).toBeGreaterThanOrEqual(2);
        for (const c of p.combos) expect(c.text.length).toBeGreaterThan(10);
      }
    }
  });
});
