// 배포물(dist)에 들어가는 운영 의존성의 라이선스 고지문(THIRD_PARTY_NOTICES.md)을 만든다.   사용: npm run gen:notices
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tree = JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ls', '--omit=dev', '--all', '--json'], { encoding: 'utf8' }));
const found = new Map();
const walk = (deps) => {
  for (const [name, info] of Object.entries(deps ?? {})) {
    if (!found.has(name)) found.set(name, info.version);
    walk(info.dependencies);
  }
};
walk(tree.dependencies);

const licenseFile = (dir) => {
  const names = fs.readdirSync(dir).filter((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  return names.length ? fs.readFileSync(path.join(dir, names[0]), 'utf8').trim() : null;
};

const out = [
  '# 제3자 소프트웨어 고지',
  '',
  '이 프로젝트의 배포물(`dist/`)에는 아래 오픈소스가 포함됩니다. 모두 MIT 라이선스이며, 라이선스 전문은 각 항목 아래에 있습니다.',
  '`npm run gen:notices` 로 다시 만든 파일입니다.',
  '',
  '`lunar-lite` 는 이 프로젝트가 일부 파일을 수정해서 씁니다(`patches/README.md`). 수정본에도 같은 MIT 라이선스가 적용되며 원 저작권 고지는 `patches/lunar-lite/LICENSE` 에 있습니다.',
  '',
];
for (const [name, version] of [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const dir = path.join('node_modules', name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const lic = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses);
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? '';
  out.push(`## ${name}@${version} — ${lic}`, '', repo ? `출처: ${repo.replace(/^git\+/, '')}` : '', '');
  const text = licenseFile(dir);
  out.push('```', text ?? '(라이선스 파일이 패키지에 없음 — package.json 의 license 필드를 따름)', '```', '');
}
fs.writeFileSync('THIRD_PARTY_NOTICES.md', out.join('\n'));
console.log(`THIRD_PARTY_NOTICES.md — ${found.size}개 패키지`);
