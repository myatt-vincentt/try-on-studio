// Dev-only: the keyboard stands in for the hand (← → flip, space locks,
// S shuffles, R resets), and window.__tryon exposes the store, the live head
// filter settings and the catalog for checks in the console. Scene.tsx
// lazy-imports this behind an inline NODE_ENV check, so it never reaches
// production.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { SLOTS } from "./catalog";
import { HEAD_FILTER } from "./headFilter";
import { actions, getStudio, live } from "./state";

const DevKeys = () => {
  const scene = useThree((st) => st.scene);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__tryon = {
      actions,
      get: getStudio,
      live,
      scene,
      // The live filter settings (FilteredHead keeps a reference to it).
      filter: HEAD_FILTER,
      // The catalog, live: item.fit edits apply on the next frame.
      slots: SLOTS,
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

  return null;
};

export default DevKeys;
