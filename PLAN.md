# Plan — Try-On Studio

Build a look one slot at a time with the vincentt.studio head accessories, on SDK 2.0.0-alpha.9's
head fit and occluders.

## Decisions (from the creator)

- Three slots: hat, face (eyes / mask / goggles), mouth / beard. Eight hand-picked items each
  (`src/tryon/catalog.ts`).
- Air swipe to flip items and pinch to lock a slot, with tap controls too. Shuffle and reset. No
  photo capture. Starts empty.
- No text on screen; controls in the lower middle; Night glass camera UI (Cypress glass, Arles
  accent, strict ease-out).

## How it works

- `look.ts` (pure, tested): the active slot, the item worn per slot and the locks. Swiping flips
  the active slot (from empty, the first or last item); a pinch locks it and moves on.
- `swipe.ts` (pure, tested): a quick, mostly sideways sweep of the palm within 350 ms fires once;
  a sweep back the other way within 1 s is ignored (a wave flips one way, not back and forth); a
  newly seen hand settles 250 ms first.
- `HandInput.tsx` (hand model 12 Hz): one hand at a time, by the SDK's stable left / right
  identity, fresh detections only. The palm feeds the swipe; a pinch locks when held for 2
  detections, not a fist (fingers' mean curl ≤ 0.5), not two hands together (clapping), not just
  after a swipe. `HandCutout` keeps hands in front of the items.
- `TouchSwipe.tsx`: a drag across the screen flips too (mouse as well).
- `FilteredHead.tsx`: a `FaceTracker` (1 face, 20 Hz) runs the SDK's canonical head fit raw
  (`useCanonicalHeadFit`, no smoothing) into `HeadFilter`; the filtered pose drives one group drawn
  straight into the scene, holding both the depth-only v3 head occluder and the items, so they
  can't drift apart. The SDK's `NeckOccluder` (bust) sits in the tracker.
- `headFilter.ts` (pure, tested): a critically damped spring chasing the fit every frame, its
  stiffness rising with head speed — calm at rest, quick in a turn, smooth in position and
  velocity, frame-rate independent. Tuned offline (`audit/grid.cjs`) on recorded fits.
- `Accessories.tsx`: the worn items. The models are in metres in the Spark AR reference's face
  frame, so one group (×100, then (0, −1.03, +7.30) cm) puts them in the canonical head frame — the
  shift the SDK used for its own Spark-based meshes. Each item loops the clips its author marked
  autoplay, pops in about its own middle (ease-out), plays its burst on lock and its wobble on a
  head shake. A `BodyTracker` + `ShoulderOccluder` run only while something hangs below the head
  (the flower crown's ribbons).
- `rig.ts` (pure, tested): the models' `face_triggers` (node moves, morphs, clip speeds and
  weights) driven by smoothed blendshapes.
- Draw order: face and mouth items before the neck and shoulder occluders (body and face depth
  come from different trackers, so a beard on the chest would be cut), hats after them (their
  ribbons hang behind the body). The gold grill sits inside the mouth, which the rigid head
  occluder never opens, so it draws before the occluder and shows only while the mouth is open or
  smiling.
- `Hud.tsx`: the item reel — pictures of the active slot's items (rendered from the models by
  `tools/render-thumbs.cjs`, cropped to fill), the worn one large in the middle, two either side
  (tap to wear, tap the middle to take off) — and the slot chips, each showing what's worn there.
  Dots were read as a colour picker; pictures say what you're choosing.
- Dev only: `DevKeys.tsx` (keyboard, `window.__tryon` with the audit probe), `DevMediaSwitcher.tsx`,
  `?occ` (draw the occluders), `?facefps=` / `?handfps=` (tracker rates).

## Audit (2026-10-28)

Headless Chrome, fake webcam, `audit/` scripts. Before → after:

- Frame rate (moving head): 25 → 50–57 fps on desktop; 18 → 38–42 fps with the CPU slowed 4×
  (phone-class). The hand model was the biggest cost (20 → 12 Hz: 22 → 36 fps throttled); body
  tracking now runs only for the flower crown. The remaining long frames are face / hand
  inference (MediaPipe waits on the GPU inside the frame).
- Fit wobble on a moving head: 5.4 → 1.0–1.2 px at the nose, 4.3 → 0.6 px at the crown, rotation
  2.5° → 0.7° per frame. Still head: 1.9× calmer than the SDK's own smoothing.
- Interaction: a wave no longer flips back and forth; clapping no longer locks; the OK-sign pinch
  still locks; drags, taps, chips, shuffle and reset all checked at 375×812; both control rows
  ≥ 48 px from the edges.
