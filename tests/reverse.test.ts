// V-09 역산 입력(F-09, I-10): 정답 포함, 모순 탐지·설명, 후보로 명반 재현
import { describe, expect, it } from 'vitest';
import { reverseSearch, birthInputOf, yearsFor, CONSTRAINT_KEYS } from '../src/core/reverse';
import type { ReverseConstraints, ConstraintKey } from '../src/core/reverse';
import { independentChart, quickKeys } from '../src/core/independent';
import type { LunarKey } from '../src/core/independent';
import { buildChart, DEFAULT_CHART_OPTIONS } from '../src/core/chart';
import { normalizeBirth } from '../src/core/time';
import { mod } from '../src/core/ganzhi';
import { NO_CORRECTION, makeChart, randomSolarDate, rng, keyOf } from './helpers';

const isValidPair = (stem: number, branch: number): boolean => stem % 2 === branch % 2;

const randomKey = (r: () => number): LunarKey => {
  const stem = Math.floor(r() * 10);
  const branches = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((b) => isValidPair(stem, b));
  return {
    yearStem: stem, yearBranch: branches[Math.floor(r() * 6)],
    month: 1 + Math.floor(r() * 12), day: 1 + Math.floor(r() * 30), hourBranch: Math.floor(r() * 12),
  };
};

const truthConstraints = (k: LunarKey, r: () => number, keep: number): ReverseConstraints => {
  const q = quickKeys(k);
  const all: ReverseConstraints = {
    yearStem: k.yearStem, yearBranch: k.yearBranch, month: k.month, day: k.day, hourBranch: k.hourBranch,
    soul: q.soul, body: q.body, fiveClass: q.fiveClass, ziwei: q.ziwei, zuofu: q.zuofu, youbi: q.youbi, wenchang: q.wenchang, wenqu: q.wenqu,
    santai: mod(q.zuofu + (k.day - 1), 12), bazuo: mod(q.youbi - (k.day - 1), 12),
  };
  const keys = [...CONSTRAINT_KEYS].sort(() => r() - 0.5).slice(0, keep);
  const out: ReverseConstraints = {};
  for (const key of keys) out[key as ConstraintKey] = all[key as ConstraintKey];
  return out;
};

describe('V-09 역산 입력', () => {
  it('임의의 출생 조합에서 알려진 정보 일부만 줘도 정답 조합이 후보에 반드시 포함된다(500건)', () => {
    const r = rng(1234);
    let missing = 0;
    for (let i = 0; i < 500; i++) {
      const k = randomKey(r);
      const c = truthConstraints(k, r, 2 + Math.floor(r() * 6));
      const res = reverseSearch(c, 100000);
      const hit = res.candidates.some(
        (x) => x.yearStem === k.yearStem && x.month === k.month && x.day === k.day && x.hourBranch === k.hourBranch && x.yearBranches.includes(k.yearBranch),
      );
      if (!hit) missing++;
    }
    expect(missing).toBe(0);
  });

  it('연간·월·일·시를 모두 주면 후보는 정확히 하나다', () => {
    const k: LunarKey = { yearStem: 6, yearBranch: 6, month: 1, day: 4, hourBranch: 6 }; // T6
    const res = reverseSearch({ yearStem: 6, month: 1, day: 4, hourBranch: 6 });
    expect(res.status).toBe('unique');
    expect(res.count).toBe(1);
    expect(res.candidates[0].yearBranches).toEqual([0, 2, 4, 6, 8, 10]);
    expect(quickKeys(k).soul).toBe(8);
  });

  it('엔진 대조: 실제 명반(T6)의 값만으로 역산하면 정답이 후보에 있고, 자미성만으로는 이틀이 남는다', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const at = (key: string): number => chart.palaces.find((p) => p.stars.some((s) => s.key === key))!.branch;
    const c: ReverseConstraints = {
      yearStem: chart.meta.yearStem, soul: chart.meta.soulBranch, body: chart.meta.bodyBranch,
      fiveClass: chart.meta.fiveElements.num, ziwei: at('紫微'), zuofu: at('左輔'), wenchang: at('文昌'),
    };
    const res = reverseSearch(c);
    // 자미성 위치는 24일 주기라 d 와 d+24 가 같은 칸이다: 초4·5일과 28·29일이 함께 남는 것이 올바른 결과
    expect(res.status).toBe('multiple');
    expect(res.count).toBe(4);
    expect(res.candidates.map((x) => x.day).sort((a, b) => a - b)).toEqual([4, 5, 28, 29]);
    expect(res.candidates.every((x) => x.yearStem === 6 && x.month === 1 && x.hourBranch === 6)).toBe(true);
    // 삼태·팔좌는 12일 주기라 d 와 d+24 를 구별하지 못하지만 4일/5일은 가려낸다
    expect(reverseSearch({ ...c, santai: at('三台') }).candidates.map((x) => x.day).sort((a, b) => a - b)).toEqual([4, 28]);
    expect(reverseSearch({ ...c, bazuo: at('八座') }).candidates.map((x) => x.day).sort((a, b) => a - b)).toEqual([4, 28]);
    // 날짜까지 주면 정확히 하나
    const res2 = reverseSearch({ ...c, day: 4 });
    expect(res2.status).toBe('unique');
    expect(res2.candidates[0]).toMatchObject({ yearStem: 6, month: 1, day: 4, hourBranch: 6 });
  });

  it('모순 입력을 후보 0건으로 탐지하고 원인 쌍을 설명한다(I-10)', () => {
    // 명궁 子 · 신궁 丑: 간격이 1(홀수)이라 불가능
    const a = reverseSearch({ soul: 0, body: 1 });
    expect(a.status).toBe('none');
    expect(a.conflicts[0].kind).toBe('pair');
    expect(a.conflicts[0].message).toContain('짝수');
    expect(a.conflicts[0].message).toContain('명궁 위치 자궁(子)과 신궁 위치 축궁(丑)은 함께 성립할 수 없습니다');
    // 좌보 辰(=정월)인데 우필 子: 정월의 우필은 戌
    const b = reverseSearch({ zuofu: 4, youbi: 0 });
    expect(b.status).toBe('none');
    expect(b.conflicts[0].message).toContain('좌보');
    // 문창 戌(=子시)인데 문곡 午
    const c = reverseSearch({ wenchang: 10, wenqu: 6 });
    expect(c.status).toBe('none');
    expect(c.conflicts[0].message).toContain('문창');
  });

  it('쌍은 멀쩡하지만 셋이 얽힌 모순도 “하나를 빼면 가능한 항목”으로 알려 준다', () => {
    // 정월(寅궁) · 子시이면 명궁은 寅이어야 한다. 명궁 申은 월/시 각각과는 양립하지만 셋이 함께는 불가
    const res = reverseSearch({ month: 1, hourBranch: 0, soul: 8 });
    expect(res.status).toBe('none');
    expect(res.conflicts.every((x) => x.kind === 'relax')).toBe(true);
    expect(res.conflicts.map((x) => x.keys[0]).sort()).toEqual(['hourBranch', 'month', 'soul']);
  });

  it('아무것도 입력하지 않으면 empty-input', () => {
    expect(reverseSearch({}).status).toBe('empty-input');
  });

  it('후보로 실제 명반을 만들면 입력한 위치와 일치한다(연도 선택 → 명반 보기)', () => {
    // 戊년 寅궁 = 甲寅(大溪水) → 水二局
    const c: ReverseConstraints = { yearStem: 4, soul: 2, fiveClass: 2, hourBranch: 0 };
    const res = reverseSearch(c);
    expect(res.count).toBeGreaterThan(0);
    // 같은 연간에 다른 국을 주면 모순이어야 한다(오행국 표와 일치)
    expect(reverseSearch({ yearStem: 4, soul: 2, fiveClass: 3, hourBranch: 0 }).status).toBe('none');
    const cand = res.candidates[0];
    const branch = cand.yearBranches[0];
    const years = yearsFor(cand, branch);
    expect(years.length).toBeGreaterThan(0);
    const norm = normalizeBirth(birthInputOf(cand, years[0], 'M'), NO_CORRECTION);
    if (!norm.ok) throw new Error(norm.errors.join());
    const chart = buildChart(norm.value, DEFAULT_CHART_OPTIONS);
    expect(chart.meta.yearStem).toBe(4);
    expect(chart.meta.soulBranch).toBe(2);
    expect(chart.meta.fiveElements.num).toBe(2);
    expect(chart.meta.timeBranch).toBe(0);
    // 독립 구현과도 일치
    const ind = independentChart({ yearStem: cand.yearStem, yearBranch: branch, month: cand.month, day: cand.day, hourBranch: cand.hourBranch }, 'M');
    expect(ind.soul).toBe(2);
  });

  it('성능: 13개 값을 모두 줘서 모순을 분석해도 1초 이내', () => {
    const k: LunarKey = { yearStem: 3, yearBranch: 5, month: 7, day: 21, hourBranch: 9 };
    const q = quickKeys(k);
    const c: ReverseConstraints = {
      yearStem: 3, yearBranch: 5, month: 7, day: 21, hourBranch: 9, soul: q.soul, body: q.body, fiveClass: q.fiveClass,
      ziwei: q.ziwei, zuofu: q.zuofu, youbi: q.youbi, wenchang: q.wenchang, wenqu: (q.wenqu + 1) % 12,
    };
    const t0 = performance.now();
    const res = reverseSearch(c);
    expect(res.status).toBe('none');
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('keyOf 보조 점검: T6 의 독립 입력이 월=1 일=4 이다', () => {
    expect(keyOf(1990, 1, 30, 6, 'lunarNewYear')).toMatchObject({ month: 1, day: 4, yearStem: 6, yearBranch: 6 });
    void randomSolarDate;
  });
});
