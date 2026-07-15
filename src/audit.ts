/**
 * Shape visual/quality audit checks.
 *
 * Dependency tier: required-peer-deps (alongside build.ts). This module
 * imports only ./build, ./shape, ./tuning, and the required-peer Tonal
 * packages (@tonaljs/note, @tonaljs/interval) — it MUST NOT import
 * ./integration or reference @tonaljs/scale, @tonaljs/chord, or
 * @tonaljs/key. See CLAUDE.md's "Dependency layers" section.
 */

import { applyChordShape, buildFrettedScale } from "./build";
import { ChordShape, ScaleShape } from "./shape";
import { STANDARD } from "./tuning";
import { chroma, transpose } from "@tonaljs/note";

// ============================================================
// Core types
// ============================================================

export type AuditSeverity = "error" | "warning" | "info";

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

// ============================================================
// Check-ID constants
// ============================================================

export const CHECK_FRET_SPAN = "fret-span";
export const CHECK_FINGER_ZERO_ON_MOVABLE = "finger-zero-on-movable";
export const CHECK_REPEATED_FINGER_NO_BARRE = "repeated-finger-no-barre";
export const CHECK_BUILD_LOSS = "build-loss";
export const CHECK_METADATA_COMPLETENESS = "metadata-completeness";
export const CHECK_GEOMETRY_MISMATCH = "geometry-mismatch";

// ============================================================
// Root helper
// ============================================================

export function displayRootFor(shape: { canonicalRoot?: string }): string {
  return shape.canonicalRoot ?? "C";
}

// ============================================================
// Individual checks — implemented in later task groups
// ============================================================

/**
 * Flags chord shapes whose fretted span (excluding open strings) exceeds
 * `maxSpan`. Promotes the `data.test.ts:474-508` issue #94 regression's
 * inline `maxSpan` helper to a first-class check: `fretted` excludes both
 * muted strings (`null`) and open strings (`fret === 0`) before taking
 * `max - min`, so an open-string drone never inflates the span. Boundary is
 * strict — `span === maxSpan` does not flag.
 */
export function checkFretSpan(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
  maxSpan = 4,
): ShapeAuditIssue[] {
  const { frets } = applyChordShape(shape, root, tuning);
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
 * Flags movable shapes (`canonicalRoot === undefined`) that assert finger 0
 * (an open string) anywhere in `fingers`. Movable shapes are, by definition,
 * never played with an open string — promotes the `data.test.ts:826-836`
 * (issue #39) invariant to a first-class check. Static: no `applyChordShape`
 * call.
 */
export function checkFingerZeroOnMovable(shape: ChordShape): ShapeAuditIssue[] {
  if (shape.canonicalRoot !== undefined) return [];
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
 */
export function checkChordBuildLoss(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  const { frets } = applyChordShape(shape, root, tuning);
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

// checkMetadataCompleteness — implemented in Task Group 5

// ============================================================
// checkGeometryMismatch — Task Group 6
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
 * Only called once `shape.baseFret != null` has already been confirmed by
 * `checkGeometryMismatch` — the non-null assertion below relies on that.
 *
 * Exported (but not re-exported from ./index) so tests can exercise it
 * directly — it is otherwise an internal helper of checkGeometryMismatch.
 */
export function sourceFrets(
  shape: ChordShape,
  gr: string,
  tuning: string[] = STANDARD,
): (number | null)[] {
  const baseFret = shape.baseFret as number;
  return shape.strings.map((ivl, i) => {
    if (ivl == null) return null;
    if (shape.fingers[i] === 0) return 0;
    const targetPc = transpose(gr, ivl);
    const raw = (((chroma(targetPc) - chroma(tuning[i])) % 12) + 12) % 12;
    let f = raw;
    while (f < baseFret) f += 12;
    return f;
  });
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
  if (shape.baseFret == null) return [];

  const gr = gripRootFor(shape);
  if (gr == null) return [];

  const builtFrets = applyChordShape(shape, gr, tuning).frets;
  const srcFrets = sourceFrets(shape, gr, tuning);

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
        gripRoot: gr,
        builtFrets,
        sourceFrets: srcFrets,
        mismatchedStrings,
      },
    },
  ];
}

// ============================================================
// Aggregate functions — implemented in Task Group 7
// ============================================================

// auditChordShape — implemented in Task Group 7

// auditScaleShape — implemented in Task Group 7

// auditAllShapes — implemented in Task Group 7
