// 의존성 패치(patches/)가 설치 상태와 어긋나지 않는지 확인한다.
// postinstall(scripts/apply-patches.mjs)이 빠진 설치(npm install --ignore-scripts 등)나 의존성 버전 변경을 여기서 잡는다.
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface PatchFile { target: string; source: string; original: string; patched: string }
interface PatchEntry { package: string; version: string; files: PatchFile[] }
const manifest = JSON.parse(fs.readFileSync('patches/manifest.json', 'utf8')) as { patches: PatchEntry[] };
const sha = (buf: Buffer): string => crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');

describe('의존성 패치', () => {
  it('manifest 에 패치가 하나 이상 있다', () => {
    expect(manifest.patches.length).toBeGreaterThan(0);
  });

  for (const p of manifest.patches) {
    it(`${p.package}@${p.version}: 설치된 버전이 패치 대상과 같다`, () => {
      const v = JSON.parse(fs.readFileSync(`node_modules/${p.package}/package.json`, 'utf8')).version;
      expect(v).toBe(p.version);
    });

    for (const f of p.files) {
      it(`${p.package}/${f.target}: 저장소의 수정본이 manifest 해시와 같고, 설치된 파일이 수정본이다`, () => {
        expect(sha(fs.readFileSync(f.source))).toBe(f.patched);
        expect(sha(fs.readFileSync(path.join('node_modules', p.package, f.target)))).toBe(f.patched);
        expect(f.original).not.toBe(f.patched);
      });
    }
  }

  it('적용 스크립트를 다시 실행해도 성공하고 아무것도 바꾸지 않는다(멱등)', () => {
    const r = spawnSync(process.execPath, ['scripts/apply-patches.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('이미 적용됨');
    expect(r.stdout).not.toContain('적용함');
  });
});
