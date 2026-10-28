// The three slots and their curated items. Every model is a vincentt.studio
// head accessory (public/models/vincentt-*.glb), authored in metres in the
// "Complete 3D Reference - Spark AR" face frame (origin at the front of the
// face, +Y up, +Z out of the face) — see FRAME below.

export type SlotId = "hat" | "face" | "mouth";

export type Item = {
  /** File name in public/models without `vincentt-` / `.glb`. */
  id: string;
  /**
   * Sits inside the mouth (a grill). The head occluder is rigid with closed
   * lips, so it would always hide it: it draws before the occluder instead
   * and shows only while the mouth is open or smiling.
   */
  inMouth?: boolean;
  /**
   * Has parts hanging below the head (the flower crown's ribbons): needs the
   * shoulder occluder, which needs body tracking — only run while it's worn.
   */
  hangs?: boolean;
};

export type Slot = {
  id: SlotId;
  /** The slot's chip in the HUD. */
  icon: string;
  items: readonly Item[];
};

export const SLOTS: readonly Slot[] = [
  {
    id: "hat",
    icon: "🎩",
    items: [
      { id: "cowboy-hat" },
      { id: "top-hat" },
      { id: "royal-crown" },
      { id: "wizard-hat" },
      { id: "beanie" },
      { id: "frog-bucket-hat" },
      { id: "viking-helmet" },
      { id: "boho-flower-crown", hangs: true },
    ],
  },
  {
    id: "face",
    icon: "🎭",
    items: [
      { id: "mask-cat" },
      { id: "mask-feather-masquerade" },
      { id: "mask-hero-domino" },
      { id: "mask-neon-cyber-visor" },
      { id: "mask-steampunk-goggle" },
      { id: "eye-heart-eyes" },
      { id: "eye-star-eyes" },
      { id: "eye-monocle" },
    ],
  },
  {
    id: "mouth",
    icon: "🥸",
    items: [
      { id: "mustache-handlebar" },
      { id: "mustache-dali" },
      { id: "beard-santa-claus" },
      { id: "beard-viking-braids" },
      { id: "mouth-vampire-fangs" },
      { id: "mouth-lollipop" },
      { id: "mouth-rose-in-teeth" },
      { id: "mouth-gold-grill", inMouth: true },
    ],
  },
];

export const modelUrl = (id: string) => `/models/vincentt-${id}.glb`;

/** The item's picture in the HUD (tools/render-thumbs.cjs renders them). */
export const thumbUrl = (id: string) => `/thumbs/${id}.webp`;

/** The SDK's v3 head occluder, hosted here until the SDK CDN serves it. */
export const OCCLUDER_URL = "/models/head-occluder-v3.glb";

/**
 * The SDK's neck-and-shoulders bust occluder (same story), so ribbons,
 * braids and straps that hang behind the neck and shoulders hide there.
 */
export const NECK_OCCLUDER_URL = "/models/neck-occluder-bust-v1.glb";

/**
 * The SDK's shoulder occluder (torso frame, fitted from body tracking), down
 * to the chest: the long ribbon tails hang past the bust.
 */
export const SHOULDER_OCCLUDER_URL = "/models/shoulder-occluder-v1.glb";

/**
 * The models' frame → the SDK's canonical head frame (centimetres): ×100,
 * then the same shift the SDK used to move the Spark AR reference into the
 * canonical frame (chins and nose tips aligned; vincentt-xr-sdk
 * assets-src/head-occluder/README.md).
 */
export const FRAME = {
  scale: 100,
  position: [0, -1.03, 7.3] as const,
};
