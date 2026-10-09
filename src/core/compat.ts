// 원본 호환 모드(검증 전용). 사이트 오류까지 따라 해서 사이트와 같은 입력으로 칸 단위 비교 시험을 반복하기 위한 스위치.
// 사용자 화면에는 개선판만 보이며, 주소에 ?compat=1 을 붙일 때만 켜진다. (원장 §1 원본 호환 모드, golden rule)
//
// 재현 근거와 신뢰도 — 모두 원장의 관찰/추론 기록에서 옮긴 것이며 사이트 출력과 직접 대조한 것은 아니다.
//   I-01 우필   : 개선판보다 월수 방향(역행)으로 1칸 더 감 (원장 4-2 “월수−1만큼 가야 하는데 월수만큼 이동”)
//   I-02 천형   : 개선판보다 진행 방향(순행)으로 1칸 더 감 (같은 원인 추론, 방향은 원인 추론에서 도출)
//   I-03 천요   : 위와 같음
//   I-04 팔좌   : 틀린 우필 위치를 기준으로 계산하므로 우필과 같은 만큼 어긋남
//   I-05 대한 궁명: 대한 모드에서 궁 이름을 寅부터 순행 고정 배치 (원장 표현이 모호해 추정 재현)
//   I-06/I-07 보정: time.ts 의 compatDelta (근사)
//   I-08 입력범위 : time.ts (1927~2026)

import type { Chart, StarView } from './chart';
import { mod } from './ganzhi';
import { PALACE_KEYS, sortStars } from './names';
import type { PalaceKey } from './names';

export interface CompatShift {
  id: 'I-01' | 'I-02' | 'I-03' | 'I-04';
  star: string;
  /** 지지 인덱스 증가 방향이 +1 */
  delta: number;
}

export const COMPAT_SHIFTS: CompatShift[] = [
  { id: 'I-01', star: '右弼', delta: -1 },
  { id: 'I-02', star: '天刑', delta: +1 },
  { id: 'I-03', star: '天姚', delta: +1 },
  { id: 'I-04', star: '八座', delta: -1 },
];

export const applyCompat = (chart: Chart): void => {
  for (const shift of COMPAT_SHIFTS) {
    const from = chart.palaces.find((p) => p.stars.some((s) => s.key === shift.star));
    if (!from) continue;
    const star = from.stars.find((s) => s.key === shift.star) as StarView;
    const to = chart.palaces[mod(from.branch + shift.delta, 12)];
    from.stars = from.stars.filter((s) => s.key !== shift.star);
    to.stars = sortStars([...to.stars, star]);
    chart.compatApplied.push(`${shift.id} ${shift.star}: ${from.branch}→${to.branch}`);
  }
};

/** I-05: 寅(2)부터 지지 순행으로 명궁, 형제, … 부모 순서 고정 배치. 지지 인덱스별 궁 이름 */
export const compatDecadalNames = (): PalaceKey[] => {
  const names: PalaceKey[] = new Array(12);
  PALACE_KEYS.forEach((k, i) => {
    names[mod(2 + i, 12)] = k;
  });
  return names;
};
