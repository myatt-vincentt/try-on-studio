// The three slots and their curated items. Every model is a vincentt.studio
// head accessory (public/models/vincentt-*.glb), authored in metres in the
// "Complete 3D Reference - Spark AR" face frame (origin at the front of the
// face, +Y up, +Z out of the face) — see FRAME below.

export type SlotId = "hat" | "face" | "mouth";

export type Item = {
  /** File name in public/models without `vincentt-` / `.glb`. */
  id: string;
  /** Tint for the item's dot in the HUD (no text on screen). */
  color: string;
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
      { id: "cowboy-hat", color: "#a0673a" },
      { id: "top-hat", color: "#2b2b33" },
      { id: "royal-crown", color: "#e8b64c" },
      { id: "wizard-hat", color: "#4b3fa8" },
      { id: "beanie", color: "#c8433a" },
      { id: "frog-bucket-hat", color: "#5fb54a" },
      { id: "viking-helmet", color: "#8f949b" },
      { id: "boho-flower-crown", color: "#f29bb8", hangs: true },
    ],
  },
  {
    id: "face",
    icon: "🎭",
    items: [
      { id: "mask-cat", color: "#e8893a" },
      { id: "mask-feather-masquerade", color: "#7b3fb8" },
      { id: "mask-hero-domino", color: "#d23a3a" },
      { id: "mask-neon-cyber-visor", color: "#33e1ff" },
      { id: "mask-steampunk-goggle", color: "#b07a3e" },
      { id: "eye-heart-eyes", color: "#ff4d79" },
      { id: "eye-star-eyes", color: "#ffd84d" },
      { id: "eye-monocle", color: "#d8b04e" },
    ],
  },
  {
    id: "mouth",
    icon: "🥸",
    items: [
      { id: "mustache-handlebar", color: "#5a3a26" },
      { id: "mustache-dali", color: "#2a2725" },
      { id: "beard-santa-claus", color: "#f4f2ec" },
      { id: "beard-viking-braids", color: "#b4743a" },
      { id: "mouth-vampire-fangs", color: "#e8e8f0" },
      { id: "mouth-lollipop", color: "#ff5c8a" },
      { id: "mouth-rose-in-teeth", color: "#c8102e" },
      { id: "mouth-gold-grill", color: "#e8b64c", inMouth: true },
    ],
  },
];

export const modelUrl = (id: string) => `/models/vincentt-${id}.glb`;

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
