// Air swipe — pure, unit-tested (swipe.test.ts).
//
// Feed it one hand's screen position at each new detection (fractions of the
// width and height, as the person sees themselves), or `null` when that hand
// is gone. A quick, mostly sideways sweep fires once: −1 for a sweep to the
// screen's left, +1 to the right. Then:
//   - it rests briefly before another swipe either way, and
//   - for a little longer it ignores a sweep back the other way, so the hand
//     returning to where it started (or a waving hand) doesn't flip back.
// A hand that has just appeared settles first: coming into view at the edge
// of the frame reads as a fast sideways move.

export type SwipeConfig = {
  /** How far the hand must travel, as a fraction of the screen width. */
  distance: number;
  /** …within this many milliseconds. */
  window: number;
  /** Sideways travel must beat vertical travel by this factor. */
  straightness: number;
  /** Rest after a swipe (ms). */
  cooldown: number;
  /** How long a sweep back the opposite way is ignored (ms). */
  returnBlock: number;
  /** A newly seen hand is watched this long before it can swipe (ms). */
  settle: number;
};

export const SWIPE: SwipeConfig = {
  distance: 0.16,
  window: 350,
  straightness: 1.6,
  cooldown: 450,
  returnBlock: 1000,
  settle: 250,
};

type Sample = { t: number; x: number; y: number };

export type SwipeState = {
  samples: Sample[];
  restUntil: number;
  /** The last swipe's direction and when its return block ends. */
  last: { dir: -1 | 1; until: number } | null;
  /** When the current hand was first seen (−1 = no hand). */
  since: number;
};

export const swipeState = (): SwipeState => ({
  samples: [],
  restUntil: 0,
  last: null,
  since: -1,
});

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
    s.since = -1;
    return 0;
  }
  if (s.since < 0) s.since = t;
  s.samples.push({ t, x: p.x, y: p.y });
  while (s.samples.length && t - s.samples[0].t > cfg.window) s.samples.shift();
  if (t < s.restUntil || t - s.since < cfg.settle) return 0;
  // Compare against the furthest point in the window, so a sweep that
  // started inside the window counts even after it slows down.
  const from = s.samples.reduce((a, q) =>
    Math.abs(p.x - q.x) > Math.abs(p.x - a.x) ? q : a,
  );
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  if (Math.abs(dx) < cfg.distance) return 0;
  if (Math.abs(dx) < Math.abs(dy) * cfg.straightness) return 0;
  const dir = dx > 0 ? 1 : -1;
  // The way back after a swipe: let it pass, and start fresh from there.
  if (s.last && s.last.dir !== dir && t < s.last.until) {
    s.samples.length = 0;
    s.samples.push({ t, x: p.x, y: p.y });
    return 0;
  }
  s.samples.length = 0;
  s.restUntil = t + cfg.cooldown;
  s.last = { dir, until: t + cfg.returnBlock };
  return dir;
};
/* eslint-enable no-param-reassign */
