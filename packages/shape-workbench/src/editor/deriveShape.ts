/**
 * Pure cells<->ChordShape conversion for the Editor screen (spec §5.4, §9
 * edge case 9). Wraps `fretboard-ui`'s `cellsToChordShape`/`frettedNotesToCells`
 * with the two rules the base editor doesn't know about:
 *
 *  - "stored as intervals, never frets... the lowest string carrying `1P`
 *    becomes `rootString`" — `cellsToChordShape` derives `rootString` from
 *    whichever cell the author explicitly marked `isRoot`, which is not
 *    necessarily the lowest string carrying an interval of `"1P"` (the same
 *    pitch class can appear on more than one string, e.g. an octave
 *    doubling). `deriveChordGeometry` recomputes it from the built
 *    `strings` array instead.
 *  - "Refuses to save without a `1P`" — `deriveChordGeometry` (and
 *    everything built on it) returns `undefined` whenever no string ends up
 *    carrying `"1P"`, whether because no root was marked at all
 *    (`cellsToChordShape` itself returns `null`) or a marked root's string
 *    got muted/overwritten and no other string carries the same pitch
 *    class.
 *
 * No React/DOM imports — testable without rendering anything.
 */
import { cellsToChordShape, frettedNotesToCells, type EditorCell } from "fretboard-ui";
import { applyChordShape, isMovable } from "tonal-guitar";
import type { Barre, ChordShape } from "tonal-guitar";
import { semitones } from "@tonaljs/interval";
import type { RawGeometry, WorkbenchDraft } from "../store";

export interface ChordGeometry {
  strings: (string | null)[];
  fingers: (number | null)[];
  rootString: number;
}

/** The lowest string index carrying interval `"1P"`, or `undefined` when no
 * string does — the save-refusal condition (spec §9 edge case 9). */
export function deriveRootString(strings: (string | null)[]): number | undefined {
  const index = strings.findIndex((interval) => interval === "1P");
  return index === -1 ? undefined : index;
}

/**
 * Converts the editor's live `cells` into `{ strings, fingers, rootString }`
 * — `undefined` when there's no marked root (`cellsToChordShape` returns
 * `null`) or the built `strings` end up with no `"1P"` anywhere.
 */
export function deriveChordGeometry(
  cells: EditorCell[],
  tuning: string[],
  rootPitchClass: string | undefined,
): ChordGeometry | undefined {
  const result = cellsToChordShape(cells, tuning, rootPitchClass);
  if (result === null) return undefined;

  const rootString = deriveRootString(result.strings);
  if (rootString === undefined) return undefined;

  return { strings: result.strings, fingers: result.fingers, rootString };
}

// Normalize an interval's semitone width to [0, 12) — spelling-agnostic
// chroma, so "9M" (14 semitones) and "2M" (2 semitones) compare equal.
function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
function chromaOfInterval(ivl: string): number {
  return mod12(semitones(ivl));
}

/**
 * Per-string: `cellsToChordShape`'s underlying `intervalFromTo` only emits
 * the 12 simple interval names (spelling-agnostic chroma, e.g. always
 * `"2M"`, never a compound like `"9M"`), so re-deriving geometry from
 * unchanged cells silently collapses a registry shape authored with
 * `"9M"`/`"11P"`/`"4A"` etc. down to its simple form. When a derived
 * string's chroma matches `base.strings` at the same index, keep `base`'s
 * original spelling instead of the collapsed one — this is what keeps a
 * metadata-only (or finger-only) edit from silently rewriting `strings` in
 * the save patch (spec §9 edge case 9 / CR-055).
 *
 * Deliberately independent of whether the finger at that string changed
 * (CR-114): fingers are carried on their own `geometry.fingers` array and
 * patched separately (`buildShapeFromCells` below sets `fingers:
 * geometry.fingers` unconditionally) — gating spelling-preservation on
 * finger equality made a pure finger relabel (e.g. re-fingering a "9M"
 * string) spuriously collapse that string's spelling too, the exact silent
 * `strings` rewrite CR-055 was meant to prevent.
 */
function preserveBaseSpelling(
  base: ChordShape,
  geometry: ChordGeometry,
): (string | null)[] {
  return geometry.strings.map((derived, i) => {
    const baseInterval = base.strings[i];
    if (derived === null || baseInterval === null || baseInterval === undefined) {
      return derived;
    }
    return chromaOfInterval(derived) === chromaOfInterval(baseInterval) ? baseInterval : derived;
  });
}

/**
 * Merges freshly-derived geometry (strings/fingers/rootString) and the
 * author's explicit `barres` array into `base` — every other field on
 * `base` (name, chordType, tags, cagedPosition, ...) is carried through
 * untouched. Returns `undefined` when `deriveChordGeometry` refuses (no
 * `1P` root) — the caller is expected to surface the save-refusal message
 * in that case, per spec §5.4/§9 edge case 9.
 */
export function buildShapeFromCells(
  base: ChordShape,
  cells: EditorCell[],
  barres: Barre[],
  tuning: string[],
  rootPitchClass: string | undefined,
): ChordShape | undefined {
  const geometry = deriveChordGeometry(cells, tuning, rootPitchClass);
  if (geometry === undefined) return undefined;

  return {
    ...base,
    strings: preserveBaseSpelling(base, geometry),
    fingers: geometry.fingers,
    rootString: geometry.rootString,
    barres,
  };
}

/**
 * Inverse of the cells<->shape round trip: seeds `FretboardEditor` cells and
 * a `barres` array from an already-authored `ChordShape` at `root` — used
 * to open an existing/duplicated shape into the editor (spec §5.3
 * `onEditShape`/`onDuplicateToPosition`). Builds the grip with open strings
 * disabled (movable templates are authored fretted, never relying on an
 * open string falling out of the interval math) and converts the built
 * positions via `frettedNotesToCells`, then folds in `shape.fingers` by
 * string index.
 */
export function seedCellsFromShape(
  shape: ChordShape,
  tuning: string[],
  root: string,
): { cells: EditorCell[]; barres: Barre[] } {
  const built = applyChordShape(shape, root, tuning, { allowOpenStrings: false });
  const cells = frettedNotesToCells(built.positions).map((cell) => ({
    ...cell,
    finger: shape.fingers[cell.string] ?? null,
  }));
  return { cells, barres: shape.barres.map((barre) => ({ ...barre })) };
}

/** Whether a `"gap"`-origin draft's shape has already been fully authored
 * elsewhere (`onDuplicateToPosition` seeds from an existing shape) — a
 * blank shape has no cells/barres to lose, so it's the only case where
 * `seedForDraft` (with no `rawGeometry` yet) is safe to seed as empty
 * rather than round-tripping through `seedCellsFromShape`. Also gates the
 * Editor's one-time auto-fingering seed (tasks.md 26.6), which must not run
 * against an already-authored grip. */
export function shapeIsBlank(shape: ChordShape): boolean {
  return (
    shape.strings.every((s) => s === null) && shape.fingers.every((f) => f === null) && shape.barres.length === 0
  );
}

/**
 * The Editor's initial `cells`/`barres` local state for a slot (CR-115):
 * prefers `draft.rawGeometry` — the exact editor state as last left,
 * including a destructive edit that derives no valid `ChordShape` (clearing
 * the grip, muting every string, removing the root) — over re-deriving from
 * `draft.shape`. Without this, resuming a draft after such an edit
 * resurrects whatever notes were on the shape the LAST valid save/seed left
 * behind, silently undoing the clear. Falls back to the pre-CR-115
 * behavior — an empty seed for a still-blank gap draft, or
 * `seedCellsFromShape` off the authored shape — only when there's no
 * `rawGeometry` yet (a brand-new draft, or one saved by a build that
 * predates this field).
 */
export function seedForDraft(
  draft: { shape: ChordShape; rawGeometry?: RawGeometry },
  tuning: string[],
  root: string,
): { cells: EditorCell[]; barres: Barre[] } {
  if (draft.rawGeometry !== undefined) return draft.rawGeometry;
  if (shapeIsBlank(draft.shape)) return { cells: [], barres: [] };
  return seedCellsFromShape(draft.shape, tuning, root);
}

/**
 * Merges the Editor's live `cells`/`barres` into `draft` (CR-115): always
 * refreshes `rawGeometry` to the exact current editor state — even a
 * destructive edit that derives no valid shape — and only updates `shape`
 * when `derivedShape` is defined. A destructive edit therefore leaves
 * `draft.shape` at its last valid value (still used for Checks/Table/Output
 * preview's display fallback, and for save, which always refuses on
 * `undefined` regardless) while `rawGeometry` becomes the source of truth
 * `seedForDraft` reads back on resume — so a cleared grip stays cleared
 * instead of being silently resurrected by the stale `shape`.
 */
export function withGeometry(
  draft: WorkbenchDraft,
  cells: EditorCell[],
  barres: Barre[],
  derivedShape: ChordShape | undefined,
): WorkbenchDraft {
  return {
    ...draft,
    rawGeometry: { cells, barres },
    ...(derivedShape !== undefined ? { shape: derivedShape } : {}),
  };
}

/**
 * The derived, human-readable reason behind `isMovable(shape)`'s value
 * (spec §5.4 Properties panel: "shows the derived `movable` reason"). The
 * boolean itself always comes from the exported `isMovable` helper — this
 * only adds the explanatory text for whichever branch it took.
 */
export function movableReason(shape: ChordShape): string {
  if (shape.movable !== undefined) {
    return isMovable(shape)
      ? "movable: true (explicit override)"
      : "movable: false (explicit override)";
  }
  return isMovable(shape)
    ? "movable — no canonicalRoot set"
    : `not movable — canonicalRoot "${shape.canonicalRoot}" pins this shape to one root`;
}
