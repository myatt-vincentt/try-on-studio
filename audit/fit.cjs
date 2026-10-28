// Fit review: every item on every clip, cropped to the face, tiled into one
// sheet per slot (rows = items, columns = clips). Optional live fit
// overrides: FIT='{"cowboy-hat":{"y":-1}}'.
//   node audit/fit.cjs <out-dir> <clip.y4m> [<clip.y4m> …]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.env.PLAYWRIGHT_FROM || __dirname] }));
const [out, ...clips] = process.argv.slice(2);
const FIT = JSON.parse(process.env.FIT || '{}');
const W = 220; const H = 240;
fs.mkdirSync(out, { recursive: true });

(async () => {
  for (const [ci, clip] of clips.entries()) {
    const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${clip}`] });
    const page = await (await browser.newContext({ viewport: { width: 540, height: 960 }, permissions: ['camera'] })).newPage();
    await page.goto('http://localhost:5191/?input=webcam');
    await page.waitForFunction(() => document.documentElement.dataset.experience === 'ready' && window.__tryon && window.__tryon.slots, null, { timeout: 120000 });
    await page.evaluate((fit) => {
      window.__tryon.slots.forEach((s) => s.items.forEach((it) => { if (fit[it.id]) it.fit = { ...(it.fit || {}), ...fit[it.id] }; }));
      window.__tryon.probe.on = true;
    }, FIT);
    const slots = await page.evaluate(() => window.__tryon.slots.map((s) => s.items.map((i) => i.id)));
    for (const [s, ids] of slots.entries()) {
      for (const [i, id] of ids.entries()) {
        await page.evaluate(([s, i]) => { window.__tryon.actions.reset(); window.__tryon.actions.pick(s, i); }, [s, i]);
        await page.evaluate(() => { window.__tryon.probe.samples.length = 0; });
        await page.waitForTimeout(1800);
        const box = await page.evaluate(([W, H]) => {
          const S = window.__tryon.probe.samples.slice(-10).filter((x) => x.nose && x.crown);
          window.__tryon.probe.samples.length = 0;
          if (S.length < 3) return null;
          const med = (f) => S.map(f).sort((a, b) => a - b)[S.length >> 1];
          const nx = med((x) => x.nose[0]); const ny = med((x) => x.nose[1]);
          const cx = med((x) => x.crown[0]); const cy = med((x) => x.crown[1]);
          const d = Math.hypot(nx - cx, ny - cy);
          // Head and hat: from well above the crown to below the chin.
          const h = 3.4 * d; const w = h * (W / H);
          return { x: nx - w / 2, y: cy - 1.25 * d, width: w, height: h };
        }, [W, H]);
        const file = path.join(out, `${s}-${i}-${ci}.png`);
        if (box) await page.screenshot({ path: file, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 540 - Math.max(0, box.x)), height: Math.min(box.height, 960 - Math.max(0, box.y)) } });
        else await page.screenshot({ path: file, clip: { x: 120, y: 80, width: 300, height: 360 } });
      }
    }
    await browser.close();
    console.log('clip', ci, 'done');
  }
  // One sheet per slot: 8 rows × clips columns.
  const slotsN = 3; const items = 8;
  for (let s = 0; s < slotsN; s++) {
    const inputs = []; const scaled = [];
    for (let i = 0; i < items; i++) for (let c = 0; c < clips.length; c++) { inputs.push('-i', path.join(out, `${s}-${i}-${c}.png`)); scaled.push(`[${inputs.length / 2 - 1}]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x222222[v${inputs.length / 2 - 1}]`); }
    const n = items * clips.length;
    const layout = Array.from({ length: n }, (_, k) => `${(k % clips.length) * W}_${Math.floor(k / clips.length) * H}`).join('|');
    const filter = `${scaled.join(';')};${Array.from({ length: n }, (_, k) => `[v${k}]`).join('')}xstack=inputs=${n}:layout=${layout}`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, path.join(out, `sheet-${s}.png`)]);
  }
  console.log('sheets in', out);
})().catch((e) => { console.error(e); process.exit(1); });
