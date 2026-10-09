// V-02 호환 모드 델타(I-01~I-04): 개선판 대 호환 모드. “번호 없는 차이는 결함”(golden rule)을 기계적으로 검사한다.
import { describe, expect, it } from 'vitest';
import { COMPAT_SHIFTS } from '../src/core/compat';
import { mod } from '../src/core/ganzhi';
import { compareWithIndependent, keyOf, makeChart, positionOf, randomSolarDate, rng } from './helpers';

describe('V-02 호환 모드 델타', () => {
  it('300건 모두 차이가 우필·천형·천요·팔좌 4개에만 있고 이동 방향·칸 수가 I-01~I-04와 같다', () => {
    const r = rng(4242);
    const unexplained: string[] = [];
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const { y, m, d } = randomSolarDate(r, 1900, 2100);
      if (y === 1900 && m < 2) continue;
      const hb = Math.floor(r() * 12);
      const g = r() < 0.5 ? 'M' : 'F';
      const fixed = makeChart(y, m, d, hb, g);
      const compat = makeChart(y, m, d, hb, g, { compat: true });
      const keys = new Set<string>();
      fixed.palaces.forEach((p) => p.stars.forEach((s) => keys.add(s.key)));
      // 별 집합이 같아야 한다(별이 사라지거나 생기지 않음)
      const compatKeys = new Set<string>();
      compat.palaces.forEach((p) => p.stars.forEach((s) => compatKeys.add(s.key)));
      expect([...compatKeys].sort()).toEqual([...keys].sort());

      for (const key of keys) {
        const a = positionOf(fixed, key) as number;
        const b = positionOf(compat, key) as number;
        const shift = COMPAT_SHIFTS.find((s) => s.star === key);
        const want = shift ? mod(a + shift.delta, 12) : a;
        if (b !== want) unexplained.push(`[${y}-${m}-${d}] ${key}: 개선=${a} 호환=${b} 기대=${want}`);
      }
      // 칸 단위로도: 4개 별을 제외한 모든 칸의 나머지 별 구성이 같다
      const skip = new Set(COMPAT_SHIFTS.map((s) => s.star));
      for (let b = 0; b < 12; b++) {
        const fa = fixed.palaces[b].stars.filter((s) => !skip.has(s.key)).map((s) => s.key + (s.brightness ?? '') + (s.mutagen ?? ''));
        const ca = compat.palaces[b].stars.filter((s) => !skip.has(s.key)).map((s) => s.key + (s.brightness ?? '') + (s.mutagen ?? ''));
        expect(ca).toEqual(fa);
      }
      expect(compat.compatApplied).toHaveLength(4);
      n++;
    }
    expect(n).toBeGreaterThan(280);
    expect(unexplained).toEqual([]);
  });

  it('독립 구현 대조의 민감도: 호환 모드 명반은 정확히 4개 항목에서만 불일치로 걸린다', () => {
    const r = rng(99);
    for (let i = 0; i < 60; i++) {
      const { y, m, d } = randomSolarDate(r, 1930, 2060);
      const hb = Math.floor(r() * 12);
      const compat = makeChart(y, m, d, hb, 'M', { compat: true });
      const diffs = compareWithIndependent('c', compat, keyOf(y, m, d, hb, 'lunarNewYear'), 'M');
      const names = diffs.map((s) => s.split(' ')[1].replace(':', '')).sort();
      expect(names).toEqual(['八座', '右弼', '天刑', '天姚'].sort());
    }
  });
});
