// 별·궁·12신·사화·운 유성의 이름표. 키는 엔진(zh-TW) 표기를 그대로 쓴다.
// 동명 별(예: 天鉞/天月, 天相/天傷, 12신 계열의 小耗·大耗·病符·官符·華蓋·咸池·天德)은
// 종류(kind)를 키에 포함해 구분한다 — 원장 I-09 “동명 신살 호출 충돌” 방지.

export type StarGroup = 'main' | 'good' | 'bad' | 'misc';
export type StarTone = 'main' | 'good' | 'bad' | 'flower' | 'helper' | 'neutral';

export interface StarMeta {
  key: string;
  hanja: string;
  ko: string;
  group: StarGroup;
  tone: StarTone;
}

const main: [string, string][] = [
  ['紫微', '자미'], ['天機', '천기'], ['太陽', '태양'], ['武曲', '무곡'], ['天同', '천동'], ['廉貞', '염정'], ['天府', '천부'],
  ['太陰', '태음'], ['貪狼', '탐랑'], ['巨門', '거문'], ['天相', '천상'], ['天梁', '천량'], ['七殺', '칠살'], ['破軍', '파군'],
];
const good: [string, string][] = [
  ['左輔', '좌보'], ['右弼', '우필'], ['文昌', '문창'], ['文曲', '문곡'], ['天魁', '천괴'], ['天鉞', '천월'], ['祿存', '녹존'], ['天馬', '천마'],
];
const bad: [string, string][] = [
  ['擎羊', '경양'], ['陀羅', '타라'], ['火星', '화성'], ['鈴星', '령성'], ['地空', '지공'], ['地劫', '지겁'],
];
// 소잡성: [키, 한글, 색 분류(표시용)]. 길·흉 분류는 색 구분을 위한 표시용이며 해석 우열을 뜻하지 않는다.
const misc: [string, string, StarTone][] = [
  ['紅鸞', '홍란', 'flower'], ['天喜', '천희', 'flower'], ['天姚', '천요', 'flower'], ['咸池', '함지', 'flower'],
  ['天刑', '천형', 'bad'], ['陰煞', '음살', 'bad'], ['天哭', '천곡', 'bad'], ['天虛', '천허', 'bad'], ['孤辰', '고신', 'bad'],
  ['寡宿', '과숙', 'bad'], ['蜚廉', '비렴', 'bad'], ['破碎', '파쇄', 'bad'], ['天傷', '천상(傷)', 'bad'], ['天使', '천사', 'bad'],
  ['天月', '천월(月)', 'bad'],
  ['空亡', '공망', 'neutral'], ['旬空', '순공', 'neutral'], ['截路', '절로', 'neutral'], ['天空', '천공', 'neutral'],
  ['三台', '삼태', 'good'], ['八座', '팔좌', 'good'], ['恩光', '은광', 'good'], ['天貴', '천귀', 'good'], ['龍池', '용지', 'good'],
  ['鳳閣', '봉각', 'good'], ['台輔', '태보', 'good'], ['封誥', '봉고', 'good'], ['天福', '천복', 'good'], ['天德', '천덕', 'good'],
  ['月德', '월덕', 'good'], ['天官', '천관', 'good'], ['天才', '천재', 'good'], ['天壽', '천수', 'good'], ['天廚', '천주', 'good'],
  ['解神', '해신', 'helper'], ['年解', '년해', 'helper'], ['天巫', '천무', 'neutral'], ['華蓋', '화개', 'neutral'],
];

export const STAR_META: Record<string, StarMeta> = {};
for (const [k, ko] of main) STAR_META[k] = { key: k, hanja: k, ko, group: 'main', tone: 'main' };
for (const [k, ko] of good) STAR_META[k] = { key: k, hanja: k, ko, group: 'good', tone: 'good' };
for (const [k, ko] of bad) STAR_META[k] = { key: k, hanja: k, ko, group: 'bad', tone: 'bad' };
for (const [k, ko, tone] of misc) STAR_META[k] = { key: k, hanja: k, ko, group: 'misc', tone };

export const MAIN_STAR_KEYS = main.map(([k]) => k);
export const GOOD_STAR_KEYS = good.map(([k]) => k);
export const BAD_STAR_KEYS = bad.map(([k]) => k);
export const MISC_STAR_KEYS = misc.map(([k]) => k);

const GROUP_ORDER: Record<StarGroup, number> = { main: 0, good: 1, bad: 2, misc: 3 };
const ORDER_INDEX: Record<string, number> = {};
[...good, ...bad, ...misc].forEach(([k], i) => (ORDER_INDEX[k] = i));

/** 칸 안 표시 순서: 주성 → 길성 → 흉성 → 잡성. 같은 그룹에서는 표의 정의 순서, 그 외에는 입력 순서 유지 */
export const sortStars = <T extends { group: StarGroup; key: string }>(stars: T[]): T[] =>
  stars
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) =>
        GROUP_ORDER[a.s.group] - GROUP_ORDER[b.s.group] || (ORDER_INDEX[a.s.key] ?? 0) - (ORDER_INDEX[b.s.key] ?? 0) || a.i - b.i,
    )
    .map((x) => x.s);

/** 알 수 없는 별이 와도 화면이 깨지지 않도록 대체 메타를 돌려준다(테스트에서 대체가 0건임을 확인). */
export const starMeta = (key: string): StarMeta =>
  STAR_META[key] ?? { key, hanja: key, ko: key, group: 'misc', tone: 'neutral' };
export const isKnownStar = (key: string): boolean => key in STAR_META;

// ── 12신 계열 ────────────────────────────────────────────────────────────────
export type TwelveSeries = 'changsheng' | 'boshi' | 'jiangqian' | 'suiqian';

export const TWELVE_SERIES_KO: Record<TwelveSeries, string> = {
  changsheng: '장생12신', boshi: '박사12신', jiangqian: '장전12신', suiqian: '세전12신',
};

export const TWELVE_KO: Record<TwelveSeries, Record<string, string>> = {
  changsheng: {
    長生: '장생', 沐浴: '목욕', 冠帶: '관대', 臨官: '임관', 帝旺: '제왕', 衰: '쇠', 病: '병', 死: '사', 墓: '묘', 絕: '절', 胎: '태', 養: '양',
  },
  boshi: {
    博士: '박사', 力士: '역사', 青龍: '청룡', 小耗: '소모', 將軍: '장군', 奏書: '주서', 飛廉: '비렴', 喜神: '희신', 病符: '병부', 大耗: '대모', 伏兵: '복병', 官府: '관부',
  },
  jiangqian: {
    將星: '장성', 攀鞍: '반안', 歲驛: '세역', 息神: '식신', 華蓋: '화개', 劫煞: '겁살', 災煞: '재살', 天煞: '천살', 指背: '지배', 咸池: '함지', 月煞: '월살', 亡神: '망신',
  },
  suiqian: {
    歲建: '세건', 晦氣: '회기', 喪門: '상문', 貫索: '관삭', 官符: '관부', 小耗: '소모', 大耗: '대모', 龍德: '용덕', 白虎: '백호', 天德: '천덕', 弔客: '조객', 病符: '병부',
  },
};

export const twelveKo = (series: TwelveSeries, key: string): string => TWELVE_KO[series][key] ?? key;

// ── 12궁 ─────────────────────────────────────────────────────────────────────
export const PALACE_KEYS = [
  'life', 'siblings', 'spouse', 'children', 'wealth', 'health', 'travel', 'friends', 'career', 'property', 'fortune', 'parents',
] as const;
export type PalaceKey = (typeof PALACE_KEYS)[number];

export const PALACE_HANJA: Record<PalaceKey, string> = {
  life: '命宮', siblings: '兄弟', spouse: '夫妻', children: '子女', wealth: '財帛', health: '疾厄',
  travel: '遷移', friends: '僕役', career: '官祿', property: '田宅', fortune: '福德', parents: '父母',
};
/** 화면에 쓰는 이름. “명궁궁” 같은 접미 중복을 피하려고 완성형으로 둔다(원장 I-09). */
export const PALACE_KO: Record<PalaceKey, string> = {
  life: '명궁', siblings: '형제궁', spouse: '부처궁', children: '자녀궁', wealth: '재백궁', health: '질액궁',
  travel: '천이궁', friends: '노복궁', career: '관록궁', property: '전택궁', fortune: '복덕궁', parents: '부모궁',
};
/** 칸 머리글처럼 좁은 곳에 쓰는 짧은 이름 */
export const PALACE_SHORT: Record<PalaceKey, string> = {
  life: '명궁', siblings: '형제', spouse: '부처', children: '자녀', wealth: '재백', health: '질액',
  travel: '천이', friends: '노복', career: '관록', property: '전택', fortune: '복덕', parents: '부모',
};

const PALACE_FROM_ZH: Record<string, PalaceKey> = {};
for (const k of PALACE_KEYS) PALACE_FROM_ZH[PALACE_HANJA[k]] = k;
PALACE_FROM_ZH['命宫'] = 'life';
export const palaceKeyFromZh = (zh: string): PalaceKey => {
  const v = PALACE_FROM_ZH[zh];
  if (!v) throw new Error(`알 수 없는 궁 이름: ${zh}`);
  return v;
};

// ── 사화 ─────────────────────────────────────────────────────────────────────
export type Mutagen = 'lu' | 'quan' | 'ke' | 'ji';
export const MUTAGENS: Mutagen[] = ['lu', 'quan', 'ke', 'ji'];
export const MUTAGEN_KO: Record<Mutagen, string> = { lu: '록', quan: '권', ke: '과', ji: '기' };
export const MUTAGEN_LONG_KO: Record<Mutagen, string> = { lu: '화록', quan: '화권', ke: '화과', ji: '화기' };
export const MUTAGEN_HANJA: Record<Mutagen, string> = { lu: '祿', quan: '權', ke: '科', ji: '忌' };
export const mutagenFromZh = (zh: string | undefined): Mutagen | undefined => {
  switch (zh) {
    case '祿': case '禄': return 'lu';
    case '權': case '权': return 'quan';
    case '科': return 'ke';
    case '忌': return 'ji';
    default: return undefined;
  }
};

// ── 운 유성(대한·유년·유월·유일·유시에 흐르는 별) ─────────────────────────────
export type Scope = 'natal' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly';
export const SCOPES: Scope[] = ['natal', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'];
export const SCOPE_KO: Record<Scope, string> = {
  natal: '본명', decadal: '대한', yearly: '유년', monthly: '유월', daily: '유일', hourly: '유시',
};
/** 칩 앞머리에 붙이는 한 글자 */
export const SCOPE_TAG: Record<Scope, string> = { natal: '본', decadal: '대', yearly: '년', monthly: '월', daily: '일', hourly: '시' };

const FLOW_PREFIX: Record<string, Scope> = { 運: 'decadal', 流: 'yearly', 月: 'monthly', 日: 'daily', 時: 'hourly' };
const FLOW_PREFIX_KO: Record<Scope, string> = { natal: '', decadal: '운', yearly: '유', monthly: '월', daily: '일', hourly: '시' };
const FLOW_BASE_KO: Record<string, string> = {
  昌: '창', 曲: '곡', 魁: '괴', 鉞: '월', 祿: '록', 羊: '양', 陀: '타', 馬: '마', 鸞: '란', 喜: '희',
};
const FLOW_BASE_FULL: Record<string, string> = {
  昌: '문창', 曲: '문곡', 魁: '천괴', 鉞: '천월', 祿: '녹존', 羊: '경양', 陀: '타라', 馬: '천마', 鸞: '홍란', 喜: '천희',
};

export interface FlowStarMeta {
  key: string;
  scope: Scope;
  ko: string;
  hanja: string;
  /** 어떤 본별에 대응하는지(툴팁용): 예) 유년 문창 */
  fullKo: string;
  tone: StarTone;
}

/** 運昌, 流祿, 月羊 … 같은 유성 이름을 해석한다. 해석 불가면 null. */
export const parseFlowStar = (key: string): FlowStarMeta | null => {
  if (key === '年解') return { key, scope: 'yearly', ko: '년해', hanja: key, fullKo: '유년 년해', tone: 'helper' };
  if (key.length !== 2) return null;
  const scope = FLOW_PREFIX[key[0]];
  const baseKo = FLOW_BASE_KO[key[1]];
  if (!scope || !baseKo) return null;
  const tone: StarTone = '羊陀'.includes(key[1]) ? 'bad' : '祿魁鉞昌曲'.includes(key[1]) ? 'good' : key[1] === '馬' ? 'neutral' : 'flower';
  return {
    key,
    scope,
    ko: FLOW_PREFIX_KO[scope] + baseKo,
    hanja: key,
    fullKo: `${SCOPE_KO[scope]} ${FLOW_BASE_FULL[key[1]]}`,
    tone,
  };
};

// ── 별 표기 ──────────────────────────────────────────────────────────────────
export type NameStyle = 'ko' | 'both' | 'hanja';

/**
 * 별 이름 표기. 병기('both')에서는 한글 뒤에 한자를 붙인다.
 * 동명 구분용 꼬리표(천월(月), 천상(傷))는 병기 때 한자 전체가 대신하므로 떼어 낸다.
 */
export const starLabel = (meta: { ko: string; hanja: string }, style: NameStyle): string => {
  if (style === 'hanja') return meta.hanja;
  if (style === 'ko' || meta.ko === meta.hanja) return meta.ko;
  return `${meta.ko.replace(/\(.+\)$/, '')}(${meta.hanja})`;
};
