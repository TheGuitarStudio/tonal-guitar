/**
 * Optional-tier chord-identification audit checks (shape-workbench spec
 * §3.2, D-006).
 *
 * Dependency tier: optional-peer-deps. This module imports only ./audit,
 * ./build, ./shape, ./tuning, @tonaljs/chord, and @tonaljs/note. It MUST NOT
 * be imported by src/audit.ts — the required-peer tier must stay buildable
 * with zero optional peers installed. See CLAUDE.md's "Dependency layers"
 * section and this module's own D-006 boundary test
 * (src/audit-integration.test.ts).
 */

import { get as getChord, detect as detectChord } from "@tonaljs/chord";
import { chroma as noteChroma, transpose as noteTranspose } from "@tonaljs/note";

import { applyChordShape, buildFrettedScale, Fingering } from "./build";
import { chordShapes, arpeggioShapes, ChordShape, ArpeggioShape } from "./shape";
import { STANDARD } from "./tuning";
import {
  auditChordShape,
  displayRootFor,
  ShapeAuditIssue,
  ShapeAuditOptions,
} from "./audit";

// ============================================================
// Check-ID constants
// ============================================================

export const CHECK_IDENTIFY_MISMATCH = "identify-mismatch";
// shape-workbench spec §3.2 — arpeggio chord-tone checks, optional tier
// (needs @tonaljs/chord for Chord.get(chordType).intervals).
export const CHECK_CHORD_TONES_ONLY = "chord-tones-only";
export const CHECK_COVERS_CHORD = "covers-chord";
export const CHECK_CONTAINS_CHORD_GRIP = "contains-chord-grip";

/** Guard: true when `c` is a valid chroma number (not null/undefined/NaN). */
function isValidChroma(c: number | null | undefined): c is number {
  return c != null && !Number.isNaN(c);
}

// ============================================================
// checkIdentifyMismatch
// ============================================================

/**
 * Flags chord shapes whose built grip, run through Tonal's `Chord.detect`,
 * does NOT identify as the shape's own declared `chordType`. The built
 * grip's pitch classes (deduped, from `Fingering.positions`) are passed to
 * `detect()`; the expected symbol is `${root}${shape.chordType}` — the same
 * `tonic + Chord.get(...).symbol` convention `shape.chordType` is documented
 * to always use (see `ChordShape.chordType`'s doc comment in ./shape). A
 * mismatch is a warning, not an error: `detect()` can legitimately fail to
 * name unusual voicings (omitted 5th, added tensions) that are still
 * musically correct.
 *
 * Skipped (`[]`) when `shape.chordType` is undefined — there is nothing to
 * compare against.
 *
 * `prebuilt`, if supplied, is used in place of an internal `applyChordShape`
 * call, mirroring `checkFretSpan`'s `prebuilt` parameter in ./audit so
 * `auditChordShapeIntegration` can reuse a single hoisted build instead of
 * re-running `applyChordShape` for every check.
 */
export function checkIdentifyMismatch(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
  prebuilt?: Fingering,
): ShapeAuditIssue[] {
  if (shape.chordType === undefined) return [];

  const built = prebuilt ?? applyChordShape(shape, root, tuning);
  const pitchClasses = Array.from(new Set(built.positions.map((p) => p.pc)));
  const detected = pitchClasses.length > 0 ? detectChord(pitchClasses) : [];
  const expected = `${built.root}${shape.chordType}`;

  if (detected.includes(expected)) return [];

  return [
    {
      id: CHECK_IDENTIFY_MISMATCH,
      severity: "warning",
      message:
        `Tonal detect() on the built grip (${detected.join(", ") || "no match"}) ` +
        `does not include the expected chord "${expected}"`,
      details: { detected, expected, root: built.root },
    },
  ];
}

// ============================================================
// Arpeggio chord-tone checks
// ============================================================
// All three need Chord.get(chordType).intervals — the reason this module
// (not audit.ts) owns them. Each is skipped when the chord type doesn't
// resolve to a usable interval set, or when the arpeggio itself fails to
// build (that failure is checkScaleBuildLoss's, in ./audit, to report).

/**
 * The absolute pitch-class chroma set of `chordType`'s intervals, transposed
 * onto `root`. Shared by `checkChordTonesOnly`/`checkCoversChord`. Returns
 * `null` when `chordType` doesn't resolve to a chord with a non-empty
 * interval list (e.g. an unrecognized symbol) — callers treat that as "skip
 * this check", the same way `checkPositionSpan` skips a failed build.
 */
function chordToneChromas(chordType: string, root: string): Set<number> | null {
  const chord = getChord(chordType);
  if (chord.empty || chord.intervals.length === 0) return null;

  const chromas = new Set<number>();
  for (const ivl of chord.intervals) {
    const c = noteChroma(noteTranspose(root, ivl));
    if (isValidChroma(c)) chromas.add(c);
  }
  return chromas;
}

/**
 * Flags arpeggio shapes that include one or more built notes whose pitch
 * class is NOT a tone of `shape.chordType` (built at `root`) — i.e. the run
 * strays outside the chord it's supposed to outline. Skipped when
 * `chordType` doesn't resolve (`chordToneChromas` returns `null`) or the
 * arpeggio fails to build.
 */
export function checkChordTonesOnly(
  shape: ArpeggioShape,
  root: string,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  const chordChromas = chordToneChromas(shape.chordType, root);
  if (chordChromas === null) return [];

  const built = buildFrettedScale(shape, root, tuning);
  if (built.empty) return [];

  const extraNotes = built.notes.filter((n) => {
    const c = noteChroma(n.pc);
    return isValidChroma(c) && !chordChromas.has(c);
  });
  if (extraNotes.length === 0) return [];

  return [
    {
      id: CHECK_CHORD_TONES_ONLY,
      severity: "warning",
      message:
        `Arpeggio "${shape.name}" has ${extraNotes.length} built note(s) that are not ` +
        `tones of chord "${root}${shape.chordType}"`,
      details: {
        extraNotes: extraNotes.map((n) => ({
          string: n.string,
          fret: n.fret,
          pc: n.pc,
          interval: n.interval,
        })),
        chordType: shape.chordType,
        root,
      },
    },
  ];
}

/**
 * Flags arpeggio shapes that OMIT one or more of `shape.chordType`'s chord
 * tones — the complement of `checkChordTonesOnly`: this one catches a run
 * that never touches every interval the chord requires (e.g. a "m7" run
 * that never plays the 7th). Skipped when `chordType` doesn't resolve or the
 * arpeggio fails to build.
 */
export function checkCoversChord(
  shape: ArpeggioShape,
  root: string,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  const chord = getChord(shape.chordType);
  if (chord.empty || chord.intervals.length === 0) return [];

  const built = buildFrettedScale(shape, root, tuning);
  if (built.empty) return [];

  const builtChromas = new Set(
    built.notes.map((n) => noteChroma(n.pc)).filter(isValidChroma),
  );

  const missingIntervals = chord.intervals.filter((ivl) => {
    const c = noteChroma(noteTranspose(root, ivl));
    return isValidChroma(c) && !builtChromas.has(c);
  });
  if (missingIntervals.length === 0) return [];

  return [
    {
      id: CHECK_COVERS_CHORD,
      severity: "warning",
      message:
        `Arpeggio "${shape.name}" is missing ${missingIntervals.length} chord tone(s) of ` +
        `"${root}${shape.chordType}": ${missingIntervals.join(", ")}`,
      details: { missingIntervals, chordType: shape.chordType, root },
    },
  ];
}

/**
 * Flags arpeggio shapes whose named grip (`shape.chordShape`, e.g. "E Shape
 * m7") is registered in `chordShapes` but is NOT fully contained in the
 * arpeggio's own built run — i.e. one or more of the grip's fretted
 * (string, fret) positions never appears among the arpeggio's built notes.
 * This is the one integration check that reaches into `chordShapes`
 * (importable here, unlike audit.ts, precisely because this module already
 * carries the optional-peer tier — spec §3.2).
 *
 * Skipped (`[]`) when `shape.chordShape` is absent, when it doesn't resolve
 * to a registered `ChordShape`, or when the arpeggio itself fails to build.
 */
export function checkContainsChordGrip(
  shape: ArpeggioShape,
  root: string,
  tuning: string[] = STANDARD,
): ShapeAuditIssue[] {
  if (shape.chordShape === undefined) return [];

  const grip = chordShapes.get(shape.chordShape);
  if (grip === undefined) return [];

  const arpeggioBuild = buildFrettedScale(shape, root, tuning);
  if (arpeggioBuild.empty) return [];

  const gripBuild = applyChordShape(grip, root, tuning);
  const arpeggioPositions = new Set(
    arpeggioBuild.notes.map((n) => `${n.string}:${n.fret}`),
  );

  const missing: { string: number; fret: number }[] = [];
  gripBuild.frets.forEach((fret, string) => {
    if (fret == null) return;
    if (!arpeggioPositions.has(`${string}:${fret}`)) {
      missing.push({ string, fret });
    }
  });
  if (missing.length === 0) return [];

  return [
    {
      id: CHECK_CONTAINS_CHORD_GRIP,
      severity: "warning",
      message:
        `Arpeggio "${shape.name}" does not contain ${missing.length} fretted position(s) ` +
        `of its referenced grip "${shape.chordShape}"`,
      details: { missing, chordShape: shape.chordShape, root },
    },
  ];
}

// ============================================================
// Aggregate functions
// ============================================================

/**
 * Runs the optional-tier chord check(s) for a chord shape: currently just
 * `identify-mismatch`. `root`/`tuning` default the same way `auditChordShape`
 * (./audit) does, and the single `applyChordShape` build is hoisted and
 * threaded through, matching that function's CR-001 pattern.
 */
export function auditChordShapeIntegration(
  shape: ChordShape,
  options: ShapeAuditOptions = {},
): ShapeAuditIssue[] {
  const root = options.root ?? displayRootFor(shape);
  const tuning = options.tuning ?? STANDARD;
  const built = applyChordShape(shape, root, tuning);

  return [...checkIdentifyMismatch(shape, root, tuning, built)];
}

/**
 * Runs the three optional-tier arpeggio chord-tone checks: chord-tones-only,
 * covers-chord, contains-chord-grip. `root` defaults to `"C"` and `tuning`
 * to `STANDARD`, mirroring `auditArpeggioShape`'s (./audit) defaults —
 * `ArpeggioShape` has no `canonicalRoot`.
 */
export function auditArpeggioShapeIntegration(
  shape: ArpeggioShape,
  options: ShapeAuditOptions = {},
): ShapeAuditIssue[] {
  const root = options.root ?? "C";
  const tuning = options.tuning ?? STANDARD;

  return [
    ...checkChordTonesOnly(shape, root, tuning),
    ...checkCoversChord(shape, root, tuning),
    ...checkContainsChordGrip(shape, root, tuning),
  ];
}

/**
 * Audits every currently-registered chord and arpeggio shape with the
 * optional-tier integration checks only, keyed by `shape.name`. Mirrors
 * `auditAllShapes` (./audit) in shape, but scoped to the checks that live in
 * this module. Note: like `auditAllShapes`, the registries are populated by
 * side-effect imports in index.ts — this only returns full results once the
 * data modules have been imported.
 */
export function auditAllShapesIntegration(options?: ShapeAuditOptions): {
  chord: Map<string, ShapeAuditIssue[]>;
  arpeggio: Map<string, ShapeAuditIssue[]>;
} {
  const chord = new Map<string, ShapeAuditIssue[]>();
  for (const shape of chordShapes.all()) {
    chord.set(shape.name, auditChordShapeIntegration(shape, options));
  }

  const arpeggio = new Map<string, ShapeAuditIssue[]>();
  for (const shape of arpeggioShapes.all()) {
    arpeggio.set(shape.name, auditArpeggioShapeIntegration(shape, options));
  }

  return { chord, arpeggio };
}

/**
 * Composer: the full chord-shape audit (spec §3.2) — every required-tier
 * check from `auditChordShape` (./audit) plus this module's optional-tier
 * integration check(s). This is what the workbench's Live Checks card runs
 * (spec §5.4), since it always has the optional peers available.
 */
export function auditChordShapeFull(
  shape: ChordShape,
  options: ShapeAuditOptions = {},
): ShapeAuditIssue[] {
  return [
    ...auditChordShape(shape, options),
    ...auditChordShapeIntegration(shape, options),
  ];
}
