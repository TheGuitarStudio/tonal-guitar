/**
 * Shape visual/quality audit checks.
 *
 * Dependency tier: required-peer-deps (alongside build.ts). This module
 * imports only ./build, ./shape, ./tuning, and the required-peer Tonal
 * packages (@tonaljs/note, @tonaljs/interval) — it MUST NOT import
 * ./integration or reference @tonaljs/scale, @tonaljs/chord, or
 * @tonaljs/key. See CLAUDE.md's "Dependency layers" section.
 */

// buildFrettedScale is unused until checkBuildLoss (Task Group 4) lands;
// kept (rather than dropped) to lock the module's import surface now,
// per-line-disabled until consumed.
import { applyChordShape } from "./build";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { buildFrettedScale } from "./build";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// checkFretSpan — implemented in Task Group 2

// checkFingerZeroOnMovable — implemented in Task Group 3

// checkRepeatedFingerNoBarre — implemented in Task Group 3

// checkBuildLoss — implemented in Task Group 4

// checkMetadataCompleteness — implemented in Task Group 5

// ============================================================
// checkGeometryMismatch — Task Group 6
// ============================================================

// Matches a leading root-letter token, e.g. "G" or "Bb", at the start of a
// shape name such as "G m7b5 Open" or "C Minor Open".
const ROOT_TOKEN_RE = /^[A-G](#|b)?/;

function parseRootFromName(name: string): string | undefined {
  const match = ROOT_TOKEN_RE.exec(name);
  return match ? match[0] : undefined;
}

/**
 * The "grip root" is the root the source diagram (baseFret/fingers) was
 * authored against: `canonicalRoot` when present, else parsed from the
 * shape's `"<Root> ... Open"` name convention (see open-chords.ts). Shapes
 * with neither yield `undefined` and the check is skipped.
 *
 * Caveat: the movable "E/A Form ... Barre" shapes have no `canonicalRoot`
 * but their names still start with a letter in `[A-G]` (the CAGED form
 * family, e.g. "E Form Major Barre"), so this falls back to parsing that
 * letter as if it were an authored root. See checkGeometryMismatch's docs
 * and audit.test.ts's registry-wide sweep comment for the resulting
 * false-positive class this produces on those 20 shapes.
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
 * `baseFret`-carrying shapes (the 70 open-chords.ts entries) — shell,
 * extended, and caged-7th shapes have no `baseFret` and are skipped ([]).
 *
 * Known limitation: for `baseFret: 1` shapes, a string with `fingers[i]`
 * non-zero but whose interval sits at the open-string pitch (chroma
 * distance 0) is structurally ambiguous — it could be a genuine
 * off-by-octave defect (see OPEN_G_AUG) or a legitimate barre-at-the-nut
 * grip (see the movable "E/A Form ... Barre" shapes in open-chords.ts,
 * which have no `canonicalRoot` and so also depend on gripRootFor's
 * name-parsing fallback). Both currently surface as a mismatch; see
 * audit.test.ts's registry-wide sweep for the full, hand-verified
 * breakdown of which flagged shapes are genuine defects versus this
 * false-positive class.
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
// Aggregate functions — implemented in Task Group 6
// ============================================================

// auditChordShape — implemented in Task Group 6

// auditScaleShape — implemented in Task Group 6

// auditAll — implemented in Task Group 6
