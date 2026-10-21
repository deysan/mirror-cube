import { lazy } from "react";

// Keep the graphics stack out of the page's synchronous dependency graph.
// Module-scoped identity preserves the canvas across language/session updates.
export const LazyCubeScene = lazy(() => import("./CubeScene").then(module => ({ default: module.CubeScene })));
