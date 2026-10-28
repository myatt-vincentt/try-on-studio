const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
const [clip, label] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${clip}`] });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5191/?input=webcam' + (process.argv[4] ? '&' + process.argv[4] : ''));
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon, null, { timeout: 120000 });
  await page.evaluate(() => window.__tryon.actions.pick(0, 0));
  await page.waitForTimeout(3000);
  const log = await page.evaluate(async () => {
    const out = []; let prev = JSON.stringify(window.__tryon.get().look); const t0 = performance.now();
    while (performance.now() - t0 < 16000) {
      await new Promise((r) => setTimeout(r, 30));
      const s = JSON.stringify(window.__tryon.get().look);
      if (s !== prev) { out.push(((performance.now() - t0) / 1000).toFixed(2) + 's ' + s); prev = s; }
    }
    return out;
  });
  console.log(label, log.length, 'changes'); log.forEach((l) => console.log('  ', l));
  await page.screenshot({ path: `${__dirname}/shot-${label}.png` });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
