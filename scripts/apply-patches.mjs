// postinstall: node_modules 의 의존성에 이 프로젝트의 패치를 적용한다 (patches/README.md 참고).
//
// 왜 patch-package 가 아닌가: 패치가 파일 두 개뿐이고, patch-package 가 끌고 오는 개발 의존성(braces 등)에
// 수정본이 없는 고위험 경고 4건이 있어 `npm audit` 가 깨끗하지 않았다. 의존성 없이 해시로 검증하는 덮어쓰기로 대신한다.
//
// 동작: 설치된 파일의 해시가 manifest 의 original 이면 patched 내용으로 덮어쓰고,
//       이미 patched 면 아무것도 하지 않고, 둘 다 아니면(의존성 버전이 달라졌다면) 오류로 멈춘다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'patches', 'manifest.json'), 'utf8'));

/** 줄바꿈 차이(CRLF 체크아웃)에 흔들리지 않도록 LF 로 맞춘다 */
const normalize = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
const sha256 = (buf) => crypto.createHash('sha256').update(normalize(buf)).digest('hex');

let failed = false;
for (const patch of manifest.patches) {
  const pkgDir = path.join(root, 'node_modules', patch.package);
  const pkgJson = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    console.error(`[patches] ${patch.package} 가 설치되어 있지 않습니다 (npm install 이 먼저 끝나야 합니다)`);
    failed = true;
    continue;
  }
  const version = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
  if (version !== patch.version) {
    console.error(`[patches] ${patch.package}@${version} 은 패치 대상(${patch.version})이 아닙니다. patches/ 를 새 버전에 맞게 다시 만드세요.`);
    failed = true;
    continue;
  }
  for (const f of patch.files) {
    const target = path.join(pkgDir, f.target);
    const current = sha256(fs.readFileSync(target));
    if (current === f.patched) {
      console.log(`[patches] ${patch.package}/${f.target}: 이미 적용됨`);
    } else if (current === f.original) {
      const next = normalize(fs.readFileSync(path.join(root, f.source)));
      if (sha256(next) !== f.patched) {
        console.error(`[patches] ${f.source} 의 내용이 manifest 와 다릅니다.`);
        failed = true;
        continue;
      }
      fs.writeFileSync(target, next);
      console.log(`[patches] ${patch.package}/${f.target}: 적용함 (${patch.reason})`);
    } else {
      console.error(`[patches] ${patch.package}/${f.target}: 원본도 패치본도 아닙니다(해시 ${current.slice(0, 12)}…). 직접 수정했거나 버전이 다른 파일입니다.`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
