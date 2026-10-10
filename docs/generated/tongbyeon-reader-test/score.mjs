// 통변 독자 시험의 사실 문항 채점기(검증 V-32). 의존성 없음: node docs/generated/tongbyeon-reader-test/score.mjs
//
// 정답은 round1/reader-key.json(엔진이 만든 값에서 뽑은 것)이고, 독자의 답은 roundN/answers-K.json 이다.
// 사실 문항 13개를 기계로 채점한다(독자마다 같은 기준). 자유 서술(Q6)과 자기 평가(Q7)는 채점하지 않고 집계만 한다.
//   Q1 가장 받쳐 준다고 한 영역(집합) · 가장 신경 쓰라고 한 영역(집합) ………………… 2
//   Q2 일간 · 강약 · 격국 · 용신 ………………………………………………………………… 4
//   Q3 일치한 영역(집합) · 엇갈린 영역(집합) ………………………………………………… 2
//   Q4 “어느 쪽이 맞다고 하지 않는다” · “일치해도 더 믿으라고 하지 않는다” ……………… 2
//   Q5 지금 대한의 단계 · 지금 대운의 단계 · 시기 비교 결과 ………………………………… 3
// 기계 채점이 애매한 답은 사람이 읽어 확인했다(결과는 README.md). 이 파일은 그 판정 규칙이다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'));
const key = read('round1/reader-key.json');

const DOMAINS = ['성격·기질', '재물', '직업', '연애·결혼', '건강', '대인·가족'];
const LV = { '▲▲': 2, '▲': 1, '●': 0, '▼': -1, '▼▼': -2 };
const symbolOf = (text) => (/^\s*(▲▲|▲|●|▼▼|▼)/.exec(text) ?? [])[1] ?? null;
/** 답 앞부분(첫 여는 괄호 앞)에 나온 영역 이름의 집합 */
const domainsIn = (v) => {
  const text = Array.isArray(v) ? v.join(',') : String(v ?? '');
  const head = text.split('(')[0];
  return DOMAINS.filter((d) => head.includes(d)).sort().join('|');
};
const setOf = (arr) => [...arr].sort().join('|');

const expectedOf = (k) => {
  const lv = Object.fromEntries(Object.entries(k.q1.levels).map(([d, s]) => [d, LV[symbolOf(s)]]));
  const top = Math.max(...Object.values(lv));
  const low = Math.min(...Object.values(lv));
  const best = top >= 1 ? DOMAINS.filter((d) => lv[d] === top) : [];
  const worst = low <= -1 ? DOMAINS.filter((d) => lv[d] === low) : [];
  const m = /^(.+?)\((.)\) 일간의 (신약|신강|중화) 사주이며, 격국은 (\S+), 용신은 (.+?)\((.)\)입니다\.$/.exec(k.q2.headline);
  if (!m) throw new Error(`헤드라인 모양을 읽지 못함: ${k.q2.headline}`);
  return { best, worst, stem: [m[1], m[2]], strength: m[3], gyeok: m[4], yong: [m[5], m[6]], agree: k.q3.agree, conflict: k.q3.conflict, now: { z: symbolOf(k.q5.ziweiNow.replace(/^.*대한 /, '')), s: symbolOf(k.q5.sajuNow.replace(/^.*대운 /, '')), pair: k.q5.pair } };
};

const score = (ans, exp) => {
  const has = (v, ...needles) => needles.some((n) => String(v ?? '').includes(n));
  const items = [
    ['Q1 가장 받쳐 주는 영역', domainsIn(ans.q1.best) === setOf(exp.best)],
    ['Q1 가장 신경 쓸 영역', domainsIn(ans.q1.worst) === setOf(exp.worst)],
    ['Q2 일간', has(ans.q2.ilgan, ...exp.stem)],
    ['Q2 강약', has(ans.q2.strength, exp.strength)],
    ['Q2 격국', has(ans.q2.gyeokguk, exp.gyeok)],
    ['Q2 용신', has(ans.q2.yongsin, ...exp.yong)],
    ['Q3 일치한 영역', domainsIn(ans.q3.agree) === setOf(exp.agree)],
    ['Q3 엇갈린 영역', domainsIn(ans.q3.conflict) === setOf(exp.conflict)],
    ['Q4 어느 쪽이 맞다고 하지 않는다', /않|아니|정하지|판정하지/.test(ans.q4.which_is_right) && !/(자미두수|사주)(가|는|쪽이) 맞(다|습니다)/.test(ans.q4.which_is_right)],
    ['Q4 일치해도 더 믿으라고 하지 않는다', /^\s*(아니|더 믿(어도|으라)|일치는 맞는다는 증거는)/.test(ans.q4.agree_means_more_trust) || /더 믿어도 된다고(는)? (말하지|하지)/.test(ans.q4.agree_means_more_trust)],
    ['Q5 지금 대한의 단계', symbolOf(ans.q5.ziwei_now) === exp.now.z],
    ['Q5 지금 대운의 단계', symbolOf(ans.q5.saju_now) === exp.now.s],
    ['Q5 시기 비교 결과', String(ans.q5.pair_result).trim().startsWith(exp.now.pair)],
  ];
  return items;
};

const rounds = fs.readdirSync(here).filter((d) => /^round\d+$/.test(d)).sort();
const result = {};
const lines = ['| 시험 | 독자 | 사실 문항 | 틀린 문항 | 여러 근거를 엮은 정리(1~5) | 읽기 쉬움(1~5) | 막힌 낱말 수 |', '|---|---|---|---|---|---|---|'];
for (const r of rounds) {
  const files = fs.readdirSync(path.join(here, r)).filter((f) => /^answers-\d+\.json$/.test(f)).sort();
  if (files.length === 0) continue;
  const rows = [];
  for (const f of files) {
    const i = Number(/(\d+)/.exec(f)[1]);
    const ans = read(`${r}/${f}`);
    const exp = expectedOf(key[`reader-${i}`]);
    const items = score(ans, exp);
    const wrong = items.filter(([, ok]) => !ok).map(([n]) => n);
    rows.push({ reader: i, person: key[`reader-${i}`].label, correct: items.length - wrong.length, total: items.length, wrong, synthesized: ans.q7.synthesized, easy: ans.q7.easy, unknownWords: ans.q7.unknown_words.length });
    lines.push(`| ${r.replace('round', '')}차 | ${i} (${key[`reader-${i}`].label}) | ${items.length - wrong.length}/${items.length} | ${wrong.join(', ') || '없음'} | ${ans.q7.synthesized} | ${ans.q7.easy} | ${ans.q7.unknown_words.length} |`);
  }
  const mean = (k) => +(rows.reduce((s, x) => s + x[k], 0) / rows.length).toFixed(2);
  result[r] = { readers: rows, correct: rows.reduce((s, x) => s + x.correct, 0), total: rows.reduce((s, x) => s + x.total, 0), meanSynthesized: mean('synthesized'), meanEasy: mean('easy'), meanUnknownWords: mean('unknownWords') };
}
fs.writeFileSync(path.join(here, 'scores.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(lines.join('\n'));
console.log('');
for (const [r, v] of Object.entries(result)) console.log(`${r}: 사실 ${v.correct}/${v.total} · 정리 ${v.meanSynthesized} · 쉬움 ${v.meanEasy} · 막힌 낱말 평균 ${v.meanUnknownWords}개`);
