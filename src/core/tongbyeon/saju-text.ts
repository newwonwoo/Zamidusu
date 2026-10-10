// 사주 통변의 문장표. 모든 문장은 이 프로젝트에서 새로 작성했다.
// 원칙(설계 부록 B): 한 문장 60자 이하, 한 문장에 한 가지 뜻, 전문용어는 {{ }} 로 표시, 단정하지 않는 어조.
import type { GyeokName, Gyeok, StructureId } from './saju-analysis';

export const GYEOK_LINE: Record<GyeokName, string> = {
  식신격: '타고난 재능과 여유로 살아가는 틀입니다.',
  상관격: '재주와 표현력으로 승부하는 틀입니다.',
  편재격: '사람과 기회를 다루며 재물을 만드는 틀입니다.',
  정재격: '꾸준한 수입과 성실함을 바탕으로 하는 틀입니다.',
  편관격: '압박 속에서 힘을 내는 도전적인 틀입니다.',
  정관격: '규율과 책임, 바른 평판을 중시하는 틀입니다.',
  편인격: '남다른 생각과 독특한 재주를 따르는 틀입니다.',
  정인격: '배움과 보호, 안정된 지원을 바탕으로 하는 틀입니다.',
  건록격: '스스로 서는 힘이 강한 틀입니다.',
  양인격: '강한 의지와 승부욕이 뚜렷한 틀입니다.',
  월겁격: '동료·경쟁자와 부딪히며 크는 틀입니다.',
};

export const GYEOK_NOTE_LINE: Record<Gyeok['note'], string> = {
  'good-jae': '재물이나 배움이 받쳐 주어 틀이 잘 이루어진 편입니다.',
  'good-in': '배움과 귀인이 받쳐 주어 틀이 잘 이루어진 편입니다.',
  'good-sik': '재능과 표현이 균형을 잡아 주어 틀이 잘 이루어진 편입니다.',
  'good-gwan': '직위와 규율이 받쳐 주어 틀이 잘 이루어진 편입니다.',
  'good-control': '힘을 덜어 내거나 다듬을 길이 있어 틀이 잘 이루어진 편입니다.',
  'bad-sanggwan': '튀는 표현이 직위를 해칠 수 있어 틀이 흔들릴 수 있습니다.',
  'bad-pyeonin': '잡념과 의심이 재능을 막을 수 있어 틀이 흔들릴 수 있습니다.',
  'bad-geop': '경쟁자가 많아 재물이 나뉘기 쉬워 틀이 흔들릴 수 있습니다.',
  'bad-jae': '재물 욕심이 배움과 보호를 해칠 수 있어 틀이 흔들릴 수 있습니다.',
  'bad-none': '힘을 풀어 줄 길이 부족해 틀이 흔들릴 수 있습니다.',
  plain: '특별히 이루어졌다고도 흔들린다고도 하기 어려운 평범한 구조입니다.',
};

/**
 * 12운성 이름을 화면에 적을 때의 표기. 한 글자 이름은 한자를 붙인다 —
 * 병(病)·사(死)·묘(墓)가 일간 병(丙)·지지 사(巳)·묘(卯)와 같은 소리라 섞여 읽혔다(3차 독자 시험).
 */
const STAGE_HANJA: Record<string, string> = { 쇠: '衰', 병: '病', 사: '死', 묘: '墓', 절: '絶', 태: '胎', 양: '養' };
export const stageLabel = (stage: string): string => (STAGE_HANJA[stage] ? `${stage}(${STAGE_HANJA[stage]})` : stage);

/** 일지에서 일간의 12운성이 주는 느낌 */
export const STAGE_LINE: Record<string, string> = {
  장생: '새로 자라는 힘이 있어 배우고 성장하려는 마음이 큽니다.',
  목욕: '감수성이 풍부하고 변화에 민감합니다.',
  관대: '자신감이 붙고 당당하게 나서는 힘이 있습니다.',
  건록: '스스로 서는 힘이 단단합니다.',
  제왕: '기운이 가장 높아 자신감이 넘치지만 지나치면 고집이 됩니다.',
  쇠: '기세가 한풀 꺾여 신중하고 차분합니다.',
  병: '기운이 약해 에너지 관리가 중요합니다.',
  사: '겉으로 드러내기보다 속으로 깊이 생각하는 편입니다.',
  묘: '저장하고 간직하려는 마음이 강합니다.',
  절: '끊고 새로 시작하는 변화의 기운이 있습니다.',
  태: '새로운 가능성을 품은 시작의 기운입니다.',
  양: '보살핌 속에서 천천히 자라는 기운입니다.',
};

/** 십성 구조를 개요에서 소개하는 한 문장(이름 + 뜻) */
export const STRUCTURE_LINE: Record<StructureId, string> = {
  sikSangSaengJae: '{{식상생재}} 구조가 있어 재능을 살려 재물을 만드는 길이 열려 있습니다.',
  jaeSaengGwan: '{{재생관}} 구조가 있어 재물이 직위와 사회적 자리를 뒷받침해 줍니다.',
  gwanInSangSaeng: '{{관인상생}} 구조가 있어 책임의 압박을 배움과 귀인이 받아 줍니다.',
  sikSinJeSal: '{{식신제살}} 구조가 있어 강한 압박도 재능과 여유로 풀어 갑니다.',
  sangGwanGyeonGwan: '{{상관견관}} 구조가 있어 윗사람·규율과 부딪히기 쉬우니 말과 태도를 다듬으세요.',
  sangGwanPaeIn: '{{상관패인}} 구조가 있어 넘치는 재능을 공부와 귀인이 다듬어 줍니다.',
  gunGeopJaengJae: '{{군겁쟁재}} 구조가 있어 경쟁자와 재물을 나누기 쉬우니 동업과 보증은 신중히 하세요.',
  jaeDaSinYak: '{{재다신약}} 구조가 있어 재물 기회는 많지만 받아 낼 힘이 약하니 욕심을 줄이세요.',
  gwanSalHonJap: '{{관살혼잡}} 구조가 있어 직장과 역할이 복잡해지기 쉽습니다.',
  inDa: '{{인성}}이 매우 많아 배움과 보호는 넉넉하지만 행동이 늦어지기 쉽습니다.',
  biGeopGwaDa: '{{비겁}}이 매우 많아 자존심과 독립심이 강하고 경쟁과 나눔이 잦습니다.',
  sikSangGwaDa: '{{식상}}이 매우 많아 재능은 넘치지만 기운을 쓰는 일이 많아 쉼이 필요합니다.',
  pyeonInDoSik: '{{편인도식}} 구조가 있어 잡념이 재능을 막지 않게 한 가지에 집중하세요.',
  muJae: '{{재성}}이 거의 없어 재물은 꾸준한 노력과 시기의 흐름에 더 좌우됩니다.',
  muGwan: '{{관성}}이 거의 없어 조직의 틀보다 자율적으로 일하는 편이 어울립니다.',
  muIn: '{{인성}}이 거의 없어 기댈 곳이 적으니 스스로 배우고 지키는 힘이 중요합니다.',
};

/** 핵심어 칩에 쓰는 짧은 이름(전문용어는 표시를 붙인다) */
export const STRUCTURE_KEYWORD: Record<StructureId, string> = {
  sikSangSaengJae: '{{식상생재}}', jaeSaengGwan: '{{재생관}}', gwanInSangSaeng: '{{관인상생}}', sikSinJeSal: '{{식신제살}}',
  sangGwanGyeonGwan: '{{상관견관}}', sangGwanPaeIn: '{{상관패인}}', gunGeopJaengJae: '{{군겁쟁재}}', jaeDaSinYak: '{{재다신약}}',
  gwanSalHonJap: '{{관살혼잡}}', inDa: '{{인성}} 과다', biGeopGwaDa: '{{비겁}} 과다', sikSangGwaDa: '{{식상}} 과다',
  pyeonInDoSik: '{{편인도식}}', muJae: '{{재성}} 없음', muGwan: '{{관성}} 없음', muIn: '{{인성}} 없음',
};

/** 격국 이름. 건록격은 용어 풀이가 필요하므로 표시를 붙인다 */
export const gyeokLabel = (name: GyeokName): string => (name === '건록격' ? '{{건록격}}' : name);

/** 구조를 개요에서 소개할 때의 우선순위(앞쪽이 먼저). 좋은 구조 → 조심할 구조 → 없음 */
export const STRUCTURE_ORDER: StructureId[] = [
  'sikSinJeSal', 'gwanInSangSaeng', 'sikSangSaengJae', 'jaeSaengGwan', 'sangGwanPaeIn',
  'jaeDaSinYak', 'gunGeopJaengJae', 'gwanSalHonJap', 'sangGwanGyeonGwan', 'pyeonInDoSik',
  'inDa', 'biGeopGwaDa', 'sikSangGwaDa', 'muJae', 'muGwan', 'muIn',
];

/** 일간 오행·음양별 핵심 성향(주제 판정에 쓴다): 갑 을 병 정 무 기 경 신 임 계 */
export const STEM_THEMES: string[][] = [
  ['lead', 'steady'], ['gentle', 'change'], ['social', 'bold'], ['feel', 'gentle'], ['steady', 'solo'],
  ['gentle', 'think'], ['bold', 'steady'], ['think', 'feel'], ['change', 'social'], ['think', 'feel'],
];

export const GYEOK_THEMES: Record<GyeokName, string[]> = {
  식신격: ['gentle', 'social'], 상관격: ['bold', 'change'], 편재격: ['social', 'change'], 정재격: ['steady'],
  편관격: ['bold', 'lead'], 정관격: ['steady', 'lead'], 편인격: ['think', 'solo'], 정인격: ['think', 'gentle'],
  건록격: ['lead', 'solo'], 양인격: ['bold', 'lead'], 월겁격: ['solo', 'bold'],
};
