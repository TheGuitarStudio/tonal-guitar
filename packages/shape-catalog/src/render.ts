/**
 * Re-export of the single TS printer, `scripts/lib/render-shape.mjs` (spec
 * §6.5), so the Shape Workbench's "Copy TS" output and
 * `scripts/shapes-merge.mjs`'s generated `src/data/*.ts` source are
 * byte-identical — never reimplement this printer here. See
 * `./render-shape-mjs.d.ts` for why this needs a hand-written type shim.
 *
 * Zero React/DOM imports; imports only the printer module (a relative
 * import, not a package dependency — `scripts/lib` is not published).
 */
import { renderShape } from "../../../scripts/lib/render-shape.mjs";

// Re-exported as `RenderShapeKind` (not `ShapeKind`) — `./catalog` already
// exports a `ShapeKind` (`"scale" | "chord"`, the two-kind catalog-entry
// discriminant); the printer's `ShapeKind` additionally includes
// `"arpeggio"`, so keeping both names distinct avoids `export *` ambiguity
// in `./index.ts` and avoids conflating the two different unions.
export type {
  ShapeKind as RenderShapeKind,
  ShapeLike,
  RenderShapeOptions,
} from "../../../scripts/lib/render-shape";

/**
 * Renders a `ChordShape | ScaleShape | ArpeggioShape` object to a
 * deterministic `export const <IDENT>: <Type> = { ... };\n` TS statement —
 * identical output to `scripts/shapes-merge.mjs`'s generated source for the
 * same `(kind, shape, options)` (spec §6.5's parity requirement, asserted
 * in `render.test.ts`).
 */
export const renderShapeTs = renderShape;
