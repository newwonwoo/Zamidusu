// 한국 음력 표(src/core/lunarkr-data.ts)를 다시 만든다.   사용: node scripts/gen-lunar-kr.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCalendar, fromEpochDay, koreanOffset, renderDataModule, yearInfos } from './lunar-kr-generator.mjs';

export const FIRST = 1900;
export const LAST = 2100;

const cal = buildCalendar(koreanOffset, FIRST - 1, LAST + 2);
const infos = yearInfos(cal, FIRST, LAST);
const lastInfo = infos[infos.length - 1];
const lastDay = lastInfo.newYear + lastInfo.lengths.reduce((a, b) => a + b, 0) - 1;
const f = (n) => {
  const d = fromEpochDay(n);
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
};
const text = renderDataModule(infos, { first: FIRST, last: LAST, firstSolar: f(infos[0].newYear), lastSolar: f(lastDay) });
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'lunarkr-data.ts');
fs.writeFileSync(out, text);
console.log(`쓴 파일: ${path.relative(process.cwd(), out)} — 음력 ${FIRST}~${LAST}년 ${infos.length}개 연도, 양력 ${f(infos[0].newYear)} ~ ${f(lastDay)}`);
