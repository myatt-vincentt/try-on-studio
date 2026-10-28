// The controls, wordless, in the lower middle where a thumb (or a hand in
// the air) reaches them. Night glass: Cypress 64 % glass, white marks, Arles
// the only accent; strict ease-out.
//
//      ◦  ○  ( ◎ )  ○  ◦        the active slot's items, as pictures: what
//                                you wear in the middle, the next ones to
//                                each side (tap one to wear it, tap the
//                                middle to take it off; or drag across the
//                                screen, or swipe in the air)
//   [🎩][🎭][🥸]   🎲  ↺         slots — each shows what you wear there —
//                                then shuffle and reset
//
// Both rows stay well inside a 375 px phone (≥ 48 px from each edge).
// Two hints above them, until answered: a hand sweeping sideways (swipe in
// the air to flip), then a pinch (lock the slot).
import { Html } from "@react-three/drei";

import { SLOTS, thumbUrl, type Item } from "./catalog";
import { actions, useStudio } from "./state";

const CSS = `
.ts { --glass: rgb(35 37 40 / .64); --arles: #f4d968; --blur: blur(20px) saturate(1.5);
  position: absolute; inset: 0; user-select: none; -webkit-user-select: none;
  font-family: system-ui, sans-serif; color: #fff; }
.ts-band { position: absolute; left: 0; right: 0; bottom: 0; height: 280px; pointer-events: none;
  background: linear-gradient(rgb(35 37 40 / 0), rgb(35 37 40 / .6)); }
.ts-controls { position: absolute; left: 50%; bottom: max(calc(env(safe-area-inset-bottom) + 24px), 40px);
  transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.ts-row { display: flex; align-items: center; gap: 6px; }
.ts-btn { pointer-events: auto; border: 0; padding: 0; margin: 0; cursor: pointer; color: #fff;
  display: grid; place-items: center; background: var(--glass); backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur); border-radius: 999px;
  transition: transform .18s ease-out, box-shadow .18s ease-out, background .18s ease-out; }
.ts-btn:active { transform: scale(.94); }
.ts-chip { width: 52px; height: 52px; font-size: 25px; position: relative; }
.ts-chip.on { box-shadow: 0 0 0 3px var(--arles); }
.ts-chip img { width: 42px; height: 42px; padding: 4px; box-sizing: border-box; object-fit: contain;
  pointer-events: none; border-radius: 50%; background: rgb(255 255 255 / .2); }
.ts-chip .ts-lock { position: absolute; right: -2px; top: -2px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--arles); display: grid; place-items: center; opacity: 0; transform: scale(.6);
  transition: opacity .2s ease-out, transform .2s ease-out; }
.ts-chip .ts-lock.on { opacity: 1; transform: scale(1); }
.ts-small { width: 44px; height: 44px; font-size: 20px; }
.ts-gap { width: 6px; }
.ts-reel { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px;
  background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); }
.ts-tile { pointer-events: auto; border: 0; margin: 0; padding: 0; cursor: pointer; background: transparent;
  display: grid; place-items: center; border-radius: 50%; transition: opacity .2s ease-out; }
.ts-tile img { object-fit: contain; pointer-events: none;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / .35)); }
.ts-tile.far, .ts-tile.near { background: rgb(255 255 255 / .16); }
.ts-tile.far { width: 36px; height: 36px; opacity: .55; }
.ts-tile.far img { width: 28px; height: 28px; }
.ts-tile.near { width: 44px; height: 44px; opacity: .85; }
.ts-tile.near img { width: 34px; height: 34px; }
.ts-tile.mid { width: 62px; height: 62px; background: rgb(255 255 255 / .22);
  box-shadow: 0 0 0 3px var(--arles); }
.ts-tile.mid img { width: 50px; height: 50px; animation: ts-in .22s ease-out; }
.ts-tile.mid .ts-none { width: 30px; height: 30px; border-radius: 50%;
  border: 2px dashed rgb(255 255 255 / .7); }
@keyframes ts-in { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: scale(1); } }
.ts-hint { position: absolute; left: 50%; bottom: max(calc(env(safe-area-inset-bottom) + 200px), 216px);
  transform: translateX(-50%); height: 52px; padding: 0 18px; border-radius: 999px; font-size: 26px;
  display: flex; align-items: center; gap: 6px; pointer-events: none;
  background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  opacity: 0; transition: opacity .35s ease-out; }
.ts-hint.on { opacity: 1; }
.ts-hint svg { opacity: .8; }
@keyframes ts-sweep { 0% { transform: translateX(7px); } 50% { transform: translateX(-7px); } 100% { transform: translateX(7px); } }
@keyframes ts-pinch { 0%, 100% { transform: scale(1); } 50% { transform: scale(.82); } }
.ts-hand-sweep { display: inline-block; width: 34px; margin: 0 8px; text-align: center; animation: ts-sweep 1.4s ease-in-out infinite; }
.ts-hand-pinch { display: inline-block; animation: ts-pinch 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ts-hand-sweep, .ts-hand-pinch, .ts-tile.mid img { animation: none; } }
`;

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
      fill="none"
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ResetIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"
      fill="none"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      fill="none"
      stroke="#232528"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** A screen reader's name for an item ("cowboy hat"); never shown. */
const label = (item: Item) =>
  item.id.replace(/^(mask|eye|mouth)-/, "").replace(/-/g, " ");

/** The reel: offsets −2 … 2 round what's worn (or round "nothing"). */
const OFFSETS = [-2, -1, 0, 1, 2] as const;
const SIZES = { 2: "far", 1: "near" } as const;

const reelIndex = (current: number, k: number, n: number) => {
  if (current >= 0) return (((current + k) % n) + n) % n;
  // Nothing worn: the first items follow, the last ones come before.
  return k > 0 ? k - 1 : n + k;
};

export const Hud = () => {
  const { look, hints } = useStudio();
  const slot = SLOTS[look.slot];
  const current = look.picks[look.slot];
  const n = slot.items.length;
  const worn = look.picks.some((p) => p >= 0);

  return (
    <Html fullscreen zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <style>{CSS}</style>
      <div className="ts">
        <div className="ts-band" />

        <div
          className={`ts-hint${hints.swiped ? "" : " on"}`}
          aria-hidden="true"
        >
          <Chevron dir="left" />
          <span className="ts-hand-sweep">👋</span>
          <Chevron dir="right" />
        </div>
        <div
          className={`ts-hint${hints.swiped && worn && !hints.locked ? " on" : ""}`}
          aria-hidden="true"
        >
          <span className="ts-hand-pinch">🤏</span>
        </div>

        <div className="ts-controls">
          <div className="ts-reel" role="group" aria-label={slot.id}>
            {OFFSETS.map((k) => {
              if (k === 0) {
                const item = current >= 0 ? slot.items[current] : null;
                return (
                  <button
                    key="mid"
                    type="button"
                    className="ts-tile mid"
                    aria-label={item ? `take off ${label(item)}` : "nothing"}
                    onClick={() => item && actions.pick(look.slot, -1)}
                  >
                    {item ? (
                      <img key={item.id} src={thumbUrl(item.id)} alt="" />
                    ) : (
                      <span className="ts-none" />
                    )}
                  </button>
                );
              }
              const i = reelIndex(current, k, n);
              const item = slot.items[i];
              return (
                <button
                  key={k}
                  type="button"
                  className={`ts-tile ${SIZES[Math.abs(k) as 1 | 2]}`}
                  aria-label={label(item)}
                  onClick={() => actions.pick(look.slot, i)}
                >
                  <img src={thumbUrl(item.id)} alt="" />
                </button>
              );
            })}
          </div>

          <div className="ts-row">
            {SLOTS.map((s, i) => {
              const on = look.picks[i];
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`ts-btn ts-chip${i === look.slot ? " on" : ""}`}
                  aria-label={s.id}
                  aria-pressed={i === look.slot}
                  onClick={() => actions.selectSlot(i)}
                >
                  {on >= 0 ? (
                    <img src={thumbUrl(s.items[on].id)} alt="" />
                  ) : (
                    s.icon
                  )}
                  <span className={`ts-lock${look.locked[i] ? " on" : ""}`}>
                    <Check />
                  </span>
                </button>
              );
            })}
            <span className="ts-gap" />
            <button
              type="button"
              className="ts-btn ts-small"
              aria-label="Shuffle"
              onClick={() => actions.shuffle()}
            >
              🎲
            </button>
            <button
              type="button"
              className="ts-btn ts-small"
              aria-label="Reset"
              onClick={() => actions.reset()}
            >
              <ResetIcon />
            </button>
          </div>
        </div>
      </div>
    </Html>
  );
};
