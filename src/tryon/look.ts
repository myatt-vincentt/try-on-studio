// The look being built — pure, unit-tested (look.test.ts).
//
// One active slot at a time. Swiping flips through that slot's items (from
// empty, the first swipe puts on the first or last item); a pinch locks the
// slot and moves on to the next one. Tapping a chip picks a slot, tapping a
// dot picks an item. Shuffle dresses every slot at random; reset undresses.

export type Look = {
  /** Index of the active slot. */
  slot: number;
  /** Item index per slot, −1 = nothing worn. */
  picks: number[];
  /** Slots locked by a pinch. */
  locked: boolean[];
};

export const emptyLook = (slots: number): Look => ({
  slot: 0,
  picks: Array.from({ length: slots }, () => -1),
  locked: Array.from({ length: slots }, () => false),
});

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Wear item `item` in slot `slot` (and make it the active slot). */
export const pick = (look: Look, slot: number, item: number): Look => {
  const picks = look.picks.slice();
  const locked = look.locked.slice();
  picks[slot] = item;
  locked[slot] = false;
  return { slot, picks, locked };
};

/** Flip the active slot's item by `dir` (±1). Unlocks the slot. */
export const step = (
  look: Look,
  dir: 1 | -1,
  counts: readonly number[],
): Look => {
  const n = counts[look.slot];
  const cur = look.picks[look.slot];
  let next = wrap(cur + dir, n);
  if (cur < 0) next = dir > 0 ? 0 : n - 1;
  return pick(look, look.slot, next);
};

/** Make `slot` active without changing what's worn. */
export const selectSlot = (look: Look, slot: number): Look => ({
  ...look,
  slot,
});

/**
 * Lock the active slot (only if something is worn there) and move to the next
 * slot. Returns the same object when there's nothing to lock.
 */
export const lock = (look: Look): Look => {
  if (look.picks[look.slot] < 0) return look;
  const locked = look.locked.slice();
  locked[look.slot] = true;
  return {
    ...look,
    locked,
    slot: wrap(look.slot + 1, look.picks.length),
  };
};

/** A random item in every slot (different from what's worn, when possible). */
export const shuffle = (
  look: Look,
  counts: readonly number[],
  random: () => number,
): Look => ({
  slot: look.slot,
  picks: counts.map((n, s) => {
    const cur = look.picks[s];
    if (n <= 1) return 0;
    let i = Math.floor(random() * n);
    if (i === cur) i = wrap(i + 1, n);
    return i;
  }),
  locked: counts.map(() => false),
});

export const reset = (look: Look): Look => emptyLook(look.picks.length);

export const isEmpty = (look: Look) => look.picks.every((p) => p < 0);
