// One small store shared by the hand input, the HUD and the 3D accessories.
import { useSyncExternalStore } from "react";

import { SLOTS } from "./catalog";
import {
  emptyLook,
  lock as lockLook,
  pick as pickLook,
  reset as resetLook,
  selectSlot as selectLookSlot,
  shuffle as shuffleLook,
  step as stepLook,
  type Look,
} from "./look";

/** Live face readings, written every frame by FaceSignals (no re-renders). */
export const live = {
  blendshapes: {} as Readonly<Record<string, number | undefined>>,
  /** Bumps on each head shake: worn items play their wobble. */
  shakes: 0,
  /** Dev checks only (window.__tryon): stands in for the face's readings. */
  override: null as Readonly<Record<string, number | undefined>> | null,
};

export type Studio = {
  look: Look;
  /** Bumps when a slot is locked, so its item plays its little burst. */
  burst: number[];
  /** Which wordless hints have been answered. */
  hints: { swiped: boolean; locked: boolean };
};

const COUNTS = SLOTS.map((s) => s.items.length);

let studio: Studio = {
  look: emptyLook(SLOTS.length),
  burst: SLOTS.map(() => 0),
  hints: { swiped: false, locked: false },
};

const listeners = new Set<() => void>();

const set = (next: Studio) => {
  studio = next;
  listeners.forEach((l) => l());
};

export const getStudio = () => studio;

export const useStudio = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getStudio,
    getStudio,
  );

export const actions = {
  step(dir: 1 | -1) {
    set({
      ...studio,
      look: stepLook(studio.look, dir, COUNTS),
      hints: { ...studio.hints, swiped: true },
    });
  },
  pick(slot: number, item: number) {
    set({ ...studio, look: pickLook(studio.look, slot, item) });
  },
  selectSlot(slot: number) {
    set({ ...studio, look: selectLookSlot(studio.look, slot) });
  },
  lock() {
    const { slot } = studio.look;
    const look = lockLook(studio.look);
    if (look === studio.look) return;
    const burst = studio.burst.slice();
    burst[slot] += 1;
    set({ look, burst, hints: { swiped: true, locked: true } });
  },
  shuffle() {
    set({ ...studio, look: shuffleLook(studio.look, COUNTS, Math.random) });
  },
  reset() {
    set({ ...studio, look: resetLook(studio.look) });
  },
};
