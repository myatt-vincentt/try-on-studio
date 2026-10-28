// Fit / FPS audit for Try-On Studio. Usage:
//   node run.cjs <clip.y4m> <label> [cpuThrottle=1] [query=""] [picks="0,0,0"]
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
const [clip, label, throttle = '1', query = '', picks = '0,0,0', cfg = ''] = process.argv.slice(2);

const stats = (a) => {
  const n = a.length; if (!n) return { mean: NaN, sd: NaN };
  const mean = a.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { mean, sd };
};
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${clip}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/__harness|XNNPACK/.test(m.text())) errors.push(m.text()); });
  if (+throttle > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle }); }
  await page.goto(`http://localhost:5191/?input=webcam${query ? '&' + query : ''}`);
  await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon && window.__tryon.probe, null, { timeout: 120000 });
  const p = picks.split(',').map(Number);
  await page.evaluate((p) => { p.forEach((i, s) => { if (i >= 0) window.__tryon.actions.pick(s, i); }); }, p);
  if (cfg) await page.evaluate((c) => { c.split(',').forEach((kv) => { const [k, v] = kv.split(':'); window.__tryon.filter[k] = +v; }); }, cfg);
  await page.waitForTimeout(5000);
  await page.evaluate(() => { window.__tryon.probe.samples.length = 0; window.__tryon.probe.on = true; window.__tryon.filterStats.log.length = 0; window.__tryon.filterStats.record = true; });
  await page.waitForTimeout(6000);
  const S = await page.evaluate(() => { window.__tryon.probe.on = false; return window.__tryon.probe.samples; });
  const FL = await page.evaluate(() => { window.__tryon.filterStats.record = false; return window.__tryon.filterStats.log; });
  require('fs').writeFileSync(`${__dirname}/samples-${label}.json`, JSON.stringify(S));
  require('fs').writeFileSync(`${__dirname}/fits-${label}.json`, JSON.stringify(FL));
  await page.screenshot({ path: `${__dirname}/shot-${label}.png` });
  await browser.close();

  const dts = S.slice(1).map((s, i) => s.t - S[i].t);
  const dur = (S[S.length - 1].t - S[0].t) / 1000;
  const fit = S.filter((s) => s.nose && s.lm);
  const faceRate = (S[S.length - 1].faceTick - S[0].faceTick) / dur;
  // Jitter: frame-to-frame motion that isn't the head's — residual from a
  // centred 9-frame moving average.
  const resid = (key) => {
    const out = [];
    for (let i = 4; i < fit.length - 4; i++) {
      let mx = 0, my = 0;
      for (let k = -4; k <= 4; k++) { mx += fit[i + k][key][0]; my += fit[i + k][key][1]; }
      mx /= 9; my /= 9;
      out.push(Math.hypot(fit[i][key][0] - mx, fit[i][key][1] - my));
    }
    return out;
  };
  const step = (key) => fit.slice(1).map((s, i) => Math.hypot(s[key][0] - fit[i][key][0], s[key][1] - fit[i][key][1]));
  // Rotation jitter: angle between consecutive frames' quaternions (deg).
  const qstep = fit.slice(1).map((s, i) => { const a = s.q, b = fit[i].q; const d = Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; });
  const err = fit.map((s) => Math.hypot(s.nose[0] - s.lm[0], s.nose[1] - s.lm[1]));
  // Lag: shift (frames) of the fitted nose x that best matches the tracker's.
  let best = { lag: 0, e: Infinity };
  for (let L = 0; L <= 12; L++) {
    let e = 0, n = 0;
    for (let i = L; i < fit.length; i++) { e += (fit[i].nose[0] - fit[i - L].lm[0]) ** 2; n++; }
    e /= n; if (e < best.e) best = { lag: L, e };
  }
  const meanDt = stats(dts).mean;
  // Against the raw (unfiltered) fit — same data, same timing.
  const rf = fit.filter((s) => s.raw);
  let bestRaw = { lag: 0, e: Infinity };
  for (let L = -8; L <= 12; L++) {
    let e = 0, n = 0;
    for (let i = Math.max(0, L); i < rf.length && i - L < rf.length; i++) { if (i - L < 0) continue; e += (rf[i].nose[0] - rf[i - L].raw[0]) ** 2; n++; }
    e /= n; if (e < bestRaw.e) bestRaw = { lag: L, e };
  }
  const rawErr = rf.map((s) => Math.hypot(s.nose[0] - s.raw[0], s.nose[1] - s.raw[1]));
  const rawStep = rf.slice(1).map((s, i) => Math.hypot(s.raw[0] - rf[i].raw[0], s.raw[1] - rf[i].raw[1]));
  const r = {
    label, throttle: +throttle, frames: S.length, seconds: +dur.toFixed(1),
    fps: +(S.length / dur).toFixed(1), frameMsP50: +pct(dts, 0.5).toFixed(1), frameMsP95: +pct(dts, 0.95).toFixed(1), over33ms: +(dts.filter((d) => d > 33.4).length / dts.length * 100).toFixed(1) + '%',
    faceUpdatesPerSec: +faceRate.toFixed(1), fitSeen: +(fit.length / S.length * 100).toFixed(0) + '%',
    noseStepPx: +stats(step('nose')).mean.toFixed(2), crownStepPx: +stats(step('crown')).mean.toFixed(2),
    noseJitterPx: +stats(resid('nose')).mean.toFixed(2), crownJitterPx: +stats(resid('crown')).mean.toFixed(2),
    rotStepDeg: +stats(qstep).mean.toFixed(3), rotStepP95Deg: +pct(qstep, 0.95).toFixed(3),
    noseErrPx: +stats(err).mean.toFixed(1), lagMs: Math.round(best.lag * meanDt),
    rawLagMs: Math.round(bestRaw.lag * meanDt), rawErrPx: +stats(rawErr).mean.toFixed(2), rawStepPx: +stats(rawStep).mean.toFixed(2),
    drawCalls: pct(S.map((s) => s.calls), 0.5), tris: pct(S.map((s) => s.tris), 0.5),
    errors: errors.slice(0, 5),
  };
  console.log(JSON.stringify(r));
})().catch((e) => { console.error(e); process.exit(1); });
