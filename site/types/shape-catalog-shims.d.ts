/**
 * Type shim for `shape-catalog`'s relative `.mjs` import of
 * `scripts/lib/render-shape.mjs` (spec §6.5), mirroring
 * `packages/shape-catalog/src/render-shape-mjs.d.ts` (Group 16/17's
 * ambient-module bridge for TS7016 — `bundler`/`node16` module resolution
 * only pairs a `.mjs` specifier with a sibling `.d.mts`, and
 * `scripts/lib/render-shape.mjs` only ships a `.d.ts`).
 *
 * `packages/shape-catalog`'s own `tsconfig.json` includes that shim
 * directly (`"include": ["src/**\/*"]`), so `npx tsc --noEmit -p
 * packages/shape-catalog` and the package's own vitest run see it. Next's
 * `next build` type-check does not: it type-checks `shape-catalog`'s
 * source (via `transpilePackages`) as part of the reachable module graph,
 * but only pulls in ambient `.d.ts` declaration files that are themselves
 * part of *this* project's own TS program (matched by `site/tsconfig.json`
 * `include`), which never reaches a file living outside `site/`. This
 * site-local copy closes that gap without touching `packages/**` or
 * `scripts/**` (out of this task's file scope) — see
 * `.tonal-guitar/features/shape-workbench/spec.md` §7/§10 Phase 2
 * acceptance ("site renders the shared `ShapeCard`" via `npm --prefix site
 * run build`).
 */
declare module "*/render-shape.mjs" {
  export function exportIdentifierFor(
    kind: import("../../scripts/lib/render-shape").ShapeKind,
    shape: import("../../scripts/lib/render-shape").ShapeLike,
  ): string;

  export function renderShape(
    kind: import("../../scripts/lib/render-shape").ShapeKind,
    shape: import("../../scripts/lib/render-shape").ShapeLike,
    options?: import("../../scripts/lib/render-shape").RenderShapeOptions,
  ): Promise<string>;
}

/**
 * `render.ts` also has a second, extension-less, type-only relative import
 * of the same module (`export type { ShapeKind, ShapeLike,
 * RenderShapeOptions } from "../../../scripts/lib/render-shape"`) for the
 * real hand-written `scripts/lib/render-shape.d.ts`. That file exists on
 * disk, so this one isn't a `.mjs`/`.d.mts` pairing gap like the one
 * above — it fails only because `site/tsconfig.json`'s
 * `preserveSymlinks: true` (needed so `fretboard-ui`'s own `import "react"`
 * resolves against `site/node_modules` — see #52) makes TypeScript compute
 * `shape-catalog`'s *own* relative imports from its symlinked location
 * under `site/node_modules/shape-catalog/src/`, not its real path under
 * `packages/shape-catalog/src/`, so `../../../scripts/lib/render-shape`
 * resolves to a nonexistent `site/scripts/lib/render-shape`. Same wildcard
 * bridge, same reasoning as above.
 */
declare module "*/render-shape" {
  export type ShapeKind = import("../../scripts/lib/render-shape").ShapeKind;
  export type ShapeLike = import("../../scripts/lib/render-shape").ShapeLike;
  export type RenderShapeOptions = import("../../scripts/lib/render-shape").RenderShapeOptions;
}
