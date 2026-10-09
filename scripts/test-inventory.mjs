// 단위 테스트 전체를 돌려 “무엇을 검증했는지” 목록(docs/generated/test-inventory.md)을 만든다.
//   사용: node scripts/test-inventory.mjs      (npm run test:inventory)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = path.join(os.tmpdir(), `vitest-inventory-${process.pid}.json`);
const run = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', '--reporter=json', `--outputFile=${tmp}`], { encoding: 'utf8' });
if (!fs.existsSync(tmp)) {
  console.error(run.stdout, run.stderr);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(tmp, 'utf8'));
fs.rmSync(tmp);

const lines = [
  '# 단위 테스트 목록 (자동 생성)',
  '',
  '`npm run test:inventory` 로 만든 목록입니다. 각 항목은 통과해야 하는 검증이며, 제목이 곧 검증 내용입니다.',
  '',
  `- 전체 ${data.numTotalTests}건 · 통과 ${data.numPassedTests}건 · 실패 ${data.numFailedTests}건 · 파일 ${data.testResults.length}개`,
  '',
];
const files = [...data.testResults].sort((a, b) => a.name.localeCompare(b.name));
for (const f of files) {
  const name = path.relative(path.join(process.cwd(), 'tests'), f.name);
  const ok = f.assertionResults.filter((a) => a.status === 'passed').length;
  lines.push(`## ${name} — ${ok}/${f.assertionResults.length}건`, '');
  let cur = null;
  for (const a of f.assertionResults) {
    const group = a.ancestorTitles.join(' › ');
    if (group !== cur) {
      cur = group;
      if (group) lines.push('', `**${group}**`, '');
    }
    lines.push(`- ${a.status === 'passed' ? '✓' : '✗'} ${a.title}`);
  }
  lines.push('');
}
fs.mkdirSync('docs/generated', { recursive: true });
fs.writeFileSync('docs/generated/test-inventory.md', lines.join('\n'));
console.log(`docs/generated/test-inventory.md — ${data.numPassedTests}/${data.numTotalTests}건 통과`);
process.exit(data.numFailedTests ? 1 : 0);
