const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${process.argv[2]}`] });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5191/?input=webcam');
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon && window.__tryon.measure, null, { timeout: 120000 });
  await page.evaluate(() => window.__tryon.actions.pick(0, 0));
  let n = 0; const t0 = Date.now();
  while (Date.now() - t0 < 16000 && n < 3) {
    const hit = await page.evaluate(async () => {
      const before = JSON.stringify(window.__tryon.get().look.locked);
      const log = []; let last = -1; const t = performance.now();
      while (performance.now() - t < 2000) {
        await new Promise((r) => setTimeout(r, 20));
        const nd = window.__tryon.handNode(); const p = nd && nd.poses && (nd.poses.right || nd.poses.left);
        if (p && !p.held && p.timestampMs !== last) { last = p.timestampMs; log.push([+window.__tryon.measure.pinch(p.image).toFixed(2), +window.__tryon.measure.grab(p.image).toFixed(2)]); }
        if (JSON.stringify(window.__tryon.get().look.locked) !== before) return log.slice(-5);
      }
      return null;
    });
    if (hit) { await page.screenshot({ path: `${__dirname}/lock-${n}.png` }); console.log('lock', n, 'last [pinch, grab]:', JSON.stringify(hit)); n++; await page.evaluate(() => window.__tryon.actions.reset() || window.__tryon.actions.pick(0, 0)); }
  }
  await browser.close();
})();
