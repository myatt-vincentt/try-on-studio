// The controls, wordless, in the lower middle where a thumb (or a hand in
// the air) reaches them. Night glass: Cypress 64 % glass, white marks, Arles
// the only accent; strict ease-out.
//
//   ‹  • • • • • • • •  ›      the active slot's items (tap one, or the arrows)
//   🎩  🎭  🥸   🎲  ↺          slots (tap to pick one), shuffle, reset
//
// Two hints above them, until answered: a hand sweeping sideways (swipe in
// the air to flip), then a pinch (lock the slot).
import { Html } from "@react-three/drei";

import { SLOTS } from "./catalog";
import { actions, useStudio } from "./state";

const CSS = `
.ts { --glass: rgb(35 37 40 / .64); --arles: #f4d968; --blur: blur(20px) saturate(1.5);
  position: absolute; inset: 0; user-select: none; -webkit-user-select: none;
  font-family: system-ui, sans-serif; color: #fff; }
.ts-band { position: absolute; left: 0; right: 0; bottom: 0; height: 260px; pointer-events: none;
  background: linear-gradient(rgb(35 37 40 / 0), rgb(35 37 40 / .6)); }
.ts-controls { position: absolute; left: 50%; bottom: max(calc(env(safe-area-inset-bottom) + 24px), 40px);
  transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 14px; }
.ts-row { display: flex; align-items: center; gap: 10px; }
.ts-btn { pointer-events: auto; border: 0; padding: 0; margin: 0; cursor: pointer; color: #fff;
  display: grid; place-items: center; background: var(--glass); backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur); border-radius: 999px;
  transition: transform .18s ease-out, box-shadow .18s ease-out, background .18s ease-out; }
.ts-btn:active { transform: scale(.94); }
.ts-chip { width: 58px; height: 58px; font-size: 28px; position: relative; }
.ts-chip.on { box-shadow: 0 0 0 3px var(--arles); }
.ts-chip .ts-lock { position: absolute; right: -2px; top: -2px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--arles); display: grid; place-items: center; opacity: 0; transform: scale(.6);
  transition: opacity .2s ease-out, transform .2s ease-out; }
.ts-chip .ts-lock.on { opacity: 1; transform: scale(1); }
.ts-small { width: 48px; height: 48px; font-size: 22px; }
.ts-gap { width: 10px; }
.ts-dots { display: flex; align-items: center; gap: 2px; padding: 6px 8px; border-radius: 999px;
  background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); }
.ts-dot { pointer-events: auto; border: 0; margin: 0; padding: 0; width: 26px; height: 30px; cursor: pointer;
  background: transparent; display: grid; place-items: center; }
.ts-dot > i { display: block; width: 12px; height: 12px; border-radius: 50%; opacity: .55;
  box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / .7); transition: all .2s ease-out; }
.ts-dot.on > i { width: 18px; height: 18px; opacity: 1; box-shadow: 0 0 0 2.5px #fff; }
.ts-arrow { width: 42px; height: 42px; }
.ts-hint { position: absolute; left: 50%; bottom: max(calc(env(safe-area-inset-bottom) + 190px), 206px);
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
@media (prefers-reduced-motion: reduce) { .ts-hand-sweep, .ts-hand-pinch { animation: none; } }
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

export const Hud = () => {
  const { look, hints } = useStudio();
  const slot = SLOTS[look.slot];
  const current = look.picks[look.slot];
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
          <div className="ts-row">
            <button
              type="button"
              className="ts-btn ts-arrow"
              aria-label="Previous"
              onClick={() => actions.step(-1)}
            >
              <Chevron dir="left" />
            </button>
            <div className="ts-dots">
              {slot.items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ts-dot${i === current ? " on" : ""}`}
                  aria-label={item.id}
                  onClick={() => actions.pick(look.slot, i)}
                >
                  <i style={{ background: item.color }} />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ts-btn ts-arrow"
              aria-label="Next"
              onClick={() => actions.step(1)}
            >
              <Chevron dir="right" />
            </button>
          </div>

          <div className="ts-row">
            {SLOTS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`ts-btn ts-chip${i === look.slot ? " on" : ""}`}
                aria-label={s.id}
                aria-pressed={i === look.slot}
                onClick={() => actions.selectSlot(i)}
              >
                {s.icon}
                <span className={`ts-lock${look.locked[i] ? " on" : ""}`}>
                  <Check />
                </span>
              </button>
            ))}
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
