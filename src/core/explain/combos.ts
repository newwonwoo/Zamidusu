// 조합 해설(N-04 “조합 해설”): 한 칸에 모인 별, 양옆에서 끼운 별(협), 삼방사정에 모인 별(격국)을 규칙으로 찾아낸다.
// 이름은 전통 용어를 따르되 설명은 새로 썼다. 전통 이론에 따른 참고용이며 통계로 검증된 것이 아니다.

import type { Chart } from '../chart';
import { surround } from '../chart';
import { mod } from '../ganzhi';

export interface ComboHit {
  id: string;
  name: string;
  hanja: string;
  kind: 'pair' | 'together' | 'flank' | 'pattern';
  /** 어디에서 찾았는지 */
  where: string;
  text: string;
  /** 관련 별(한자 키) */
  stars: string[];
}

// 주성 두 개가 한 칸에 모인 경우: 정렬한 키 → [이름, 한자, 설명]
const PAIRS: Record<string, [string, string, string]> = {};
const pair = (a: string, b: string, name: string, hanja: string, text: string): void => {
  PAIRS[[a, b].sort().join('|')] = [name, hanja, text];
};
pair('紫微', '天府', '자부동궁', '紫府同宮', '제왕과 곳간이 한 칸에 모인 구도로 품격과 안정감이 함께 갑니다. 지키려는 마음이 강해 변화에는 신중합니다.');
pair('紫微', '天相', '자상동궁', '紫相同宮', '중심에 서는 힘에 보좌의 신뢰가 더해진 구도입니다. 체면과 균형을 함께 챙깁니다.');
pair('紫微', '貪狼', '자탐동궁', '紫貪同宮', '품격에 욕망과 매력이 섞인 구도입니다. 사교성이 높고 재주가 많지만 절제가 과제입니다.');
pair('紫微', '七殺', '자살동궁', '紫殺同宮', '통솔력에 돌파력이 더해진 구도입니다. 큰 결단을 내리는 힘이 있으나 강하게 몰아붙이기 쉽습니다.');
pair('紫微', '破軍', '자파동궁', '紫破同宮', '품격과 개혁이 맞붙은 구도입니다. 틀을 바꾸는 큰 변화를 이끌지만 기복도 큽니다.');
pair('天機', '太陰', '기음동궁', '機陰同宮', '기획력에 섬세함이 더해진 구도입니다. 생각이 깊고 감수성이 풍부해 안으로 고민이 많습니다.');
pair('天機', '巨門', '기거동궁', '機巨同宮', '분석과 말이 맞붙은 구도입니다. 두뇌 회전이 빠르고 논쟁에 강하지만 의심이 늘 수 있습니다.');
pair('天機', '天梁', '기량동궁', '機梁同宮', '지혜와 원칙이 만난 구도입니다. 조언과 기획에 능하고 신중하게 보호하려는 힘이 있습니다.');
pair('太陽', '太陰', '일월동궁', '日月同宮', '밝음과 섬세함이 한 칸에 모인 구도입니다. 활동적이면서도 속이 깊은 양면성이 있습니다.');
pair('太陽', '巨門', '일거동궁', '日巨同宮', '드러내는 힘과 말의 힘이 함께합니다. 대중 앞에서 말로 빛나지만 구설도 조심해야 합니다.');
pair('太陽', '天梁', '일량동궁', '日梁同宮', '밝음과 보호가 만난 구도입니다. 공정하게 베풀고 사람을 돌보는 일에 어울립니다.');
pair('武曲', '天府', '무부동궁', '武府同宮', '재물을 다루는 힘과 곳간이 만난 구도입니다. 모으고 지키는 현실 감각이 뛰어납니다.');
pair('武曲', '天相', '무상동궁', '武相同宮', '실행력과 보좌의 신뢰가 만난 구도입니다. 원칙을 지키며 성실하게 일을 이룹니다.');
pair('武曲', '七殺', '무살동궁', '武殺同宮', '결단과 돌파가 겹친 강한 구도입니다. 추진력이 크지만 마찰도 커서 완급 조절이 필요합니다.');
pair('武曲', '貪狼', '무탐동궁', '武貪同宮', '재물 감각에 욕구와 재주가 더해진 구도입니다. 성취가 늦게 피는 편이며 기회를 잡는 힘이 있습니다.');
pair('武曲', '破軍', '무파동궁', '武破同宮', '재물과 개혁이 맞붙은 구도입니다. 큰 변화 속에서 벌고 쓰는 폭이 큽니다.');
pair('天同', '太陰', '동음동궁', '同陰同宮', '온화함과 섬세함이 만난 구도입니다. 마음이 부드럽고 정이 깊어 가정적입니다.');
pair('天同', '巨門', '동거동궁', '同巨同宮', '편안함과 따지는 말이 맞선 구도입니다. 마음 한켠의 불만을 대화로 푸는 것이 과제입니다.');
pair('天同', '天梁', '동량동궁', '同梁同宮', '온화함과 보호가 만난 구도입니다. 사람을 편안하게 하고 돌보는 일에 어울립니다.');
pair('廉貞', '天府', '염부동궁', '廉府同宮', '열정과 안정이 만난 구도입니다. 자존심과 신중함을 함께 지녀 믿음을 얻습니다.');
pair('廉貞', '天相', '염상동궁', '廉相同宮', '열정에 보좌의 균형이 더해진 구도입니다. 감정을 다스리며 일을 조율합니다.');
pair('廉貞', '七殺', '염살동궁', '廉殺同宮', '열정과 돌파가 겹친 거센 구도입니다. 승부 근성이 강하고 한번 꽂히면 멈추기 어렵습니다.');
pair('廉貞', '貪狼', '염탐동궁', '廉貪同宮', '열정과 욕망이 겹친 구도입니다. 매력과 감정의 진폭이 커서 절제가 과제입니다.');
pair('廉貞', '破軍', '염파동궁', '廉破同宮', '열정과 개혁이 겹친 구도입니다. 감정 기복과 변화가 크고 새로 일으키는 힘이 있습니다.');

export const MAIN_PAIR_COUNT = Object.keys(PAIRS).length;

const has = (keys: Set<string>, ...k: string[]): boolean => k.every((x) => keys.has(x));

export const detectCombos = (chart: Chart, branch: number): ComboHit[] => {
  const hits: ComboHit[] = [];
  const palace = chart.palaces[branch];
  const keys = new Set(palace.stars.map((s) => s.key));
  const mains = palace.stars.filter((s) => s.group === 'main').map((s) => s.key);
  const hasLu = palace.stars.some((s) => s.mutagen === 'lu');

  // 1) 주성 둘 이상 동궁
  for (let i = 0; i < mains.length; i++) {
    for (let j = i + 1; j < mains.length; j++) {
      const hit = PAIRS[[mains[i], mains[j]].sort().join('|')];
      if (hit) {
        hits.push({
          id: `pair:${mains[i]}${mains[j]}`, name: hit[0], hanja: hit[1], kind: 'pair',
          where: '{{동궁}}', text: hit[2], stars: [mains[i], mains[j]],
        });
      }
    }
  }

  // 2) 보좌·살성 동궁 조합
  if (keys.has('天馬') && (keys.has('祿存') || hasLu)) {
    hits.push({
      id: 'lumaa', name: '녹마교치', hanja: '祿馬交馳', kind: 'together', where: '{{동궁}}',
      text: '재물의 기회와 이동의 힘이 한 칸에서 만났습니다. 가만히 있기보다 움직일 때 이득이 생기기 쉬운 구도입니다.',
      stars: ['天馬', keys.has('祿存') ? '祿存' : '化祿'],
    });
  }
  if (keys.has('祿存') && palace.stars.some((s) => s.mutagen === 'lu' && s.key !== '祿存')) {
    hits.push({
      id: 'doublelu', name: '쌍록', hanja: '雙祿', kind: 'together', where: '{{동궁}}',
      text: '녹존과 {{화록}}이 함께 있어 재물의 흐름이 두 겹으로 받쳐 줍니다. 모으고 지키는 힘이 큽니다.',
      stars: ['祿存', '化祿'],
    });
  }
  if (keys.has('貪狼') && keys.has('火星')) {
    hits.push({
      id: 'huotan', name: '화탐', hanja: '火貪', kind: 'together', where: '{{동궁}}',
      text: '탐랑의 욕구에 불꽃이 붙은 구도입니다. 갑작스러운 기회와 폭발력이 있지만 기복도 큽니다.', stars: ['貪狼', '火星'],
    });
  }
  if (keys.has('貪狼') && keys.has('鈴星')) {
    hits.push({
      id: 'lingtan', name: '영탐', hanja: '鈴貪', kind: 'together', where: '{{동궁}}',
      text: '탐랑의 욕구에 숨은 불씨가 붙은 구도입니다. 때를 만나면 크게 터지는 대신 참았던 마음이 한꺼번에 나올 수 있습니다.', stars: ['貪狼', '鈴星'],
    });
  }
  const togethers: [string, string, string, string, string][] = [
    ['左輔', '右弼', '좌우동궁', '左右同宮', '보좌의 별 둘이 한 칸에 모여 협력자가 겹겹이 따릅니다.'],
    ['文昌', '文曲', '창곡동궁', '昌曲同宮', '글과 말의 재능이 한 칸에 모였습니다. 학업과 표현에 힘이 실립니다.'],
    ['天魁', '天鉞', '괴월동궁', '魁鉞同宮', '두 귀인이 한 칸에 모여 도움의 손길이 겹칩니다.'],
    ['地空', '地劫', '공겁동궁', '空劫同宮', '비움과 덜어냄이 겹친 구도입니다. 큰 정리와 새 출발의 기운이 강하지만 재물 관리에 유의하세요.'],
    ['擎羊', '陀羅', '양타동궁', '羊陀同宮', '날카로움과 끈질김이 한 칸에 겹쳐 긴장이 큽니다. 서두르지 말고 단계를 나눠 대응하세요.'],
    ['火星', '鈴星', '화령동궁', '火鈴同宮', '급한 불과 숨은 불이 만났습니다. 감정이 한꺼번에 터지지 않게 표현할 창구를 만들어 두세요.'],
  ];
  for (const [a, b, name, hanja, text] of togethers) {
    if (has(keys, a, b)) hits.push({ id: `together:${a}${b}`, name, hanja, kind: 'together', where: '{{동궁}}', text, stars: [a, b] });
  }

  // 3) 협(夾): 양옆 칸에 한 쌍이 하나씩
  const before = new Set(chart.palaces[mod(branch - 1, 12)].stars.map((s) => s.key));
  const after = new Set(chart.palaces[mod(branch + 1, 12)].stars.map((s) => s.key));
  const flanks: [string, string, string, string, string][] = [
    ['左輔', '右弼', '좌우협', '左右夾', '좌보와 우필이 양옆에서 받쳐 주는 구도입니다. 필요할 때 도움을 청할 사람이 곁에 있습니다.'],
    ['文昌', '文曲', '창곡협', '昌曲夾', '문창과 문곡이 양옆에서 감싸는 구도입니다. 글과 말, 학습 쪽 재능이 받쳐 줍니다.'],
    ['天魁', '天鉞', '괴월협', '魁鉞夾', '천괴와 천월이 양옆에서 감싸는 구도입니다. 귀인의 도움이 곁에서 대기하는 모양입니다.'],
    ['地空', '地劫', '공겁협', '空劫夾', '지공과 지겁이 양옆에서 끼는 구도입니다. 의욕이 허공으로 흩어지기 쉬우니 목표를 구체적으로 적어 두세요.'],
    ['火星', '鈴星', '화령협', '火鈴夾', '화성과 령성이 양옆에서 끼는 구도입니다. 감정이 급해지기 쉬우니 한 박자 쉬는 습관이 도움이 됩니다.'],
  ];
  for (const [a, b, name, hanja, text] of flanks) {
    if ((before.has(a) && after.has(b)) || (before.has(b) && after.has(a))) {
      hits.push({ id: `flank:${a}${b}`, name, hanja, kind: 'flank', where: '{{협}}', text, stars: [a, b] });
    }
  }

  // 4) 격국: 명궁의 삼방사정에 모인 별 (명궁 칸에서만 판정)
  if (palace.natalName === 'life') {
    const s = surround(branch);
    const union = new Set<string>();
    const luOnSurround = [s.self, ...s.trine, s.opposite].some((b) => chart.palaces[b].stars.some((x) => x.mutagen === 'lu'));
    for (const b of [s.self, ...s.trine, s.opposite]) chart.palaces[b].stars.forEach((x) => union.add(x.key));
    if (has(union, '七殺', '破軍', '貪狼')) {
      hits.push({
        id: 'sapalang', name: '살파랑', hanja: '殺破狼', kind: 'pattern', where: '{{삼방사정}}',
        text: '칠살·파군·탐랑이 모두 {{삼방사정}}에 모인 구도입니다. 변화와 개척이 많은 삶의 흐름을 뜻하며, 안정보다 도전에서 힘을 얻는다고 봅니다.',
        stars: ['七殺', '破軍', '貪狼'],
      });
    }
    if (has(union, '天機', '太陰', '天同', '天梁')) {
      hits.push({
        id: 'gwiweol', name: '기월동량', hanja: '機月同梁', kind: 'pattern', where: '{{삼방사정}}',
        text: '천기·태음·천동·천량이 {{삼방사정}}에 모인 구도입니다. 조직 안에서 차분하게 일하며 기획·행정·보좌에 어울린다고 봅니다.',
        stars: ['天機', '太陰', '天同', '天梁'],
      });
    }
    if (has(union, '太陽', '天梁', '文昌') && (union.has('祿存') || luOnSurround)) {
      hits.push({
        id: 'yangryang', name: '양량창록', hanja: '陽梁昌祿', kind: 'pattern', where: '{{삼방사정}}',
        text: '태양·천량·문창과 녹존이나 {{화록}}이 {{삼방사정}}에 모인 구도입니다. 시험·학업·공적인 일에 유리하다고 전해집니다.',
        stars: ['太陽', '天梁', '文昌', '祿存'],
      });
    }
  }
  return hits;
};
