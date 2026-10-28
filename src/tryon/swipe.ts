// Air swipe — pure, unit-tested (swipe.test.ts).
//
// Feed it the hand's screen position every frame (fractions of the width and
// height, as the person sees themselves) or `null` when no hand is seen. A
// quick, mostly sideways sweep fires once: −1 for a sweep to the screen's
// left, +1 to the right. Then it rests for a moment so the hand coming back
// doesn't count as a swipe the other way.

export type SwipeConfig = {
  /** How far the hand must travel, as a fraction of the screen width. */
  distance: number;
  /** …within this many milliseconds. */
  window: number;
  /** Sideways travel must beat vertical travel by this factor. */
  straightness: number;
  /** Rest after a swipe (ms). */
  cooldown: number;
};

export const SWIPE: SwipeConfig = {
  distance: 0.16,
  window: 350,
  straightness: 1.6,
  cooldown: 550,
};

type Sample = { t: number; x: number; y: number };

export type SwipeState = { samples: Sample[]; restUntil: number };

export const swipeState = (): SwipeState => ({ samples: [], restUntil: 0 });

/** Add a sample; returns −1 / +1 when a swipe fires, else 0. */
/* eslint-disable no-param-reassign -- the state is the detector's own scratch memory */
export const feedSwipe = (
  s: SwipeState,
  t: number,
  p: { x: number; y: number } | null,
  cfg: SwipeConfig = SWIPE,
): -1 | 0 | 1 => {
  if (!p) {
    s.samples.length = 0;
    return 0;
  }
  s.samples.push({ t, x: p.x, y: p.y });
  while (s.samples.length && t - s.samples[0].t > cfg.window) s.samples.shift();
  if (t < s.restUntil) return 0;
  // Compare against the furthest point in the window, so a sweep that
  // started inside the window counts even after it slows down.
  const from = s.samples.reduce((a, q) =>
    Math.abs(p.x - q.x) > Math.abs(p.x - a.x) ? q : a,
  );
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  if (Math.abs(dx) < cfg.distance) return 0;
  if (Math.abs(dx) < Math.abs(dy) * cfg.straightness) return 0;
  s.samples.length = 0;
  s.restUntil = t + cfg.cooldown;
  return dx > 0 ? 1 : -1;
};
/* eslint-enable no-param-reassign */
