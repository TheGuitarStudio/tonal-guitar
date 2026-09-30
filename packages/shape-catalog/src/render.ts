/**
 * Re-export of the single TS printer, `scripts/lib/render-shape.mjs` (spec
 * §6.5), so the Shape Workbench's "Copy TS" output and
 * `scripts/shapes-merge.mjs`'s generated `src/data/*.ts` source are
 * byte-identical — never reimplement this printer here. Its types come
 * from the hand-written `scripts/lib/render-shape.d.mts` beside it.
 *
 * Zero React/DOM imports; imports only the printer module (a relative
 * import, not a package dependency — `scripts/lib` is not published).
 *
 * Exposed only as the `shape-catalog/render` subpath, never from the
 * `./index.ts` barrel: the printer reaches outside this package and
 * lazily `import()`s `prettier`, so it must stay out of browser module
 * graphs (the site's static export) that only need the catalog helpers.
 * Its consumers are Node tooling and the Shape Workbench.
 */
import { renderShape } from "../../../scripts/lib/render-shape.mjs";

// Re-exported as `RenderShapeKind` (not `ShapeKind`) — `./catalog` already
// exports a `ShapeKind` (`"scale" | "chord"`, the two-kind catalog-entry
// discriminant); the printer's `ShapeKind` additionally includes
// `"arpeggio"`, so keeping both names distinct avoids conflating the two
// different unions in consumers that import from both entry points.
export type {
  ShapeKind as RenderShapeKind,
  ShapeLike,
  RenderShapeOptions,
} from "../../../scripts/lib/render-shape.mjs";

/**
 * Renders a `ChordShape | ScaleShape | ArpeggioShape` object to a
 * deterministic `export const <IDENT>: <Type> = { ... };\n` TS statement —
 * identical output to `scripts/shapes-merge.mjs`'s generated source for the
 * same `(kind, shape, options)` (spec §6.5's parity requirement, asserted
 * in `render.test.ts`).
 */
export const renderShapeTs = renderShape;
