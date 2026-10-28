// Dev-only: the keyboard stands in for the hand (← → flip, space locks,
// S shuffles, R resets), and window.__tryon exposes the store for checks,
// plus a probe for the fit audit (__tryon.probe.on = true): per frame, the
// fitted nose tip and crown on screen as last drawn, the tracker's own nose
// tip, the frame time and the draw calls. Scene.tsx lazy-imports this behind
// an inline NODE_ENV check, so it never reaches production.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { XRModel } from "@vincentt-xr/sdk";
import {
  measureGrab,
  measurePinch,
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";
import { useFaceInfo } from "@vincentt-xr/sdk/tracking";

import { FACE_FPS } from "./FilteredHead";
import { HEAD_FILTER, headFilterStats } from "./headFilter";
import { actions, getStudio, live } from "./state";

type Sample = {
  t: number;
  /** Fitted canonical nose tip and crown, screen px. */
  nose: [number, number] | null;
  crown: [number, number] | null;
  /** Fitted head rotation (quaternion). */
  q: [number, number, number, number] | null;
  /** The tracker's nose tip (landmark 1), screen px. */
  lm: [number, number] | null;
  /** The raw (unfiltered) fit's nose tip, screen px. */
  raw: [number, number] | null;
  /** The raw fit's world pose: position, quaternion, scale. */
  rawPose: number[] | null;
  /** Bumps when a new face result arrives. */
  faceTick: number;
  calls: number;
  tris: number;
};

const probe = { on: false, samples: [] as Sample[] };
const NOSE = new Vector3(0, -1.13, 7.48);
const CROWN = new Vector3(0, 13.26, -3.76);

const DevKeys = () => {
  const scene = useThree((st) => st.scene);
  const face = useFaceInfo({ active: true, numFaces: 1, targetFps: FACE_FPS });
  const hands = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const handsRef = useRef(hands);
  handsRef.current = hands;
  const lastFace = useRef<unknown>(null);
  const faceTick = useRef(0);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__tryon = {
      actions,
      get: getStudio,
      live,
      scene,
      probe,
      // The live filter tuning (FilteredHead keeps a reference to it).
      filter: HEAD_FILTER,
      filterStats: headFilterStats,
      handNode: () => handsRef.current,
      measure: { pinch: measurePinch, grab: measureGrab },
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") actions.step(-1);
      else if (e.key === "ArrowRight") actions.step(1);
      else if (e.key === " ") actions.lock();
      else if (e.key === "s") actions.shuffle();
      else if (e.key === "r") actions.reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene]);

  // First in the frame (negative priority keeps R3F's own render): reads
  // the state the previous frame drew.
  useFrame((state) => {
    if (!probe.on) return;
    if (face?.landmarks !== lastFace.current) {
      lastFace.current = face?.landmarks;
      faceTick.current += 1;
    }
    const { width: W, height: H } = state.size;
    const toPx = (v: Vector3): [number, number] => {
      v.project(state.camera);
      return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H];
    };
    const frame = scene.getObjectByName("tryon-frame")?.parent;
    let seen = !!frame;
    for (let o = frame; o && seen; o = o.parent) seen = o.visible;
    let q: Sample["q"] = null;
    if (seen && frame) {
      const wq = frame.getWorldQuaternion(new Quaternion());
      q = [wq.x, wq.y, wq.z, wq.w];
    }
    const lm = face?.landmarks?.[1];
    const rawFit = scene.getObjectByName("tryon-raw");
    rawFit?.updateWorldMatrix(true, false);
    probe.samples.push({
      t: performance.now(),
      nose: seen && frame ? toPx(frame.localToWorld(NOSE.clone())) : null,
      crown: seen && frame ? toPx(frame.localToWorld(CROWN.clone())) : null,
      q,
      lm: lm ? [lm.x * W, lm.y * H] : null,
      raw: rawFit && seen ? toPx(rawFit.localToWorld(NOSE.clone())) : null,
      rawPose:
        rawFit && seen
          ? [
              ...rawFit.getWorldPosition(new Vector3()).toArray(),
              ...rawFit.getWorldQuaternion(new Quaternion()).toArray(),
              rawFit.getWorldScale(new Vector3()).x,
            ]
          : null,
      faceTick: faceTick.current,
      calls: state.gl.info.render.calls,
      tris: state.gl.info.render.triangles,
    });
  }, -1000);

  return null;
};

export default DevKeys;
