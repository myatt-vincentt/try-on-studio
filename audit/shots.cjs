const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
const clip = process.argv[2];
const sets = [
  ['occ-0', 'occ', [0, 0, 0]], ['occ-boho', 'occ', [7, 7, 3]],
  ['look-a', '', [3, 5, 2]], ['look-b', '', [7, 7, 3]], ['look-c', '', [6, 4, 3]], ['look-d', '', [1, 1, 5]], ['look-e', '', [2, 3, 4]], ['look-f', '', [5, 6, 6]],
];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${clip}`] });
  for (const [name, q, picks] of sets) {
    const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, permissions: ['camera'] });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5191/?input=webcam' + (q ? '&' + q : ''));
    await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon, null, { timeout: 120000 });
    await page.evaluate((p) => p.forEach((i, s) => window.__tryon.actions.pick(s, i)), picks);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${__dirname}/v-${name}.png` });
    await ctx.close(); console.log(name);
  }
  // Phone size HUD.
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5191/?input=webcam');
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon, null, { timeout: 120000 });
  await page.waitForTimeout(3000); await page.screenshot({ path: `${__dirname}/v-phone-empty.png` });
  await page.evaluate(() => { window.__tryon.actions.step(1); }); await page.waitForTimeout(3000); await page.screenshot({ path: `${__dirname}/v-phone-hint2.png` });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
