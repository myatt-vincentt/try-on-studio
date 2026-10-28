const { execSync } = require('child_process');
const { HeadFilter, HEAD_FILTER } = require('./headFilter.cjs');
const { Vector3, Quaternion } = require('three');
const CROWN = new Vector3(0, 13.26, -3.76);
const pt = (P) => CROWN.clone().applyQuaternion(P.quaternion).multiplyScalar(P.scale).add(P.position);
const toPose = (a) => ({ position: new Vector3(a[0], a[1], a[2]), quaternion: new Quaternion(a[3], a[4], a[5], a[6]), scale: a[7] });
const load = (name) => { const S = require(`./samples-${name}.json`); const raw = require(`./fits-${name}.json`).map(([t, ...p]) => ({ t, p })); return { frames: S.map((s) => s.t / 1000), raw }; };
const evalOne = ({ frames, raw }, mode, cfg) => {
  const scale = raw[0].p[7]; const rc = raw.map((r) => pt(toPose(r.p)));
  const ref = rc.map((_, i) => { const a = []; for (let k = -2; k <= 2; k++) if (rc[i + k]) a.push(rc[i + k]); return a.reduce((s, v) => s.add(v), new Vector3()).divideScalar(a.length); });
  const refAt = (t) => { if (t <= raw[0].t) return ref[0].clone(); for (let i = 1; i < raw.length; i++) if (raw[i].t >= t) { const k = (t - raw[i - 1].t) / (raw[i].t - raw[i - 1].t); return ref[i - 1].clone().lerp(ref[i], k); } return ref[ref.length - 1].clone(); };
  const f = new HeadFilter({ ...HEAD_FILTER, ...cfg }); const out = { position: new Vector3(), quaternion: new Quaternion(), scale: 1 };
  let j = 0, ema = null, last = null; const res = [];
  for (const T of frames) {
    while (j < raw.length && raw[j].t <= T) { f.update(raw[j].t, toPose(raw[j].p)); j++; }
    if (!j) continue; const dt = last === null ? 1 / 60 : T - last; last = T; let P;
    if (mode === 'ema') { const cur = toPose(raw[j - 1].p); if (!ema) ema = cur; else { ema.position.lerp(cur.position, 0.5); ema.quaternion.slerp(cur.quaternion, 0.5); ema.scale += (cur.scale - ema.scale) * 0.5; } P = ema; }
    else P = f.sample(T, out);
    res.push({ T, c: pt(P) });
  }
  const cm = (v) => v / scale; const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const err = mean(res.map((r) => cm(r.c.distanceTo(refAt(r.T)))));
  const rough = mean(res.slice(2).map((r, i) => cm(r.c.clone().sub(res[i + 1].c).sub(res[i + 1].c.clone().sub(res[i].c)).length())));
  let best = { L: 0, e: Infinity }; for (let L = -0.1; L <= 0.2; L += 0.005) { let e = 0; res.forEach((r) => { e += r.c.distanceToSquared(refAt(r.T - L)); }); if (e < best.e) best = { L, e }; }
  return { err, rough, lag: best.L * 1000 };
};
// Every recorded run: labels with "motion" are moving heads, "noisy" still ones.
const runs = require('fs').readdirSync(__dirname).filter((f) => /^fits-.*\.json$/.test(f)).map((f) => f.slice(5, -5));
const motion = runs.filter((r) => r.includes('motion')).map(load);
const still = runs.filter((r) => r.includes('noisy')).map(load);
const avg = (sets, mode, cfg) => { const r = sets.map((d) => evalOne(d, mode, cfg)); const m = (k) => r.reduce((s, x) => s + x[k], 0) / r.length; return { err: m('err'), rough: m('rough'), lag: m('lag') }; };
const fmt = (n, m, s) => `${n.padEnd(40)} motion err ${m.err.toFixed(3)} rough ${m.rough.toFixed(4)} lag ${m.lag.toFixed(0).padStart(3)} | still rough ${s.rough.toFixed(4)}`;
console.log(fmt('SDK EMA 0.5', avg(motion, 'ema'), avg(still, 'ema')));
const grid = [];
for (const wMin of [14, 18, 24, 30]) for (const wMax of [45, 70, 90]) for (const wPerSpeed of [1, 2, 4]) grid.push({ wMin, wMax, wPerSpeed });
const rows = grid.map((c) => ({ c, m: avg(motion, 'f', c), s: avg(still, 'f', c) }));
const ema = { m: avg(motion, 'ema'), s: avg(still, 'ema') };
rows.filter((r) => r.s.rough <= ema.s.rough * 0.7).sort((a, b) => (a.m.rough / ema.m.rough + a.m.lag / ema.m.lag) - (b.m.rough / ema.m.rough + b.m.lag / ema.m.lag)).slice(0, 12).forEach((r) => console.log(fmt(JSON.stringify(r.c), r.m, r.s)));
console.log('-- current'); console.log(fmt('current', avg(motion, 'f', {}), avg(still, 'f', {})));
