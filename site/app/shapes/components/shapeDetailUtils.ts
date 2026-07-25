// Pure detail-derivation helpers for the shape detail panel (Task Group 12).
// Same peer-dep boundary as `shapeLibraryUtils.ts`: imports only from
// "tonal-guitar" (plus this file's own local sibling module), never
// "@tonaljs/*" directly. All Tonal-touching calls the panel needs live here
// so `ShapeDetailPanel.tsx` (a later task group) stays free of library calls
// in JSX and can run everything in a `useMemo` keyed on the selected entry.
//
// Every helper documented below degrades gracefully — empty array/
// `undefined`, never throws — for the registry gaps verified in
// `.tonal-guitar/features/shape-detail-panel/research.md`: missing
// `chordType`/`inversion` on the 5 base CAGED majors, an empty alternate-
// fingering query, an unresolvable scale name, an unmapped `quality`, and an
// empty `identifyChord` result.
import {
  identifyChord,
  scalesContainingChord,
  chordShapes,
  buildFromScale,
  relatedScales,
  modeShapes,
  STANDARD,
} from "tonal-guitar";
import type {
  ChordShape,
  ScalesContainingChordResult,
} from "tonal-guitar";
import type {
  ChordCatalogEntry,
  ScaleCatalogEntry,
  ShapeCatalogEntry,
} from "./shapeLibraryUtils";

// Re-exposed here (12.4) so the panel can pull its report-problem plumbing
// from the same module as every other detail helper. The implementation
// stays in `shapeLibraryUtils.ts` — this is a re-export, not a fork.
export { buildReportUrl } from "./shapeLibraryUtils";

// ============================================================
// Chord entries (12.2)
// ============================================================

/**
 * The chord name the rest of the chord-entry helpers key off, derived from an
 * already-computed `identifyChord` result: its first entry when Tonal can
 * name the built voicing, else `` `${renderRoot}${chordType}` `` when the
 * shape at least carries a `chordType`, else `undefined` (e.g. an
 * unidentifiable voicing on one of the 5 base CAGED majors, which have
 * neither). Factored out of `chordDetailFor` so that helper can derive both
 * `chordName` and `identified` from a single `identifyChord` call rather than
 * re-invoking it.
 */
function chordNameFromIdentified(entry: ChordCatalogEntry, identified: string[]): string | undefined {
  if (identified.length > 0) return identified[0];

  if (entry.shape.chordType !== undefined) {
    return `${entry.renderRoot}${entry.shape.chordType}`;
  }

  return undefined;
}

export interface ChordDetailResult {
  /** Full `identifyChord(entry.builtFrets, STANDARD)` result — first entry is
   * "primary", the rest are alternates. `[]` renders the "Could not identify
   * these notes" state. */
  identified: string[];
  /** Heading text for "Scales over {chord}"; `undefined` means that section
   * is skipped entirely. */
  chordName: string | undefined;
  /** `scalesContainingChord(chordName)`, or `undefined` when `chordName`
   * couldn't be derived at all. */
  scales: ScalesContainingChordResult | undefined;
}

/**
 * Single-pass chord-entry detail: one `identifyChord` call feeds `identified`,
 * `chordName`, and (via `scalesContainingChord`) `scales` — collapsing what
 * was previously three separate `identifyChord` invocations per chord
 * selection (`identified` directly, `resolveChordName`, and
 * `scalesOverChord`'s own `resolveChordName` re-derivation) into one, and
 * keeping the `identifyChord`/`STANDARD` calls out of `ShapeDetailPanel.tsx`
 * entirely.
 */
export function chordDetailFor(entry: ChordCatalogEntry): ChordDetailResult {
  const identified = identifyChord(entry.builtFrets, STANDARD);
  const chordName = chordNameFromIdentified(entry, identified);
  const scales = chordName === undefined ? undefined : scalesContainingChord(chordName);
  return { identified, chordName, scales };
}

/**
 * The full `chordShapes.query({ chordType })` group for `entry`'s
 * `chordType`, INCLUDING `entry` itself — the shared building block behind
 * `alternateFingerings` (which excludes the current entry),
 * `inversionGroups`, and `siblingStepper` (which both want the current entry
 * in context). Returns `[]` gracefully when `chordType` is `undefined` (the
 * base CAGED majors) rather than querying with an `undefined` filter, which
 * would otherwise match every registered chord shape.
 */
export function chordTypeSiblings(entry: ChordCatalogEntry): ChordShape[] {
  if (entry.shape.chordType === undefined) return [];
  return chordShapes.query({ chordType: entry.shape.chordType });
}

/**
 * Alternate fingerings of the same `chordType`, excluding `entry` itself by
 * `name`. `[]` when `chordType` is undefined (base CAGED majors) or the
 * registry has no other voicing of that type.
 */
export function alternateFingerings(entry: ChordCatalogEntry): ChordShape[] {
  return chordTypeSiblings(entry).filter((shape) => shape.name !== entry.name);
}

export type InversionGroupingMode = "inversion" | "voicingFamily";

export interface InversionGroup {
  /** Raw grouping key: the `inversion` number as a string, the
   * `voicingFamily` value, or `"unknown"` when neither is set on a sibling. */
  key: string;
  /** Display label — "Root position" / "1st inversion" / ... in `"inversion"`
   * mode, the `voicingFamily` value (or "Other") in `"voicingFamily"` mode. */
  label: string;
  shapes: ChordShape[];
}

export interface InversionGroupsResult {
  /** Which field the groups are keyed by. `"voicingFamily"` is the fallback
   * used when `entry` has no `chordType`/`inversion` to group siblings by
   * (the base CAGED majors — spec: "degrade to voicing-family grouping"). */
  mode: InversionGroupingMode;
  groups: InversionGroup[];
}

const INVERSION_LABELS: Readonly<Record<number, string>> = {
  0: "Root position",
  1: "1st inversion",
  2: "2nd inversion",
  3: "3rd inversion",
};

function inversionLabel(inversion: number): string {
  return INVERSION_LABELS[inversion] ?? `${inversion}th inversion`;
}

/**
 * Groups `siblings` (conventionally `chordTypeSiblings(entry)`, so the
 * current entry is included) by `ChordShape.inversion`. Degrades to grouping
 * by `voicingFamily` when `entry` itself has no `chordType`/`inversion` —
 * the metadata gap on the 5 base CAGED majors — since grouping by an absent
 * field would otherwise collapse everything into a single "unknown" bucket.
 * Groups are sorted: numerically by inversion in `"inversion"` mode,
 * alphabetically by key in `"voicingFamily"` mode. Never throws — an empty
 * `siblings` array yields `{ mode, groups: [] }`.
 */
export function inversionGroups(
  entry: ChordCatalogEntry,
  siblings: readonly ChordShape[],
): InversionGroupsResult {
  const canGroupByInversion =
    entry.shape.chordType !== undefined && entry.shape.inversion !== undefined;
  const mode: InversionGroupingMode = canGroupByInversion ? "inversion" : "voicingFamily";

  const buckets = new Map<string, ChordShape[]>();
  for (const shape of siblings) {
    const key =
      mode === "inversion"
        ? shape.inversion !== undefined
          ? String(shape.inversion)
          : "unknown"
        : shape.voicingFamily ?? "unknown";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(shape);
    else buckets.set(key, [shape]);
  }

  const groups: InversionGroup[] = [...buckets.entries()]
    .sort(([a], [b]) => {
      if (mode === "inversion") {
        const numA = a === "unknown" ? Infinity : Number(a);
        const numB = b === "unknown" ? Infinity : Number(b);
        return numA - numB;
      }
      return a.localeCompare(b);
    })
    .map(([key, shapes]) => ({
      key,
      label:
        mode === "inversion"
          ? key === "unknown"
            ? "Unknown inversion"
            : inversionLabel(Number(key))
          : key === "unknown"
            ? "Other"
            : key,
      shapes,
    }));

  return { mode, groups };
}

export interface SiblingStepperInfo {
  /** 0-based position of `entry` within `siblings` (matched by `name`), or
   * `-1` when `entry` isn't present in `siblings`. */
  index: number;
  /** `siblings.length` — total voicing count for the "voicing i of n" copy. */
  total: number;
}

/**
 * Current index + total count for the Prev/Next voicing stepper. `siblings`
 * is conventionally `chordTypeSiblings(entry)` so the current entry is
 * included and `index`/`total` read naturally as "voicing i of n". Never
 * throws — an empty `siblings` array yields `{ index: -1, total: 0 }`.
 */
export function siblingStepper(
  entry: ChordCatalogEntry,
  siblings: readonly ChordShape[],
): SiblingStepperInfo {
  const index = siblings.findIndex((shape) => shape.name === entry.name);
  return { index, total: siblings.length };
}

// ============================================================
// Scale entries (12.3)
// ============================================================

/** `ScaleShape.quality` -> full scale-name suffix seeded at a root. Every
 * other quality value (including `undefined`, the gap on the un-relabeled
 * major CAGED/pentatonic/3NPS shapes) is unmapped by design — see the
 * module-level degrade-gracefully note. */
const QUALITY_SCALE_NAME: Readonly<Record<string, string>> = {
  major: "major",
  minor: "minor",
  "minor-pentatonic": "minor pentatonic",
};

/**
 * Derives a full scale name (e.g. "C major") seeded at `renderRoot` from
 * `shape.quality`, for feeding `buildFromScale`/`relatedScales`/`modeShapes`.
 * Returns `undefined` for an absent or unmapped `quality` — notably the
 * registry's un-relabeled major CAGED/pentatonic/3NPS shapes, which carry no
 * `quality` at all (only their `relabelShape`-derived minor counterparts do).
 */
export function relatedScaleNameFor(
  shape: ScaleCatalogEntry["shape"],
  renderRoot: string,
): string | undefined {
  if (shape.quality === undefined) return undefined;
  const suffix = QUALITY_SCALE_NAME[shape.quality];
  if (suffix === undefined) return undefined;
  return `${renderRoot} ${suffix}`;
}

/**
 * Related scales/modes for a scale entry: `buildFromScale(shape, scaleName)`
 * (the catalog's own `buildFrettedScale` leaves `scaleType: ""`, so this
 * does its own build) then `relatedScales(built)`. `[]` when the scale name
 * can't be derived (`relatedScaleNameFor` -> `undefined`) or the build
 * itself comes back empty.
 */
export function relatedScalesForEntry(
  entry: ScaleCatalogEntry,
): Array<{ root: string; scale: string }> {
  const scaleName = relatedScaleNameFor(entry.shape, entry.renderRoot);
  if (scaleName === undefined) return [];

  const built = buildFromScale(entry.shape, scaleName, STANDARD);
  if (built.empty) return [];

  return relatedScales(built);
}

export interface CompatibleShapesResult {
  /** Other registered scale shapes compatible with the same derived scale
   * name, current entry excluded. `[]` when no scale name could be derived. */
  shapes: ScaleCatalogEntry["shape"][];
  /**
   * Q4 (`docs/QUESTIONS.md`) footnote flag: `true` when `entry.shape.system
   * === "3nps"`, so the panel can caveat that 3NPS shapes carry traditional
   * modal names Tonal-derived compatibility doesn't corroborate — never an
   * assertion that the names match or don't.
   */
  q4Footnote: boolean;
}

/**
 * Compatible-shape context for a scale entry: `modeShapes(scaleName)` (which
 * already sweeps every registered shape via `isShapeCompatible`), restricted
 * to shapes other than `entry` itself. `shapes` is `[]` when no scale name
 * can be derived for `entry` (same gap as `relatedScalesForEntry`).
 */
export function compatibleShapesForEntry(entry: ScaleCatalogEntry): CompatibleShapesResult {
  const q4Footnote = entry.shape.system === "3nps";
  const scaleName = relatedScaleNameFor(entry.shape, entry.renderRoot);
  if (scaleName === undefined) return { shapes: [], q4Footnote };

  const shapes = modeShapes(scaleName).filter((shape) => shape.name !== entry.shape.name);
  return { shapes, q4Footnote };
}

/**
 * Same-`(system, quality)` siblings for a scale entry, INCLUDING `entry`
 * itself and sorted by name — the single source of truth for this sibling
 * set, shared by `siblingScaleStepper` (below) and by
 * `ShapeDetailPanel.tsx`'s own sibling-stepper navigation, mirroring how
 * `chordTypeSiblings` is shared by the chord path's stepper/inversions/
 * alternate-fingering helpers. `catalog` is the full shape catalog (as built
 * by `buildCatalog`) rather than a pre-filtered list — scale shapes have no
 * registry-level query helper analogous to `chordShapes.query`, so the
 * sibling set is derived here by filtering scale entries to `entry`'s
 * `(system, quality)` pair, ordered by name (matching `sortScaleEntries`).
 * Entries with `quality: undefined` are only grouped with other
 * `quality: undefined` entries of the same `system`, never conflated with a
 * defined quality.
 */
export function scaleSiblings(
  entry: ScaleCatalogEntry,
  catalog: readonly ShapeCatalogEntry[],
): ScaleCatalogEntry[] {
  return catalog
    .filter(
      (candidate): candidate is ScaleCatalogEntry =>
        candidate.kind === "scale" &&
        candidate.shape.system === entry.shape.system &&
        candidate.shape.quality === entry.shape.quality,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Same-`(system, quality)` sibling stepper for scale entries, mirroring
 * `siblingStepper`'s chord counterpart. Built on `scaleSiblings` so the
 * index it returns is always meaningful against that same list — callers
 * needing the sibling list itself (e.g. for Prev/Next navigation) should call
 * `scaleSiblings` directly rather than recomputing it.
 */
export function siblingScaleStepper(
  entry: ScaleCatalogEntry,
  catalog: readonly ShapeCatalogEntry[],
): SiblingStepperInfo {
  const siblings = scaleSiblings(entry, catalog);
  const index = siblings.findIndex((candidate) => candidate.name === entry.name);
  return { index, total: siblings.length };
}
