import { describe, expect, it } from "vitest";

import {
  emptyLook,
  isEmpty,
  lock,
  pick,
  reset,
  selectSlot,
  shuffle,
  step,
} from "./look";

const COUNTS = [8, 8, 8];

describe("look", () => {
  it("starts empty on the first slot", () => {
    const l = emptyLook(3);
    expect(l.slot).toBe(0);
    expect(isEmpty(l)).toBe(true);
  });

  it("first swipe puts on the first (or last) item, then wraps", () => {
    expect(step(emptyLook(3), 1, COUNTS).picks[0]).toBe(0);
    expect(step(emptyLook(3), -1, COUNTS).picks[0]).toBe(7);
    let l = pick(emptyLook(3), 0, 7);
    l = step(l, 1, COUNTS);
    expect(l.picks[0]).toBe(0);
  });

  it("only flips the active slot", () => {
    const l = step(selectSlot(emptyLook(3), 2), 1, COUNTS);
    expect(l.picks).toEqual([-1, -1, 0]);
  });

  it("lock needs something worn, then moves on and wraps", () => {
    const l0 = emptyLook(3);
    expect(lock(l0)).toBe(l0);
    let l = lock(step(l0, 1, COUNTS));
    expect(l.locked).toEqual([true, false, false]);
    expect(l.slot).toBe(1);
    l = lock(step(selectSlot(l, 2), 1, COUNTS));
    expect(l.slot).toBe(0);
  });

  it("changing a locked slot unlocks it", () => {
    const l = lock(step(emptyLook(3), 1, COUNTS));
    const back = step(selectSlot(l, 0), 1, COUNTS);
    expect(back.locked[0]).toBe(false);
    expect(back.picks[0]).toBe(1);
  });

  it("shuffle dresses every slot with something new", () => {
    const l = pick(emptyLook(3), 0, 3);
    const s = shuffle(l, COUNTS, () => 3 / 8);
    expect(s.picks[0]).toBe(4); // would repeat 3, so it moves on
    expect(s.picks.every((p) => p >= 0 && p < 8)).toBe(true);
    expect(s.locked).toEqual([false, false, false]);
  });

  it("reset undresses", () => {
    const l = reset(shuffle(emptyLook(3), COUNTS, Math.random));
    expect(isEmpty(l)).toBe(true);
    expect(l.slot).toBe(0);
  });
});
