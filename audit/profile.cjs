const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
const [clip, throttle = '4', picks = '0,0,0'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${clip}`] });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto('http://localhost:5191/?input=webcam');
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon, null, { timeout: 120000 });
  await page.evaluate((p) => p.split(',').map(Number).forEach((i, s) => { if (i >= 0) window.__tryon.actions.pick(s, i); }), picks);
  await page.waitForTimeout(4000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start'); await page.waitForTimeout(5000);
  const { profile } = await cdp.send('Profiler.stop');
  await browser.close();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map(); const dts = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const n = byId.get(id); const d = dts[i] || 0; total += d; const f = n.callFrame; const url = (f.url || '').replace(/.*\//, '').replace(/\?.*/, ''); const key = `${f.functionName || '(anon)'} @ ${url}:${f.lineNumber}`; self.set(key, (self.get(key) || 0) + d); });
  // Group by file too.
  const byFile = new Map(); for (const [k, v] of self) { const file = k.split(' @ ')[1].replace(/:\d+$/, ''); byFile.set(file, (byFile.get(file) || 0) + v); }
  const pct = (v) => (v / total * 100).toFixed(1) + '%';
  console.log('total ms', (total / 1000).toFixed(0));
  console.log('-- by file'); [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(pct(v).padStart(7), k || '(native)'));
  // Callers of readPixels: walk up parents.
  const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const chains = new Map();
  profile.samples.forEach((id, i) => { const n = byId.get(id); if (n.callFrame.functionName !== 'readPixels') return; const c = []; let p = parent.get(id); while (p && c.length < 7) { const f = byId.get(p).callFrame; c.push(`${f.functionName || '(anon)'}@${(f.url || '').replace(/.*\//, '').replace(/\?.*/, '')}:${f.lineNumber}`); p = parent.get(p); } const k = c.join(' < '); chains.set(k, (chains.get(k) || 0) + (dts[i] || 0)); });
  console.log('-- readPixels callers'); [...chains].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => console.log(pct(v).padStart(7), k));
  console.log('-- by function'); [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(pct(v).padStart(7), k));
})().catch((e) => { console.error(e); process.exit(1); });
