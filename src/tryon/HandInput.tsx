// Hands: sweep sideways in the air to flip the active slot's item, pinch to
// lock it and move on. Hands also stay in front of the hats and masks
// (HandCutout), so reaching up to "adjust" a hat looks right.
//
// One hand drives it at a time, followed by its stable identity (the SDK's
// `poses.left` / `poses.right`), so two hands in view can't make the reading
// jump from one to the other. Only fresh detections count (the SDK holds a
// lost hand's last pose for a moment).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import { HandCutout, HandTracker } from "@vincentt-xr/sdk/tracking";
import {
  measureGrab,
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
  /**
   * A fist also brings thumb and index together. Measured: a real pinch
   * (the OK sign) keeps the fingers' mean curl ≤ 0.16; a fist that reads as
   * a pinch sits around 0.85. Above this it's a fist, not a pinch.
   */
  maxGrab: 0.5,
  /** Detections in a row the pinch must hold (≈ 160 ms at 12 Hz). */
  hold: 2,
  /**
   * Two hands closer than this (palm to palm, in tracker units: the screen
   * is 2 wide) overlap — clapping, rubbing hands — and the hidden fingers
   * misread as a pinch. Neither pinches nor swipes count then.
   */
  handsApart: 0.45,
};

/**
 * Hand inference rate. The hand model is the costliest thing on screen:
 * on a phone-class CPU, 20 → 12 took the frame rate from 22 to 36 fps, and a
 * sweep still reads at 12 (the swipe window holds 4 detections).
 */
export const HAND_FPS = 12;

/** Dev only: ?handfps=N overrides the rate, for the performance audit. */
const handFps = () =>
  (process.env.NODE_ENV !== "production" &&
    Number(new URLSearchParams(window.location.search).get("handfps"))) ||
  HAND_FPS;

type Side = "left" | "right";

export const HandInput = () => {
  const hands = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const swipe = useRef(swipeState());
  const pinched = useRef(false);
  const pinchRun = useRef(0);
  const lastSwipe = useRef(-Infinity);
  const side = useRef<Side | null>(null);
  const lastStamp = useRef(-1);

  useFrame(() => {
    const poses = hands?.poses;
    const live = (s: Side) => {
      const h = poses?.[s];
      return h && !h.held && h.image.length > 20 ? h : null;
    };
    // Keep the hand we're following while it's in view; else take one.
    let s: Side | null =
      side.current && live(side.current) ? side.current : null;
    if (!s) s = (live("right") && "right") || (live("left") && "left") || null;
    if (s !== side.current) {
      side.current = s;
      feedSwipe(swipe.current, performance.now(), null);
      pinched.current = false;
      pinchRun.current = 0;
    }
    const hand = s ? live(s) : null;
    if (!hand || hand.timestampMs === lastStamp.current) return;
    const other = live(s === "left" ? "right" : "left");
    const together =
      !!other &&
      Math.hypot(
        other.image[PALM].x - hand.image[PALM].x,
        other.image[PALM].y - hand.image[PALM].y,
      ) < PINCH.handsApart;
    lastStamp.current = hand.timestampMs;
    const now = hand.timestampMs;
    const pts = hand.image;

    const p = measurePinch(pts);
    const fist = measureGrab(pts) > PINCH.maxGrab;
    const blocked = fist || together;
    const wasPinched = pinched.current;
    pinched.current = !blocked && (wasPinched ? p > PINCH.off : p >= PINCH.on);
    pinchRun.current = pinched.current ? pinchRun.current + 1 : 0;
    if (
      pinchRun.current === PINCH.hold &&
      now - lastSwipe.current > PINCH.afterSwipe
    )
      actions.lock();

    // Tracker points: centre origin, y up, already mirrored → screen fractions.
    // A pinch, a fist or two hands together moving isn't a swipe.
    const at =
      pinched.current || blocked
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
    <HandTracker targetFps={handFps()}>
      <HandCutout />
    </HandTracker>
  );
};
