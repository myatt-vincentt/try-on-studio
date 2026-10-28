// The worn items: one per slot, on the filtered head (FilteredHead.tsx: the
// SDK's canonical head fit through a One Euro filter, with the depth-only v3
// head occluder in the same group, so brims, straps and ribbons go behind the
// head). The models are in metres in the Spark AR face frame, so one group
// converts them to canonical centimetres (FRAME).
//
// Each item plays the loops its author marked autoplay (in the GLB's
// scenes[0].extras.vincentt_config), pops in when it's put on, and plays its
// one-shot "burst" (or "twirl") when its slot is locked.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  LoopRepeat,
  Mesh,
  PMREMGenerator,
  Vector3,
  type AnimationClip,
  type Group,
  type Material,
  type Object3D,
} from "three";
// eslint-disable-next-line import/extensions
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
// eslint-disable-next-line import/extensions
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
// eslint-disable-next-line import/extensions
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  defineGltfAsset,
  useXRAsset,
  useXRAssetCache,
  type XRAssetDefinition,
} from "@vincentt-xr/sdk";
import {
  BodyTracker,
  ShoulderOccluder,
  useFaceInfo,
  useGesture,
} from "@vincentt-xr/sdk/tracking";

import {
  FRAME,
  modelUrl,
  SHOULDER_OCCLUDER_URL,
  SLOTS,
  type Item,
  type SlotId,
} from "./catalog";
import { FACE_FPS, FilteredHead, showOccluders } from "./FilteredHead";
import { buildRig, type FaceTrigger } from "./rig";
import { live, useStudio } from "./state";

const assets = new Map<string, XRAssetDefinition<GLTF>>();
const assetFor = (id: string) => {
  let a = assets.get(id);
  if (!a) {
    a = defineGltfAsset(modelUrl(id));
    assets.set(id, a);
  }
  return a;
};

type ClipConfig = { clip: string; loop?: boolean; autoplay?: boolean };
type ItemConfig = {
  animations?: ClipConfig[];
  rig?: { autoplay?: boolean };
  face_triggers?: FaceTrigger[];
  actions?: { clip: string; triggers?: string[] }[];
};

/** Clips that loop while the item is worn. */
const autoplayClips = (cfg: ItemConfig, clips: AnimationClip[]) => {
  if (cfg.animations?.length)
    return cfg.animations
      .filter((a) => a.autoplay)
      .map((a) => clips.find((c) => c.name === a.clip))
      .filter((c): c is AnimationClip => !!c);
  // A rigged item without a clip list (the flower crown's ribbons).
  return cfg.rig?.autoplay ? clips : [];
};

/** The one-shot clip a head shake plays (only where the author asked). */
const shakeClip = (cfg: ItemConfig, clips: AnimationClip[]) => {
  const a = cfg.actions?.find((x) => x.triggers?.includes("headShake"));
  return a ? clips.find((c) => c.name === a.clip) : undefined;
};

/** The one-shot clip a lock plays. */
const burstClip = (clips: AnimationClip[]) =>
  clips.find((c) => c.name === "burst") ??
  clips.find((c) => c.name === "twirl");

/**
 * Draw order (mesh renderOrder; the SDK's head occluder is -1):
 *   inside the mouth    -1.5    before the head (shown only when open)
 *   face + mouth items  5 / 6   hidden by the head only
 *   neck + shoulders    7       (BODY_ORDER)
 *   hats                8 / 9   hidden by the head, neck and shoulders
 * Body depth and face depth come from different trackers and don't agree to
 * the centimetre, so a beard or braid hanging over the neck and chest would
 * be cut by them; drawn before them it can't be. Hat ribbons and tails hang
 * behind the body and need the shoulders. Opaque / see-through per the SDK
 * recipe (no culling, see-through parts don't write depth).
 */
const ORDER = { mouth: [-1.5, 6], face: [5, 6], hat: [8, 9] } as const;
const BODY_ORDER = 7;

const prepare = (root: Object3D, tier: readonly [number, number]) => {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    const mats = (
      Array.isArray(m.material) ? m.material : [m.material]
    ) as Material[];
    const clear = mats.some((x) => x.transparent);
    m.renderOrder = clear ? tier[1] : tier[0];
    if (clear)
      mats.forEach((x) => {
        // eslint-disable-next-line no-param-reassign
        x.depthWrite = false;
      });
  });
  return root;
};

const POP = 0.3; // s

/** House motion: strict ease-out, never an overshoot. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

const tierFor = (slot: SlotId, item: Item) => {
  if (item.inMouth) return ORDER.mouth;
  return slot === "hat" ? ORDER.hat : ORDER.face;
};

/** How open the mouth reads for an inside-the-mouth item (0–1). */
const mouthOpen = (b: Readonly<Record<string, number | undefined>>) =>
  Math.max(
    (b.jawOpen ?? 0) / 0.35,
    // A closed-lip smile reads up to ~0.4: the teeth only show past that.
    ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2 / 0.8,
  );

const Worn = ({
  id,
  burst,
  tier,
  inMouth = false,
  fit,
}: {
  id: string;
  burst: number;
  tier: readonly [number, number];
  inMouth?: boolean;
  /** Per-item placement (catalog.ts): read every frame, so it can be edited live. */
  fit: Item;
}) => {
  const { value } = useXRAsset(assetFor(id));
  const holder = useRef<Group>(null);
  const born = useRef(-1);

  const model = useMemo(() => {
    if (!value) return null;
    const root = prepare(cloneSkinned(value.scene), tier);
    const mixer = new AnimationMixer(root);
    const cfg = (value.scene.userData?.vincentt_config ?? {}) as ItemConfig;
    autoplayClips(cfg, value.animations).forEach((c) =>
      mixer.clipAction(c).setLoop(LoopRepeat, Infinity).play(),
    );
    // Pop in about the item's own middle, not the face frame's origin
    // (the tip of the nose), so a hat grows in place.
    const centre = new Box3().setFromObject(root).getCenter(new Vector3());
    return {
      root,
      centre,
      mixer,
      burst: burstClip(value.animations),
      shake: shakeClip(cfg, value.animations),
      rig: buildRig(
        root,
        (cfg.face_triggers ?? []).map((t) =>
          fit.triggers?.[t.input] ? { ...t, map: fit.triggers[t.input] } : t,
        ),
        mixer,
        value.animations,
      ),
    };
  }, [value, tier, fit]);

  useEffect(
    () => () => {
      model?.mixer.stopAllAction();
    },
    [model],
  );

  // A lock (not the first render) plays the burst once.
  const lastBurst = useRef(burst);
  useEffect(() => {
    if (burst === lastBurst.current) return;
    lastBurst.current = burst;
    if (!model?.burst) return;
    const a = model.mixer.clipAction(model.burst);
    a.setLoop(LoopOnce, 1);
    a.reset().play();
  }, [burst, model]);

  const lastShake = useRef(live.shakes);
  useFrame((state, dt) => {
    if (!model || !holder.current) return;
    const face = live.override ?? live.blendshapes;
    model.rig(face);
    if (inMouth) {
      // Hysteresis, so it doesn't flicker at the threshold.
      const open = mouthOpen(face);
      if (model.root.visible ? open < 0.35 : open > 0.55)
        model.root.visible = !model.root.visible;
    }
    if (live.shakes !== lastShake.current) {
      lastShake.current = live.shakes;
      if (model.shake) {
        const a = model.mixer.clipAction(model.shake);
        a.setLoop(LoopOnce, 1);
        a.reset().play();
      }
    }
    model.mixer.update(Math.min(dt, 0.1));
    if (born.current < 0) born.current = state.clock.elapsedTime;
    const k = Math.min(1, (state.clock.elapsedTime - born.current) / POP);
    // Pop in, then sit where its fit says (cm → the frame's metres).
    const f = fit.fit;
    holder.current.scale.setScalar((0.6 + 0.4 * easeOut(k)) * (f?.scale ?? 1));
    holder.current.position.set(
      model.centre.x,
      model.centre.y + (f?.y ?? 0) / 100,
      model.centre.z + (f?.z ?? 0) / 100,
    );
  });

  if (!model) return null;
  return (
    <group ref={holder} position={model.centre} scale={0.6}>
      <group position={model.centre.clone().negate()}>
        <primitive object={model.root} />
      </group>
    </group>
  );
};

/** The body occluders' meshes (the SDK names them), drawn at BODY_ORDER. */
const BODY_OCCLUDERS = new Set(["shoulder_occluder", "neck_bust"]);

/**
 * Moves the neck and shoulder occluders to BODY_ORDER once they load. The
 * SDK gives them -1 and also puts the shoulder's -1 on its loaded scene
 * GROUP; three sorts by the nearest group's renderOrder before the mesh's,
 * so that group would keep it in a tier of its own, ahead of everything.
 * Their groups go back to 0, their meshes to BODY_ORDER. Rescans twice a
 * second (they load late and remount when tracking is lost).
 */
const BodyOccluderOrder = () => {
  const scene = useThree((st) => st.scene);
  const next = useRef(0);
  useFrame((state) => {
    if (state.clock.elapsedTime < next.current) return;
    next.current = state.clock.elapsedTime + 0.5;
    scene.traverse((o) => {
      if (!BODY_OCCLUDERS.has(o.name) || !(o as Mesh).isMesh) return;
      // eslint-disable-next-line no-param-reassign
      o.renderOrder = BODY_ORDER;
      let p = o.parent;
      while (p && p !== scene && p.renderOrder < 0) {
        p.renderOrder = 0;
        p = p.parent;
      }
    });
  });
  return null;
};

/** The blendshapes the models' face_triggers read (see rig.ts). */
const FACE_INPUTS = [
  "jawOpen",
  "mouthSmileLeft",
  "mouthSmileRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "browInnerUp",
  "browDownLeft",
];
/** Per-second easing of the readings (higher = snappier, noisier). */
const FACE_EASE = 14;

/** Copies the face's blendshapes into `live` and counts head shakes. */
const FaceSignals = () => {
  // Same options as FilteredHead's FaceTracker: the first consumer of the
  // shared face model sets its face count and rate.
  const face = useFaceInfo({ active: true, numFaces: 1, targetFps: FACE_FPS });
  const raw = useRef<Readonly<Record<string, number | undefined>>>({});
  raw.current = face?.blendshapes ?? {};
  // Ease toward the latest readings: raw blendshapes flicker a few percent
  // frame to frame, which would make every face-driven part twitch.
  const smooth = useRef<Record<string, number>>({});
  useFrame((_st, dt) => {
    const k = 1 - Math.exp(-FACE_EASE * Math.min(dt, 0.1));
    const out = smooth.current;
    FACE_INPUTS.forEach((name) => {
      const v = raw.current[name] ?? 0;
      out[name] = (out[name] ?? v) + (v - (out[name] ?? v)) * k;
    });
    live.blendshapes = out;
  }, -1);
  useGesture("headShake", {
    onBegin: () => {
      live.shakes += 1;
    },
  });
  return null;
};

/** Soft studio reflections, so the metal and gloss read on camera. */
const useStudioLight = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const before = scene.environment;
    scene.environment = tex;
    return () => {
      scene.environment = before;
      tex.dispose();
    };
  }, [gl, scene]);
};

/**
 * Warms the items either side of what the active slot shows (or its first
 * and last when empty), so a swipe doesn't wait on a download.
 */
const usePreloadNeighbours = (slot: number, current: number) => {
  const cache = useXRAssetCache();
  useEffect(() => {
    const { items } = SLOTS[slot];
    const n = items.length;
    const near =
      current < 0 ? [0, n - 1] : [(current + 1) % n, (current - 1 + n) % n];
    near.forEach((i) => {
      cache.preload(assetFor(items[i].id)).catch(() => {
        // A failed warm-up is retried by the real load.
      });
    });
  }, [cache, slot, current]);
};

export const Accessories = () => {
  const { look, burst } = useStudio();
  useStudioLight();
  usePreloadNeighbours(look.slot, look.picks[look.slot]);
  const hangs = SLOTS.some((slot, s) => slot.items[look.picks[s]]?.hangs);
  return (
    <>
      <FaceSignals />
      <BodyOccluderOrder />
      {/* Shoulders and chest, from body tracking, only while something
          hangs below the head (the flower crown's ribbons): body tracking
          is the most expensive model, so it doesn't run otherwise. */}
      {hangs ? (
        <BodyTracker bodyIndex={0}>
          <ShoulderOccluder
            url={SHOULDER_OCCLUDER_URL}
            showDebugMaterial={showOccluders()}
            opacity={0.45}
          />
        </BodyTracker>
      ) : null}
      <FilteredHead>
        <group name="tryon-frame" scale={FRAME.scale} position={FRAME.position}>
          {SLOTS.map((slot, s) => {
            const i = look.picks[s];
            if (i < 0) return null;
            const { id } = slot.items[i];
            return (
              <Worn
                key={`${slot.id}:${id}`}
                id={id}
                burst={burst[s]}
                tier={tierFor(slot.id, slot.items[i])}
                inMouth={slot.items[i].inMouth}
                fit={slot.items[i]}
              />
            );
          })}
        </group>
      </FilteredHead>
    </>
  );
};
