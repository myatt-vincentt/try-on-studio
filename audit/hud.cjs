// HUD check at phone size: margins, the item reel and every tap path, with
// screenshots. node audit/hud.cjs <clip.y4m>
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${process.argv[2]}`] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, permissions: ['camera'], hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/__harness|XNNPACK/.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push('failed ' + r.url().replace(/.*\//, '') + ' ' + r.failure().errorText));
  page.on('response', (r) => { if (r.status() >= 400 && !/__harness/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
  await page.goto('http://localhost:5191/?input=webcam');
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  const look = () => page.evaluate(() => JSON.stringify(window.__tryon.get().look));
  const rows = await page.evaluate(() => ['.ts-reel', '.ts-row'].map((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return `${sel} left ${Math.round(b.left)} right ${Math.round(375 - b.right)} w ${Math.round(b.width)} h ${Math.round(b.height)}`; }));
  console.log(rows.join(' | '));
  await page.screenshot({ path: `${__dirname}/hud-1-empty.png` });
  await page.locator('.ts-tile').nth(3).click(); console.log('tap right tile', await look());
  await page.waitForTimeout(3500); await page.screenshot({ path: `${__dirname}/hud-2-first.png` });
  await page.locator('.ts-tile').nth(4).click(); console.log('tap far right', await look());
  await page.locator('.ts-tile').nth(1).click(); console.log('tap left', await look());
  await page.locator('.ts-tile.mid').click(); console.log('tap middle (take off)', await look());
  await page.locator('.ts-tile').nth(0).click(); console.log('tap far left', await look());
  await page.locator('.ts-chip').nth(1).click(); console.log('face chip', await look());
  await page.locator('.ts-tile').nth(3).click(); await page.locator('.ts-chip').nth(2).click(); await page.locator('.ts-tile').nth(3).click();
  await page.evaluate(() => window.__tryon.actions.lock());
  console.log('after face+mouth+lock', await look());
  await page.waitForTimeout(4000); await page.screenshot({ path: `${__dirname}/hud-3-dressed.png` });
  const names = await page.evaluate(() => [...document.querySelectorAll('.ts-tile, .ts-chip')].map((b) => b.getAttribute('aria-label')));
  console.log('labels', names.join(', '));
  console.log('errors', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
