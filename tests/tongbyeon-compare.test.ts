// V-28 통변 비교(설계 부록 D-7, 요구 T-04·T-05): 판정 규칙·시기 짝짓기·공통/각자 주제 분할을 독립 구현·전수 표와 대조한다.
import { describe, expect, it } from 'vitest';
import { compareAll, compareDomain, pairPeriods, verdictOf, whyOf } from '../src/core/tongbyeon/compare';
import { DOMAINS, DOMAIN_LABEL, LEVELS, LEVEL_LABEL, THEMES } from '../src/core/tongbyeon';
import type { Domain, DomainReading, Level, PeriodReading, Verdict } from '../src/core/tongbyeon';
import { rng } from './helpers';
import { tbSample } from './tbsample';

const V: Record<string, Verdict> = { A: 'agree', M: 'complement', X: 'conflict' };
/** 자미두수 단계(행 −2…+2) × 사주 단계(열 −2…+2). A 일치 · M 보완 · X 엇갈림 */
const TABLE = ['AAMXX', 'AAMXX', 'MMAMM', 'XXMAA', 'XXMAA'];

const reading = (system: 'ziwei' | 'saju', domain: Domain, level: Level, themes: string[] = [], reasons: DomainReading['reasons'] = []): DomainReading => ({
  system, domain, level, score: 0, title: '', verdict: '', points: [], themes, advice: '', reasons, evidence: [],
});

const period = (system: 'ziwei' | 'saju', startYear: number, level: Level, label = 'x'): PeriodReading => ({
  system, label, startAge: 0, endAge: 9, startYear, endYear: startYear + 9, level, score: 0, fine: 0, headline: '', highlights: [], evidence: [],
});

describe('V-28 판정 규칙', () => {
  it('5 × 5 전수: 판정 함수가 독립 표와 같다', () => {
    for (const z of LEVELS) for (const s of LEVELS) expect(verdictOf(z, s), `자미 ${z} / 사주 ${s}`).toBe(V[TABLE[z + 2][s + 2]]);
  });

  it('대칭·부호 불변: 두 체계를 바꿔도 같고, 단계의 크기가 아니라 부호만 본다', () => {
    for (const z of LEVELS) for (const s of LEVELS) {
      expect(verdictOf(z, s)).toBe(verdictOf(s, z));
      expect(verdictOf(z, s)).toBe(verdictOf(Math.sign(z) as Level, Math.sign(s) as Level));
    }
  });

  it('영역 비교: 공통·자미두수만·사주만 주제가 서로 겹치지 않고 합치면 각 체계의 주제가 된다(무작위 5,000건)', () => {
    const r = rng(28001);
    for (let n = 0; n < 5000; n++) {
      const d = DOMAINS[Math.floor(r() * 6)];
      const ids = Object.keys(THEMES[d]);
      const pick = (): string[] => ids.filter(() => r() < 0.4).slice(0, 3);
      const zt = pick();
      const st = pick();
      const c = compareDomain(reading('ziwei', d, LEVELS[Math.floor(r() * 5)], zt), reading('saju', d, LEVELS[Math.floor(r() * 5)], st));
      const label = (t: string): string => THEMES[d][t];
      expect(c.shared).toEqual(zt.filter((t) => st.includes(t)).map(label));
      expect([...c.shared, ...c.onlyZiwei].sort()).toEqual(zt.map(label).sort());
      expect([...c.shared, ...c.onlySaju].sort()).toEqual(st.map(label).sort());
      expect(c.onlyZiwei.filter((x) => c.onlySaju.includes(x))).toEqual([]);
      expect(c.verdict).toBe(verdictOf(c.ziwei.level, c.saju.level));
    }
  });

  it('근거 요약: 좋은 단계에는 좋은 근거만, 신경 쓸 단계에는 나쁜 근거만, 무난에는 양쪽 한 개씩', () => {
    const reasons = [
      { rule: 'a', brief: '가', delta: 0.6 }, { rule: 'b', brief: '나', delta: -0.7 }, { rule: 'c', brief: '다', delta: 0.3 }, { rule: 'd', brief: '라', delta: -0.2 },
    ].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    expect(whyOf(reading('saju', 'wealth', 2, [], reasons))).toEqual(['가', '다']);
    expect(whyOf(reading('saju', 'wealth', 1, [], reasons))).toEqual(['가', '다']);
    expect(whyOf(reading('saju', 'wealth', -1, [], reasons))).toEqual(['나', '라']);
    expect(whyOf(reading('saju', 'wealth', -2, [], reasons))).toEqual(['나', '라']);
    expect(whyOf(reading('saju', 'wealth', 0, [], reasons))).toEqual(['가', '나']);
    expect(whyOf(reading('saju', 'wealth', 0, [], []))).toEqual([]);
    // 단계가 낮은데 나쁜 요소가 없거나(좋은 단계에 좋은 요소가 없을 때) 근거가 비면 그 사실을 적는다
    const onlyGood = [{ rule: 'a', brief: '가', delta: 0.6 }];
    const onlyBad = [{ rule: 'b', brief: '나', delta: -0.7 }];
    expect(whyOf(reading('ziwei', 'self', -1, [], onlyGood))).toEqual(['뚜렷한 약점은 없지만 받쳐 주는 요소가 적음']);
    expect(whyOf(reading('ziwei', 'self', 2, [], onlyBad))).toEqual(['뚜렷한 강점은 없지만 약점이 적음']);
    expect(whyOf(reading('ziwei', 'self', -2, [], onlyBad))).toEqual(['나']);
  });
});

describe('V-28 시기 짝짓기(대한 ↔ 대운)', () => {
  const oracle = (zs: PeriodReading[], ss: PeriodReading[]): (number | null)[] =>
    zs.map((z) => {
      let best = -1;
      let bestN = 0;
      ss.forEach((s, i) => {
        let n = 0;
        for (let y = z.startYear; y <= z.endYear; y++) if (y >= s.startYear && y <= s.endYear) n++;
        if (n > bestN) {
          bestN = n;
          best = i;
        }
      });
      return bestN >= 3 ? best : null;
    });

  it('무작위 4,000쌍: 연도를 하나씩 세어 가장 많이 겹치는 대운(동률은 앞 대운, 3년 미만은 짝 없음)과 같다', () => {
    const r = rng(28002);
    let nulls = 0;
    let ties = 0;
    for (let n = 0; n < 4000; n++) {
      const z0 = 1900 + Math.floor(r() * 150);
      const zs = Array.from({ length: 12 }, (_, i) => period('ziwei', z0 + i * 10, LEVELS[Math.floor(r() * 5)]));
      const s0 = z0 - 9 + Math.floor(r() * 20);
      const ss = Array.from({ length: 9 }, (_, i) => period('saju', s0 + i * 10, LEVELS[Math.floor(r() * 5)], `d${i}`));
      const want = oracle(zs, ss);
      const got = pairPeriods(zs, ss).map((p) => (p.saju ? ss.indexOf(p.saju) : null));
      expect(got).toEqual(want);
      nulls += want.filter((x) => x === null).length;
      // 정확히 5년씩 겹쳐 동률이 되는 경우도 지나가는지
      if (z0 % 10 === (s0 % 10 + 5) % 10) ties++;
    }
    expect(nulls).toBeGreaterThan(100);
    expect(ties).toBeGreaterThan(100);
  });

  it('짝이 있으면 판정이 두 단계의 판정과 같고, 없으면 판정이 없다', () => {
    const r = rng(28003);
    const zs = Array.from({ length: 12 }, (_, i) => period('ziwei', 2000 + i * 10, LEVELS[Math.floor(r() * 5)]));
    const ss = Array.from({ length: 9 }, (_, i) => period('saju', 1995 + i * 10, LEVELS[Math.floor(r() * 5)]));
    for (const p of pairPeriods(zs, ss)) {
      if (p.saju) expect(p.verdict).toBe(verdictOf(p.ziwei.level, p.saju.level));
      else expect(p.verdict).toBeNull();
    }
  });
});

describe('V-28 실제 명반 300개의 비교 결과', () => {
  const sample = tbSample(300, 2026101);

  it('판정은 두 영역 단계에서 규칙대로 나오고, 개수 요약과 문장이 일치한다', () => {
    for (const { tb } of sample) {
      const c = tb.comparison;
      expect(c.domains.map((d) => d.domain)).toEqual(DOMAINS);
      const counts: Record<Verdict, number> = { agree: 0, complement: 0, conflict: 0 };
      for (const d of c.domains) {
        expect(d.verdict).toBe(verdictOf(tb.ziwei.domains[d.domain].level, tb.saju.domains[d.domain].level));
        expect(d.ziwei).toBe(tb.ziwei.domains[d.domain]);
        expect(d.saju).toBe(tb.saju.domains[d.domain]);
        counts[d.verdict]++;
      }
      expect(c.counts).toEqual(counts);
      expect(c.summary[0]).toBe(`여섯 영역 중 ${counts.agree}개는 일치, ${counts.complement}개는 보완, ${counts.conflict}개는 엇갈립니다.`);
      const pc = { agree: 0, complement: 0, conflict: 0 };
      for (const p of c.periods) if (p.verdict) pc[p.verdict]++;
      expect(c.periodCounts).toEqual(pc);
    }
  });

  it('엇갈림에는 “판정하지 않는다”는 안내가, 일치·보완에는 각각의 읽는 법이 붙는다', () => {
    let seen = { agree: 0, complement: 0, conflict: 0 };
    for (const { tb } of sample) {
      for (const d of tb.comparison.domains) {
        seen[d.verdict]++;
        if (d.verdict === 'conflict') expect(d.reading).toContain('판정하지 않으니');
        if (d.verdict === 'complement') expect(d.reading).toContain('확정으로 받아들이지는 마세요');
        if (d.verdict === 'agree') expect(d.reading).toContain('맞는다는 증거는 아니고');
        expect(d.headline.length).toBeGreaterThan(10);
      }
    }
    expect(seen.agree).toBeGreaterThan(300);
    expect(seen.complement).toBeGreaterThan(300);
    expect(seen.conflict).toBeGreaterThan(300);
  });

  it('요약은 가장 분명한 일치와 가장 큰 엇갈림을 실제 값으로 가리킨다(동률은 영역 순서가 앞선 쪽)', () => {
    for (const { tb } of sample) {
      const c = tb.comparison;
      const agrees = c.domains.filter((d) => d.verdict === 'agree' && d.ziwei.level !== 0);
      const conflicts = c.domains.filter((d) => d.verdict === 'conflict');
      const agreeLine = c.summary.find((s) => s.startsWith('두 체계가 같은 쪽으로 가장 강하게 보는 영역은'));
      const conflictLine = c.summary.find((s) => s.startsWith('가장 크게 엇갈리는 영역은'));
      expect(Boolean(agreeLine)).toBe(agrees.length > 0);
      expect(Boolean(conflictLine)).toBe(conflicts.length > 0);
      if (agrees.length > 0) {
        const strength = (d: (typeof agrees)[number]): number => Math.abs(d.ziwei.level) + Math.abs(d.saju.level);
        const max = Math.max(...agrees.map(strength));
        const want = agrees.find((d) => strength(d) === max) as (typeof agrees)[number];
        expect(agreeLine).toContain(`영역은 ${DOMAIN_LABEL[want.domain]}입니다.`);
        // 뽑힌 이유가 보이도록 두 체계의 단계를 함께 적는다(▲/▲ 영역이 있는데 ▲/▲▲ 영역이 뽑히는 경우를 독자가 이상하게 읽었다)
        if (want.ziwei.level === want.saju.level) expect(agreeLine).toContain(`둘 다 ${LEVEL_LABEL[want.ziwei.level]}`);
        else expect(agreeLine).toContain(`${Math.abs(want.ziwei.level) > Math.abs(want.saju.level) ? '자미두수' : '사주'}가 더 강하게 봅니다`);
      }
      if (conflicts.length > 0) {
        const gap = (d: (typeof conflicts)[number]): number => Math.abs(d.ziwei.level - d.saju.level);
        const max = Math.max(...conflicts.map(gap));
        const want = conflicts.find((d) => gap(d) === max) as (typeof conflicts)[number];
        expect(conflictLine).toContain(`영역은 ${DOMAIN_LABEL[want.domain]}입니다.`);
        expect(max).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('compareAll 은 같은 입력에 같은 출력을 낸다(결정성)', () => {
    const { tb } = sample[0];
    const again = compareAll(tb.ziwei.domains, tb.saju.domains, tb.ziwei.decades, tb.saju.daeun);
    expect(JSON.stringify(again)).toBe(JSON.stringify(tb.comparison));
  });

  it('공개한 사실의 근거: 두 체계의 판정 분포는 서로 무관한 두 점수의 기대값에 가깝다(일치 33.5% · 보완 42% · 엇갈림 24.5%)', () => {
    // 화면의 “일치한다고 해서 맞다는 증거는 아닙니다. … 일치 비율은 우연에 가까웠습니다” 문구가 사실인지 지키는 시험이다.
    // 단계 비율이 (10·25·30·25·10)%이고 두 체계가 서로 무관하면 일치 0.335 · 보완 0.42 · 엇갈림 0.245 가 기대값이다.
    const n = { agree: 0, complement: 0, conflict: 0 };
    let total = 0;
    for (const { tb } of sample) for (const d of tb.comparison.domains) {
      n[d.verdict]++;
      total++;
    }
    const share = (v: Verdict): number => n[v] / total;
    // eslint-disable-next-line no-console
    console.log('TONGBYEON_VERDICT_SHARE', JSON.stringify({ domains: total, agree: +share('agree').toFixed(3), complement: +share('complement').toFixed(3), conflict: +share('conflict').toFixed(3) }));
    expect(Math.abs(share('agree') - 0.335)).toBeLessThan(0.06);
    expect(Math.abs(share('complement') - 0.42)).toBeLessThan(0.06);
    expect(Math.abs(share('conflict') - 0.245)).toBeLessThan(0.06);
  });
});
