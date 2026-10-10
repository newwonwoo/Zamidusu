// 자미두수 통변의 표와 문장. 모든 문장은 이 프로젝트에서 새로 작성했다(설계 부록 D-5).
import type { Domain } from './types';
import type { PalaceKey } from '../names';

/** 영역을 이루는 칸과 가중치(설계 5-3). 첫 칸이 중심(본궁) */
export const DOMAIN_PALACES: Record<Domain, { role: PalaceKey | 'body'; w: number }[]> = {
  self: [{ role: 'life', w: 1.0 }, { role: 'body', w: 0.35 }, { role: 'fortune', w: 0.2 }],
  wealth: [{ role: 'wealth', w: 1.0 }, { role: 'property', w: 0.35 }, { role: 'fortune', w: 0.15 }],
  career: [{ role: 'career', w: 1.0 }, { role: 'travel', w: 0.3 }, { role: 'life', w: 0.25 }],
  love: [{ role: 'spouse', w: 1.0 }, { role: 'fortune', w: 0.25 }],
  health: [{ role: 'health', w: 1.0 }, { role: 'fortune', w: 0.3 }, { role: 'life', w: 0.2 }],
  people: [
    { role: 'friends', w: 0.4 }, { role: 'travel', w: 0.25 }, { role: 'parents', w: 0.15 }, { role: 'siblings', w: 0.1 }, { role: 'children', w: 0.1 },
  ],
};

/** 영역 적성표(ZP-08): 그 영역에 어울리는 주성(good)과 조심할 주성(caution) */
export const DOMAIN_FIT: Record<Domain, { good: string[]; caution: string[] }> = {
  self: { good: [], caution: [] },
  wealth: { good: ['武曲', '天府', '太陰', '紫微', '天相'], caution: ['破軍', '七殺', '巨門'] },
  career: { good: ['紫微', '天府', '武曲', '太陽', '天梁', '天相', '廉貞'], caution: ['天同', '巨門', '破軍'] },
  love: { good: ['天同', '天相', '天府', '太陰', '天梁'], caution: ['七殺', '破軍', '巨門', '廉貞', '武曲'] },
  health: { good: ['天同', '天府', '天梁', '天相'], caution: ['七殺', '破軍', '巨門', '廉貞'] },
  people: { good: ['天同', '天梁', '天相', '天府', '紫微', '太陽', '太陰'], caution: ['七殺', '破軍', '巨門', '廉貞'] },
};

/** 영역별 주성 주제(설계 5-7). 중심 칸의 주성(또는 빌린 주성)에서 뽑는다 */
export const STAR_THEMES: Record<Domain, Record<string, string[]>> = {
  self: {
    紫微: ['lead', 'steady'], 天機: ['think', 'change'], 太陽: ['social', 'lead'], 武曲: ['steady', 'bold'], 天同: ['gentle'],
    廉貞: ['feel', 'bold'], 天府: ['steady', 'gentle'], 太陰: ['feel', 'think'], 貪狼: ['social', 'change'], 巨門: ['think', 'solo'],
    天相: ['gentle', 'steady'], 天梁: ['steady', 'think'], 七殺: ['bold', 'solo'], 破軍: ['change', 'bold'],
  },
  wealth: {
    紫微: ['steady'], 天機: ['earned', 'swing'], 太陽: ['leak'], 武曲: ['steady', 'earned'], 天同: ['steady'], 廉貞: ['swing'],
    天府: ['keeper', 'steady'], 太陰: ['keeper', 'steady'], 貪狼: ['chance'], 巨門: ['earned'], 天相: ['steady'], 天梁: ['keeper'],
    七殺: ['swing', 'earned'], 破軍: ['swing', 'leak'],
  },
  career: {
    紫微: ['leader', 'organization'], 天機: ['support', 'change'], 太陽: ['leader', 'organization'], 武曲: ['expert', 'venture'],
    天同: ['support', 'creative'], 廉貞: ['organization', 'leader'], 天府: ['organization', 'support'], 太陰: ['expert', 'creative'],
    貪狼: ['venture', 'creative'], 巨門: ['expert'], 天相: ['support', 'organization'], 天梁: ['organization', 'expert'],
    七殺: ['venture', 'leader'], 破軍: ['venture', 'change'],
  },
  love: {
    紫微: ['warm'], 天機: ['unsettled'], 太陽: ['passion', 'warm'], 武曲: ['late', 'distance'], 天同: ['warm'], 廉貞: ['passion', 'conflict'],
    天府: ['warm'], 太陰: ['warm'], 貪狼: ['passion', 'unsettled'], 巨門: ['conflict'], 天相: ['warm'], 天梁: ['warm', 'late'],
    七殺: ['distance', 'conflict'], 破軍: ['unsettled', 'passion'],
  },
  health: {
    紫微: ['sturdy'], 天機: ['stress'], 太陽: ['tired'], 武曲: ['accident'], 天同: ['sturdy'], 廉貞: ['stress', 'tired'], 天府: ['sturdy'],
    太陰: ['stress'], 貪狼: ['tired'], 巨門: ['stress'], 天相: ['sturdy'], 天梁: ['sturdy', 'watch'], 七殺: ['accident'], 破軍: ['accident', 'watch'],
  },
  people: {
    紫微: ['helpers'], 天機: ['wide'], 太陽: ['wide', 'helpers'], 武曲: ['solo'], 天同: ['helpers', 'close'], 廉貞: ['rivals'], 天府: ['helpers'],
    太陰: ['close'], 貪狼: ['wide'], 巨門: ['rivals'], 天相: ['helpers', 'close'], 天梁: ['helpers', 'close'], 七殺: ['rivals', 'solo'],
    破軍: ['rivals', 'wide'],
  },
};

/** 보조 별이 주제에 더하는 것: [영역][별 키] → 주제 id 목록 */
export const MINOR_THEMES: Partial<Record<Domain, Record<string, string[]>>> = {
  wealth: { 祿存: ['keeper'], 地空: ['leak'], 地劫: ['leak'], 擎羊: ['swing'], 陀羅: ['swing'], 火星: ['swing'], 鈴星: ['swing'] },
  career: { 天馬: ['change'], 左輔: ['support'], 右弼: ['support'], 文昌: ['expert'], 文曲: ['creative'], 擎羊: ['venture'], 火星: ['venture'] },
  love: { 紅鸞: ['passion'], 天喜: ['passion'], 咸池: ['passion'], 天姚: ['passion'], 孤辰: ['late', 'distance'], 寡宿: ['late', 'distance'], 擎羊: ['conflict'], 陀羅: ['conflict'], 天刑: ['conflict'] },
  health: { 擎羊: ['accident'], 火星: ['accident'], 鈴星: ['stress'], 地空: ['tired'], 地劫: ['tired'], 天月: ['watch'] },
  people: { 左輔: ['helpers'], 右弼: ['helpers'], 天魁: ['helpers'], 天鉞: ['helpers'], 孤辰: ['solo'], 寡宿: ['solo'], 擎羊: ['rivals'], 蜚廉: ['rivals'], 紅鸞: ['wide'], 天喜: ['wide'] },
  self: { 火星: ['bold'], 鈴星: ['bold'], 擎羊: ['bold'], 天馬: ['change'], 左輔: ['gentle'], 右弼: ['gentle'], 文昌: ['think'], 文曲: ['feel'] },
};

/** 영역별로 도움의 별·긴장의 별이 만드는 결과 문장 */
export const HELP_RESULT: Record<Domain, string> = {
  self: '스스로 부족한 점을 보완해 주는 도움이 따르기 쉽습니다.',
  wealth: '돈 문제에서 조언과 기회가 이어지기 쉽습니다.',
  career: '일에서 이끌어 주고 추천해 주는 사람이 따르기 쉽습니다.',
  love: '인연을 이어 주고 관계를 거들어 주는 사람이 생기기 쉽습니다.',
  health: '몸이 불편할 때 믿을 만한 도움을 만나기 쉽습니다.',
  people: '곁에서 힘이 되어 주는 사람이 많은 편입니다.',
};
export const TENSION_RESULT: Record<Domain, string> = {
  self: '추진력이 세지만 성격이 날카로워지거나 마음이 급해지기 쉽습니다.',
  wealth: '돈이 새거나 다툼이 생기지 않게 점검이 필요합니다.',
  career: '일에서 충돌과 지연이 생기기 쉬우니 단계를 나누세요.',
  love: '관계에서 말다툼과 오해가 생기기 쉽습니다.',
  health: '다치거나 무리하기 쉬우니 몸을 아껴 쓰세요.',
  people: '사람 사이에 오해와 구설이 생기기 쉽습니다.',
};

/** 신궁이 놓인 칸에 따른 중년 이후의 초점(신궁은 명·관록·재백·부처·천이·복덕 중 한 곳에만 놓인다) */
export const BODY_LINE: Partial<Record<PalaceKey, string>> = {
  career: '중년 이후에는 일과 사회적 성취가 삶의 중심이 되기 쉽습니다.',
  wealth: '중년 이후에는 재물을 일구고 지키는 일이 삶의 중심이 되기 쉽습니다.',
  spouse: '중년 이후에는 배우자와 가까운 관계가 삶의 중심이 되기 쉽습니다.',
  travel: '중년 이후에는 바깥 활동과 사회적 관계가 삶의 중심이 되기 쉽습니다.',
  fortune: '중년 이후에는 마음의 만족과 여유가 삶의 중심이 되기 쉽습니다.',
};

/** 영역 전용 핵심어(칩) — 총평의 키워드에 쓴다 */
export const STRONG_PHRASE: Record<Domain, string> = {
  self: '든든한 바탕', wealth: '재물운', career: '직업운', love: '인연운', health: '체력', people: '사람 복',
};
