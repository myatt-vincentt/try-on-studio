import { describe, expect, it } from "vitest";

import { feedSwipe, swipeState, SWIPE } from "./swipe";

/** Move the hand from x0 to x1 over `ms`, sampling at 30 fps. */
const sweep = (
  s: ReturnType<typeof swipeState>,
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

describe("air swipe", () => {
  it("a quick sweep left fires once, −1", () => {
    expect(sweep(swipeState(), 0, 0.7, 0.35, 250)).toEqual([-1]);
  });

  it("a quick sweep right fires once, +1", () => {
    expect(sweep(swipeState(), 0, 0.3, 0.65, 250)).toEqual([1]);
  });

  it("a slow drift doesn't fire", () => {
    expect(sweep(swipeState(), 0, 0.3, 0.7, 2000)).toEqual([]);
  });

  it("a short twitch doesn't fire", () => {
    expect(sweep(swipeState(), 0, 0.5, 0.58, 150)).toEqual([]);
  });

  it("a mostly vertical move doesn't fire", () => {
    expect(sweep(swipeState(), 0, 0.5, 0.68, 250, 0.2, 0.7)).toEqual([]);
  });

  it("the hand coming back during the rest doesn't fire", () => {
    const s = swipeState();
    expect(sweep(s, 0, 0.7, 0.35, 250)).toEqual([-1]);
    expect(sweep(s, 260, 0.35, 0.7, 250)).toEqual([]);
    // After the rest a new sweep counts again.
    expect(sweep(s, 260 + SWIPE.cooldown + 400, 0.7, 0.35, 250)).toEqual([-1]);
  });

  it("losing the hand forgets the sweep", () => {
    const s = swipeState();
    sweep(s, 0, 0.7, 0.6, 100);
    expect(feedSwipe(s, 120, null)).toBe(0);
    expect(feedSwipe(s, 140, { x: 0.4, y: 0.5 })).toBe(0);
  });
});
