# Fit, frame-rate and interaction audit

Dev tooling, not part of the app. Each script drives headless Chrome (GPU on) against the running
dev server (`PORT=5191 pnpm dev`) with a fake webcam fed from a `.y4m` clip, and reads the
dev-only probe in `src/tryon/DevKeys.tsx` (`window.__tryon`).

Needs `@playwright/test` and Chrome. Point `PLAYWRIGHT_FROM` at any folder whose
`node_modules` has it (e.g. the SDK checkout).

## Clips

Not committed (each ~190 MB). Make them with ffmpeg from any clip, 540×960, 30 fps:

```
ffmpeg -i face.mp4 -t 8 -r 30 -vf "scale=540:960,format=yuv420p" motion.y4m
ffmpeg -ss 1 -i face.mp4 -frames:v 1 still.png
ffmpeg -loop 1 -i still.png -t 8 -r 30 -vf "scale=540:960,noise=alls=10:allf=t,format=yuv420p" noisy.y4m
```

Used for the 2026-10-28 audit: the SDK sample `person_shaking_head.mp4` (motion, and a still frame
of it with sensor noise), and the SDK example's `hand_palms_waving.mp4`, `hand_fists_fighting.mp4`
(clapping) and `hand_ok_sign.mp4`.

## Scripts

- `run.cjs <clip.y4m> <label> [cpuThrottle] [query] [picks] [filterCfg]` — frame rate, frame-time
  percentiles, face rate, fit wobble (screen px, rotation per frame), draw calls; writes
  `samples-<label>.json` and the filter's raw input `fits-<label>.json`.
- `grid.cjs` — replays recorded `fits-*.json` through `HeadFilter` settings offline (needs
  `npx esbuild src/tryon/headFilter.ts --bundle --platform=node --format=cjs --outfile=audit/headFilter.cjs`)
  and compares error, roughness and lag with the SDK's per-frame smoothing.
- `hands.cjs <clip> <label> [query]` — every look change over 16 s (swipes, locks).
- `lockshot.cjs <clip>` — screenshots and pinch/grab readings at each lock.
- `phone.cjs <clip>` — HUD margins at 375×812 and every tap / drag path.
- `shots.cjs <clip>` — fit and occlusion screenshots (`?occ`) and looks.
- `profile.cjs <clip> [cpuThrottle]` — CPU profile by file / function.
