// V-26 통변 규칙의 도달성·일관성(설계 부록 D-9, 요구 T-06·T-10): 규칙표와 실제 결과가 어긋나지 않는지 확인한다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildView, decadalList, viewForDecade } from '../src/core/chart';
import { lunarJavascriptEngine } from '../src/core/saju';
import { buildTongbyeon, DOMAINS, DOMAIN_LABEL, LEVEL_LABEL, THEMES, levelOf } from '../src/core/tongbyeon';
import type { Domain } from '../src/core/tongbyeon';
import { SAJU_CUTS, SAJU_PERIOD_CUTS, ZIWEI_CUTS, ZIWEI_DECADE_CUTS, ZIWEI_PERIOD_CUTS } from '../src/core/tongbyeon/calibration';
import { RULES, RULE_IDS } from '../src/core/tongbyeon/rules';
import { readSaju } from '../src/core/tongbyeon/saju-read';
import { makeScorer } from '../src/core/tongbyeon/ziwei-score';
import { makeChart, randomSolarDate, rng } from './helpers';
import { sajuOfChart, tbSample } from './tbsample';

const sample = tbSample(300, 2026101);

describe('V-26 통변 일관성', () => {
  it('모든 영역·시기·총평의 구조가 갖춰져 있고 단계는 점수와 경계값에서 나온다', () => {
    for (const { tb } of sample) {
      for (const sys of [tb.ziwei, tb.saju]) {
        expect(Object.keys(sys.domains)).toEqual(DOMAINS);
        for (const d of DOMAINS) {
          const r = sys.domains[d];
          expect(r.domain).toBe(d);
          expect([-2, -1, 0, 1, 2]).toContain(r.level);
          const cuts = r.system === 'ziwei' ? ZIWEI_CUTS[d] : SAJU_CUTS[d];
          expect(r.level, `${r.system} ${d}`).toBe(levelOf(r.score, cuts));
          expect(r.title.length).toBeGreaterThan(3);
          expect(r.verdict.length).toBeGreaterThan(10);
          expect(r.points.length).toBeGreaterThanOrEqual(1);
          expect(r.advice.length).toBeGreaterThan(5);
          expect(r.themes.length).toBeLessThanOrEqual(3);
          expect(new Set(r.themes).size).toBe(r.themes.length);
          for (const t of r.themes) expect(Object.keys(THEMES[d]), `${d}/${t}`).toContain(t);
          // 근거 요약은 영향이 큰 순
          for (let i = 1; i < r.reasons.length; i++) expect(Math.abs(r.reasons[i - 1].delta)).toBeGreaterThanOrEqual(Math.abs(r.reasons[i].delta) - 1e-9);
          // 근거 목록의 규칙 번호는 모두 규칙표에 있다
          for (const e of r.evidence) expect(RULE_IDS.has(e.rule), `${r.system} ${d} ${e.rule}`).toBe(true);
          expect(r.evidence.length).toBeGreaterThan(1);
        }
        expect(sys.overview.headline.length).toBeGreaterThan(10);
        expect(sys.overview.paragraphs.length).toBeGreaterThanOrEqual(4);
        expect(sys.overview.advice.length).toBeGreaterThanOrEqual(1);
        expect(sys.overview.keywords.length).toBeGreaterThanOrEqual(1);
        for (const e of sys.overview.evidence) expect(RULE_IDS.has(e.rule), e.rule).toBe(true);
      }
    }
  });

  it('대한 12구간과 대운은 나이·연도가 끊김 없이 이어지고, 단계는 경계값에서 나온다', () => {
    for (const { tb, chart } of sample) {
      const dec = tb.ziwei.decades;
      // 대한 12구간 가운데 100세가 넘는 마지막 둘은 다루지 않는다: 언제나 10구간
      expect(dec).toHaveLength(10);
      expect(dec.every((p) => p.startAge <= 100)).toBe(true);
      expect(decadalList(chart).filter((x) => x.startAge <= 100)).toHaveLength(10);
      for (let i = 0; i < dec.length; i++) {
        expect(dec[i].endAge - dec[i].startAge).toBe(9);
        expect(dec[i].endYear - dec[i].startYear).toBe(9);
        expect(dec[i].startYear).toBe(chart.meta.baseYear + dec[i].startAge - 1);
        if (i > 0) {
          expect(dec[i].startAge).toBe(dec[i - 1].endAge + 1);
          expect(dec[i].startYear).toBe(dec[i - 1].endYear + 1);
        }
        const avg = DOMAINS.reduce((s, d) => s + (dec[i].byDomain as Record<string, number>)[d], 0) / 6;
        expect(dec[i].level).toBe(levelOf(Math.round(avg * 100) / 100, ZIWEI_PERIOD_CUTS));
        for (const e of dec[i].evidence) expect(RULE_IDS.has(e.rule), e.rule).toBe(true);
      }
      const dy = tb.saju.daeun;
      expect(dy.length).toBeGreaterThanOrEqual(8);
      for (let i = 0; i < dy.length; i++) {
        expect(dy[i].endYear - dy[i].startYear).toBe(9);
        expect(dy[i].level).toBe(levelOf(dy[i].score, SAJU_PERIOD_CUTS));
        if (i > 0) expect(dy[i].startYear).toBe(dy[i - 1].endYear + 1);
        for (const e of dy[i].evidence) expect(RULE_IDS.has(e.rule), e.rule).toBe(true);
      }
      // “지금” 표시: 올해가 포함된 구간
      const nowZ = dec.findIndex((p) => 2026 >= p.startYear && 2026 <= p.endYear);
      const nowS = dy.findIndex((p) => 2026 >= p.startYear && 2026 <= p.endYear);
      expect(tb.now).toEqual({ year: 2026, ziweiDecade: nowZ, sajuDaeun: nowS });
    }
  });

  it('이 사람 안에서의 위치: 구간끼리 뚜렷이 다를 때만, 값이 가장 큰 구간에 “가장 나은 때”, 가장 작은 구간에 “가장 신경 쓸 때”가 붙는다', () => {
    const tagged = { ziwei: 0, saju: 0, both: 0 };
    for (const { tb, chart } of sample) {
      // 대한의 구간 값: 영역 점수를 “무난” 구간의 가운데에서 떨어진 정도로 보고 경계값 폭(10~90%)으로 나눈 평균
      const items = decadalList(chart);
      tb.ziwei.decades.forEach((p, i) => {
        const sc = makeScorer(chart, viewForDecade(chart, items[i].startAge));
        let sum = 0;
        for (const d of DOMAINS) {
          const c = ZIWEI_DECADE_CUTS[d];
          sum += (sc.domain(d).score - (c[1] + c[2]) / 2) / (c[3] - c[0]);
          // 대한의 영역 단계는 “대한” 경계값으로 자른다(본명 경계값이 아니다)
          expect(p.byDomain?.[d], `대한 ${i} ${d} 단계`).toBe(levelOf(sc.domain(d).score, ZIWEI_DECADE_CUTS[d]));
        }
        expect(p.fine, `대한 ${i}`).toBeCloseTo(sum / 6, 9);
      });
      for (const p of tb.saju.daeun) expect(p.fine).toBe(p.score);

      for (const [list, minSpread, key] of [[tb.ziwei.decades, 0.15, 'ziwei'], [tb.saju.daeun, 1.0, 'saju']] as const) {
        const hi = Math.max(...list.map((p) => p.fine));
        const lo = Math.min(...list.map((p) => p.fine));
        const wide = hi - lo >= minSpread;
        let best = 0;
        let worst = 0;
        for (const p of list) {
          const want = !wide ? undefined : Math.abs(p.fine - hi) < 1e-9 ? 'best' : Math.abs(p.fine - lo) < 1e-9 ? 'worst' : undefined;
          expect(p.standing, `${key} ${p.label}`).toBe(want);
          expect(p.standingNote === undefined, `${key} ${p.label} 문구`).toBe(want === undefined);
          if (want === 'best') best++;
          if (want === 'worst') worst++;
        }
        // 가장 나은 때와 가장 신경 쓸 때는 서로 다른 구간이고, 붙을 때는 둘 다 붙는다
        expect(best > 0).toBe(worst > 0);
        // 하나도 붙지 않았을 때만(구간끼리 차이가 작을 때) 목록 위 안내가 있다
        expect(key === 'ziwei' ? tb.ziwei.decadeNote !== undefined : tb.saju.daeunNote !== undefined, `${key} 안내`).toBe(!wide);
        if (wide) tagged[key]++;
      }
    }
    // 기능이 죽어 있지 않다: 대부분의 사람에게 붙는다
    expect(tagged.ziwei).toBeGreaterThan(sample.length * 0.9);
    expect(tagged.saju).toBeGreaterThan(sample.length * 0.9);
  });

  it('같은 칸 해설(함께 읽는 ○○궁)은 성격을 뺀 영역 카드 사이에서 되풀이되지 않는다', () => {
    let links = 0;
    for (const { tb } of sample) {
      const seen = new Set<string>();
      for (const d of DOMAINS) {
        if (d === 'self') continue;
        for (const p of tb.ziwei.domains[d].points) {
          if (p.kind !== 'link') continue;
          links++;
          const key = `${p.label}|${p.text}`;
          expect(seen.has(key), `${d}: ${key}`).toBe(false);
          seen.add(key);
        }
      }
    }
    // 되풀이를 걸러 낸 뒤에도 표본에서 실제로 여러 카드가 이 해설을 가진다
    expect(links).toBeGreaterThan(500);
  });

  it('총평은 단계와 어긋나지 않는다: 조언의 “…의 강점을 살리고”는 가장 높은 단계(+1 이상)의 영역들, “…먼저 점검하세요”는 가장 낮은 단계(−1 이하)의 영역들만 말한다', () => {
    const said = { both: 0, bestOnly: 0, worstOnly: 0, none: 0, tied: 0 };
    for (const { tb } of sample) {
      for (const sys of [tb.ziwei, tb.saju]) {
        const others = [...DOMAINS];
        const topL = Math.max(...others.map((d) => sys.domains[d].level));
        const lowL = Math.min(...others.map((d) => sys.domains[d].level));
        const bestSet = topL >= 1 ? others.filter((d) => sys.domains[d].level === topL) : [];
        const worstSet = lowL <= -1 ? others.filter((d) => sys.domains[d].level === lowL) : [];
        const labelsIn = (part: string): string[] => others.filter((d) => part.includes(DOMAIN_LABEL[d])).map((d) => DOMAIN_LABEL[d]).sort();
        const want = (ds: string[]): string[] => ds.map((d) => DOMAIN_LABEL[d as (typeof DOMAINS)[number]]).sort();

        const line = sys.overview.advice.find((a) => a.includes('강점을 살리') || a.includes('먼저 점검하세요'));
        let bestPart = '';
        let worstPart = '';
        if (line) {
          const both = /^(.+)의 강점을 살리고, (.+?)[은는] 먼저 점검하세요\.$/.exec(line);
          const bestOnly = /^(.+)의 강점을 살리세요\.$/.exec(line);
          const worstOnly = /^(.+?)[은는] 먼저 점검하세요\.$/.exec(line);
          if (both) {
            [bestPart, worstPart] = [both[1], both[2]];
            said.both++;
          } else if (bestOnly) {
            bestPart = bestOnly[1];
            said.bestOnly++;
          } else if (worstOnly) {
            worstPart = worstOnly[1];
            said.worstOnly++;
          } else {
            expect.fail(`알 수 없는 조언 문장 모양: ${line}`);
          }
        } else said.none++;
        expect(labelsIn(bestPart), `${sys.overview.headline} — ${line}`).toEqual(want(bestSet));
        expect(labelsIn(worstPart), `${sys.overview.headline} — ${line}`).toEqual(want(worstSet));
        if (bestSet.length > 1 || worstSet.length > 1) said.tied++;

        // 한 줄 결론(자미두수)도 같은 영역들만 말한다: 받쳐 주는 편·신경 쓸 편 문장에 나오는 영역 = 가장 높은/낮은 단계의 영역들
        if (sys === tb.ziwei) {
          const spreadSentence = sys.overview.headline.split(/(?<=\.) /).find((x) => /받쳐 주는 편|신경 쓸/.test(x)) ?? '';
          expect(labelsIn(spreadSentence), sys.overview.headline).toEqual(want([...bestSet, ...worstSet]));
        }
      }
    }
    // 네 갈래와 “단계가 같은 영역을 함께 말하는” 경우가 표본에서 실제로 지나간다
    expect(said.both).toBeGreaterThan(100);
    expect(said.bestOnly).toBeGreaterThan(10);
    expect(said.worstOnly).toBeGreaterThan(10);
    expect(said.tied).toBeGreaterThan(100);
  });

  it('핵심 네 칸의 균형은 영역 단계와 어긋나지 않는다: 영역이 +1 이상인 칸을 “꾸준히 보완”하라고 하지 않고, 그때는 칸 하나만 보면 약해도 영역은 받쳐 준다고 이유를 말한다', () => {
    // 3차 독자 시험: “관록궁이 약하니 일·직업을 보완하라”면서 직업 영역은 ▲▲ 라 앞뒤가 안 맞게 읽혔다
    const OF: Record<string, Domain | undefined> = { 명궁: 'self', 재백궁: 'wealth', 관록궁: 'career', 천이궁: undefined };
    const seen = { supplement: 0, explained: 0, allSturdy: 0 };
    for (const { tb } of sample) {
      const para = tb.ziwei.overview.paragraphs.find((p) => p.label === '핵심 네 칸의 균형');
      expect(para, '핵심 네 칸의 균형 문단').toBeTruthy();
      const text = (para as { sentences: string[] }).sentences.join(' ').replace(/\{\{|\}\}/g, '');
      const m = /가운데 (명궁|재백궁|관록궁|천이궁)[이가] 가장 든든하고, (명궁|재백궁|관록궁|천이궁)[은는] 상대적으로 약합니다/.exec(text);
      if (!m) {
        expect(text).toContain('모두 든든한 편');
        seen.allSturdy++;
        continue;
      }
      const dom = OF[m[2]];
      const level = dom ? tb.ziwei.domains[dom].level : 0;
      if (text.includes('꾸준히 보완하는 편이 좋습니다')) {
        seen.supplement++;
        expect(level, text).toBeLessThanOrEqual(0);
      }
      if (text.includes('하나만 보면 약하지만')) {
        seen.explained++;
        expect(level, text).toBeGreaterThanOrEqual(1);
        expect(text).toContain(`${LEVEL_LABEL[level]}입니다`);
        expect(text).not.toContain('꾸준히 보완');
      }
      if (dom && level >= 1) expect(text, text).toContain('하나만 보면 약하지만');
    }
    expect(seen.supplement).toBeGreaterThan(20);
    expect(seen.explained).toBeGreaterThan(5);
    expect(seen.allSturdy).toBeGreaterThan(5);
  });

  it('지금의 흐름: 타고난 바탕과 이 10년의 방향(부호)이 반대인 영역이 있을 때만 그 영역들(최대 3개)을 짚는다', () => {
    // 3차 독자 시험: 바탕은 연애·결혼이 좋은 편인데 지금 10년은 신경 쓸 시기라고 하니 모순으로 읽혔다
    let said = 0;
    let silent = 0;
    for (const { tb } of sample) {
      const now = tb.ziwei.decades[tb.now.ziweiDecade];
      const para = tb.ziwei.overview.paragraphs.find((p) => p.label === '지금의 흐름(10년 운)');
      if (!now || !para) continue;
      const by = now.byDomain as Record<Domain, number>;
      const apart = DOMAINS.filter((d) => tb.ziwei.domains[d].level * by[d] < 0);
      const line = para.sentences.find((x) => x.includes('타고난 바탕과 이 10년의 방향이 다릅니다'));
      expect(Boolean(line), para.sentences.join(' ')).toBe(apart.length > 0);
      if (line) {
        expect(DOMAINS.filter((d) => line.includes(DOMAIN_LABEL[d]))).toEqual(apart.slice(0, 3));
        expect(para.sentences).toContain('바탕은 타고난 구조이고, 10년 운은 그 시기에 더해지는 흐름입니다.');
        said++;
      } else silent++;
    }
    expect(said).toBeGreaterThan(20);
    expect(silent).toBeGreaterThan(20);
  });

  it('12운성 이름은 한 글자이면 한자를 붙여 적는다(병(病)·사(死)·묘(墓)가 일간 병(丙)·지지 사(巳)·묘(卯)와 같은 소리라 섞여 읽혔다)', () => {
    const HANJA: Record<string, string> = { 쇠: '衰', 병: '病', 사: '死', 묘: '墓', 절: '絶', 태: '胎', 양: '養' };
    const stages = new Set<string>();
    for (const { tb } of sample) {
      const root = tb.saju.domains.self.points.find((p) => p.label === '뿌리의 힘');
      expect(root, '성격 카드의 뿌리의 힘').toBeTruthy();
      const m = /\{\{12운성\}\}은 '([^']+)'입니다/.exec((root as { text: string }).text);
      expect(m, (root as { text: string }).text).toBeTruthy();
      const shown = (m as RegExpExecArray)[1].replace(/\{\{|\}\}/g, '');
      const name = shown.replace(/\(.+\)$/, '');
      stages.add(name);
      if (HANJA[name]) expect(shown).toBe(`${name}(${HANJA[name]})`);
      else expect(shown).toBe(name);
    }
    // 표본에서 한 글자 이름과 두 글자 이름이 모두 실제로 지나간다
    expect(stages.size).toBeGreaterThanOrEqual(9);
    expect([...stages].some((x) => HANJA[x])).toBe(true);
    expect([...stages].some((x) => !HANJA[x])).toBe(true);
  });

  it('용신·희신 관계 문장은 “지금 도움이 된다”가 아니라 “이 기운이 채워지는 때에 도움을 받는다”로 쓴다(재성이 적은 사주에서 앞 문장과 어긋나 읽혔다)', () => {
    // 3차 독자 시험(그리고 2차의 독자 3): “재성이 적은 편” → ▼ 인데 “재성은 용신, 재물에 도움이 되는 쪽”이라 좋다는 건지 나쁘다는 건지 모르겠다
    let n = 0;
    let scarce = 0;
    for (const { tb } of sample) {
      for (const d of DOMAINS) {
        for (const p of tb.saju.domains[d].points) {
          if (p.label !== '필요한 기운과의 관계') continue;
          const plain = p.text.replace(/\{\{|\}\}/g, '');
          if (!/(용신|희신)에 해당합니다/.test(plain)) continue;
          n++;
          expect(plain).toContain('이 기운이 채워지는 때에');
          expect(plain).not.toContain('도움이 되는 쪽입니다');
          if (d === 'wealth' && tb.saju.domains.wealth.points.some((x) => x.label === '재물 기운' && x.text.includes('적은 편'))) scarce++;
        }
      }
    }
    expect(n).toBeGreaterThan(100);
    // 재성이 적은데 재성 기운이 용신·희신인 사주가 표본에 실제로 있다
    expect(scarce).toBeGreaterThan(3);
  });

  it('결정성: 같은 입력은 같은 통변을 낸다(명반을 다시 만들어도, 같은 명반으로 다시 불러도)', () => {
    for (const c of sample.slice(0, 12)) {
      const again = makeChart(c.y, c.m, c.d, c.branch, c.gender);
      const t2 = buildTongbyeon(again, sajuOfChart(again, c.gender), { mode: '5', todayYear: 2026 });
      expect(JSON.stringify(t2)).toBe(JSON.stringify(c.tb));
      expect(JSON.stringify(buildTongbyeon(c.chart, c.saju, { mode: '5', todayYear: 2026 }))).toBe(JSON.stringify(c.tb));
    }
  });

  it('밝기 표시(5단계/7단계)는 별의 힘 문장만 바꾸고 점수·단계·판정은 바꾸지 않는다', () => {
    for (const c of sample.slice(0, 20)) {
      const t7 = buildTongbyeon(c.chart, c.saju, { mode: '7', todayYear: 2026 });
      for (const d of DOMAINS) {
        expect(t7.ziwei.domains[d].level).toBe(c.tb.ziwei.domains[d].level);
        expect(t7.ziwei.domains[d].score).toBe(c.tb.ziwei.domains[d].score);
      }
      expect(JSON.stringify(t7.comparison.counts)).toBe(JSON.stringify(c.tb.comparison.counts));
      expect(JSON.stringify(t7.saju)).toBe(JSON.stringify(c.tb.saju));
    }
  });

  it('통변 한 번(명반·사주 포함)이 걸리는 시간: 대한 계산을 포함해도 평균 1초 이내(로컬 140~275ms, CI 의 느린 실행기 여유)', () => {
    const c = sample[0];
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) {
      // 캐시를 피하려고 매번 새 명반 객체로
      const chart = makeChart(c.y, c.m, c.d, c.branch, c.gender);
      buildTongbyeon(chart, sajuOfChart(chart, c.gender), { mode: '5', todayYear: 2026 });
    }
    const avg = (performance.now() - t0) / 5;
    // eslint-disable-next-line no-console
    console.log('TONGBYEON_MS_PER_BUILD(chart+saju+tongbyeon)', avg.toFixed(0));
    expect(avg).toBeLessThan(1000);
  });
});

describe('V-26 규칙 도달성: 규칙표의 모든 규칙이 실제 표본에서 한 번 이상 발동한다', () => {
  it('사주 규칙: 날짜에서 만든 사주 4,000개', () => {
    const r = rng(26001);
    const fired = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const d = randomSolarDate(r, 1930, 2030);
      const hour = Math.floor(r() * 24);
      const gender = r() < 0.5 ? 'M' : 'F';
      const s = lunarJavascriptEngine.compute({ instantUtcMs: Date.UTC(d.y, d.m - 1, d.d, hour - 9, 0), clock: { y: d.y, m: d.m, d: d.d, h: hour, mi: 0 }, hourKnown: true, gender, lateZi: 'next' });
      const t = readSaju(s, gender);
      for (const dm of DOMAINS) for (const e of t.domains[dm].evidence) fired.add(e.rule);
      for (const e of t.overview.evidence) fired.add(e.rule);
      for (const p of t.daeun) for (const e of p.evidence) fired.add(e.rule);
    }
    const missing = RULES.filter((x) => x.system === 'saju' && !fired.has(x.id)).map((x) => x.id);
    expect(missing).toEqual([]);
  });

  it('자미두수 규칙: 명반 300개(대한 덧씌움 규칙은 대한 칸에서)', () => {
    const fired = new Set<string>();
    for (const { tb } of sample) {
      for (const dm of DOMAINS) for (const e of tb.ziwei.domains[dm].evidence) fired.add(e.rule);
      for (const e of tb.ziwei.overview.evidence) fired.add(e.rule);
      for (const p of tb.ziwei.decades) for (const e of p.evidence) fired.add(e.rule);
    }
    // 대한 사화(ZO-01)·대한 유성(ZO-02)은 점수에만 반영되고 근거 목록에는 나오지 않으므로 대한 칸의 구성 요소로 직접 본다
    for (const { chart } of sample.slice(0, 40)) {
      for (const item of decadalList(chart)) {
        const sc = makeScorer(chart, viewForDecade(chart, item.startAge));
        for (let b = 0; b < 12; b++) for (const c of sc.comps(b, 'self')) fired.add(c.rule);
      }
      const sc = makeScorer(chart, buildView(chart, 'natal', null));
      for (let b = 0; b < 12; b++) for (const dm of DOMAINS) for (const c of sc.comps(b, dm)) fired.add(c.rule);
    }
    const missing = RULES.filter((x) => x.system === 'ziwei' && !fired.has(x.id)).map((x) => x.id);
    // 매우 드문 것은 표본에 없을 수 있다 — 규칙표에서 rare 로 표시된 것만 허용한다
    const notAllowed = missing.filter((id) => !(RULES.find((x) => x.id === id) as { rare?: boolean }).rare);
    expect(notAllowed).toEqual([]);
  });

  it('규칙표: 번호가 겹치지 않고, 설명이 모두 채워져 있다', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(r.title.length, r.id).toBeGreaterThan(1);
      expect(r.desc.length, r.id).toBeGreaterThan(3);
    }
  });

  it.runIf(Boolean(process.env.WRITE_TONGBYEON_DOCS))('규칙표를 docs/generated/tongbyeon-rules.md 로 쓴다', () => {
    const lines = [
      '# 통변 규칙표 (자동 생성)',
      '',
      '`WRITE_TONGBYEON_DOCS=1 npx vitest run tests/tongbyeon-rules.test.ts` 로 만든 문서입니다. 화면의 “근거 보기”에 나오는 규칙 번호의 뜻입니다.',
      '점수와 경계값은 설계서 부록 D 와 `docs/generated/tongbyeon-calibration.md` 를 보세요.',
      '',
    ];
    for (const sys of ['saju', 'ziwei'] as const) {
      lines.push(`## ${sys === 'saju' ? '사주 통변' : '자미두수 통변'}`, '', '| 번호 | 영역 | 규칙 | 내용 |', '|---|---|---|---|');
      for (const r of RULES.filter((x) => x.system === sys)) lines.push(`| ${r.id} | ${r.area} | ${r.title} | ${r.desc} |`);
      lines.push('');
    }
    fs.writeFileSync('docs/generated/tongbyeon-rules.md', lines.join('\n'));
    expect(lines.length).toBeGreaterThan(50);
  });
});

void ZIWEI_DECADE_CUTS;
