// Scene.tsx — Try-On Studio: build a look one slot at a time (hat, face,
// mouth). Sweep a hand sideways in the air to flip through the active slot,
// pinch to lock it and move on; or tap the dots and chips. Shuffle for a
// random look, reset to start again. See PLAN.md.
import { lazy, Suspense } from "react";

import { Accessories } from "./tryon/Accessories";
import { HandInput } from "./tryon/HandInput";
import { Hud } from "./tryon/Hud";

// Dev-only helpers for previewing without a camera. Lazy and behind a
// constant esbuild folds to false in production. Two rules:
// `process.env.NODE_ENV`, not `import.meta.env.DEV` (vincentt-xr/v2-template#112);
// and write the check INSIDE the ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevKeys =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./tryon/DevKeys"))
    : null;

export const Scene = () => (
  <>
    <Accessories />
    <HandInput />
    <Hud />
    {DevMediaSwitcher && DevKeys ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
        <DevKeys />
      </Suspense>
    ) : null}
  </>
);
