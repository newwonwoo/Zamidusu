// 사주 비교 탭의 데이터(N-01, D-03). 원장 §5 근거표 C-1~C-5, D-1~D-5 를 새 문장으로 옮기고,
// 항목마다 근거 구분과 “이 명식에서 실제로 계산한 값”을 붙인다.
//   근거 구분: 코드·시험 검증 / 화면 관찰 / 자료 인용 / 전통 표 인용  (원장 §7 품질확인서와 같은 구분)

import type { Chart } from './chart';
import { surround } from './chart';
import { fmtDateKo, fmtInstant } from './format';
import {
  BRANCHES, BRANCHES_KO, STEMS, STEMS_KO, STEM_ELEMENT, ELEMENT_KO, mod,
} from './ganzhi';
import { starMeta } from './names';
import {
  CHANGSHENG_BRANCH, CHEONEUL_BRANCHES, MUNCHANG_BRANCH, STAGES_KO, lokBranchOf, stageOf, yeokmaBranchOf,
} from './saju';
import type { SajuChart } from './saju';
import { termTime } from './solarterms';
import { lunarToSolar } from './time';

export type EvidenceKind = 'code' | 'screen' | 'source' | 'tradition';
export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  code: '코드·시험 검증', screen: '화면 관찰', source: '자료 인용', tradition: '전통 표 인용',
};

export interface Evidence {
  kind: EvidenceKind;
  /** 근거가 가리키는 쪽(예: “사주 쪽”) */
  part?: string;
  detail: string;
}
export interface LiveLine {
  text: string;
  /** match: 두 체계가 같음, differ: 다름, info: 참고 */
  status: 'match' | 'differ' | 'info';
}
export interface CompareItem {
  id: 'C-1' | 'C-2' | 'C-3' | 'C-4' | 'C-5' | 'D-1' | 'D-2' | 'D-3' | 'D-4' | 'D-5';
  side: 'common' | 'diff';
  title: string;
  body: string;
  evidence: Evidence[];
  /** 원장 §7이 매기는 대표 근거 구분 */
  primary: EvidenceKind;
  live: LiveLine[];
}

export interface CalendarNotice {
  level: 'same' | 'year-differs' | 'month-differs';
  headline: string;
  lines: string[];
  yearDiffers: boolean;
}

export interface PillarColumn {
  key: 'hour' | 'day' | 'month' | 'year';
  label: string;
  saju: { ganzhi: string; ko: string; stemGod: string; branchGod: string; stage: string } | null;
  ziwei: string;
  ziweiNote: string;
  /** true 같은 값, false 다른 값, null 비교 대상이 다른 개념 */
  same: boolean | null;
}

export interface Comparison {
  notice: CalendarNotice;
  columns: PillarColumn[];
  items: CompareItem[];
  evidenceCounts: Record<EvidenceKind, number>;
  elements: { key: string; ko: string; count: number }[];
}

const stemName = (s: number): string => `${STEMS_KO[s]}(${STEMS[s]})`;
const branchName = (b: number): string => `${BRANCHES_KO[b]}(${BRANCHES[b]})`;
const gz = (stem: number, branch: number): string => STEMS[stem] + BRANCHES[branch];
const positionOf = (chart: Chart, key: string): number => chart.palaces.find((p) => p.stars.some((s) => s.key === key))!.branch;

export const buildComparison = (chart: Chart, saju: SajuChart, tz: string): Comparison => {
  const m = chart.meta;
  const ziYear = gz(m.yearStem, m.yearBranch);
  const lunar = m.lunar;
  const ziMonthLabel = `음력 ${lunar.leap ? '윤' : ''}${lunar.month}월`;
  const sajuMonthBranch = saju.month.branch;
  // 월건 지지가 음력 월과 대응하는 지지(정월=寅)와 같은지
  const monthSame = sajuMonthBranch === mod(lunar.month + 1, 12) && !lunar.leap;
  const yearSame = saju.year.ganzhi === ziYear;

  // ── 달력 기준 알림 ──
  const civilYear = chart.norm.civil.y;
  const lichunMs = termTime(civilYear, '立春');
  const newYear = lunarToSolar(lunar.year, 1, false, 1);
  const lines: string[] = [];
  lines.push(`사주는 ${saju.year.ganzhi}년 ${saju.month.ganzhi}월, 자미두수는 ${ziYear}년 ${ziMonthLabel} ${lunar.day}일로 계산했습니다.`);
  let level: CalendarNotice['level'] = 'same';
  if (!yearSame) {
    level = 'year-differs';
    lines.push(
      `이 생일은 음력 설${newYear ? `(${fmtDateKo(newYear)})` : ''}과 입춘(${fmtInstant(lichunMs, tz)}) 사이에 있어 해가 바뀐 시점이 두 체계에서 다릅니다.`,
    );
    lines.push(
      m.yearStem === saju.year.stem
        ? ''
        : chart.options.yearBasis === 'lunarNewYear'
          ? '연도 기준을 “입춘”으로 바꾸면 자미두수도 사주와 같은 해로 계산합니다.'
          : '',
    );
  } else if (!monthSame) {
    level = 'month-differs';
    lines.push('연주는 같지만, 사주의 월은 절기(월건)로, 자미두수의 월은 음력 날짜로 정해서 달 이름이 서로 맞지 않습니다. 정상적인 차이입니다.');
  } else {
    lines.push('이 생일은 두 체계의 연·월 기준이 우연히 같습니다.');
  }
  const notice: CalendarNotice = {
    level,
    headline: yearSame ? (monthSame ? '두 체계의 연·월 기준이 같습니다' : '연주는 같고 월 기준이 다릅니다') : '두 체계의 연주가 다릅니다',
    lines: lines.filter(Boolean),
    yearDiffers: !yearSame,
  };

  // ── 4기둥 병기 ──
  const pillarCol = (key: PillarColumn['key'], label: string, p: SajuChart['year'] | null, ziwei: string, note: string, same: boolean | null): PillarColumn => ({
    key, label, ziwei, ziweiNote: note, same,
    saju: p ? { ganzhi: p.ganzhi, ko: p.ko, stemGod: p.stemGod, branchGod: p.branchGod, stage: p.stage } : null,
  });
  const hourTime = chart.norm.corrected;
  const columns: PillarColumn[] = [
    pillarCol('hour', '시', saju.hour, `${BRANCHES_KO[m.timeBranch]}시(${BRANCHES[m.timeBranch]})`, hourTime ? `보정 후 ${String(hourTime.h).padStart(2, '0')}:${String(hourTime.mi).padStart(2, '0')}` : '', saju.hour ? saju.hour.branch === m.timeBranch : null),
    pillarCol('day', '일', saju.day, `음력 ${lunar.day}일`, '날짜는 음력, 사주는 일진(60갑자)', null),
    pillarCol('month', '월', saju.month, ziMonthLabel, `사주는 절기 월건 ${BRANCHES_KO[sajuMonthBranch]}월`, monthSame),
    pillarCol('year', '연', saju.year, `${ziYear}년`, chart.options.yearBasis === 'ipchun' ? '입춘 기준' : '음력 설 기준', yearSame),
  ];

  // ── 오행 분포 ──
  const elements = (['wood', 'fire', 'earth', 'metal', 'water'] as const).map((e) => ({
    key: e, ko: ELEMENT_KO[e], count: saju.elementCounts[e],
  }));

  // ── 항목별 근거와 실측값 ──
  const dayStem = saju.day.stem;
  const sajuYearStem = saju.year.stem;
  const items: CompareItem[] = [];

  items.push({
    id: 'C-1', side: 'common', primary: 'source',
    title: '같은 뿌리: 천간·지지·음양오행',
    body: '두 체계 모두 열 개의 천간과 열두 개의 지지, 그리고 음양오행이라는 같은 기호로 시간을 읽습니다. 그래서 한쪽의 간지 글자를 다른 쪽에서도 같은 뜻으로 알아볼 수 있습니다.',
    evidence: [{ kind: 'source', detail: '위키백과 — 두 체계가 같은 기반을 쓴다고 설명' }],
    live: [
      { status: 'info', text: `이 명식의 사주 일간은 ${stemName(dayStem)}(${ELEMENT_KO[STEM_ELEMENT[dayStem]]}), 자미두수 명궁은 ${gz(chart.palaces[m.soulBranch].stem, m.soulBranch)}입니다. 둘 다 같은 천간·지지 글자를 씁니다.` },
    ],
  });

  const sameStem = sajuYearStem === m.yearStem;
  items.push({
    id: 'C-2', side: 'common', primary: 'code',
    title: '10년 운의 방향 규칙이 같습니다',
    body: '양의 해에 태어난 남자와 음의 해에 태어난 여자는 순행(앞으로), 음의 해의 남자와 양의 해의 여자는 역행(거꾸로)으로 움직입니다. 연간의 음양과 성별만 보면 되는 같은 규칙입니다.',
    evidence: [
      { kind: 'code', detail: '1984-01-30(음년 남) 역행을 사이트와 iztro가 일치 확인 (원장)' },
      { kind: 'code', part: '이 구현', detail: '무작위 300건에서 연간이 같을 때 두 방향이 모두 일치 (V-13)' },
    ],
    live: [
      { status: sameStem ? (saju.daeun.forward === m.decadalForward ? 'match' : 'differ') : 'differ',
        text: `사주 대운: ${saju.daeun.forward ? '순행' : '역행'}(연간 ${stemName(saju.year.stem)}) · 자미두수 대한: ${m.decadalForward ? '순행' : '역행'}(연간 ${stemName(m.yearStem)})` },
      ...(sameStem ? [] : [{ status: 'info' as const, text: '연간이 서로 달라 방향도 달라졌습니다. 규칙이 다른 것이 아니라 해가 바뀌는 기준이 달라서입니다.' }]),
    ],
  });

  const luPos = positionOf(chart, '祿存');
  const maPos = positionOf(chart, '天馬');
  const kuiPos = positionOf(chart, '天魁');
  const yuePos = positionOf(chart, '天鉞');
  const cheoneul = CHEONEUL_BRANCHES[m.yearStem];
  items.push({
    id: 'C-3', side: 'common', primary: 'code',
    title: '녹존·천마·천괴·천월은 사주와 같은 표에서 나옵니다',
    body: '녹존은 연간의 건록, 천마는 연지의 역마, 천괴와 천월은 연간의 천을귀인과 같은 자리입니다. 이름은 달라도 사주의 신살과 자미두수의 별이 같은 계산을 공유합니다.',
    evidence: [
      { kind: 'code', detail: '1930~2020년 91개 연도 모두 일치 (원장 T7)' },
      { kind: 'code', part: '이 구현', detail: '같은 91개 연도를 다시 대조 (V-13)' },
    ],
    live: [
      { status: luPos === lokBranchOf(m.yearStem) ? 'match' : 'differ', text: `녹존 ${branchName(luPos)}궁 = 연간 ${stemName(m.yearStem)}의 건록 ${branchName(lokBranchOf(m.yearStem))}` },
      { status: maPos === yeokmaBranchOf(m.yearBranch) ? 'match' : 'differ', text: `천마 ${branchName(maPos)}궁 = 연지 ${branchName(m.yearBranch)}의 역마 ${branchName(yeokmaBranchOf(m.yearBranch))}` },
      { status: [kuiPos, yuePos].sort().join() === [...cheoneul].sort((a, b) => a - b).join() ? 'match' : 'differ',
        text: `천괴·천월 ${branchName(kuiPos)}·${branchName(yuePos)}궁 = 연간 ${stemName(m.yearStem)}의 천을귀인 ${branchName(cheoneul[0])}·${branchName(cheoneul[1])}` },
    ],
  });

  const soulStage = chart.palaces[m.soulBranch].twelve.changsheng;
  items.push({
    id: 'C-4', side: 'common', primary: 'screen',
    title: '12운성 이름을 함께 씁니다',
    body: '장생·목욕·관대·임관(건록)·제왕·쇠·병·사·묘·절·태·양, 열두 단계의 이름을 두 체계가 같이 씁니다. 자미두수에서는 이를 장생12신이라 부르며, 사주의 건록은 자미두수에서 임관이라 적습니다.',
    evidence: [{ kind: 'screen', detail: '사이트 화면의 ‘포태 12신’ 표기 (원장)' }],
    live: [
      { status: 'info', text: `사주: 일간 ${stemName(dayStem)} 기준 년·월·일·시지의 12운성 = ${[saju.year, saju.month, saju.day, ...(saju.hour ? [saju.hour] : [])].map((p) => p.stage).join('·')}` },
      { status: 'info', text: `자미두수: 명궁 칸의 장생12신 = ${soulStage === '長生' ? '장생' : soulStage}` },
    ],
  });

  const s = surround(m.soulBranch);
  items.push({
    id: 'C-5', side: 'common', primary: 'screen',
    title: '삼방사정은 삼합과 충의 구조입니다',
    body: '한 칸을 읽을 때 함께 보는 삼방사정은 사주의 삼합(세 지지가 이루는 한 묶음)과 충(맞은편)의 관계와 같은 구조입니다. 기준 칸에서 네 칸·여덟 칸 떨어진 곳이 삼합, 여섯 칸 맞은편이 충입니다.',
    evidence: [{ kind: 'screen', detail: '사이트 화면 스크립트의 +4, +8, +6 (원장 R-04)' }],
    live: [
      { status: 'info', text: `이 명식의 명궁 ${branchName(m.soulBranch)}궁: 삼합 ${branchName(s.trine[0])}·${branchName(s.trine[1])}, 충 ${branchName(s.opposite)}` },
    ],
  });

  items.push({
    id: 'D-1', side: 'diff', primary: 'code',
    title: '달력이 다릅니다: 24절기 대 음력',
    body: '사주는 태양의 위치(24절기)로 연과 월을 나누고, 자미두수는 음력의 월·일을 씁니다. 해의 시작도 사주는 입춘, 자미두수는 음력 설입니다. 그래서 같은 생일이어도 연·월이 다르게 나올 수 있습니다.',
    evidence: [
      { kind: 'code', detail: 'T6: 사주 己巳年 丁丑月, 자미두수 庚午年 정월. lunar-javascript·sxtwl 일치 3건 (원장)' },
      { kind: 'code', part: '이 구현', detail: 'lunar-javascript·tyme4ts·태양 황경 천문식·일주 산술로 4기둥 대조 (V-12)' },
    ],
    live: [
      { status: yearSame ? 'match' : 'differ', text: `연: 사주 ${saju.year.ganzhi}년 / 자미두수 ${ziYear}년` },
      { status: monthSame ? 'match' : 'differ', text: `월: 사주 ${saju.month.ganzhi}월(월건) / 자미두수 ${ziMonthLabel}` },
    ],
  });

  const munchangZi = positionOf(chart, '文昌');
  items.push({
    id: 'D-2', side: 'diff', primary: 'tradition',
    title: '같은 이름, 다른 규칙: 문창',
    body: '문창은 사주에서는 일간을 기준으로 정하는 귀인이고, 자미두수에서는 태어난 시를 기준으로 놓는 별입니다. 이름이 같아도 위치가 다르게 나오는 것이 정상입니다.',
    evidence: [
      { kind: 'code', part: '자미두수 쪽', detail: 'T6 명반에서 확인(辰)' },
      { kind: 'tradition', part: '사주 쪽', detail: '전통 귀인 표 인용 (코드 미검증)' },
    ],
    live: [
      { status: MUNCHANG_BRANCH[dayStem] === munchangZi ? 'match' : 'differ',
        text: `사주 문창귀인: 일간 ${stemName(dayStem)} → ${branchName(MUNCHANG_BRANCH[dayStem])} / 자미두수 문창: ${BRANCHES_KO[m.timeBranch]}시 → ${branchName(munchangZi)}궁` },
    ],
  });

  const zStart = chart.palaces.find((p) => p.twelve.changsheng === '長生')!.branch;
  items.push({
    id: 'D-3', side: 'diff', primary: 'code',
    title: '장생의 기준이 다릅니다: 일간 대 오행국',
    body: '사주의 12운성은 일간에서 출발하고, 자미두수의 장생은 오행국에서 출발합니다. 같은 “장생”이라도 시작하는 자리가 다릅니다.',
    evidence: [
      { kind: 'code', detail: '장생12신 시작 위치가 오행국으로 정해짐 (원장 R-06)' },
      { kind: 'code', part: '이 구현', detail: '무작위 300건 대조 (V-13)' },
    ],
    live: [
      { status: CHANGSHENG_BRANCH[dayStem] === zStart ? 'match' : 'differ',
        text: `사주: 일간 ${stemName(dayStem)}의 장생 ${branchName(CHANGSHENG_BRANCH[dayStem])} / 자미두수: ${m.fiveElements.ko}의 장생 ${branchName(zStart)}` },
    ],
  });

  const dyk = saju.daeun;
  items.push({
    id: 'D-4', side: 'diff', primary: 'code',
    title: '10년 운이 시작되는 나이가 다릅니다',
    body: '사주는 태어난 날부터 가장 가까운 절기까지의 날수를 3으로 나눈 값이 첫 대운의 시작 나이입니다. 자미두수는 오행국의 숫자(2~6)가 첫 대한의 시작 나이입니다.',
    evidence: [
      { kind: 'code', part: '자미두수 쪽', detail: '시작 나이가 오행국으로 정해짐 (원장 R-06, 이 구현 V-13)' },
      { kind: 'source', part: '사주 쪽', detail: '일반 이론 인용 — 3일을 1년으로 환산' },
    ],
    live: [
      { status: dyk.startYears === m.firstDecadalAge ? 'match' : 'differ',
        text: `사주 대운수 ${dyk.startYears} (태어나 ${dyk.startYears}년 ${dyk.startMonths}개월 ${dyk.startDays}일 뒤 시작) / 자미두수 첫 대한 ${m.firstDecadalAge}세 (${m.fiveElements.ko})` },
    ],
  });

  const starCount = chart.palaces.reduce((n, p) => n + p.stars.length, 0);
  items.push({
    id: 'D-5', side: 'diff', primary: 'source',
    title: '그림의 모양이 다릅니다: 8글자 대 12칸',
    body: '사주는 여덟 글자가 이루는 균형(오행과 십성)을 보고, 자미두수는 열두 칸 위에 놓인 100여 개 별의 배치를 봅니다. 같은 사람을 서로 다른 지도로 그리는 셈입니다.',
    evidence: [{ kind: 'source', detail: '위키백과 — 구조·분석 방식의 차이' }],
    live: [
      { status: 'info', text: `사주: 오행 ${elements.map((e) => `${e.ko}${e.count}`).join(' ')} (천간 + 지지 본기 ${saju.hour ? 8 : 6}글자)` },
      { status: 'info', text: `자미두수: 열두 칸에 주성 14개를 포함해 별 ${starCount}개가 배치됨` },
    ],
  });

  const evidenceCounts: Record<EvidenceKind, number> = { code: 0, screen: 0, source: 0, tradition: 0 };
  for (const it of items) evidenceCounts[it.primary]++;

  return { notice, columns, items, evidenceCounts, elements };
};

/** 별 이름 → 사주 대응(별 해설의 “사주 대응 한 줄”에서 쓴다). 대응이 없으면 undefined */
export const STAR_SAJU_LINK: Record<string, string> = {
  祿存: '사주의 건록(연간이 가장 힘을 얻는 자리)',
  天馬: '사주의 역마(이동·변화를 뜻하는 지지)',
  天魁: '사주의 천을귀인(귀인의 도움)',
  天鉞: '사주의 천을귀인(귀인의 도움)',
  文昌: '사주의 문창귀인(학문·문서의 귀인)',
  文曲: '사주의 문창귀인과 이웃한 학예의 별',
};

export { stageOf, STAGES_KO, starMeta };
