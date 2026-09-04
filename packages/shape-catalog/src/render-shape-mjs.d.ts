/**
 * Type shim for the relative `.mjs` import in `./render.ts`.
 *
 * `scripts/lib/render-shape.mjs` already ships a hand-written
 * `scripts/lib/render-shape.d.ts` (Group 16), but TypeScript's `bundler`/
 * `node16` module resolution only pairs a `.mjs` specifier with a sibling
 * `.d.mts` declaration file, never a bare `.d.ts` — so an `import ... from
 * "../../../scripts/lib/render-shape.mjs"` can't find it on its own
 * (`TS7016`). We can't add a `.d.mts` file under `scripts/lib/` (out of
 * scope for this package — `scripts/**` is owned by Group 17), so this
 * wildcard ambient module declaration bridges the gap: it matches any
 * specifier ending in `/render-shape.mjs` and re-states the exact same
 * signatures as the real `.d.ts`, sourced via type-only `import()` so this
 * file stays a global (non-module) script and the wildcard pattern applies.
 *
 * This is a types-only shim — Vite/vitest/Node resolve the real `.mjs`
 * file at runtime via the literal relative path in `./render.ts`; nothing
 * here affects that resolution.
 */
declare module "*/render-shape.mjs" {
  export function exportIdentifierFor(
    kind: import("../../../scripts/lib/render-shape").ShapeKind,
    shape: import("../../../scripts/lib/render-shape").ShapeLike,
  ): string;

  export function renderShape(
    kind: import("../../../scripts/lib/render-shape").ShapeKind,
    shape: import("../../../scripts/lib/render-shape").ShapeLike,
    options?: import("../../../scripts/lib/render-shape").RenderShapeOptions,
  ): Promise<string>;
}
