// 독립 구현: 전통 구결(口訣)에서 직접 작성한 포국 공식.
// 목적 ① 검증 — 엔진(iztro)과 별개의 계산으로 결과를 대조한다(V-01).  ② 역산 입력의 빠른 탐색(reverse.ts).
// 이 파일은 iztro 의 소스를 참조하지 않고, 주석에 적은 구결/표를 그대로 코드로 옮긴 것이다.
//
// 지지 인덱스: 子=0 … 亥=11 (ganzhi.ts). 寅=2, 卯=3, 辰=4, 巳=5, 午=6, 未=7, 申=8, 酉=9, 戌=10, 亥=11.

import { isYangStem, mod, stemOfBranchFromYear } from './ganzhi';
import type { Mutagen } from './names';

export interface LunarKey {
  yearStem: number;
  yearBranch: number;
  /** 유효 음력 월(1~12, 윤달 후반 보정 후) */
  month: number;
  /** 유효 음력 일(1~30) */
  day: number;
  /** 시진(0=子 … 11=亥) */
  hourBranch: number;
}

// ── 오행국: 命宮 干支의 納音 오행 ─────────────────────────────────────────────
// 60甲子 순서의 納音 30개(2개 간지당 1개): 海中金 爐中火 大林木 路旁土 劍鋒金 山頭火 澗下水 城頭土 白蠟金 楊柳木
// 泉中水 屋上土 霹靂火 松柏木 長流水 砂中金 山下火 平地木 壁上土 金箔金 覆燈火 天河水 大驛土 釵釧金 桑柘木 大溪水
// 沙中土 天上火 石榴木 大海水
type El = '金' | '木' | '水' | '火' | '土';
const NAYIN: El[] = [
  '金', '火', '木', '土', '金', '火', '水', '土', '金', '木', '水', '土', '火', '木', '水',
  '金', '火', '木', '土', '金', '火', '水', '土', '金', '木', '水', '土', '火', '木', '水',
];
const CLASS_OF: Record<El, number> = { 水: 2, 木: 3, 金: 4, 土: 5, 火: 6 };

/** 天干·地支 → 60甲子 번호(0~59). 홀짝이 다르면 존재하지 않는 간지 */
export const jiaziIndex = (stem: number, branch: number): number => {
  // n ≡ stem (mod 10), n ≡ branch (mod 12)
  for (let n = stem; n < 60; n += 10) if (n % 12 === branch) return n;
  return -1;
};

/** 命宮 간지 → 오행국 수(2 水, 3 木, 4 金, 5 土, 6 火) */
export const fiveClassOfGanzhi = (stem: number, branch: number): number => {
  const n = jiaziIndex(stem, branch);
  if (n < 0) throw new Error('유효하지 않은 간지');
  return CLASS_OF[NAYIN[Math.floor(n / 2)]];
};

// ── 紫微 위치: 局數除日數 ────────────────────────────────────────────────────
// 六五四三二 酉午亥辰丑 / 局數除日數 商數宮前走 / 若見數無余 便要起虎口 / 日數小於局 還直宮中守
// (日數에 더해 局數로 나누어떨어지게 하는 수가 홀수면 뒤로, 짝수면 앞으로 간다. 寅에서 商數칸.)
export const ziweiBranch = (day: number, fiveNum: number): number => {
  let add = 0;
  while ((day + add) % fiveNum !== 0) add++;
  const quotient = (day + add) / fiveNum;
  const fromYin = quotient - 1 + (add % 2 === 0 ? add : -add);
  return mod(2 + fromYin, 12);
};

// ── 년간 사화표 ──────────────────────────────────────────────────────────────
export const MUTAGEN_TABLE: [string, string, string, string][] = [
  ['廉貞', '破軍', '武曲', '太陽'], // 甲
  ['天機', '天梁', '紫微', '太陰'], // 乙
  ['天同', '天機', '文昌', '廉貞'], // 丙
  ['太陰', '天同', '天機', '巨門'], // 丁
  ['貪狼', '太陰', '右弼', '天機'], // 戊
  ['武曲', '貪狼', '天梁', '文曲'], // 己
  ['太陽', '武曲', '太陰', '天同'], // 庚
  ['巨門', '太陽', '文曲', '文昌'], // 辛
  ['天梁', '紫微', '左輔', '武曲'], // 壬
  ['破軍', '巨門', '太陰', '貪狼'], // 癸
];
const MUTAGEN_ORDER: Mutagen[] = ['lu', 'quan', 'ke', 'ji'];

// ── 년간·년지 계열 ───────────────────────────────────────────────────────────
// 定祿存: 甲祿到寅 乙祿居卯 丙戊祿在巳 丁己祿在午 庚祿定申 辛祿酉 壬祿亥 癸祿子
export const LUCUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
// 天魁天鉞(貴人): 甲戊庚牛羊 乙己鼠猴鄉 丙丁豬雞位 壬癸兔蛇藏 六辛逢馬虎 → [魁, 鉞]
export const KUIYUE: [number, number][] = [
  [1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [3, 5], [3, 5],
];
const TRIAD = (yearBranch: number): 0 | 1 | 2 | 3 => {
  // 0: 申子辰(水局) 1: 寅午戌(火局) 2: 巳酉丑(金局) 3: 亥卯未(木局)
  const b = mod(yearBranch, 12);
  if ([8, 0, 4].includes(b)) return 0;
  if ([2, 6, 10].includes(b)) return 1;
  if ([5, 9, 1].includes(b)) return 2;
  return 3;
};
// 天馬(年支): 申子辰 → 寅 / 寅午戌 → 申 / 巳酉丑 → 亥 / 亥卯未 → 巳 (TRIAD 순서: 水局, 火局, 金局, 木局)
export const tianma = (yearBranch: number): number => [2, 8, 11, 5][TRIAD(yearBranch)];

// 火星鈴星: 申子辰人寅戌揚 寅午戌人丑卯方 巳酉丑人卯戌位 亥卯未人酉戌房 → [火星 시작, 鈴星 시작], 子時부터 순행
const HUOLING: [number, number][] = [[2, 10], [1, 3], [3, 10], [9, 10]];

export interface IndependentChart {
  soul: number;
  body: number;
  fiveClass: number;
  ziwei: number;
  tianfu: number;
  /** 별 키(zh-TW) → 지지 */
  stars: Record<string, number>;
  mutagens: { star: string; mutagen: Mutagen }[];
  decadalForward: boolean;
  firstDecadalAge: number;
}

/** 월·시 계열만 필요한 빠른 계산(역산 탐색용). */
export interface QuickKeys {
  soul: number;
  body: number;
  fiveClass: number;
  ziwei: number;
  zuofu: number;
  youbi: number;
  wenchang: number;
  wenqu: number;
}

export const quickKeys = (k: LunarKey): QuickKeys => {
  // 命宮: 寅에서 정월로 시작해 순행으로 생월, 거기서 子時로 시작해 역행으로 생시까지. 身宮은 순행.
  const monthPalace = mod(2 + (k.month - 1), 12);
  const soul = mod(monthPalace - k.hourBranch, 12);
  const body = mod(monthPalace + k.hourBranch, 12);
  const stem = stemOfBranchFromYear(k.yearStem, soul);
  const fiveClass = fiveClassOfGanzhi(stem, soul);
  return {
    soul,
    body,
    fiveClass,
    ziwei: ziweiBranch(k.day, fiveClass),
    zuofu: mod(4 + (k.month - 1), 12), // 辰上順正尋左輔
    youbi: mod(10 - (k.month - 1), 12), // 戌上逆正右弼當
    wenchang: mod(10 - k.hourBranch, 12), // 戌上逆時覓文昌
    wenqu: mod(4 + k.hourBranch, 12), // 辰上順時文曲位
  };
};

/** 14주성 위치: 紫微계열은 역행, 天府계열은 순행 */
const ZIWEI_OFFSETS: [string, number][] = [['紫微', 0], ['天機', -1], ['太陽', -3], ['武曲', -4], ['天同', -5], ['廉貞', -8]];
const TIANFU_OFFSETS: [string, number][] = [
  ['天府', 0], ['太陰', 1], ['貪狼', 2], ['巨門', 3], ['天相', 4], ['天梁', 5], ['七殺', 6], ['破軍', 10],
];

export const independentChart = (k: LunarKey, gender: 'M' | 'F'): IndependentChart => {
  const q = quickKeys(k);
  const stars: Record<string, number> = {};
  const tianfu = mod(4 - q.ziwei, 12); // 紫微와 天府는 寅申 축에 대칭
  for (const [n, o] of ZIWEI_OFFSETS) stars[n] = mod(q.ziwei + o, 12);
  for (const [n, o] of TIANFU_OFFSETS) stars[n] = mod(tianfu + o, 12);

  stars['左輔'] = q.zuofu;
  stars['右弼'] = q.youbi;
  stars['文昌'] = q.wenchang;
  stars['文曲'] = q.wenqu;
  const [kui, yue] = KUIYUE[k.yearStem];
  stars['天魁'] = kui;
  stars['天鉞'] = yue;
  const lu = LUCUN[k.yearStem];
  stars['祿存'] = lu;
  stars['擎羊'] = mod(lu + 1, 12);
  stars['陀羅'] = mod(lu - 1, 12);
  stars['天馬'] = tianma(k.yearBranch);
  const [huo, ling] = HUOLING[TRIAD(k.yearBranch)];
  stars['火星'] = mod(huo + k.hourBranch, 12);
  stars['鈴星'] = mod(ling + k.hourBranch, 12);
  stars['地空'] = mod(11 - k.hourBranch, 12); // 亥上子時順安劫 逆回便是地空亡
  stars['地劫'] = mod(11 + k.hourBranch, 12);

  // 월 계열 잡성: 天刑 酉에서 정월 순행 / 天姚 丑에서 정월 순행
  stars['天刑'] = mod(9 + (k.month - 1), 12);
  stars['天姚'] = mod(1 + (k.month - 1), 12);
  // 月解: 正二在申 三四在戌 五六在子 七八在寅 九十月坐於辰 十一十二在午
  stars['解神'] = [8, 10, 0, 2, 4, 6][Math.floor((k.month - 1) / 2)];
  // 陰煞: 正七月在寅 二八月在子 三九月在戌 四十月在申 五十一在午 六十二在辰
  stars['陰煞'] = [2, 0, 10, 8, 6, 4][(k.month - 1) % 6];
  // 天月: 一犬二蛇三在龍 四虎五羊六兔宮 七猪八羊九在虎 十馬冬犬臘寅中
  stars['天月'] = [10, 5, 4, 2, 7, 3, 11, 7, 2, 6, 10, 2][k.month - 1];
  // 天巫: 正五九月在巳 二六十月在申 三七十一在寅 四八十二在亥
  stars['天巫'] = [5, 8, 2, 11][(k.month - 1) % 4];

  // 일 계열: 左輔에서 초하루로 순행해 생일에 三台 / 右弼에서 초하루로 역행해 생일에 八座
  //          文昌에서 초하루로 순행해 생일, 다시 한 칸 물러 恩光 / 文曲에서 같은 방식으로 天貴
  stars['三台'] = mod(q.zuofu + (k.day - 1), 12);
  stars['八座'] = mod(q.youbi - (k.day - 1), 12);
  stars['恩光'] = mod(q.wenchang + (k.day - 1) - 1, 12);
  stars['天貴'] = mod(q.wenqu + (k.day - 1) - 1, 12);

  // 시 계열: 台輔 午에서 子時부터 순행 / 封誥 寅에서 子時부터 순행
  stars['台輔'] = mod(6 + k.hourBranch, 12);
  stars['封誥'] = mod(2 + k.hourBranch, 12);

  // 년지 계열
  const yb = k.yearBranch;
  stars['紅鸞'] = mod(3 - yb, 12); // 卯에서 子년부터 역행
  stars['天喜'] = mod(stars['紅鸞'] + 6, 12); // 紅鸞의 대궁
  stars['龍池'] = mod(4 + yb, 12); // 辰에서 子년부터 순행
  stars['鳳閣'] = mod(10 - yb, 12); // 戌에서 子년부터 역행
  stars['天哭'] = mod(6 - yb, 12); // 午에서 子년부터 역행
  stars['天虛'] = mod(6 + yb, 12); // 午에서 子년부터 순행
  stars['天才'] = mod(q.soul + yb, 12); // 命宮에서 子년부터 순행
  stars['天壽'] = mod(q.body + yb, 12); // 身宮에서 子년부터 순행
  // 孤辰寡宿: 寅卯辰 → 巳/丑, 巳午未 → 申/辰, 申酉戌 → 亥/未, 亥子丑 → 寅/戌
  const season = Math.floor(mod(yb - 2, 12) / 3);
  stars['孤辰'] = [5, 8, 11, 2][season];
  stars['寡宿'] = [1, 4, 7, 10][season];
  // 華蓋咸池(년지 삼합): 寅午戌 → 戌/卯, 巳酉丑 → 丑/午, 申子辰 → 辰/酉, 亥卯未 → 未/子
  const t = TRIAD(yb);
  stars['華蓋'] = [4, 10, 1, 7][t];
  stars['咸池'] = [9, 3, 6, 0][t];

  const mutagens = MUTAGEN_TABLE[k.yearStem].map((star, i) => ({ star, mutagen: MUTAGEN_ORDER[i] }));

  // 大限: 命宮에서 출발, 陽男陰女는 순행 / 陰男陽女는 역행. 첫 대한 시작 나이는 오행국 수
  const forward = isYangStem(k.yearStem) === (gender === 'M');
  return {
    soul: q.soul,
    body: q.body,
    fiveClass: q.fiveClass,
    ziwei: q.ziwei,
    tianfu,
    stars,
    mutagens,
    decadalForward: forward,
    firstDecadalAge: q.fiveClass,
  };
};

/** 대한 구간: 명궁에서 k번째 구간의 지지와 나이 범위 */
export const independentDecades = (c: IndependentChart): { branch: number; from: number; to: number }[] =>
  Array.from({ length: 12 }, (_, i) => ({
    branch: mod(c.soul + (c.decadalForward ? i : -i), 12),
    from: c.firstDecadalAge + i * 10,
    to: c.firstDecadalAge + i * 10 + 9,
  }));
