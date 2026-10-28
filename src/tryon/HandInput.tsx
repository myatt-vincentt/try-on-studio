// Hands: sweep sideways in the air to flip the active slot's item, pinch to
// lock it and move on. Hands also stay in front of the hats and masks
// (HandCutout), so reaching up to "adjust" a hat looks right.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import { HandCutout, HandTracker } from "@vincentt-xr/sdk/tracking";
import {
  measurePinch,
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";

import { actions } from "./state";
import { feedSwipe, swipeState } from "./swipe";

/** Palm centre (middle-finger knuckle) — steadier than a fingertip. */
const PALM = 9;

const PINCH = {
  on: 0.62,
  off: 0.4,
  /** No pinch this soon after a swipe (the fingers close mid-sweep). */
  afterSwipe: 400, // ms
};

export const HandInput = () => {
  const hands = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const swipe = useRef(swipeState());
  const pinched = useRef(false);
  const lastSwipe = useRef(-Infinity);

  useFrame(() => {
    const now = performance.now();
    const pts = (hands?.hands ?? []).find(
      (h) => (h.coordinates?.length ?? 0) > 20,
    )?.coordinates;

    if (!pts) {
      feedSwipe(swipe.current, now, null);
      pinched.current = false;
      return;
    }

    const p = measurePinch(pts);
    const wasPinched = pinched.current;
    pinched.current = wasPinched ? p > PINCH.off : p >= PINCH.on;
    if (
      pinched.current &&
      !wasPinched &&
      now - lastSwipe.current > PINCH.afterSwipe
    )
      actions.lock();

    // Tracker points: centre origin, y up, already mirrored → screen fractions.
    const at = pinched.current
      ? null
      : { x: pts[PALM].x * 0.5 + 0.5, y: 0.5 - pts[PALM].y * 0.5 };
    const dir = feedSwipe(swipe.current, now, at);
    if (dir) {
      lastSwipe.current = now;
      // A sweep to the left brings the next item, like a carousel.
      actions.step(dir < 0 ? 1 : -1);
    }
  });

  return (
    <HandTracker>
      <HandCutout />
    </HandTracker>
  );
};
