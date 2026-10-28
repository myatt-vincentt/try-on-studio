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
- `swipe.ts` (pure, tested): a quick, mostly sideways sweep of the palm within 350 ms fires once,
  then rests so the hand coming back doesn't count.
- `HandInput.tsx`: the palm feeds the swipe; a pinch (with hysteresis, ignored just after a
  swipe) locks. `HandCutout` keeps hands in front of the items.
- `Accessories.tsx`: `HeadBinding` (face tracker + the v3 head occluder + the neck bust) and a
  `CanonicalHeadFrame` holding the worn items. The models are in metres in the Spark AR
  reference's face frame, so one group (×100, then (0, −1.03, +7.30) cm) puts them in the canonical
  head frame — the shift the SDK used for its own Spark-based meshes. A `BodyTracker` fits the
  shoulder occluder. Each item loops the clips its author marked autoplay, pops in (ease-out),
  plays its burst on lock and its wobble on a head shake.
- `rig.ts` (pure, tested): the models' `face_triggers` (node moves, morphs, clip speeds and
  weights) driven by smoothed blendshapes.
- Draw order: face and mouth items before the neck and shoulder occluders (body and face depth
  come from different trackers, so a beard on the chest would be cut), hats after them (their
  ribbons hang behind the body). The gold grill sits inside the mouth, which the rigid head
  occluder never opens, so it draws before the occluder and shows only while the mouth is open or
  smiling.
- Both head fits share `FIT_SMOOTHING` (0.3) so the items and the occluder move together.
- Dev only: `DevKeys.tsx` (keyboard, `window.__tryon`), `DevMediaSwitcher.tsx`, `?occ`.
