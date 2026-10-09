// E2E 공용: 정적 서버(vite preview, JS API), 브라우저 실행 도우미
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

export const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export async function startServer(port = 4173) {
  const server = await preview({ preview: { port, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
  // 서버가 실제로 받은 요청 주소(경로+쿼리). 해시(#)는 브라우저가 보내지 않으므로 여기에 나타나지 않는다.
  const seen = [];
  // prependListener: vite 의 SPA 대체 응답이 req.url 을 '/index.html' 로 바꾸기 전에 원래 주소를 기록한다
  server.httpServer.prependListener('request', (req) => seen.push(req.url));
  return { url: `http://127.0.0.1:${port}/`, seen, stop: () => new Promise((resolve) => server.httpServer.close(() => resolve())) };
}

export async function launch() {
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

/** dist 를 하위 경로(예: GitHub Pages 의 /저장소이름/)에 올린 것처럼 서비스한다 — 상대 경로 자산이 맞게 풀리는지 확인용 */
export function startSubpathServer(prefix = '/Zamidusu/', port = 4174, root = 'dist') {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404).end('not found');
      return;
    }
    const file = path.resolve(base, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
    const target = file === base ? path.join(base, 'index.html') : file;
    if (!target.startsWith(base + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(target)] ?? 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${port}${prefix}`, origin: `http://127.0.0.1:${port}`, stop: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
