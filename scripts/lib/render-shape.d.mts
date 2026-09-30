/**
 * TS-consumer type declarations for `./render-shape.mjs` (shape-workbench
 * spec §6.5). Kept hand-written and deliberately independent of `src/shape.ts`
 * so this printer's contract stays stable even if the library's field set
 * changes shape — `renderShape` accepts any plain shape-like record, prints
 * only the keys it finds, and never inspects TS types at runtime.
 */

/** The three shape registries this printer knows how to name/print for. */
export type ShapeKind = "chord" | "scale" | "arpeggio";

/**
 * Minimal structural contract `renderShape`/`exportIdentifierFor` rely on.
 * Deliberately a loose `Record<string, unknown>` rather than importing
 * `ChordShape`/`ScaleShape`/`ArpeggioShape` from `../../src/shape` — this
 * printer only ever reads `name` plus whatever other own, defined keys the
 * caller passes, and prints unrecognized keys alphabetized at the end
 * rather than rejecting them.
 */
export interface ShapeLike {
  name: string;
  [key: string]: unknown;
}

export interface RenderShapeOptions {
  /**
   * Export identifier to use instead of the generated
   * `exportIdentifierFor(kind, shape)` value (spec §1.8/§6.1
   * `AddChange.ident`). Must be a valid TS identifier.
   */
  ident?: string;
  /**
   * Defaults to `true`. When `prettier` is resolvable at runtime, the
   * printer formats its output through it (spec §6.5); pass `false` to
   * force the printer's own deterministic fallback formatting instead.
   */
  usePrettier?: boolean;
}

/**
 * Deterministic export identifier for a shape: `<KIND_PREFIX>_<NAME_UPPER_SNAKE>`,
 * e.g. `exportIdentifierFor("chord", { name: "E Shape Minor" })` ->
 * `"CHORD_E_SHAPE_MINOR"`. Throws a `TypeError` when `shape.name` is empty,
 * non-string, or slugifies to an empty identifier.
 */
export declare function exportIdentifierFor(kind: ShapeKind, shape: ShapeLike): string;

/**
 * Renders a chord/scale/arpeggio shape object to a deterministic
 * `export const <IDENT>: <Type> = { ... };\n` TS statement: stable
 * identifier naming, stable key order, consistent double-quoting, and
 * stable formatting (via `prettier` when resolvable, otherwise the
 * printer's own fallback formatter). Calling it twice on the same `shape`
 * and `options` is byte-identical.
 */
export declare function renderShape(
  kind: ShapeKind,
  shape: ShapeLike,
  options?: RenderShapeOptions
): Promise<string>;
