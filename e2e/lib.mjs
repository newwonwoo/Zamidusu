// E2E 공용: 정적 서버(vite preview, JS API), 브라우저 실행 도우미
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
