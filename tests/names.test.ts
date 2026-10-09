// V-04 밝기 매핑(F-05) · V-05 별 이름·분류(R-07, F-06, I-09)
import { describe, expect, it } from 'vitest';
import {
  LEGEND5, LEGEND7, averageScore, brightnessLabel, parseBrightness, to5,
} from '../src/core/brightness';
import type { Brightness7 } from '../src/core/brightness';
import {
  BAD_STAR_KEYS, GOOD_STAR_KEYS, MAIN_STAR_KEYS, MISC_STAR_KEYS, PALACE_KEYS, PALACE_KO, PALACE_SHORT, STAR_META, TWELVE_KO, isKnownStar,
  parseFlowStar, sortStars, starLabel, starMeta,
} from '../src/core/names';
import { buildView, decadalList, scorePalace, viewForDecade } from '../src/core/chart';
import { makeChart, randomSolarDate, rng } from './helpers';

describe('V-04 밝기', () => {
  it('원장 F-05의 5단계 지수: 묘100 왕75 평50 한25 함0', () => {
    expect(LEGEND5.map((l) => `${l.symbol}${l.text}${l.score}`)).toEqual(['◎묘100', '○왕75', '△평50', '/한25', 'X함0']);
  });
  it('7→5 매핑표(설계서 4-5)', () => {
    const want: Record<Brightness7, string> = { miao: 'miao', wang: 'wang', de: 'wang', li: 'ping', ping: 'ping', bu: 'han', xian: 'xian' };
    for (const [k, v] of Object.entries(want)) expect(to5(k as Brightness7)).toBe(v);
  });
  it('7단계 표시는 7개이며 지수가 단조 감소한다', () => {
    expect(LEGEND7).toHaveLength(7);
    const scores = LEGEND7.map((l) => l.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(brightnessLabel('de', '7').text).toBe('득');
    expect(brightnessLabel('de', '5').text).toBe('왕');
  });
  it('엔진 표기(廟旺得利平不陷)를 해석한다', () => {
    expect(['廟', '旺', '得', '利', '平', '不', '陷'].map((z) => parseBrightness(z))).toEqual(['miao', 'wang', 'de', 'li', 'ping', 'bu', 'xian']);
    expect(parseBrightness(undefined)).toBeUndefined();
  });
  it('평균지수: 비면 null, 묘+함=50', () => {
    expect(averageScore([], '5')).toBeNull();
    expect(averageScore(['miao', 'xian'], '5')).toBe(50);
  });
});

describe('V-05 별 이름·분류', () => {
  it('원장 F-06: 주성 14 · 길성 8 · 흉성 6, 키 중복 없음', () => {
    expect(MAIN_STAR_KEYS).toHaveLength(14);
    expect(GOOD_STAR_KEYS).toHaveLength(8);
    expect(BAD_STAR_KEYS).toHaveLength(6);
    const all = [...MAIN_STAR_KEYS, ...GOOD_STAR_KEYS, ...BAD_STAR_KEYS, ...MISC_STAR_KEYS];
    expect(new Set(all).size).toBe(all.length);
  });
  it('한글 표기 충돌이 없다(동명 별은 꼬리표로 구분): 같은 한글 이름이 두 별에 쓰이지 않는다', () => {
    const seen = new Map<string, string>();
    for (const m of Object.values(STAR_META)) {
      expect(seen.has(m.ko), `${m.ko} 중복: ${seen.get(m.ko)} / ${m.key}`).toBe(false);
      seen.set(m.ko, m.key);
    }
  });
  it('원장 I-09: “명궁궁” 같은 접미 중복이 없고 12궁 이름이 모두 다르다', () => {
    for (const k of PALACE_KEYS) {
      expect(PALACE_KO[k]).not.toMatch(/궁궁/);
      expect(PALACE_SHORT[k].length).toBeLessThanOrEqual(2);
    }
    expect(new Set(Object.values(PALACE_KO)).size).toBe(12);
  });
  it('표본 명반 250개: 모든 별·12신 이름이 이름표에 있고, 주성 14·길성 8·흉성 6이 각각 정확히 한 번씩 나온다', () => {
    const r = rng(8080);
    for (let i = 0; i < 250; i++) {
      const { y, m, d } = randomSolarDate(r, 1900, 2100);
      if (y === 1900 && m < 2) continue;
      const chart = makeChart(y, m, d, Math.floor(r() * 12), r() < 0.5 ? 'M' : 'F');
      const count = new Map<string, number>();
      for (const p of chart.palaces) {
        expect(PALACE_KEYS).toContain(p.natalName);
        for (const s of p.stars) {
          expect(isKnownStar(s.key), `미등록 별 ${s.key}`).toBe(true);
          count.set(s.key, (count.get(s.key) ?? 0) + 1);
        }
        for (const series of ['changsheng', 'boshi', 'jiangqian', 'suiqian'] as const) {
          expect(TWELVE_KO[series][p.twelve[series]], `${series} ${p.twelve[series]}`).toBeTruthy();
        }
      }
      for (const k of [...MAIN_STAR_KEYS, ...GOOD_STAR_KEYS, ...BAD_STAR_KEYS]) expect(count.get(k), `${k}`).toBe(1);
      // 12신 계열은 12칸에 한 번씩
      for (const series of ['changsheng', 'boshi', 'jiangqian', 'suiqian'] as const) {
        expect(new Set(chart.palaces.map((p) => p.twelve[series])).size).toBe(12);
      }
      // 칸 안 정렬: 그룹 순서 유지
      for (const p of chart.palaces) expect(sortStars(p.stars).map((s) => s.key)).toEqual(p.stars.map((s) => s.key));
    }
  });
  it('운 유성 이름을 모두 해석한다(5개 운 × 10종)', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    for (const scope of ['decadal', 'yearly', 'monthly', 'daily', 'hourly'] as const) {
      const v = scope === 'decadal' ? viewForDecade(chart, decadalList(chart)[2].startAge) : buildView(chart, scope, { date: { y: 2026, m: 10, d: 9 }, timeIndex: 6 });
      const n = v.flow.flat().length;
      expect(n).toBeGreaterThanOrEqual(10);
    }
    expect(parseFlowStar('運昌')?.ko).toBe('운창');
    expect(parseFlowStar('流祿')?.fullKo).toBe('유년 녹존');
    expect(parseFlowStar('時喜')?.scope).toBe('hourly');
    expect(parseFlowStar('없는별')).toBeNull();
  });
  it('병기 표기는 동명 꼬리표를 한자로 대체한다', () => {
    expect(starLabel(starMeta('天月'), 'both')).toBe('천월(天月)');
    expect(starLabel(starMeta('天鉞'), 'both')).toBe('천월(天鉞)');
    expect(starLabel(starMeta('天傷'), 'ko')).toBe('천상(傷)');
    expect(starLabel(starMeta('紫微'), 'hanja')).toBe('紫微');
  });
  it('지수: 빈 궁은 밝기 null, 사화 기는 흉으로 센다', () => {
    const chart = makeChart(1990, 1, 30, 6, 'M');
    const life = chart.palaces[chart.meta.soulBranch];
    expect(scorePalace(life, '5').brightness).toBeNull();
    const happy = chart.palaces.find((p) => p.stars.some((s) => s.mutagen === 'ji'))!;
    expect(scorePalace(happy, '5').bad).toBeGreaterThanOrEqual(1);
  });
});
