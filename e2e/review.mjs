// 사람이 읽기 위한 확대 캡처: 사주 비교 탭의 구역별 이미지
import { startServer, launch } from './lib.mjs';
const server = await startServer(4181);
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.6 });
const page = await ctx.newPage();
await page.goto(server.url);
await page.waitForSelector('.cell');
await page.getByRole('tab', { name: '사주 비교' }).click();
await page.locator('.notice').screenshot({ path: 'e2e/out/r-notice.png' });
await page.locator('.pillars').screenshot({ path: 'e2e/out/r-pillars.png' });
await page.locator('.cmp-card[data-id="C-2"]').screenshot({ path: 'e2e/out/r-c2.png' });
await page.locator('.cmp-card[data-id="D-2"]').screenshot({ path: 'e2e/out/r-d2.png' });
await page.locator('.daeun').screenshot({ path: 'e2e/out/r-daeun.png' });
await browser.close();
await server.stop();
