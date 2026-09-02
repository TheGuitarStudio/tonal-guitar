/**
 * Shape visual/quality audit checks.
 *
 * Dependency tier: required-peer-deps (alongside build.ts). This module
 * imports only ./build, ./shape, ./tuning, and @tonaljs/note — it MUST NOT
 * import ./integration or reference @tonaljs/scale, @tonaljs/chord, or
 * @tonaljs/key. See CLAUDE.md's "Dependency layers" section.
 */

import { applyChordShape, buildFrettedScale, Fingering } from "./build";
import {
  all,
  get as getScaleShape,
  chordShapes,
  arpeggioShapes,
  ChordShape,
  ScaleShape,
  ArpeggioShape,
  isMovable,
  playedStringSet,
  gripBaseFret,
  sourceGripBaseFret,
  exportIdentifierFor,
} from "./shape";
import { STANDARD } from "./tuning";
import { chroma, transpose } from "@tonaljs/note";

// ============================================================
// Core types
// ============================================================

export type AuditSeverity = "error" | "warning";

export interface ShapeAuditIssue {
  id: string; // one of the CHECK_* constants
  severity: AuditSeverity;
  message: string; // human-readable, for tooltips only
  details?: Record<string, unknown>; // structured data (frets, strings, span, etc.)
}

export interface ShapeAuditOptions {
  root?: string; // default: displayRootFor(shape)
  tuning?: string[]; // default: STANDARD
  maxFretSpan?: number; // default: 4
}

/**
 * Always-populated (not just on mismatch) geometry data for a `baseFret`-
 * carrying chord shape with a resolvable grip root: the root its source
 * diagram was authored against, and the per-string frets that diagram
 * implies. See `chordShapeGeometry`/`gripRootFor`/`sourceFrets` below —
 * this is the same data `checkGeometryMismatch` computes to decide whether
 * to flag a shape, surfaced unconditionally so consumers (e.g. the Guitar
 * Lab site's shape library) can render a "source frets" row on every
 * resolvable card, not only the ones that mismatch.
 */
export interface ChordGeometryDetails {
  gripRoot: string;
  sourceFrets: (number | null)[];
}

/**
 * Per-shape audit output for a single chord shape: its issue list plus
 * always-populated geometry details (`undefined` when the shape has no
 * `baseFret` or no resolvable grip root — see `chordShapeGeometry`).
 */
export interface ChordShapeAuditResult {
  issues: ShapeAuditIssue[];
  geometry?: ChordGeometryDetails;
}

// ============================================================
// Check-ID constants
// ============================================================

export const CHECK_FRET_SPAN = "fret-span";
export const CHECK_FINGER_ZERO_ON_MOVABLE = "finger-zero-on-movable";
export const CHECK_REPEATED_FINGER_NO_BARRE = "repeated-finger-no-barre";
export const CHECK_BUILD_LOSS = "build-loss";
export const CHECK_METADATA_COMPLETENESS = "metadata-completeness";
export const CHECK_GEOMETRY_MISMATCH = "geometry-mismatch";
// shape-workbench spec §3.1 — required-tier checks.
export const CHECK_STRINGSET_MISMATCH = "stringset-mismatch";
export const CHECK_TUNING_MISMATCH = "tuning-mismatch";
export const CHECK_BARRE_FRET_ORIGIN = "barre-fret-origin";
export const CHECK_NAME_UNIQUE = "name-unique";
// shape-workbench spec §3.1 — arpeggio-only tier-safe checks, analogous to
// checkFretSpan/checkChordBuildLoss but scoped to arpeggio geometry.
export const CHECK_POSITION_SPAN = "position-span";
export const CHECK_FINGERING_COMPLETE = "fingering-complete";
export const CHECK_OVERRIDES_TARGET = "overrides-target";

// ============================================================
// Root helper
// ============================================================

export function displayRootFor(shape: { canonicalRoot?: string }): string {
  return shape.canonicalRoot ?? "C";
}

// ============================================================
// Individual checks
// ============================================================

/**
 * Flags chord shapes whose fretted span (excluding open strings) exceeds
 * `maxSpan`. Promotes the `data.test.ts:474-508` issue #94 regression's
 * inline `maxSpan` helper to a first-class check: `fretted` excludes both
 * muted strings (`null`) and open strings (`fret === 0`) before taking
 * `max - min`, so an open-string drone never inflates the span. Boundary is
 * strict — `span === maxSpan` does not flag.
 *
 * `prebuilt`, if supplied, is used in place of an internal `applyChordShape`
 * call — lets `auditChordShape` hoist one shared build across the checks
 * that use identical (shape, root, tuning) arguments. Standalone callers
 * omit it and get the original self-contained behavior.
 */
export function checkFretSpan(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
  maxSpan = 4,
  prebuilt?: Fingering,
): ShapeAuditIssue[] {
  const { frets } = prebuilt ?? applyChordShape(shape, root, tuning);
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;

  if (span <= maxSpan) return [];

  return [
    {
      id: CHECK_FRET_SPAN,
      severity: "error",
      message: `Fret span of ${span} exceeds the maximum playable span of ${maxSpan}`,
      details: { span, frets, maxSpan },
    },
  ];
}

/**
 * Flags movable shapes (`isMovable(shape)`, shape-workbench spec §1.8 —
 * explicit `movable` when set, else `canonicalRoot === undefined`) that
 * assert finger 0 (an open string) anywhere in `fingers`. Movable shapes are,
 * by definition, never played with an open string — promotes the
 * `data.test.ts:826-836` (issue #39) invariant to a first-class check.
 * Static: no `applyChordShape` call.
 */
export function checkFingerZeroOnMovable(shape: ChordShape): ShapeAuditIssue[] {
  if (!isMovable(shape)) return [];
  if (!shape.fingers.includes(0)) return [];

  return [
    {
      id: CHECK_FINGER_ZERO_ON_MOVABLE,
      severity: "error",
      message: "Movable shape (no canonicalRoot) asserts finger 0 (open string)",
      details: { fingers: shape.fingers },
    },
  ];
}

/**
 * Flags adjacent-string pairs that share a repeated (non-null, non-zero)
 * finger number with no `barres` entry covering both strings — implying a
 * simultaneous press with the same finger on two strings that isn't backed
 * by an actual barre. Promotes the `data.test.ts:839-855` (issue #39)
 * invariant to a first-class check, emitting one issue per uncovered pair.
 * Static: no `applyChordShape` call.
 */
export function checkRepeatedFingerNoBarre(shape: ChordShape): ShapeAuditIssue[] {
  const { fingers, barres } = shape;
  const issues: ShapeAuditIssue[] = [];

  for (let i = 0; i < fingers.length - 1; i++) {
    const finger = fingers[i];
    if (finger === null || finger === 0 || fingers[i + 1] !== finger) continue;

    const covered = barres.some(
      (b) => b.finger === finger && i >= b.fromString && i + 1 <= b.toString,
    );
    if (covered) continue;

    issues.push({
      id: CHECK_REPEATED_FINGER_NO_BARRE,
      severity: "error",
      message: `Finger ${finger} repeats on adjacent strings ${i}, ${i + 1} with no barre entry covering them`,
      details: { finger, strings: [i, i + 1] },
    });
  }

  return issues;
}

/**
 * Flags chord shapes where the build engine silently dropped one or more
 * played notes: `playedCount` (non-null entries in `shape.strings`) exceeds
 * `builtCount` (non-null entries in the built `frets` array). This mirrors
 * `extended-chords.test.ts`'s `assertBuildsPlayable` helper (lines 121-148),
 * which asserts `nonNullFrets.length === impliedStringSet(shape).length` for
 * every registered extended-chord shape — a mismatch there means the
 * fret-window logic in `buildFrettedScale` (invoked via `applyChordShape`)
 * couldn't resolve one of the shape's own intervals (e.g. an unparseable
 * interval string) and quietly dropped the note instead of placing it.
 *
 * `prebuilt`, if supplied, is used in place of an internal `applyChordShape`
 * call — lets `auditChordShape` hoist one shared build across the checks
 * that use identical (shape, root, tuning) arguments. Standalone callers
 * omit it and get the original self-contained behavior.
 */
export function checkChordBuildLoss(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
  prebuilt?: Fingering,
): ShapeAuditIssue[] {
  const { frets } = prebuilt ?? applyChordShape(shape, root, tuning);
  const playedCount = shape.strings.filter((s) => s != null).length;
  const builtCount = frets.filter((f) => f != null).length;

  if (builtCount >= playedCount) return [];

  return [
    {
      id: CHECK_BUILD_LOSS,
      severity: "error",
      message:
        `Built ${builtCount} of ${playedCount} played string(s) — the fret ` +
        `window silently dropped ${playedCount - builtCount} note(s)`,
      details: { playedCount, builtCount, frets },
    },
  ];
}

/**
 * Flags scale shapes where the build engine silently dropped one or more
 * defined notes. Two failure modes:
 *
 * 1. `buildFrettedScale` returns the `NoFrettedScale` sentinel (`empty:
 *    true`) — the root/shape combination couldn't be resolved at all (e.g.
 *    an unparseable root note), so nothing was placed.
 * 2. The build succeeds but places fewer notes than the shape defines:
 *    `slotCount` (the sum of `shape.strings[i].length` over non-null
 *    entries) exceeds `builtCount` (`result.notes.length`) — some
 *    individual interval within the shape couldn't be resolved and was
 *    dropped.
 */
export function checkScaleBuildLoss(
  shape: ScaleShape,
  root: string,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  const slotCount = shape.strings.reduce(
    (sum, s) => sum + (s ? s.length : 0),
    0,
  );
  const result = buildFrettedScale(shape, root, tuning);

  if (result.empty) {
    return [
      {
        id: CHECK_BUILD_LOSS,
        severity: "error",
        message: `Build placed no notes for shape "${shape.name}" at root "${root}"`,
        details: { slotCount, builtCount: 0 },
      },
    ];
  }

  const builtCount = result.notes.length;
  if (builtCount >= slotCount) return [];

  return [
    {
      id: CHECK_BUILD_LOSS,
      severity: "error",
      message:
        `Built ${builtCount} of ${slotCount} defined note(s) — the fret ` +
        `window silently dropped ${slotCount - builtCount} note(s)`,
      details: { slotCount, builtCount },
    },
  ];
}

/**
 * Flags chord shapes missing `chordType` and/or `voicingFamily` — the two
 * harmonic-metadata fields every meaningfully-cataloged chord shape should
 * carry. `stringSet`/`canonicalRoot`/`baseFret` are intentionally NOT
 * required: many valid shapes (movable CAGED forms, jazz shells) omit them
 * by design. The 5 base CAGED majors in `caged-chords.ts` were backfilled
 * with `chordType: "M"`, `voicingFamily: "caged"`, and `cagedPosition` (see
 * §4.4 of the shape-workbench spec), so the registry currently has no
 * chord shape that surfaces a warning here — this check exists to catch
 * future additions that omit the fields, not to flag known-incomplete data.
 */
export function checkChordMetadataCompleteness(shape: ChordShape): ShapeAuditIssue[] {
  const missing: string[] = [];
  if (shape.chordType === undefined) missing.push("chordType");
  if (shape.voicingFamily === undefined) missing.push("voicingFamily");

  if (missing.length === 0) return [];

  return [
    {
      id: CHECK_METADATA_COMPLETENESS,
      severity: "warning",
      message: `Chord shape "${shape.name}" is missing metadata field(s): ${missing.join(", ")}`,
      details: { missing },
    },
  ];
}

/**
 * Flags scale shapes that violate the derived-shape both-or-neither
 * invariant: `quality` and `parentShape` are set together by `relabelShape`
 * (see caged-scales-minor.ts / pentatonic-minor.ts) or not at all on base
 * shapes — exactly one being present indicates a broken/partial relabel.
 */
export function checkScaleMetadataCompleteness(shape: ScaleShape): ShapeAuditIssue[] {
  const hasQuality = shape.quality !== undefined;
  const hasParentShape = shape.parentShape !== undefined;

  if (hasQuality === hasParentShape) return [];

  return [
    {
      id: CHECK_METADATA_COMPLETENESS,
      severity: "warning",
      message:
        `Scale shape "${shape.name}" has only one of quality/parentShape set ` +
        `(expected both or neither)`,
      details: { quality: shape.quality, parentShape: shape.parentShape },
    },
  ];
}

// ============================================================
// checkGeometryMismatch
// ============================================================

// Matches a leading root-letter token, e.g. "G" or "Bb", but only in names
// that follow the authored-grip `"<Root> ... Open"` convention (see
// open-chords.ts). The movable "E/A Form ... Barre" shapes also start with a
// letter in `[A-G]`, but there it names the CAGED form family, not a chord
// root — requiring the trailing "Open" keeps those from being misread.
const OPEN_NAME_ROOT_RE = /^([A-G](#|b)?)\s.*\bOpen$/;

function parseRootFromName(name: string): string | undefined {
  const match = OPEN_NAME_ROOT_RE.exec(name);
  return match ? match[1] : undefined;
}

/**
 * The "grip root" is the root the source diagram (baseFret/fingers) was
 * authored against: `canonicalRoot` when present, else parsed from the
 * shape's `"<Root> ... Open"` name convention (see open-chords.ts). Shapes
 * with neither yield `undefined` and the check is skipped — this includes
 * the movable "E/A Form ... Barre" shapes, whose leading letter is a CAGED
 * form family, not an authored root: their nut-position barre grips (fret 0
 * with a non-zero finger) are structurally indistinguishable from genuine
 * off-by-octave defects, so they are skipped rather than misjudged.
 *
 * Exported (but not re-exported from ./index) so tests can exercise it
 * directly — it is otherwise an internal helper of checkGeometryMismatch.
 */
export function gripRootFor(shape: ChordShape): string | undefined {
  return shape.canonicalRoot ?? parseRootFromName(shape.name);
}

/**
 * Reconstructs, per string, the fret implied by the shape's SOURCE diagram
 * (its `baseFret` window) rather than the build engine's own anchor logic.
 * `strings[i] == null` → muted; `fingers[i] === 0` → open; otherwise the
 * interval's chroma distance from the open string is lifted by octaves
 * until it falls at or above `baseFret`, matching where the source diagram
 * places it.
 *
 * `baseFret` is taken as an explicit parameter rather than read off
 * `shape.baseFret` so the dependency is visible at every call site;
 * `checkGeometryMismatch` passes its already null-checked value.
 *
 * Exported (but not re-exported from ./index) so tests can exercise it
 * directly — it is otherwise an internal helper of checkGeometryMismatch.
 */
export function sourceFrets(
  shape: ChordShape,
  gripRoot: string,
  baseFret: number,
  tuning: string[] = STANDARD,
): (number | null)[] {
  return shape.strings.map((ivl, i) => {
    if (ivl == null) return null;
    if (shape.fingers[i] === 0) return 0;
    const targetPc = transpose(gripRoot, ivl);
    const raw = (((chroma(targetPc) - chroma(tuning[i])) % 12) + 12) % 12;
    let f = raw;
    while (f < baseFret) f += 12;
    return f;
  });
}

/**
 * Computes the always-populated `ChordGeometryDetails` for `shape`: the
 * grip root its source diagram was authored against, and the per-string
 * frets that diagram implies (`sourceFrets`, anchored at `shape.baseFret`).
 * Returns `undefined` under the same two conditions `checkGeometryMismatch`
 * skips under — no `baseFret`, or no resolvable grip root (see
 * `gripRootFor`) — since neither yields a source diagram to reconstruct.
 *
 * This is the single computation both `checkGeometryMismatch` (which
 * additionally compares it against the build engine's own reconstruction)
 * and the aggregate functions (which surface it unconditionally, for every
 * shape, via `ChordShapeAuditResult.geometry`) are built on.
 */
export function chordShapeGeometry(
  shape: ChordShape,
  tuning: string[] = STANDARD,
): ChordGeometryDetails | undefined {
  if (shape.baseFret == null) return undefined;

  const gripRoot = gripRootFor(shape);
  if (gripRoot == null) return undefined;

  return {
    gripRoot,
    sourceFrets: sourceFrets(shape, gripRoot, shape.baseFret, tuning),
  };
}

/**
 * Detects divergence between the build engine's reconstructed geometry
 * (`applyChordShape`, which ignores `baseFret`/`fingers`/`barres`) and the
 * geometry implied by the shape's own source diagram. Applies only to
 * `baseFret`-carrying shapes with a resolvable grip root (the 50
 * `"<Root> ... Open"` open-chords.ts entries) — shell, extended, and
 * caged-7th shapes have no `baseFret`, and the movable "E/A Form ... Barre"
 * shapes have no authored grip root (see gripRootFor); all are skipped ([]).
 * See audit.test.ts's registry-wide sweep for the hand-verified breakdown
 * of the shapes this check flags.
 */
export function checkGeometryMismatch(
  shape: ChordShape,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  const geometry = chordShapeGeometry(shape, tuning);
  if (geometry == null) return [];

  const { gripRoot, sourceFrets: srcFrets } = geometry;
  const builtFrets = applyChordShape(shape, gripRoot, tuning).frets;

  const mismatchedStrings: number[] = [];
  for (let i = 0; i < shape.strings.length; i++) {
    if (shape.strings[i] == null) continue; // muted strings are never compared
    if (builtFrets[i] !== srcFrets[i]) {
      mismatchedStrings.push(i);
    }
  }

  if (mismatchedStrings.length === 0) return [];

  return [
    {
      id: CHECK_GEOMETRY_MISMATCH,
      severity: "warning",
      message:
        `Built geometry diverges from the source diagram on string(s) ` +
        `${mismatchedStrings.join(", ")}`,
      details: {
        gripRoot,
        builtFrets,
        sourceFrets: srcFrets,
        mismatchedStrings,
      },
    },
  ];
}

// ============================================================
// Required-tier checks (shape-workbench spec §3.1)
// ============================================================

/** Order- and length-sensitive array equality (mirrors `toEqual`'s deep-equal semantics). */
function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Flags chord shapes whose explicit `stringSet` diverges from the strings
 * actually played (`playedStringSet(shape)`, ./shape). Skipped (`[]`) when
 * `stringSet` is absent — many valid shapes omit it. Static: no
 * `applyChordShape` call.
 */
export function checkStringsetMismatch(shape: ChordShape): ShapeAuditIssue[] {
  if (shape.stringSet === undefined) return [];

  const played = playedStringSet(shape);
  if (arraysEqual(shape.stringSet, played)) return [];

  return [
    {
      id: CHECK_STRINGSET_MISMATCH,
      severity: "warning",
      message:
        `shape.stringSet [${shape.stringSet.join(", ")}] does not match the ` +
        `played string set [${played.join(", ")}]`,
      details: { stringSet: shape.stringSet, playedStringSet: played },
    },
  ];
}

/**
 * Flags chord shapes whose explicit `tuning` diverges from the tuning the
 * shape is actually being built against. Skipped (`[]`) when `shape.tuning`
 * is absent (the common case — absence means "use STANDARD", per the field's
 * doc comment in ./shape).
 */
export function checkTuningMismatch(
  shape: ChordShape,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  if (shape.tuning === undefined) return [];
  if (arraysEqual(shape.tuning, tuning)) return [];

  return [
    {
      id: CHECK_TUNING_MISMATCH,
      severity: "warning",
      message:
        `shape.tuning [${shape.tuning.join(", ")}] does not match the build ` +
        `tuning [${tuning.join(", ")}]`,
      details: { shapeTuning: shape.tuning, buildTuning: tuning },
    },
  ];
}

/**
 * Flags a `Barre.fret` that cannot be a valid grip-base offset (D-010):
 *
 * 1. `fret < 0` — an offset is never negative.
 * 2. `fret > span` — `span` is the shape's own fretted span (same
 *    `checkFretSpan` computation: max − min over non-null, non-open built
 *    frets), and an offset can never exceed the span it's measured within.
 * 3. For `baseFret`-carrying shapes with a resolvable grip root (see
 *    `chordShapeGeometry`): `fret` equals the ABSOLUTE fret the source
 *    diagram implies for the barre's strings (`sourceFrets[barre.fromString]`)
 *    while a distinct, valid (`>= 0`) offset exists — i.e. the data still
 *    stores the pre-D-010 absolute value instead of the offset. This was the
 *    trigger the Group 13 `open-chords.ts` migration was gated on (see D-010
 *    §4.1) — that migration has landed, and every `src/data/open-chords.ts`
 *    shape (voicingFamily "open"/"barre") now reports zero issues here.
 *    One pre-existing issue elsewhere in the registry (`EXT_CHORD_A_9` in
 *    `src/data/extended-chords.ts`, absolute-style barre fret) predates
 *    D-010 and is tracked separately rather than silently auto-fixed.
 *
 * `root`/`tuning`/`prebuilt` mirror `checkFretSpan`'s signature so
 * `auditChordShape` can thread its single hoisted `applyChordShape` build in
 * without a second rebuild (CR-001).
 */
export function checkBarreFretOrigin(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
  prebuilt?: Fingering,
): ShapeAuditIssue[] {
  if (shape.barres.length === 0) return [];

  const { frets } = prebuilt ?? applyChordShape(shape, root, tuning);
  const fretted = frets.filter((f): f is number => f != null && f > 0);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const gripBase = gripBaseFret(frets);
  const geometry = chordShapeGeometry(shape, tuning);

  const issues: ShapeAuditIssue[] = [];

  shape.barres.forEach((barre, barreIndex) => {
    const clampedOffset = Math.min(Math.max(barre.fret - gripBase, 0), Math.max(span, 0));

    if (barre.fret < 0) {
      issues.push({
        id: CHECK_BARRE_FRET_ORIGIN,
        severity: "warning",
        message: `Barre ${barreIndex}'s fret (${barre.fret}) is negative — a grip-base offset can never be negative`,
        details: { barreIndex, fret: barre.fret, span, gripBase, suggestedOffset: clampedOffset },
      });
      return;
    }

    if (barre.fret > span) {
      issues.push({
        id: CHECK_BARRE_FRET_ORIGIN,
        severity: "warning",
        message:
          `Barre ${barreIndex}'s fret (${barre.fret}) exceeds the shape's fretted span ` +
          `(${span}) — an offset cannot exceed the span it's measured within`,
        details: { barreIndex, fret: barre.fret, span, gripBase, suggestedOffset: clampedOffset },
      });
      return;
    }

    if (geometry == null) return;

    const absoluteSourceFret = geometry.sourceFrets[barre.fromString];
    if (absoluteSourceFret == null) return;

    const sourceGripBase = sourceGripBaseFret(shape, geometry.sourceFrets);
    const suggestedOffset = absoluteSourceFret - sourceGripBase;
    if (
      barre.fret === absoluteSourceFret &&
      suggestedOffset >= 0 &&
      suggestedOffset !== barre.fret
    ) {
      issues.push({
        id: CHECK_BARRE_FRET_ORIGIN,
        severity: "warning",
        message:
          `Barre ${barreIndex}'s fret (${barre.fret}) equals the absolute source-diagram fret ` +
          `rather than a grip-base offset — did you mean offset ${suggestedOffset}?`,
        details: { barreIndex, fret: barre.fret, span, gripBase, suggestedOffset },
      });
    }
  });

  return issues;
}

type NamedShape = { name: string };
export type NameUniqueKind = "chord" | "scale" | "arpeggio";

function registryGetFor(kind: NameUniqueKind, name: string): NamedShape | undefined {
  switch (kind) {
    case "chord":
      return chordShapes.get(name);
    case "scale":
      return getScaleShape(name);
    case "arpeggio":
      return arpeggioShapes.get(name);
  }
}

function registryAllFor(kind: NameUniqueKind): NamedShape[] {
  switch (kind) {
    case "chord":
      return chordShapes.all();
    case "scale":
      return all();
    case "arpeggio":
      return arpeggioShapes.all();
  }
}

/**
 * Errors when `shape.name` is already registered in the target `kind`
 * registry, or `exportIdentifierFor(kind, shape)` collides with another
 * registered entry's derived identifier.
 *
 * Default behavior (no `options`) consults the LIVE registry — safe to
 * compose into `auditChordShape` for already-registered shapes because a
 * shape is never flagged against itself: the registry stores at most one
 * object per name (registration replaces, never duplicates), so a
 * self-comparison only ever matches by reference, never flags. It only fires
 * for a genuinely different, already-registered entry sharing the candidate
 * shape's name or derived identifier.
 *
 * `options.knownNames`/`options.knownIdentifiers`, when supplied, are
 * consulted INSTEAD of the live registry — lets the `shapes:merge` script
 * check a whole changeset's names/identifiers (including other new entries
 * in the same changeset) against a merge-time snapshot without touching the
 * live registry.
 */
export function checkNameUnique(
  shape: NamedShape,
  kind: NameUniqueKind,
  options?: { knownNames?: Set<string>; knownIdentifiers?: Set<string> },
): ShapeAuditIssue[] {
  const issues: ShapeAuditIssue[] = [];
  const identifier = exportIdentifierFor(kind, shape);

  const nameCollides =
    options?.knownNames !== undefined
      ? options.knownNames.has(shape.name)
      : (() => {
          const existing = registryGetFor(kind, shape.name);
          return existing !== undefined && existing !== shape;
        })();

  if (nameCollides) {
    issues.push({
      id: CHECK_NAME_UNIQUE,
      severity: "error",
      message: `Shape name "${shape.name}" is already registered in the ${kind} registry`,
      details: { name: shape.name, kind },
    });
  }

  const identifierCollides =
    options?.knownIdentifiers !== undefined
      ? options.knownIdentifiers.has(identifier)
      : registryAllFor(kind).some(
          (entry) => entry !== shape && exportIdentifierFor(kind, entry) === identifier,
        );

  if (identifierCollides) {
    issues.push({
      id: CHECK_NAME_UNIQUE,
      severity: "error",
      message:
        `Export identifier "${identifier}" for shape "${shape.name}" collides with an ` +
        `existing src/data identifier`,
      details: { identifier, name: shape.name, kind },
    });
  }

  return issues;
}

// ============================================================
// Aggregate functions
// ============================================================

/**
 * Runs all six chord checks (1–6: fret-span, finger-zero-on-movable,
 * repeated-finger-no-barre, chord build-loss, chord metadata-completeness,
 * geometry-mismatch) against a single chord shape and returns the combined
 * issue list. `root` defaults to `displayRootFor(shape)`, `tuning` defaults
 * to `STANDARD`, and `options.maxFretSpan` (if provided) is piped into
 * `checkFretSpan`.
 *
 * `applyChordShape(shape, root, tuning)` is built once here and threaded
 * into `checkFretSpan`/`checkChordBuildLoss` (their `prebuilt` param) since
 * both call it with the exact same arguments (CR-001) — avoids two
 * redundant rebuilds per audited shape. `checkGeometryMismatch` is NOT
 * given the shared build: it reconstructs against `gripRootFor(shape)`
 * (`canonicalRoot`, falling back to a name-parsed root), which diverges
 * from `root` whenever `options.root` overrides the default or
 * `canonicalRoot` is undefined — see audit.test.ts's "overrides the default
 * root" case, where `checkGeometryMismatch` keeps using the shape's own
 * grip root regardless of the override.
 */
export function auditChordShape(
  shape: ChordShape,
  options: ShapeAuditOptions = {},
): ShapeAuditIssue[] {
  const root = options.root ?? displayRootFor(shape);
  const tuning = options.tuning ?? STANDARD;
  const built = applyChordShape(shape, root, tuning);

  return [
    ...checkFretSpan(shape, root, tuning, options.maxFretSpan, built),
    ...checkFingerZeroOnMovable(shape),
    ...checkRepeatedFingerNoBarre(shape),
    ...checkChordBuildLoss(shape, root, tuning, built),
    ...checkChordMetadataCompleteness(shape),
    ...checkGeometryMismatch(shape, tuning),
    ...checkStringsetMismatch(shape),
    ...checkTuningMismatch(shape, tuning),
    ...checkBarreFretOrigin(shape, root, tuning, built),
    ...checkNameUnique(shape, "chord"),
  ];
}

/**
 * Runs the two checks that apply to scale shapes — build-loss and
 * metadata-completeness — never fret-span/finger/geometry, which are
 * chord-only. `root` defaults to `"C"` (`ScaleShape` has no `canonicalRoot`
 * field, so `displayRootFor` isn't applicable here — its default resolves to
 * "C" too, mirroring `checkScaleBuildLoss`'s registry-wide test convention);
 * `tuning` defaults to `STANDARD`.
 */
export function auditScaleShape(
  shape: ScaleShape,
  options: ShapeAuditOptions = {},
): ShapeAuditIssue[] {
  const root = options.root ?? "C";
  const tuning = options.tuning ?? STANDARD;

  return [
    ...checkScaleBuildLoss(shape, root, tuning),
    ...checkScaleMetadataCompleteness(shape),
  ];
}

// ============================================================
// Arpeggio-only checks (shape-workbench spec §3.1)
// ============================================================
// Tier-safe only: no chord-tone verification here (that needs
// @tonaljs/chord and lives in the optional-tier audit-integration.ts).

/**
 * Flags arpeggio shapes whose built position span exceeds `maxSpan`.
 * Analogous to `checkFretSpan`, scoped to arpeggio geometry: builds via
 * `buildFrettedScale` (arpeggios have no single grip to reconstruct via
 * `applyChordShape`) and takes `max - min` over the built notes' non-open
 * frets. Skipped when the build itself fails (`result.empty`) — that failure
 * is `checkScaleBuildLoss`'s to report, not this check's.
 */
export function checkPositionSpan(
  shape: ArpeggioShape,
  root: string,
  tuning: string[] = STANDARD,
  maxSpan = 4,
): ShapeAuditIssue[] {
  const result = buildFrettedScale(shape, root, tuning);
  if (result.empty) return [];

  const fretted = result.notes.map((n) => n.fret).filter((f) => f > 0);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;

  if (span <= maxSpan) return [];

  return [
    {
      id: CHECK_POSITION_SPAN,
      severity: "error",
      message: `Position span of ${span} exceeds the maximum playable span of ${maxSpan}`,
      details: { span, maxSpan },
    },
  ];
}

/**
 * Flags a structurally inconsistent `ArpeggioShape.fingers` (per-string,
 * parallel to `strings[]`): a length mismatch against `strings`, a finger
 * entry present for a muted (`null`) string, or a finger sub-array whose
 * length doesn't match its string's note-array length. Skipped (`[]`) when
 * `fingers` is absent entirely — it's optional.
 */
export function checkFingeringComplete(shape: ArpeggioShape): ShapeAuditIssue[] {
  if (shape.fingers === undefined) return [];

  const { strings, fingers } = shape;

  if (fingers.length !== strings.length) {
    return [
      {
        id: CHECK_FINGERING_COMPLETE,
        severity: "error",
        message:
          `shape.fingers has ${fingers.length} string entries but shape.strings has ` +
          `${strings.length}`,
        details: { fingersLength: fingers.length, stringsLength: strings.length },
      },
    ];
  }

  const issues: ShapeAuditIssue[] = [];
  for (let i = 0; i < strings.length; i++) {
    const notes = strings[i];
    const fingerSlot = fingers[i];

    if (notes == null) {
      if (fingerSlot != null && fingerSlot.length > 0) {
        issues.push({
          id: CHECK_FINGERING_COMPLETE,
          severity: "error",
          message: `String ${i} is muted in shape.strings but shape.fingers[${i}] is non-empty`,
          details: { string: i, fingerSlot },
        });
      }
      continue;
    }

    if (fingerSlot == null || fingerSlot.length !== notes.length) {
      issues.push({
        id: CHECK_FINGERING_COMPLETE,
        severity: "error",
        message:
          `String ${i} has ${notes.length} note(s) in shape.strings but ` +
          `${fingerSlot?.length ?? 0} finger(s) in shape.fingers`,
        details: { string: i, notesLength: notes.length, fingersLength: fingerSlot?.length ?? 0 },
      });
    }
  }

  return issues;
}

/**
 * Verifies that an override arpeggio's named core (`shape.overrides`) is
 * actually registered in `arpeggioShapes`. Skipped (`[]`) when `overrides`
 * is absent (the shape isn't an override).
 */
export function checkOverridesTarget(shape: ArpeggioShape): ShapeAuditIssue[] {
  if (shape.overrides === undefined) return [];
  if (arpeggioShapes.get(shape.overrides) !== undefined) return [];

  return [
    {
      id: CHECK_OVERRIDES_TARGET,
      severity: "error",
      message: `shape.overrides names "${shape.overrides}", which is not registered in arpeggioShapes`,
      details: { overrides: shape.overrides },
    },
  ];
}

/**
 * Runs only the tier-safe arpeggio checks (shape-workbench spec §3.1):
 * build-loss, position-span, fingering-complete, overrides-target. Chord-tone
 * verification (does the run actually outline `chordType`?) needs
 * `@tonaljs/chord` and lives in the optional tier
 * (`auditArpeggioShapeIntegration`, `src/audit-integration.ts`, not this
 * module). `root` defaults to `"C"` (`ArpeggioShape` has no `canonicalRoot`,
 * mirroring `auditScaleShape`'s default); `tuning` defaults to `STANDARD`.
 */
export function auditArpeggioShape(
  shape: ArpeggioShape,
  options: ShapeAuditOptions = {},
): ShapeAuditIssue[] {
  const root = options.root ?? "C";
  const tuning = options.tuning ?? STANDARD;

  return [
    ...checkScaleBuildLoss(shape, root, tuning),
    ...checkPositionSpan(shape, root, tuning, options.maxFretSpan),
    ...checkFingeringComplete(shape),
    ...checkOverridesTarget(shape),
  ];
}

/**
 * Audits every currently-registered chord and scale shape, keyed by
 * `shape.name`. Note: the registries are populated by side-effect imports in
 * index.ts, so this only returns full results once the data modules have
 * been imported — in tests, import `./index` or the relevant data modules
 * first to populate them.
 *
 * Chord results are `ChordShapeAuditResult` — `issues` plus an
 * always-populated `geometry` (via `chordShapeGeometry`), not just on the
 * shapes `checkGeometryMismatch` flags — so a consumer rendering every card
 * (e.g. the Guitar Lab site's shape library) can show source-diagram frets
 * without re-deriving `gripRootFor`/`sourceFrets` itself. Scale shapes have
 * no comparable geometry concept, so their results remain a plain issue
 * list.
 */
export function auditAllShapes(options?: ShapeAuditOptions): {
  chord: Map<string, ChordShapeAuditResult>;
  scale: Map<string, ShapeAuditIssue[]>;
} {
  const tuning = options?.tuning ?? STANDARD;

  const chord = new Map<string, ChordShapeAuditResult>();
  for (const shape of chordShapes.all()) {
    chord.set(shape.name, {
      issues: auditChordShape(shape, options),
      geometry: chordShapeGeometry(shape, tuning),
    });
  }

  const scale = new Map<string, ShapeAuditIssue[]>();
  for (const shape of all()) {
    scale.set(shape.name, auditScaleShape(shape, options));
  }

  return { chord, scale };
}
