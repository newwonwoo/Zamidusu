// 요소 단위 확대 스크린샷: node e2e/zoom.mjs "<query>" <name> <selector> [width] [height] [scheme] [scale]
import { startServer, launch } from './lib.mjs';
const [, , query = '', name = 'zoom', selector = '.board', width = '1440', height = '1000', scheme = 'light', scale = '2'] = process.argv;
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: +width, height: +height }, colorScheme: scheme, deviceScaleFactor: +scale });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(server.url + (query ? `?${query}` : ''));
await page.waitForSelector('.cell', { timeout: 10000 });
await page.locator(selector).first().screenshot({ path: `e2e/out/${name}.png` });
console.log('logs:', JSON.stringify(logs));
await browser.close();
await server.stop();
