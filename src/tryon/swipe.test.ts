import { describe, expect, it } from "vitest";

import { feedSwipe, swipeState, SWIPE } from "./swipe";

type State = ReturnType<typeof swipeState>;

/** Move the hand from x0 to x1 over `ms`, sampling at 30 fps. */
const sweep = (
  s: State,
  t0: number,
  x0: number,
  x1: number,
  ms: number,
  y = 0.5,
  y1 = y,
) => {
  const fired: number[] = [];
  const n = Math.max(1, Math.round(ms / 33));
  for (let i = 0; i <= n; i += 1) {
    const k = i / n;
    const r = feedSwipe(s, t0 + k * ms, {
      x: x0 + (x1 - x0) * k,
      y: y + (y1 - y) * k,
    });
    if (r) fired.push(r);
  }
  return fired;
};

/** A hand already in view, held still at x for 400 ms (past the settle). */
const ready = (x: number) => {
  const s = swipeState();
  sweep(s, 0, x, x, 400);
  return s;
};

describe("air swipe", () => {
  it("a quick sweep left fires once, −1", () => {
    expect(sweep(ready(0.7), 500, 0.7, 0.35, 250)).toEqual([-1]);
  });

  it("a quick sweep right fires once, +1", () => {
    expect(sweep(ready(0.3), 500, 0.3, 0.65, 250)).toEqual([1]);
  });

  it("a slow drift doesn't fire", () => {
    expect(sweep(ready(0.3), 500, 0.3, 0.7, 2000)).toEqual([]);
  });

  it("a short twitch doesn't fire", () => {
    expect(sweep(ready(0.5), 500, 0.5, 0.58, 150)).toEqual([]);
  });

  it("a mostly vertical move doesn't fire", () => {
    expect(sweep(ready(0.5), 500, 0.5, 0.68, 250, 0.2, 0.7)).toEqual([]);
  });

  it("a hand coming into view fast doesn't fire", () => {
    // First seen at the edge, already moving inward.
    expect(sweep(swipeState(), 0, 0.98, 0.7, 200)).toEqual([]);
  });

  it("the way back doesn't flip back", () => {
    const s = ready(0.7);
    expect(sweep(s, 500, 0.7, 0.35, 250)).toEqual([-1]);
    // Returning right, right after the rest: ignored.
    expect(sweep(s, 500 + 250 + SWIPE.cooldown, 0.35, 0.7, 250)).toEqual([]);
    // Another sweep the same way after the rest counts.
    expect(sweep(s, 1700, 0.7, 0.35, 250)).toEqual([-1]);
  });

  it("a wave flips one way, not back and forth", () => {
    const s = ready(0.5);
    const fired: number[] = [];
    // 4 s of waving: 0.3 ↔ 0.7 every 350 ms.
    for (let i = 0; i < 12; i += 1) {
      const [a, b] = i % 2 ? [0.7, 0.3] : [0.3, 0.7];
      fired.push(...sweep(s, 500 + i * 350, a, b, 340));
    }
    expect(fired.length).toBeGreaterThan(0);
    expect(new Set(fired).size).toBe(1);
  });

  it("a swipe the other way counts once the block is over", () => {
    const s = ready(0.7);
    expect(sweep(s, 500, 0.7, 0.35, 250)).toEqual([-1]);
    sweep(s, 760, 0.35, 0.35, 1100); // rest there
    expect(sweep(s, 1900, 0.35, 0.7, 250)).toEqual([1]);
  });

  it("losing the hand forgets the sweep", () => {
    const s = ready(0.7);
    sweep(s, 500, 0.7, 0.6, 100);
    expect(feedSwipe(s, 620, null)).toBe(0);
    expect(feedSwipe(s, 640, { x: 0.4, y: 0.5 })).toBe(0);
  });
});
