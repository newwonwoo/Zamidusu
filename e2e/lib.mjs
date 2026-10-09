// E2E 공용: 정적 서버(vite preview, JS API), 브라우저 실행 도우미
import { preview } from 'vite';
import { chromium } from 'playwright-core';

export const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export async function startServer(port = 4173) {
  const server = await preview({ preview: { port, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
  return { url: `http://127.0.0.1:${port}/`, stop: () => new Promise((resolve) => server.httpServer.close(() => resolve())) };
}

export async function launch() {
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}
