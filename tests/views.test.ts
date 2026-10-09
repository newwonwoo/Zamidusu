// V-03 삼방사정 · V-08 운 모드(R-02, I-05, U-02 일부): 대한·유년 뷰를 전통 규칙과 대조
import { describe, expect, it } from 'vitest';
import { PALACE_KEYS } from '../src/core/names';
import type { PalaceKey } from '../src/core/names';
import { buildView, decadalList, surround, surroundSet, viewForDecade, GRID_ROWS } from '../src/core/chart';
import { compatDecadalNames } from '../src/core/compat';
import { MUTAGEN_TABLE, KUIYUE, LUCUN, tianma } from '../src/core/independent';
import { branchIndex, mod, stemIndex } from '../src/core/ganzhi';
import { makeChart, randomSolarDate, rng, solarLunarOf } from './helpers';

// 流昌·流曲 (天干 기준, 四墓宮 제외): 甲巳 乙午 丙申 丁酉 戊申 己酉 庚亥 辛子 壬寅 癸卯 / 甲酉 乙申 丙午 丁巳 戊午 己巳 庚卯 辛寅 壬子 癸亥
const CHANG_BY_STEM = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
const QU_BY_STEM = [9, 8, 6, 5, 6, 5, 3, 2, 0, 11];

const posIn = (flow: { key: string }[][], key: string): number => flow.findIndex((list) => list.some((f) => f.key === key));

describe('V-03 삼방사정(R-04)', () => {
  it('12궁 전수: +4, +8(삼합), +6(대궁)', () => {
    for (let b = 0; b < 12; b++) {
      const s = surround(b);
      expect(s.trine).toEqual([mod(b + 4, 12), mod(b + 8, 12)]);
      expect(s.opposite).toBe(mod(b + 6, 12));
      expect(surroundSet(b).size).toBe(4);
    }
  });
  it('격자 배치는 12지지를 한 번씩만 쓰고 가운데 4칸이 비어 있다', () => {
    const flat = GRID_ROWS.flat();
    expect(flat.filter((x) => x !== null).sort((a, b) => (a as number) - (b as number))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(flat.filter((x) => x === null)).toHaveLength(4);
  });
});

describe('V-08 대한 모드(R-02, I-05)', () => {
  it('40개 명반 × 12구간: 대한 칸이 명궁이 되고 이름이 그 칸에서 역행으로 이어진다', () => {
    const r = rng(31337);
    const problems: string[] = [];
    for (let i = 0; i < 40; i++) {
      const { y, m, d } = randomSolarDate(r, 1925, 2030);
      const chart = makeChart(y, m, d, Math.floor(r() * 12), r() < 0.5 ? 'M' : 'F');
      for (const dec of decadalList(chart)) {
        const v = viewForDecade(chart, dec.startAge);
        const tag = `[${y}-${m}-${d} ${dec.startAge}세]`;
        if (v.lifeBranch !== dec.branch) problems.push(`${tag} 대한 칸 ${v.lifeBranch} ≠ ${dec.branch}`);
        for (let k = 0; k < 12; k++) {
          const want: PalaceKey = PALACE_KEYS[k];
          const got = v.names[mod(dec.branch - k, 12)];
          if (got !== want) problems.push(`${tag} ${k}번째 이름 ${got} ≠ ${want}`);
        }
        if (v.info.rangeLabel !== `${dec.startAge}~${dec.endAge}세`) problems.push(`${tag} 라벨 ${v.info.rangeLabel}`);
        // 대한 사화: 대한 칸의 천간 기준
        const stem = chart.palaces[dec.branch].stem;
        const want4 = MUTAGEN_TABLE[stem];
        if (v.mutagens.map((x) => x.star).join() !== want4.join()) problems.push(`${tag} 대한 사화 ${v.mutagens.map((x) => x.star)} ≠ ${want4}`);
        // 운 유성: 運祿·運羊·運陀·運魁·運鉞·運昌·運曲·運馬·運鸞·運喜
        const f = v.flow;
        const lu = LUCUN[stem];
        const expect2: [string, number][] = [
          ['運祿', lu], ['運羊', mod(lu + 1, 12)], ['運陀', mod(lu - 1, 12)],
          ['運魁', KUIYUE[stem][0]], ['運鉞', KUIYUE[stem][1]],
          ['運昌', CHANG_BY_STEM[stem]], ['運曲', QU_BY_STEM[stem]],
          ['運馬', tianma(dec.branch)], ['運鸞', mod(3 - dec.branch, 12)], ['運喜', mod(3 - dec.branch + 6, 12)],
        ];
        for (const [key, want] of expect2) {
          const got = posIn(f, key);
          if (got !== want) problems.push(`${tag} ${key} ${got} ≠ ${want}`);
        }
      }
    }
    expect(problems.slice(0, 15)).toEqual([]);
  });

  it('대한 구간의 나이 범위가 전부 이어지고 12구간이 서로 다른 칸이다', () => {
    const chart = makeChart(1984, 1, 30, 7, 'M');
    const list = decadalList(chart);
    expect(list).toHaveLength(12);
    expect(new Set(list.map((x) => x.branch)).size).toBe(12);
    list.forEach((x, i) => {
      expect(x.startAge).toBe(list[0].startAge + i * 10);
      expect(x.endAge).toBe(x.startAge + 9);
    });
  });

  it('호환 모드(I-05, 추정 재현): 대한 모드 궁 이름이 선택한 대한과 무관하게 寅부터 순행 고정이다', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M', { compat: true });
    const fixed = compatDecadalNames();
    expect(fixed[branchIndex('寅')]).toBe('life');
    expect(fixed[branchIndex('卯')]).toBe('siblings');
    for (const dec of decadalList(chart)) {
      expect(viewForDecade(chart, dec.startAge).names).toEqual(fixed);
    }
    // 개선판은 대한 칸에 맞춰 달라진다 → 두 모드의 차이가 I-05 로 설명된다
    const improved = makeChart(1990, 1, 30, 6, 'M');
    const v = viewForDecade(improved, decadalList(improved)[3].startAge);
    expect(v.names).not.toEqual(fixed);
  });
});

describe('V-08 유년 모드(U-02 일부)', () => {
  it('유년 명궁은 그 해의 지지 칸이고, 유년 사화는 그 해 천간 기준이다', () => {
    const r = rng(2468);
    const problems: string[] = [];
    for (let i = 0; i < 12; i++) {
      const { y, m, d } = randomSolarDate(r, 1940, 2020);
      const chart = makeChart(y, m, d, Math.floor(r() * 12), 'F');
      for (let k = 0; k < 6; k++) {
        const ty = 2000 + Math.floor(r() * 40);
        const date = { y: ty, m: 7, d: 1 };
        const v = buildView(chart, 'yearly', { date, timeIndex: 6 });
        const l = solarLunarOf(ty, 7, 1);
        const wantBranch = branchIndex(l.getYearZhi());
        const wantStem = stemIndex(l.getYearGan());
        if (v.lifeBranch !== wantBranch) problems.push(`[${y}-${m}-${d}] ${ty}년 명궁 ${v.lifeBranch} ≠ ${wantBranch}`);
        if (v.mutagens.map((x) => x.star).join() !== MUTAGEN_TABLE[wantStem].join()) problems.push(`${ty}년 사화`);
        const lu = LUCUN[wantStem];
        if (posIn(v.flow, '流祿') !== lu) problems.push(`${ty}년 流祿 ${posIn(v.flow, '流祿')} ≠ ${lu}`);
        if (posIn(v.flow, '流羊') !== mod(lu + 1, 12)) problems.push(`${ty}년 流羊`);
        if (posIn(v.flow, '流馬') !== tianma(wantBranch)) problems.push(`${ty}년 流馬`);
        if (v.info.nominalAge !== ty - chart.meta.baseYear + 1) problems.push(`${ty}년 나이 ${v.info.nominalAge}`);
        if (!v.yearlyTwelve || v.yearlyTwelve.suiqian.length !== 12) problems.push('세전12신 누락');
        if (v.ageBranch === undefined) problems.push('소한 누락');
      }
    }
    expect(problems.slice(0, 15)).toEqual([]);
  });

  it('유월·유일·유시도 12궁 이름과 운 사화 4개를 만든다(정확도는 U-02 — 엔진 값 그대로)', () => {
    const chart = makeChart(1985, 5, 20, 3, 'M');
    for (const scope of ['monthly', 'daily', 'hourly'] as const) {
      const v = buildView(chart, scope, { date: { y: 2026, m: 10, d: 9 }, timeIndex: 6 });
      expect(new Set(v.names).size).toBe(12);
      expect(v.names[v.lifeBranch]).toBe('life');
      expect(v.mutagens).toHaveLength(4);
    }
  });

  it('본명 뷰는 본명 12궁 이름 그대로다', () => {
    const chart = makeChart(1985, 5, 20, 3, 'M');
    const v = buildView(chart, 'natal', null);
    expect(v.names).toEqual(chart.palaces.map((p) => p.natalName));
    expect(v.lifeBranch).toBe(chart.meta.soulBranch);
  });
});
