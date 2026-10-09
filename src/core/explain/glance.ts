// “한눈에 보기” — 칸 해설의 결론. 별 카드를 다 읽지 않아도 이 칸이 이 명반에서 무엇을 뜻하는지 알 수 있게 한다.
// 구성: 결론(강점·조심할 점·별의 힘) + 항목(중심 별 · 별의 힘 · 사화 · 함께 있는 별).
// 모든 문장은 일상어 짧은 문장이며, 전문용어는 {{ }} 로 표시해 화면에서 풀이를 붙인다.

import type { BrightnessMode } from '../brightness';
import { borrowedMainStars, surround } from '../chart';
import type { Chart, StarView, View } from '../chart';
import { PALACE_KO, starMeta } from '../names';
import type { PalaceKey, Scope } from '../names';
import { josa } from './korean';
import { PALACES } from './palaces';
import { cautionOf, mutagenEffects, mutagenSubject, powerParts, strengthOf } from './phrases';
import type { MutagenTag } from './phrases';
import { ROLE_META, ROLE_ORDER, ROLE_PALACE_LINES } from './roles';
import type { MinorRole } from './roles';
import { MAIN_PALACE_LINES, STAR_PROFILES } from './stars';

export type GlanceKind = 'star' | 'power' | 'mutagen' | 'group' | 'borrow';

export interface GlancePoint {
  kind: GlanceKind;
  label: string;
  text: string;
}

export interface Glance {
  /** 결론(2~4문장) */
  headline: string;
  points: GlancePoint[];
}

/** 본명은 따로 말하지 않고, 운 모드만 “이 10년 동안/올해/…”로 시기를 앞에 붙인다 */
const LEAD: Record<Scope, string> = {
  natal: '', decadal: '이 10년 동안 ', yearly: '올해 ', monthly: '이번 달 ', daily: '오늘 ', hourly: '이 시각 ',
};

const POWER_NOTE: Record<'strong' | 'even' | 'weak' | 'weakest', string> = {
  strong: '힘이 센 자리에 있어 이 강점이 잘 드러납니다.',
  even: '힘이 보통인 자리에 있어 강점과 조심할 점이 함께 나타납니다.',
  weak: '힘이 약한 자리에 있어 강점이 덜 드러나니 조심할 점을 먼저 챙기세요.',
  weakest: '힘이 가장 약한 자리에 있어 강점이 잘 드러나지 않으니 조심할 점을 먼저 챙기세요.',
};

const BORROW_NOTE = '빌려 온 별은 힘이 다소 약해서 영향이 부드럽게 나타납니다.';

export const buildGlance = (
  chart: Chart, view: View, branch: number, scopedName: PalaceKey, mode: BrightnessMode,
): Glance => {
  const palace = chart.palaces[branch];
  const topic = PALACES[scopedName].topic;
  const lead = LEAD[view.scope];
  const mains = palace.stars.filter((s) => s.group === 'main');
  const others = palace.stars.filter((s) => s.group !== 'main');
  const borrowed = mains.length === 0 ? borrowedMainStars(chart, branch) : [];
  const points: GlancePoint[] = [];

  // ── 결론 ──
  const sentences: string[] = [];
  const primary = mains[0] ?? borrowed[0];
  if (mains.length > 0) {
    const prof = STAR_PROFILES[primary.key];
    // 장점·주의는 “별의 성격”이므로 별에 붙여 말한다(칸의 주제와 어긋나는 문장을 피한다)
    sentences.push(`${lead}${topic}에서 중심이 되는 별은 ${mains.map((s) => s.ko).join('·')}입니다.`);
    sentences.push(`${josa(primary.ko, '은/는')} ${josa(strengthOf(prof), '이/가')} 강점이고, ${josa(cautionOf(prof), '은/는')} 조심할 점입니다.`);
    const rest = mains.slice(1);
    if (rest.length === 1) sentences.push(`여기에 ${rest[0].ko}의 성격(${STAR_PROFILES[rest[0].key].tag})이 더해집니다.`);
    if (rest.length > 1) sentences.push(`여기에 ${rest.map((s) => s.ko).join('·')}의 성격이 더해집니다.`);
    if (primary.brightness) sentences.push(`${josa(primary.ko, '은/는')} ${POWER_NOTE[powerParts(primary.brightness, mode, prof).level]}`);
  } else if (borrowed.length > 0) {
    const opp = PALACE_KO[view.names[(branch + 6) % 12]];
    const list = borrowed.map((s) => s.ko).join('·');
    const prof = STAR_PROFILES[primary.key];
    sentences.push(`이 칸에는 중심이 되는 별이 없어, 맞은편 ${opp}의 ${list}${josa(list, '을/를').slice(list.length)} 빌려 읽습니다.`);
    sentences.push(`${josa(primary.ko, '은/는')} ${josa(strengthOf(prof), '이/가')} 강점이고, ${josa(cautionOf(prof), '은/는')} 조심할 점입니다.`);
    sentences.push(BORROW_NOTE);
  } else if (others.length > 0) {
    const sur = surround(branch);
    const trineMains = sur.trine.flatMap((b) => chart.palaces[b].stars.filter((s) => s.group === 'main').map((s) => s.ko));
    sentences.push(
      trineMains.length > 0
        ? `이 칸과 맞은편 칸에는 중심이 되는 별이 없어, 함께 읽는 칸의 ${trineMains.join('·')}의 분위기를 더 크게 참고합니다.`
        : '이 칸과 맞은편 칸에는 중심이 되는 별이 없어, 함께 있는 보조 별과 변화(사화)를 중심으로 가볍게 읽으세요.',
    );
  } else {
    sentences.push('이 칸에는 별이 없어 영향이 크지 않습니다. 함께 읽는 칸을 참고하세요.');
  }

  // ── 중심 별(별 × 궁 문장) ──
  for (const s of mains) points.push({ kind: 'star', label: s.ko, text: MAIN_PALACE_LINES[s.key][scopedName] });
  for (const s of borrowed) points.push({ kind: 'borrow', label: `빌려 온 ${s.ko}`, text: MAIN_PALACE_LINES[s.key][scopedName] });

  // ── 별의 힘 ──
  for (const s of mains) {
    if (!s.brightness) continue;
    const pw = powerParts(s.brightness, mode, STAR_PROFILES[s.key]);
    points.push({ kind: 'power', label: '별의 힘', text: `${josa(s.ko, '은/는')} ${pw.phrase}('${pw.label}')에 있습니다. ${pw.effect}` });
  }

  // ── 사화(생년 + 선택한 운) ──
  const tags: { star: StarView; tag: MutagenTag }[] = [];
  for (const s of palace.stars) if (s.mutagen) tags.push({ star: s, tag: { mutagen: s.mutagen, scope: 'natal' } });
  for (const m of view.mutagens) {
    const star = palace.stars.find((s) => s.key === m.star);
    if (star) tags.push({ star, tag: { mutagen: m.mutagen, scope: m.scope } });
  }
  for (const { star, tag } of tags) {
    const eff = mutagenEffects(STAR_PROFILES[star.key], tag, topic).slice(1);
    points.push({ kind: 'mutagen', label: '변화(사화)', text: `${mutagenSubject(tag)} ${star.ko}에 붙어 있습니다. ${eff.join(' ')}` });
  }

  // ── 함께 있는 별: 역할별 한 줄 ──
  const byRole = new Map<MinorRole, StarView[]>();
  for (const s of others) {
    const role = STAR_PROFILES[s.key]?.role;
    if (!role || role === 'main') continue;
    byRole.set(role, [...(byRole.get(role) ?? []), s]);
  }
  for (const role of ROLE_ORDER) {
    const list = byRole.get(role);
    if (!list) continue;
    points.push({ kind: 'group', label: ROLE_META[role].label, text: `${list.map((s) => starMeta(s.key).ko).join('·')} — ${ROLE_PALACE_LINES[role][scopedName]}` });
  }

  return { headline: sentences.join(' '), points };
};
