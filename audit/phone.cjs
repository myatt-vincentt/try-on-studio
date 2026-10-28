const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${process.argv[2]}`] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, permissions: ['camera'], hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5191/?input=webcam');
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon, null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  // Measure the HUD's edges.
  const box = await page.evaluate(() => [...document.querySelectorAll('.ts-row')].map((r) => { const b = r.getBoundingClientRect(); return [Math.round(b.left), Math.round(375 - b.right), Math.round(b.width)]; }));
  console.log('rows [left margin, right margin, width]', JSON.stringify(box));
  const dots = await page.evaluate(() => { const b = document.querySelector('.ts-dot').getBoundingClientRect(); return [b.width, b.height]; });
  console.log('dot target', dots);
  // Drag across the screen (mouse) → next item.
  await page.mouse.move(300, 400); await page.mouse.down(); await page.mouse.move(150, 405, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500);
  console.log('after drag left', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  await page.mouse.move(100, 400); await page.mouse.down(); await page.mouse.move(260, 398, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500);
  console.log('after drag right', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  // A short tap on the canvas doesn't flip.
  await page.mouse.click(200, 300); await page.waitForTimeout(300);
  console.log('after tap', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  // Tap the third dot, the face chip, then shuffle and reset.
  await page.locator('.ts-dot').nth(2).click(); console.log('dot 3', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  await page.locator('.ts-chip').nth(1).click(); console.log('face chip', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  await page.getByLabel('Shuffle').click(); console.log('shuffle', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  await page.waitForTimeout(5000); await page.screenshot({ path: `${__dirname}/v-phone-full.png` });
  await page.getByLabel('Reset').click(); console.log('reset', JSON.stringify(await page.evaluate(() => window.__tryon.get().look)));
  await page.waitForTimeout(1000); await page.screenshot({ path: `${__dirname}/v-phone-reset.png` });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
