// V-14 화면 E2E: 실제 Chromium 으로 사용자 흐름을 따라가며 확인하고, 스크린샷과 결과 JSON 을 e2e/out 에 남긴다.
//   실행: npm run build && npm run e2e
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer, startSubpathServer, launch } from './lib.mjs';

const OUT = 'e2e/out';
const AXE_SOURCE = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleProblems = [];
let current = '';

const check = (name, cond, detail = '') => {
  results.push({ test: current, check: name, pass: Boolean(cond), detail: cond ? '' : String(detail) });
  if (!cond) console.log(`  ✗ ${name} ${detail}`);
};

const server = await startServer();
const browser = await launch();

const externalRequests = [];
/** 이 검증에서 직접 띄운 보조 서버(하위 경로 호스팅). 외부 요청으로 세지 않는다 */
const allowedOrigins = [];
const newPage = async (viewport = { width: 1440, height: 1000 }, opts = {}) => {
  const ctx = await browser.newContext({
    viewport, colorScheme: opts.scheme ?? 'light', deviceScaleFactor: opts.scale ?? 1, acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  page.on('request', (req) => {
    const u = req.url();
    const own = [server.url, 'file://', ...allowedOrigins].some((p) => u.startsWith(p));
    if (!own && !u.startsWith('data:') && !u.startsWith('blob:')) externalRequests.push(`[${current}] ${req.method()} ${u}`);
    if (req.method() !== 'GET' && req.method() !== 'HEAD' && !u.startsWith('data:') && !u.startsWith('blob:')) externalRequests.push(`[${current}] ${req.method()} ${u}`);
  });
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) consoleProblems.push(`[${current}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleProblems.push(`[${current}] pageerror: ${e.message}`));
  return { page, ctx };
};

// 입력값은 실제 사용처럼 해시(#)로, 검증 전용 스위치(compat)는 쿼리(?)로 전달한다.
// 같은 페이지에서 해시만 바꾸면 다시 열리지 않으므로, 매번 빈 페이지를 거쳐 새로 연다.
const open = async (page, params = '') => {
  const sp = new URLSearchParams(params);
  const compat = sp.get('compat') === '1';
  sp.delete('compat');
  const hash = sp.toString();
  await page.goto('about:blank');
  await page.goto(server.url + (compat ? '?compat=1' : '') + (hash ? `#${hash}` : ''));
  await page.waitForSelector('.cell', { timeout: 10000 });
};

const cell = (page, branch) => page.locator(`.cell[data-branch="${branch}"]`);
const run = async (name, fn) => {
  current = name;
  console.log(`▶ ${name}`);
  try {
    await fn();
  } catch (e) {
    check('예외 없이 완료', false, e.message.split('\n')[0]);
  }
};

// ── 1. 첫 화면(예시 T6) ─────────────────────────────────────────────────────────
await run('첫 화면: 예시 명반(T6) 렌더', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  check('12궁이 그려진다', (await page.locator('.cell').count()) === 12);
  check('가운데 정보 블록이 있다', (await page.locator('.center').count()) === 1);
  const center = await page.locator('.center').innerText();
  check('양력·음력·오행국 표시', center.includes('1990-01-30') && center.includes('1990년 1월 4일') && center.includes('수이국'), center);
  check('연주는 庚午(음력 설 기준)', center.includes('庚午'), center);
  check('생년 사화 4개', ['화록 태양', '화권 무곡', '화과 태음', '화기 천동'].every((t) => center.includes(t)), center);
  check('달력 기준 알림이 있다', center.includes('달력 기준'));
  const life = await cell(page, 8).innerText();
  check('명궁(申): 녹존·천마 + 차성 천기·태음', life.includes('녹존') && life.includes('천마') && life.includes('천기') && life.includes('태음'), life);
  check('명궁 칸이 선택(강조)되어 있다', (await cell(page, 8).getAttribute('class')).includes('hl-sel'));
  check('신궁 표지(身)', (await cell(page, 8).innerText()).includes('身'));
  const wealth = await cell(page, 4).innerText();
  check('재백궁(辰): 거문 함 + 좌보·문창', wealth.includes('거문') && wealth.includes('함') && wealth.includes('좌보') && wealth.includes('문창'), wealth);
  const sib = await cell(page, 7).innerText();
  check('형제궁(未): 염정·칠살·타라·화성', ['염정', '칠살', '타라', '화성'].every((s) => sib.includes(s)), sib);
  await page.screenshot({ path: `${OUT}/01-desktop-default.png`, fullPage: true });
  // 응답 시간: ‘명반 보기’ 클릭부터 화면 갱신까지
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: '명반 보기' }).click();
  const t1 = await page.evaluate(() => performance.now());
  check('명반 재계산·재렌더 1초 이내', t1 - t0 < 1000, `${Math.round(t1 - t0)}ms`);
  // 음성 읽기: 재생이 시작되거나, 음성 엔진이 없으면 안내 토스트가 떠야 한다(아무 반응 없음이 아님).
  // 엔진 오류 이벤트는 비동기라 “재생 중” 상태가 잠깐 보였다 사라질 수 있으므로 경합에 견디게 확인한다.
  if (await page.getByRole('button', { name: '▶ 듣기' }).count()) {
    await page.getByRole('button', { name: '▶ 듣기' }).click();
    const reacted = await page
      .waitForFunction(
        () => Boolean(document.querySelector('.toast')?.textContent?.includes('음성')) || [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('멈춤')),
        null,
        { timeout: 4000 },
      )
      .then(() => true)
      .catch(() => false);
    check('음성 읽기: 재생이 시작되거나 불가 안내가 뜬다', reacted);
    const stop = page.getByRole('button', { name: '■ 멈춤' });
    if (await stop.count()) await stop.click({ timeout: 1500 }).catch(() => {});
    const back = await page
      .waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('▶ 듣기')), null, { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    check('음성 읽기 뒤 버튼이 원래 상태(▶ 듣기)로 돌아온다', back);
  }
  await ctx.close();
});

// ── 2. 삼방사정 ─────────────────────────────────────────────────────────────────
await run('삼방사정: 칸 클릭 → +4 +8 +6 강조', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  await cell(page, 2).click(); // 寅 천이궁
  check('선택 칸 강조', (await cell(page, 2).getAttribute('class')).includes('hl-sel'));
  check('삼합 두 칸(午·戌)', (await cell(page, 6).getAttribute('class')).includes('hl-tri') && (await cell(page, 10).getAttribute('class')).includes('hl-tri'));
  check('대궁(申)', (await cell(page, 8).getAttribute('class')).includes('hl-opp'));
  check('그 밖의 칸은 강조 없음', !(await cell(page, 0).getAttribute('class')).includes('hl-'));
  check('우측 패널이 천이궁 해설로 바뀐다', (await page.locator('.palace-card h3').innerText()).includes('천이궁'));
  check('함께 읽는 칸 링크 3개', (await page.locator('.surround-line .link').count()) === 3);
  // 키보드로 선택
  await cell(page, 5).focus();
  await page.keyboard.press('Enter');
  check('키보드(Enter)로 칸을 선택할 수 있다', (await cell(page, 5).getAttribute('class')).includes('hl-sel'));
  // 요약표에서 선택
  await page.locator('.summary tbody tr').nth(8).click();
  check('요약표 행 클릭으로 선택', (await page.locator('.palace-card h3').innerText()).includes('관록'));
  await ctx.close();
});

// ── 3. 운 모드 ──────────────────────────────────────────────────────────────────
await run('운 모드: 대한·유년·유월·유일·유시', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  await page.getByRole('tab', { name: '대한' }).click();
  check('대한 구간 12개', (await page.locator('.decades button').count()) === 12);
  await page.locator('.decades button').nth(1).click(); // 12-21세
  check('대한 12–21: 酉 칸이 대한명궁', (await cell(page, 9).innerText()).includes('대한명궁'));
  check('대한 칸 이름이 재배치(酉=명궁, 申=형제, 戌=부모)', (await cell(page, 9).locator('.pname').innerText()).startsWith('명궁')
    && (await cell(page, 8).locator('.pname').innerText()).startsWith('형제')
    && (await cell(page, 10).locator('.pname').innerText()).startsWith('부모'));
  check('본명 칸 이름이 작게 남는다', (await cell(page, 9).locator('.natalname').innerText()) === '부모');
  const hasScopeMut = (await page.locator('.cell .mut-out').count()) > 0;
  check('대한 사화가 윤곽 배지로 표시된다', hasScopeMut);
  check('운 유성 칩이 있다', (await page.locator('.chip-flow').count()) >= 10);
  await page.screenshot({ path: `${OUT}/03-decadal.png`, fullPage: true });
  await page.getByRole('tab', { name: '유년' }).click();
  check('유년: 날짜 입력이 나타난다', (await page.locator('.stepper input[type="date"]').count()) === 1);
  const info1 = await page.locator('.fortune-info').innerText();
  check('유년 안내(간지·세는나이·명궁 칸)', /년 · 세는나이 \d+세/.test(info1), info1);
  const y1 = Number((await page.locator('.stepper input[type="date"]').inputValue()).slice(0, 4));
  await page.locator('.stepper button[aria-label="다음"]').click();
  const y2 = Number((await page.locator('.stepper input[type="date"]').inputValue()).slice(0, 4));
  check('▶ 로 한 해 이동', y2 === y1 + 1, `${y1}→${y2}`);
  check('유년 칩(세전 12신 표시 켜기 전에도 소한 태그)', (await page.locator('.tag-age').count()) === 1);
  for (const name of ['유월', '유일', '유시']) {
    await page.getByRole('tab', { name }).click();
    check(`${name}: 안내와 12궁이 유지된다`, (await page.locator('.cell').count()) === 12 && (await page.locator('.fortune-info').innerText()).includes(`${name} 명궁`));
  }
  check('유시: 시진 선택이 있다', (await page.locator('.stepper select').count()) === 1);
  await page.getByRole('tab', { name: '본명' }).click();
  check('본명으로 돌아오면 윤곽 배지가 사라진다', (await page.locator('.cell .mut-out').count()) === 0);
  await ctx.close();
});

// ── 4. 사주 비교 ────────────────────────────────────────────────────────────────
await run('사주 비교 탭(N-01~N-03)', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  await page.getByRole('tab', { name: '사주 비교' }).click();
  const pillars = await page.locator('.pillars').innerText();
  check('사주 4기둥 己巳 丁丑 乙未 壬午', ['己巳', '丁丑', '乙未', '壬午'].every((g) => pillars.includes(g)), pillars);
  check('자미두수 열: 庚午년 · 음력 1월', pillars.includes('庚午년') && pillars.includes('음력 1월'), pillars);
  const notice = await page.locator('.notice').innerText();
  check('달력 기준 알림 문장', notice.includes('사주는 己巳년 丁丑월') && notice.includes('庚午년 음력 1월 4일') && notice.includes('입춘'), notice);
  check('공통점 5 · 차이점 5 카드', (await page.locator('.cmp-card.common').count()) === 5 && (await page.locator('.cmp-card.diff').count()) === 5);
  check('근거 구분 배지 4종이 모두 쓰인다', (await page.locator('.ev-code').count()) > 0 && (await page.locator('.ev-screen').count()) > 0
    && (await page.locator('.ev-source').count()) > 0 && (await page.locator('.ev-tradition').count()) > 0);
  const d4 = await page.locator('.cmp-card[data-id="D-4"]').innerText();
  check('D-4 실측값: 사주 대운수 8 대 자미두수 2세', d4.includes('대운수 8') && d4.includes('첫 대한 2세'), d4);
  const c3 = await page.locator('.cmp-card[data-id="C-3"] .live-match').count();
  check('C-3 은 세 줄 모두 일치 표시', c3 === 3, c3);
  check('2단계 자리표시(준비 중)', (await page.locator('.stage2').innerText()).includes('준비 중'));
  await page.screenshot({ path: `${OUT}/04-saju.png`, fullPage: true });
  // 연도 기준을 입춘으로
  await page.locator('.basis input[type="radio"]').nth(1).check();
  await page.waitForFunction(() => document.querySelector('.center')?.textContent?.includes('입춘 기준'));
  const center = await page.locator('.center').innerText();
  check('입춘 기준: 己巳년·금사국', center.includes('己巳') && center.includes('금사국'), center);
  const notice2 = await page.locator('.notice').innerText();
  check('입춘 기준이면 연주 불일치 경고가 사라진다', notice2.includes('연주는 같고'), notice2);
  await ctx.close();
});

// ── 4-1. 쉬운 해설(설계서 부록 B: E-01~E-10) ───────────────────────────────────
await run('쉬운 해설(E-01~E-10): 한눈에 보기·읽는 법·사주로 보면·근거 접기', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  // 첫 화면의 선택 칸은 명궁(주성 없음 → 차성안궁)
  check('한눈에 보기 제목이 보인다', (await page.locator('.glance h4').innerText()) === '한눈에 보기');
  const g0 = await page.locator('.glance').innerText();
  check('명궁: 결론이 “중심이 되는 별이 없어 … 빌려 읽습니다”로 시작한다', g0.includes('중심이 되는 별이 없어') && g0.includes('천이궁의 천기·태음을 빌려 읽습니다'), g0);
  check('명궁: 빌려 온 별 항목 2개(천기·태음)', (await page.locator('.glance .gp-label', { hasText: '빌려 온' }).count()) === 2);
  check('명궁: 함께 있는 별이 역할별 한 줄(재물을 모으는 별·움직임의 별 …)', ['재물을 모으는 별', '움직임의 별', '고독의 별'].every((t) => g0.includes(t)), g0);
  check('결론이 본문(별 카드)보다 먼저 나온다', await page.evaluate(() => {
    const g = document.querySelector('.glance'); const st = document.querySelector('.stars-explain');
    return Boolean(g && st && (g.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING));
  }));

  // 요약표에서 관록궁 선택
  await page.locator('.summary tbody tr', { hasText: '관록' }).click();
  const head = await page.locator('.glance-head').innerText();
  check('관록궁 결론: 중심 별 · 강점 · 조심할 점 · 별의 힘', head.includes('중심이 되는 별은 태양입니다') && head.includes('태양은 공정함과 베푸는 힘이 강점이고') && head.includes('남을 챙기다 스스로 지치는 면은 조심할 점입니다') && head.includes('태양은 힘이 가장 약한 자리'), head);
  const labels = await page.locator('.glance .gp-label').allInnerTexts();
  check('항목: 태양 · 별의 힘 · 변화(사화) · 명예와 인정의 별 · 걱정과 마찰의 별', ['태양', '별의 힘', '변화(사화)', '명예와 인정의 별', '걱정과 마찰의 별'].every((l) => labels.includes(l)), labels.join('|'));
  check('별의 힘 항목이 기호의 뜻을 풀어 말한다', (await page.locator('.glance .gp-power .gp-text').first().innerText()).includes("힘이 가장 약한 자리('함')에 있습니다"));
  const firsts = await page.locator('.glance .term-first').allInnerTexts();
  check('처음 나오는 용어에는 풀이가 붙는다(화록)', firsts.some((t) => t.includes('화록') && t.includes('좋은 일과 인연이 늘어나는 변화')), firsts.join('|'));
  check('함께 읽는 칸 옆에 삼합·대궁 설명이 있다', (await page.locator('.surround-line .legend').innerText()).includes('삼합은 네 칸 간격'));
  const sun = await page.locator('.star-card[data-star="太陽"]').innerText();
  check('태양 카드: 밝기 문장이 ‘함’의 뜻을 먼저 말한다', sun.includes("'함'으로, 힘이 가장 약한 자리입니다."), sun);
  check('태양 카드: 사화 문장이 짧은 문장으로 나뉜다', sun.includes('생년 화록이 이 별에 붙어 있습니다.'), sun);
  const saju = await page.locator('.saju-section').innerText();
  check('“사주로 보면”: 개수를 말로 풀고 뜻을 붙인다', saju.includes('사주로 보면') && saju.includes('식상은 3개로 많은 편입니다') && saju.includes('말·기술·아이디어로 일하는 쪽'), saju);
  check('“사주로 보면”이 별 해설 뒤에 있다', await page.evaluate(() => {
    const st = document.querySelector('.stars-explain'); const sj = document.querySelector('.saju-section');
    return Boolean(st && sj && (st.compareDocumentPosition(sj) & Node.DOCUMENT_POSITION_FOLLOWING));
  }));
  check('옛 “명식”이라는 말이 화면에 없다', !(await page.locator('.explain').innerText()).includes('명식'));

  // 별 카드 속 “사주와 같은 점”은 접혀 있고, 열면 보인다(명궁의 녹존)
  await page.locator('.summary tbody tr', { hasText: '명궁' }).click();
  const fold = page.locator('.star-card[data-star="祿存"] details.blk-fold');
  check('별 카드의 사주 대응은 접혀 있다', (await fold.count()) === 1 && !(await fold.evaluate((d) => d.open)));
  await fold.locator('summary').click();
  check('열면 사주의 같은 개념이 풀려 보인다(건록)', (await fold.innerText()).includes('건록') && (await fold.innerText()).includes('경(庚)의 건록은 신(申)'));
  await page.locator('.summary tbody tr', { hasText: '관록' }).click();

  // 읽는 법
  const guide = page.locator('details.how-to-read');
  check('해설 읽는 법은 처음에 접혀 있다', !(await guide.evaluate((d) => d.open)));
  await guide.locator('summary').click();
  const gt = await guide.innerText();
  check('읽는 법을 열면 7개 항목과 별의 힘 순서·개수 설명이 보인다', (await guide.locator('li').count()) === 7 && gt.includes('묘 → 왕 → 평 → 한 → 함') && gt.includes('한눈에 보기를 먼저') && gt.includes('여덟 글자 중 그 기운에 해당하는 글자의 수'), gt);
  check('요약표 설명이 쉬운 말이다(도움이 되는 요소·신경 쓸 요소)', (await page.locator('.table-note').innerText()).includes('도움이 되는 요소'));
  await page.screenshot({ path: `${OUT}/03-explain-easy.png`, fullPage: true });

  // 사주 비교: 근거는 접혀 있고 열면 보인다
  await page.getByRole('tab', { name: '사주 비교' }).click();
  const boxes = page.locator('.cmp-card details.evidence-box');
  check('근거 보기가 항목마다 접혀 있다(10개)', (await boxes.count()) === 10 && (await boxes.evaluateAll((els) => els.every((e) => !e.open))));
  const cardTexts = (await page.locator('.cmp-card').allInnerTexts()).join('\n');
  check('접힌 상태에서는 내부 번호(원장·V-번호)가 본문에 보이지 않는다', !/원장|V-\d/.test(cardTexts), cardTexts.slice(0, 200));
  check('비교 본문의 전문용어에 풀이 표시가 붙는다', (await page.locator('.cmp-card[data-id="C-3"] .term, .cmp-card[data-id="C-3"] abbr.term').count()) >= 4);
  check('비교 본문: 처음 나오는 용어는 풀이를 펼쳐 보여 준다', (await page.locator('.cmp-card .term-first').count()) >= 3);
  await boxes.first().locator('summary').click();
  check('근거 보기를 열면 근거 구분과 내용이 보인다', await boxes.first().locator('.ev-kind').first().isVisible() && (await boxes.first().locator('.ev-detail').first().innerText()).length > 5);
  await ctx.close();
});

// ── 4-2. 입춘 당일(절입 시각 전후) ──────────────────────────────────────────────
// 엔진은 입춘 기준 연주를 날짜 단위로만 판정하므로, 빌드된 번들에서도 패치가 작동하는지(명반과 사주의 연주가 같은지) 확인한다.
await run('입춘 기준: 절입 시각 전후의 연주(번들 검증)', async () => {
  const { page, ctx } = await newPage();
  const cases = [
    // [쿼리, 기대 연주, 설명]
    ['y=2024&m=2&d=4&h=16&mi=57', '癸卯', '2024 입춘 17:27 직전'],
    ['y=2024&m=2&d=4&h=17&mi=57', '甲辰', '2024 입춘 17:27 직후'],
    ['y=2024&m=2&d=4&h=0&mi=10', '癸卯', '2024-02-04 0시대(중국 표준시로는 전날)'],
    ['y=2021&m=2&d=3&h=23&mi=30', '庚子', '2021 입춘 23:59 직전 — 23시대라 엔진 날짜가 하루 넘어감'],
    ['y=2021&m=2&d=4&h=0&mi=30', '辛丑', '2021 입춘 23:59 직후'],
  ];
  for (const [query, year, label] of cases) {
    await open(page, `g=M&cal=solar&${query}&yb=ipchun`);
    const center = await page.locator('.center').innerText();
    check(`${label}: 명반 연주 ${year}`, center.includes(`${year}년`) && center.includes('입춘 기준'), center);
    await page.getByRole('tab', { name: '사주 비교' }).click();
    const pillars = await page.locator('.pillars').innerText();
    const notice = await page.locator('.notice').innerText();
    check(`${label}: 사주 연주도 ${year}, 연주 불일치 경고 없음`, pillars.includes(year) && !notice.includes('연주가 다릅니다'), `${pillars.replace(/\s+/g, ' ')} / ${notice}`);
  }
  await ctx.close();
});

// ── 4-3. 음력 기준(I-15): 한국/중국 ─────────────────────────────────────────────
await run('음력 기준(I-15): 한국·중국이 다른 날 — 표시·전환·링크·만세력', async () => {
  const { page, ctx } = await newPage();
  // 2012-05-21: 한국 음력 4월 1일(윤3월 다음 달), 중국 음력 윤4월 1일
  await open(page, 'y=2012&m=5&d=21&h=12&g=M&cal=solar');
  let center = await page.locator('.center').innerText();
  check('기본은 한국 음력: 4월 1일 (한국 기준)', center.includes('2012년 4월 1일') && center.includes('한국 기준'), center);
  check('다른 기준의 날짜도 함께 보인다(중국 윤4월 1일)', center.includes('중국 기준 윤4월 1일'), center);
  await page.locator('input[name="lunarbasis"]').nth(1).check();
  await page.waitForFunction(() => document.querySelector('.center')?.textContent?.includes('윤4월 1일 (중국 기준)') || /윤4월 1일\s*\(중국 기준\)/.test(document.querySelector('.center')?.textContent ?? ''), null, { timeout: 8000 });
  center = await page.locator('.center').innerText();
  check('중국으로 바꾸면 즉시 윤4월 1일 (중국 기준), 한국 기준 4월 1일이 함께 보인다', /윤4월 1일\s*\(중국 기준\)/.test(center) && center.includes('한국 기준 4월 1일'), center);
  // (2012-05-21 은 윤4월 1일 ↔ 4월 1일이라 윤달 전반부 보정으로 명반 자체는 같다 — 명반이 달라지는 날은 아래 2023-05-19 로 확인)
  // 사주 비교 탭의 달력 알림
  await page.getByRole('tab', { name: '사주 비교' }).click();
  const notice = await page.locator('.notice').innerText();
  check('사주 비교: 두 기준의 음력 날짜를 알려 준다', notice.includes('달력 기준') && notice.includes('한국') && notice.includes('중국'), notice);
  await page.screenshot({ path: `${OUT}/15-lunar-basis-china.png`, fullPage: true });
  // 링크에는 중국 기준이 담기고(lb=cn), 열면 같은 기준으로 복원된다
  await page.getByRole('button', { name: '링크 복사' }).click();
  await page.waitForSelector('.toast');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  check('링크에 음력 기준(lb=cn)이 담긴다', link.includes('lb=cn'), link);
  const p2 = await ctx.newPage();
  await p2.goto(link);
  await p2.waitForSelector('.cell');
  check('링크를 열면 중국 기준으로 복원된다', /윤4월 1일\s*\(중국 기준\)/.test(await p2.locator('.center').innerText()));
  check('복원된 입력부의 라디오도 중국이다', await p2.locator('input[name="lunarbasis"]').nth(1).isChecked());
  // 만세력: 2012-05-21 칸의 음력 표기가 기준에 따라 다르다
  await p2.getByRole('button', { name: '만세력' }).click();
  await p2.waitForSelector('[role="dialog"]');
  const birthCell = await p2.locator('td.birth .lunar').innerText();
  check('만세력(중국 기준): 윤4.1', birthCell.trim() === '윤4.1', birthCell);
  await p2.keyboard.press('Escape');
  await p2.close();
  // 한국으로 되돌리면 한국 값
  await page.locator('input[name="lunarbasis"]').nth(0).check();
  await page.waitForFunction(() => /2012년 4월 1일\s*\(한국 기준\)/.test(document.querySelector('.center')?.textContent ?? ''), null, { timeout: 8000 });
  await page.getByRole('button', { name: '만세력' }).click();
  await page.waitForSelector('[role="dialog"]');
  check('만세력(한국 기준): 4.1', (await page.locator('td.birth .lunar').innerText()).trim() === '4.1');
  await page.keyboard.press('Escape');
  // 두 기준이 다른 날 2023-05-19: 한국 3월 30일 ↔ 중국 4월 1일 — 달이 달라져 명반이 달라진다
  await open(page, 'y=2023&m=5&d=19&h=12&g=M&cal=solar');
  const board = () => page.locator('.cell[data-branch]').evaluateAll((els) => els.map((e) => e.textContent).join('|'));
  center = await page.locator('.center').innerText();
  check('2023-05-19 한국: 3월 30일', center.includes('2023년 3월 30일') && center.includes('중국 기준 4월 1일'), center);
  const boardKorea = await board();
  await page.locator('input[name="lunarbasis"]').nth(1).check();
  await page.waitForFunction(() => /2023년 4월 1일\s*\(중국 기준\)/.test(document.querySelector('.center')?.textContent ?? ''), null, { timeout: 8000 });
  check('2023-05-19 중국: 4월 1일이며 명반이 달라진다', (await board()) !== boardKorea);
  await page.screenshot({ path: `${OUT}/16-lunar-basis-diff.png`, fullPage: true });
  // 두 기준이 같은 날(T6)에는 다른 기준 표시가 없다
  await open(page, 'y=1990&m=1&d=30&h=12&g=M&cal=solar');
  check('같은 날에는 “다른 기준” 표시가 없다', (await page.locator('.alt-lunar').count()) === 0);
  await ctx.close();
});

// ── 5. 입력 검증 ────────────────────────────────────────────────────────────────
await run('입력: 음력·윤달·오류 안내', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  await page.getByLabel('음력', { exact: true }).check();
  await page.getByLabel('윤달', { exact: true }).check();
  await page.locator('select').filter({ has: page.locator('option[value="1991"]') }).first().selectOption('1991');
  await page.getByRole('button', { name: '명반 보기' }).click();
  const err = await page.locator('.errors').innerText();
  check('없는 윤달 안내', err.includes('윤1월이 없습니다') || err.includes('윤'), err);
  await page.getByLabel('윤달', { exact: true }).uncheck();
  await page.locator('select').filter({ has: page.locator('option[value="1991"]') }).first().selectOption('1990');
  await page.getByRole('button', { name: '명반 보기' }).click();
  const err2 = await page.locator('.errors').innerText();
  check('음력 1990년 1월 30일은 없는 날짜(29일까지) 안내', err2.includes('29일까지'), err2);
  await page.locator('select').filter({ has: page.locator('option[value="30"]') }).first().selectOption('4');
  await page.getByRole('button', { name: '명반 보기' }).click();
  await page.waitForSelector('.cell');
  check('올바른 날짜로 고치면 오류가 사라지고 명반이 다시 그려진다', (await page.locator('.errors').count()) === 0);
  // 음력 1990-1-4 = 양력 1990-01-30
  const center = await page.locator('.center').innerText();
  check('음력 1990-1-4 입력 → 양력 1990-01-30', center.includes('1990-01-30'), center);
  // 양력 2월 30일 방지: 일 선택지가 달 길이를 따른다
  await page.getByLabel('양력', { exact: true }).check();
  await page.locator('select').filter({ has: page.locator('option[value="2000"]') }).first().selectOption('2023');
  await page.locator('select').filter({ has: page.locator('option[value="12"]') }).first().selectOption('2');
  const days = await page.locator('select').filter({ has: page.locator('option[value="28"]') }).first().locator('option').count();
  check('2023년 2월은 28일까지', days === 28, days);
  await ctx.close();
});

// ── 6. 출생지 보정 ──────────────────────────────────────────────────────────────
await run('출생지 보정(T5): 서울 13:10 → 午시', async () => {
  const { page, ctx } = await newPage();
  await open(page, 'y=1990&m=3&d=10&h=13&mi=10&g=M&cal=solar');
  let center = await page.locator('.center').innerText();
  check('표준시(보정 없음)는 未시', center.includes('미시'), center);
  await page.locator('select').filter({ has: page.locator('option[value="standard"]') }).selectOption('특별·광역시-서울');
  await page.getByRole('button', { name: '명반 보기' }).click();
  await page.waitForFunction(() => document.querySelector('.center')?.textContent?.includes('보정'));
  center = await page.locator('.center').innerText();
  check('서울 선택: 午시로 바뀌고 보정량이 표시된다', center.includes('오시') && center.includes('보정'), center);
  const notes = await page.locator('.notes').innerText();
  check('보정 근거 안내', notes.includes('서울') && notes.includes('126.98'), notes);
  // 경도 직접 입력: 빈 칸을 0°(그리니치)로 받아들여 9시간이 어긋난 명반을 그리면 안 된다 — 안내를 띄운다
  await page.locator('select').filter({ has: page.locator('option[value="custom"]') }).selectOption('custom');
  await page.locator('input[type="number"][step="0.01"]').fill('');
  await page.getByRole('button', { name: '명반 보기' }).click();
  const lonErr = await page.locator('.errors').innerText();
  check('경도 빈 칸: 숫자를 입력하라는 안내(0°로 계산하지 않음)', lonErr.includes('경도'), lonErr);
  await ctx.close();
});

// ── 7. 시 모름 ──────────────────────────────────────────────────────────────────
await run('시 모름(N-06): 12시진 비교표', async () => {
  const { page, ctx } = await newPage();
  await page.goto(server.url + '#y=1990&m=1&d=30&h=&g=M&cal=solar');
  await page.waitForSelector('.hour-unknown', { timeout: 8000 });
  check('12시진 행', (await page.locator('.hour-table tbody tr').count()) === 12);
  check('안내 문구', (await page.locator('.hour-unknown').innerText()).includes('명궁과 오행국이 태어난 시로 정해지기 때문'));
  await page.screenshot({ path: `${OUT}/07-hour-unknown.png`, fullPage: true });
  await page.locator('.hour-table tbody tr').nth(6).getByRole('button').click(); // 午
  await page.waitForSelector('.cell');
  check('시진을 고르면 명반이 열린다', (await page.locator('.cell').count()) === 12);
  check('午시 명반(명궁 申)', (await cell(page, 8).innerText()).includes('녹존'));
  await ctx.close();
});

// ── 8. 역산 ─────────────────────────────────────────────────────────────────────
await run('역산 입력(F-09, I-10)', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  await page.getByRole('tab', { name: '역산 입력' }).click();
  const sel = (label) => page.locator('.reverse label', { hasText: label }).locator('select');
  await sel('명궁 위치').selectOption('0'); // 子
  await sel('신궁 위치').selectOption('1'); // 丑
  await page.waitForSelector('.rev-none');
  const none = await page.locator('.rev-none').innerText();
  check('모순 입력 → 후보 0개와 이유', none.includes('후보 0개') && none.includes('짝수'), none);
  await page.screenshot({ path: `${OUT}/08-reverse-conflict.png`, fullPage: true });
  await page.getByRole('button', { name: '초기화' }).last().click();
  await sel('연간').selectOption('6'); // 庚
  await sel('명궁 위치').selectOption('8'); // 申
  await sel('오행국').selectOption('2');
  await sel('좌보 위치').selectOption('4'); // 辰 → 정월
  await sel('문창 위치').selectOption('4'); // 辰 → 午시
  await sel('자미성 위치').selectOption('3'); // 卯
  await page.waitForSelector('.cands li');
  const head = await page.locator('.rev-result p').first().innerText();
  check('후보 개수 표시(초4·5·28·29일 → 4개)', head.includes('가능한 조합 4개'), head);
  await page.locator('.cands li').first().getByRole('button', { name: '명반 보기' }).click();
  await page.waitForSelector('.cell');
  check('후보로 명반이 열린다(기본 입력으로 전환)', (await page.locator('.input-form').count()) === 1);
  const center = await page.locator('.center').innerText();
  check('음력 월·시가 후보와 같다(1월 · 오시)', center.includes('1월') && center.includes('오시'), center);
  await ctx.close();
});

// ── 9. 팝업 ─────────────────────────────────────────────────────────────────────
await run('팝업: 글꼴·표시 옵션·만세력', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  await page.getByRole('button', { name: '글꼴 설정' }).click();
  await page.getByLabel('크게').check();
  await page.getByLabel('명조체').check();
  check('글자 크기·글꼴이 적용된다', (await page.evaluate(() => document.documentElement.dataset.fs + '/' + document.documentElement.dataset.ff)) === 'lg/serif');
  await page.keyboard.press('Escape');
  check('Esc 로 닫힌다', (await page.locator('.dialog').count()) === 0);
  await page.reload();
  await page.waitForSelector('.cell');
  check('설정이 새로고침 뒤에도 남는다(localStorage)', (await page.evaluate(() => document.documentElement.dataset.fs)) === 'lg');
  await page.getByRole('button', { name: '표시 옵션' }).click();
  await page.getByLabel('한글 + 한자').check();
  await page.getByLabel('7단계').check();
  await page.getByLabel('12신 계열 표시').check();
  await page.keyboard.press('Escape');
  const txt = await cell(page, 4).innerText();
  check('별 이름 한글+한자 병기', txt.includes('거문(巨門)'), txt);
  check('7단계 범례', (await page.locator('.legend .br').count()) === 7);
  check('12신 줄 표시', (await page.locator('.cell .twelve').count()) === 12);
  const dec = await cell(page, 0).innerText();
  check('7단계: 득/리 표기가 나온다', (await page.locator('.cell .br').allInnerTexts()).some((t) => t === '득' || t === '리'), dec);
  await page.getByRole('button', { name: '만세력' }).click();
  await page.waitForSelector('.manse');
  const manse = await page.locator('.dialog').innerText();
  check('만세력: 생일 월(1990년 1월) 표시와 소한 절기', manse.includes('소한') && manse.includes('22:33'.replace('22:33', '')), manse.slice(0, 200));
  await page.locator('.dialog select[aria-label="월"]').selectOption('2');
  const manse2 = await page.locator('.manse').innerText();
  check('1990년 2월: 입춘 11:14(한국 시각)', manse2.includes('입춘 11:14'), manse2.slice(0, 300));
  await page.screenshot({ path: `${OUT}/09-manse.png` });
  await ctx.close();
});

// ── 10. 이미지 저장·링크 복사 ───────────────────────────────────────────────────
await run('이미지 저장·링크 복사', async () => {
  const { page, ctx } = await newPage();
  await open(page);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: '이미지 저장' }).click()]);
  await download.saveAs(`${OUT}/10-exported.png`);
  const p = `${OUT}/10-exported.png`;
  const size = fs.statSync(p).size;
  check('PNG 다운로드(파일명·크기)', /^ziwei-chart-19900130\.png$/.test(download.suggestedFilename()) && size > 20000, `${download.suggestedFilename()} ${size}B`);
  const head = fs.readFileSync(p).subarray(0, 8).toString('hex');
  check('PNG 시그니처', head === '89504e470d0a1a0a', head);
  await page.getByRole('button', { name: '링크 복사' }).click();
  await page.waitForSelector('.toast');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const [beforeHash, afterHash = ''] = clip.split('#');
  check('링크에 입력값이 담긴다', afterHash.includes('y=1990') && afterHash.includes('m=1') && afterHash.includes('d=30') && afterHash.includes('h=12'), clip);
  check('입력값은 해시(#)에만 있고 쿼리·경로에는 없다(서버 접근 기록에 남지 않음)', !beforeHash.includes('1990') && !beforeHash.includes('?y='), clip);
  // 복사한 링크를 새 페이지에서 열면 같은 명반이 복원되고, 서버는 생년월일시가 든 주소를 받지 않는다
  const mark = server.seen.length;
  const page2 = await ctx.newPage();
  await page2.goto(clip);
  await page2.waitForSelector('.cell', { timeout: 10000 });
  const restored = await page2.locator('.center').innerText();
  check('링크를 열면 같은 입력의 명반이 복원된다', restored.includes('1990-01-30 12:00'), restored);
  const leaked = server.seen.slice(mark).filter((u) => /[?&](y|m|d|h)=\d/.test(u));
  check('서버가 받은 요청 주소에 생년월일시가 없다', leaked.length === 0, leaked.join(' | '));
  // 감시 장치 점검: 예전 형식(쿼리) 링크는 서버에 그대로 보인다 — 위 확인이 헛돌지 않음을 보인다
  const mark2 = server.seen.length;
  await page2.goto(`${server.url}?y=1990&m=1&d=30&h=12&g=M`);
  await page2.waitForSelector('.cell');
  check('(점검) 쿼리 형식 주소는 서버에 보인다', server.seen.slice(mark2).some((u) => u.includes('y=1990')), server.seen.slice(mark2).join(' | '));
  await ctx.close();
});

// ── 10-2. 배포 형태 ─────────────────────────────────────────────────────────────
await run('배포 형태: file:// 직접 열기 · 하위 경로(/Zamidusu/) 호스팅', async () => {
  // 정적 서버 없이 dist/index.html 을 파일로 바로 여는 경우(브라우저가 module·crossorigin 을 막는 환경)
  const { page, ctx } = await newPage();
  const fileUrl = pathToFileURL(path.resolve('dist/index.html')).href;
  await page.goto(`${fileUrl}#y=1990&m=1&d=30&h=12&g=M&cal=solar`);
  await page.waitForSelector('.cell', { timeout: 10000 });
  check('file:// 로 열어도 명반이 그려진다', (await page.locator('.cell').count()) === 12);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('file:// 에서도 스타일이 적용된다', bg === 'rgb(246, 241, 231)', bg);
  check('file:// 에서 입력값(해시)으로 명반이 열린다', (await page.locator('.center').innerText()).includes('1990-01-30 12:00'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }).catch(() => null), page.getByRole('button', { name: '이미지 저장' }).click()]);
  check('file:// 에서 이미지 저장이 된다', Boolean(dl) && dl.suggestedFilename() === 'ziwei-chart-19900130.png', dl ? dl.suggestedFilename() : '다운로드 없음');
  await ctx.close();

  // GitHub Pages 처럼 https://호스트/저장소이름/ 아래에 올린 경우
  const sub = await startSubpathServer();
  allowedOrigins.push(sub.origin);
  const c2 = await newPage();
  await c2.page.goto(`${sub.url}#y=1984&m=7&d=15&h=8&g=F&cal=solar`);
  await c2.page.waitForSelector('.cell', { timeout: 10000 });
  check('하위 경로에서도 명반이 그려진다', (await c2.page.locator('.cell').count()) === 12 && (await c2.page.locator('.center').innerText()).includes('여명'));
  await c2.ctx.close();
  await sub.stop();
});

// ── 10-3. 화면 폭별 배치(태블릿 구간 포함) ─────────────────────────────────────────
await run('화면 폭별 배치: 3열 → 2열 → 모바일 3탭, 가로 넘침 없음', async () => {
  const { page, ctx } = await newPage({ width: 1440, height: 900 });
  const box = async (sel) => (await page.locator(sel).first().boundingBox());
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const w of [1920, 1440, 1181]) {
    await page.setViewportSize({ width: w, height: 900 });
    await open(page, 'y=1990&m=1&d=30&h=12&g=M&cal=solar');
    const [i, c, sd] = [await box('.input-panel'), await box('.chart-panel'), await box('.side-panel')];
    check(`${w}px: 입력·명반·해설 3열(같은 줄, 왼쪽→오른쪽)`, Math.abs(i.y - c.y) < 4 && Math.abs(c.y - sd.y) < 4 && i.x < c.x && c.x < sd.x, JSON.stringify([i, c, sd].map((b) => [Math.round(b.x), Math.round(b.y)])));
    check(`${w}px: 가로 넘침 없음`, (await overflow()) <= 1, await overflow());
  }
  for (const w of [1180, 1024, 900, 820, 761]) {
    await page.setViewportSize({ width: w, height: 900 });
    await open(page, 'y=1990&m=1&d=30&h=12&g=M&cal=solar');
    const [i, c, sd] = [await box('.input-panel'), await box('.chart-panel'), await box('.side-panel')];
    check(`${w}px: 입력이 위, 그 아래 명반·해설 2열`, i.y + i.height <= c.y + 1 && Math.abs(c.y - sd.y) < 4 && c.x < sd.x, JSON.stringify([i, c, sd].map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.width)])));
    check(`${w}px: 명반 칸이 12개 모두 보이고 겹치지 않는다`, await page.evaluate(() => {
      const r = [...document.querySelectorAll('.cell')].map((e) => e.getBoundingClientRect());
      return r.length === 12 && r.every((a, k) => a.width > 40 && r.every((b, j) => j <= k || a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
    }));
    check(`${w}px: 가로 넘침 없음`, (await overflow()) <= 1, await overflow());
    if (w === 1024) await page.screenshot({ path: `${OUT}/14-tablet-1024.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 760, height: 900 });
  await open(page, 'y=1990&m=1&d=30&h=12&g=M&cal=solar');
  check('760px 이하: 모바일 3탭', (await page.locator('.mobile-tabs button').count()) === 3 && (await page.locator('.mobile-tabs').isVisible()));
  check('760px: 가로 넘침 없음', (await overflow()) <= 1, await overflow());
  await ctx.close();
});

// ── 10-4. 접근성(axe-core) ──────────────────────────────────────────────────────
// WCAG 2.0/2.1 A·AA 와 모범 사례 규칙을 주요 화면 상태마다 검사한다. 위반이 하나라도 있으면 실패.
await run('접근성(axe-core): 라이트·다크 × 데스크톱·모바일, 팝업·역산·시 모름 포함', async () => {
  const scan = async (page, label) => {
    await page.evaluate(AXE_SOURCE);
    const found = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
      return r.violations.map((v) => `${v.id}[${v.impact}] ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
    });
    check(`axe 위반 0건 — ${label}`, found.length === 0, found.join(' ; '));
  };
  const H = 'y=1990&m=1&d=30&h=12&g=M&cal=solar';
  for (const scheme of ['light', 'dark']) {
    const { page, ctx } = await newPage({ width: 1440, height: 1000 }, { scheme });
    await open(page, H);
    await scan(page, `${scheme} 데스크톱 · 본명+궁 해설`);
    await page.locator('details.how-to-read summary').click();
    await scan(page, `${scheme} 데스크톱 · 읽는 법 열림`);
    await page.locator('details.how-to-read summary').click();
    await page.getByRole('tab', { name: '사주 비교' }).click();
    await scan(page, `${scheme} 데스크톱 · 사주 비교`);
    await page.locator('.cmp-card details.evidence-box summary').first().click();
    await scan(page, `${scheme} 데스크톱 · 사주 비교(근거 열림)`);
    await page.getByRole('tab', { name: '궁 해설' }).click();
    for (const name of ['대한', '유년', '유시']) {
      await page.getByRole('tab', { name }).click();
      await scan(page, `${scheme} 데스크톱 · ${name} 모드`);
    }
    await page.getByRole('tab', { name: '본명' }).click();
    await page.getByRole('tab', { name: '역산 입력' }).click();
    await page.locator('.reverse label', { hasText: '명궁 위치' }).locator('select').selectOption('0');
    await page.locator('.reverse label', { hasText: '신궁 위치' }).locator('select').selectOption('1');
    await scan(page, `${scheme} 데스크톱 · 역산(모순 안내)`);
    await page.locator('.reverse label', { hasText: '신궁 위치' }).locator('select').selectOption('');
    await scan(page, `${scheme} 데스크톱 · 역산(후보 목록)`);
    await page.getByRole('tab', { name: '기본 입력' }).click();
    for (const name of ['글꼴 설정', '표시 옵션', '만세력']) {
      await page.getByRole('button', { name }).click();
      await page.waitForSelector('[role="dialog"]');
      await scan(page, `${scheme} 데스크톱 · ${name} 팝업`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[role="dialog"]', { state: 'detached' });
    }
    await page.goto('about:blank');
    await page.goto(`${server.url}#y=1990&m=1&d=30&h=&g=M&cal=solar`);
    await page.waitForSelector('.hour-unknown', { timeout: 10000 });
    await scan(page, `${scheme} 데스크톱 · 시 모름`);
    await ctx.close();
  }
  for (const scheme of ['light', 'dark']) {
    const { page, ctx } = await newPage({ width: 390, height: 844 }, { scheme, scale: 2 });
    await open(page, H);
    await scan(page, `${scheme} 모바일 · 명반 탭`);
    await page.locator('.cell[data-branch="2"]').click();
    await page.locator('.peek').click();
    await scan(page, `${scheme} 모바일 · 궁 해설 탭`);
    await page.locator('.mobile-tabs button').nth(2).click();
    await scan(page, `${scheme} 모바일 · 사주 비교 탭`);
    await ctx.close();
  }
  {
    const { page, ctx } = await newPage();
    await open(page, 'compat=1');
    await scan(page, '라이트 데스크톱 · 호환 모드');
    await ctx.close();
  }
});

// ── 11. 모바일 ──────────────────────────────────────────────────────────────────
await run('모바일(390px): 3탭, 가로 넘침 없음', async () => {
  const { page, ctx } = await newPage({ width: 390, height: 844 }, { scale: 2 });
  await open(page);
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('명반 탭: 가로 스크롤 없음', (await overflow()) <= 1, await overflow());
  check('탭 3개', (await page.locator('.mobile-tabs button').count()) === 3);
  check('명반 탭에서는 우측 패널이 숨겨진다', !(await page.locator('.side-panel').isVisible()));
  await page.screenshot({ path: `${OUT}/11-mobile-chart.png`, fullPage: true });
  await cell(page, 2).click();
  check('하단 “해설 보기” 버튼', (await page.locator('.peek').innerText()).includes('천이'));
  await page.locator('.peek').click();
  check('궁 해설 탭: 패널이 보이고 명반은 숨겨진다', (await page.locator('.side-panel').isVisible()) && !(await page.locator('.chart-panel').isVisible()));
  check('궁 해설 탭: 가로 스크롤 없음', (await overflow()) <= 1, await overflow());
  await page.screenshot({ path: `${OUT}/11-mobile-explain.png`, fullPage: true });
  await page.locator('.mobile-tabs button').nth(2).click();
  check('사주 비교 탭: 표가 보인다', await page.locator('.pillars').isVisible());
  check('사주 비교 탭: 가로 스크롤 없음', (await overflow()) <= 1, await overflow());
  await page.screenshot({ path: `${OUT}/11-mobile-saju.png`, fullPage: true });
  await page.locator('.mobile-tabs button').nth(0).click();
  await page.getByRole('button', { name: '입력 열기' }).click();
  check('입력 열기 → 폼이 보인다', await page.locator('.input-form').isVisible());
  check('입력 열린 상태 가로 스크롤 없음', (await overflow()) <= 1, await overflow());
  await ctx.close();
});

// ── 12. 호환 모드 ───────────────────────────────────────────────────────────────
await run('원본 호환 모드(?compat=1)', async () => {
  const { page, ctx } = await newPage();
  await open(page, 'compat=1');
  check('경고 띠', (await page.locator('.compat-banner').innerText()).includes('원본 호환 모드'));
  const banner = await page.locator('.compat-banner').innerText();
  check('적용된 I-01~I-04 기록', ['I-01', 'I-02', 'I-03', 'I-04'].every((i) => banner.includes(i)), banner);
  const c9 = await cell(page, 9).innerText();
  const c10 = await cell(page, 10).innerText();
  check('우필이 酉로 이동(개선판은 戌), 천형은 戌로 이동(개선판은 酉)', c9.includes('우필') && c10.includes('천형') && !c9.includes('천형'), `${c9} | ${c10}`);
  check('호환 모드 해외출생 선택지', (await page.locator('option[value="abroad"]').count()) === 1);
  await page.getByRole('tab', { name: '대한' }).click();
  await page.locator('.decades button').nth(1).click();
  const names = await Promise.all([2, 3, 4].map(async (b) => (await cell(page, b).locator('.pname').innerText()).slice(0, 2)));
  check('I-05 재현: 대한 모드 이름이 寅(명궁)부터 순행 고정', names.join(',') === '명궁,형제,부처', names.join(','));
  await page.screenshot({ path: `${OUT}/12-compat.png` });
  await ctx.close();
  const { page: p2, ctx: c2 } = await newPage();
  await open(p2);
  check('일반 화면에는 호환 모드 표시가 없다', (await p2.locator('.compat-banner').count()) === 0 && (await p2.locator('option[value="abroad"]').count()) === 0);
  await c2.close();
});

// ── 13. 다크 모드·URL 입력 ──────────────────────────────────────────────────────
await run('URL 입력값 자동 실행 · 다크 모드', async () => {
  const { page, ctx } = await newPage({ width: 1440, height: 1000 }, { scheme: 'dark' });
  await open(page, 'y=1984&m=7&d=15&h=8&mi=20&g=F&cal=solar');
  const center = await page.locator('.center').innerText();
  check('URL 의 입력값으로 명반이 열린다(여명)', center.includes('1984-07-15 08:20') && center.includes('여명'), center);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('다크 모드 배경', bg === 'rgb(20, 18, 15)', bg);
  await page.screenshot({ path: `${OUT}/13-dark.png`, fullPage: true });
  // 같은 탭에서 주소의 해시만 바꾸면(공유 링크 붙여넣기) 새로 고치지 않아도 그 입력으로 바뀐다
  await page.evaluate(() => { window.location.hash = 'y=1991&m=9&d=5&h=8&g=F&cal=solar'; });
  await page.waitForFunction(() => document.querySelector('.center')?.textContent?.includes('1991-09-05 08:00'), null, { timeout: 8000 });
  check('주소 해시 변경(hashchange)에 맞춰 명반이 바뀐다', (await page.locator('.center').innerText()).includes('여명'));
  await ctx.close();
});

await browser.close();
await server.stop();

const failed = results.filter((r) => !r.pass);
const byTest = {};
for (const r of results) {
  byTest[r.test] ??= { pass: 0, fail: 0 };
  byTest[r.test][r.pass ? 'pass' : 'fail']++;
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ total: results.length, failed: failed.length, byTest, consoleProblems, externalRequests, results }, null, 2));
if (process.env.WRITE_REPORT) {
  // 문서용 결과표(docs/generated/e2e-results.md). 평소에는 쓰지 않는다.   WRITE_REPORT=1 node e2e/run.mjs
  const lines = [
    '# 브라우저 E2E 결과 (자동 생성)',
    '',
    '`WRITE_REPORT=1 npm run e2e` 로 만든 목록입니다. 실제 Chromium 에서 사용자 흐름을 따라가며 확인한 항목입니다.',
    '',
    `- 확인 ${results.length}건 · 실패 ${failed.length}건 · 콘솔 오류/경고 ${consoleProblems.length}건 · 외부/비-GET 요청 ${externalRequests.length}건`,
    '',
  ];
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r.test)) groups.set(r.test, []);
    groups.get(r.test).push(r);
  }
  for (const [name, list] of groups) {
    lines.push(`## ${name} — ${list.filter((x) => x.pass).length}/${list.length}건`, '');
    for (const r of list) lines.push(`- ${r.pass ? '✓' : '✗'} ${r.check}`);
    lines.push('');
  }
  fs.mkdirSync('docs/generated', { recursive: true });
  fs.writeFileSync('docs/generated/e2e-results.md', lines.join('\n'));
}
console.log('\n── 결과 ──');
for (const [t, v] of Object.entries(byTest)) console.log(`${v.fail ? '✗' : '✓'} ${t}  (통과 ${v.pass}${v.fail ? `, 실패 ${v.fail}` : ''})`);
console.log(`확인 ${results.length}건 중 실패 ${failed.length}건 · 콘솔 오류/경고 ${consoleProblems.length}건 · 외부/비-GET 요청 ${externalRequests.length}건`);
if (externalRequests.length) console.log(externalRequests.slice(0, 10).join('\n'));
if (consoleProblems.length) console.log(consoleProblems.slice(0, 10).join('\n'));
process.exit(failed.length || consoleProblems.length || externalRequests.length ? 1 : 0);
