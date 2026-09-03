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
 * string's chroma matches `base.strings` at the same index and the finger
 * there is unchanged, keep `base`'s original spelling instead of the
 * collapsed one — this is what keeps a metadata-only edit from silently
 * rewriting `strings` in the save patch (spec §9 edge case 9 / CR-055).
 */
function preserveBaseSpelling(
  base: ChordShape,
  geometry: ChordGeometry,
): (string | null)[] {
  return geometry.strings.map((derived, i) => {
    const baseInterval = base.strings[i];
    if (
      derived === null ||
      baseInterval === null ||
      baseInterval === undefined ||
      base.fingers[i] !== geometry.fingers[i]
    ) {
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
