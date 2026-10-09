// 밝기: 엔진(iztro)은 7단계(廟旺得利平不陷)를 준다. 사이트는 5단계(◎묘 ○왕 △평 /한 X함)로 보여 준다.
// 설계서 4-5: 5단계 표시가 기본이고 7단계 전환을 지원한다. 득·리의 5단계 대응은 임시(사이트 매핑표 미확인).

export type Brightness7 = 'miao' | 'wang' | 'de' | 'li' | 'ping' | 'bu' | 'xian';
export type Brightness5 = 'miao' | 'wang' | 'ping' | 'han' | 'xian';
export type BrightnessMode = '5' | '7';

const ZH_TO_KEY: Record<string, Brightness7> = {
  廟: 'miao', 庙: 'miao', 旺: 'wang', 得: 'de', 利: 'li', 平: 'ping', 不: 'bu', 陷: 'xian',
};

export const parseBrightness = (zh: string | undefined | null): Brightness7 | undefined =>
  zh ? ZH_TO_KEY[zh] : undefined;

const TO5: Record<Brightness7, Brightness5> = {
  miao: 'miao', wang: 'wang', de: 'wang', li: 'ping', ping: 'ping', bu: 'han', xian: 'xian',
};
export const to5 = (b: Brightness7): Brightness5 => TO5[b];

export interface BrightnessLabel {
  key: Brightness7 | Brightness5;
  symbol: string;
  text: string;
  score: number;
  /** 색상 구간(0 가장 밝음 ~ 4 가장 어두움) */
  tier: 0 | 1 | 2 | 3 | 4;
}

const L5: Record<Brightness5, BrightnessLabel> = {
  miao: { key: 'miao', symbol: '◎', text: '묘', score: 100, tier: 0 },
  wang: { key: 'wang', symbol: '○', text: '왕', score: 75, tier: 1 },
  ping: { key: 'ping', symbol: '△', text: '평', score: 50, tier: 2 },
  han: { key: 'han', symbol: '/', text: '한', score: 25, tier: 3 },
  xian: { key: 'xian', symbol: 'X', text: '함', score: 0, tier: 4 },
};

const L7: Record<Brightness7, BrightnessLabel> = {
  miao: { key: 'miao', symbol: '◎', text: '묘', score: 100, tier: 0 },
  wang: { key: 'wang', symbol: '○', text: '왕', score: 83, tier: 1 },
  de: { key: 'de', symbol: '◐', text: '득', score: 67, tier: 1 },
  li: { key: 'li', symbol: '◑', text: '리', score: 50, tier: 2 },
  ping: { key: 'ping', symbol: '△', text: '평', score: 33, tier: 2 },
  bu: { key: 'bu', symbol: '/', text: '불', score: 17, tier: 3 },
  xian: { key: 'xian', symbol: 'X', text: '함', score: 0, tier: 4 },
};

export const brightnessLabel = (b: Brightness7, mode: BrightnessMode): BrightnessLabel =>
  mode === '7' ? L7[b] : L5[TO5[b]];

export const brightnessScore = (b: Brightness7, mode: BrightnessMode): number => brightnessLabel(b, mode).score;

/** 5단계 지수표(범례용) */
export const LEGEND5: BrightnessLabel[] = [L5.miao, L5.wang, L5.ping, L5.han, L5.xian];
export const LEGEND7: BrightnessLabel[] = [L7.miao, L7.wang, L7.de, L7.li, L7.ping, L7.bu, L7.xian];

/** 밝기 평균지수(I-11). 비어 있으면 null */
export const averageScore = (list: Brightness7[], mode: BrightnessMode): number | null => {
  if (list.length === 0) return null;
  const sum = list.reduce((acc, b) => acc + brightnessScore(b, mode), 0);
  return Math.round(sum / list.length);
};
