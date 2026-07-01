/**
 * Test harness for src/data/extended-chords.ts.
 *
 * TG1 (this file's origin) only scaffolds the harness: `EXTENDED_CHORD_SHAPES`
 * is empty, so the parametrized `describe.each` block below generates zero
 * per-shape suites. Later task groups (Tier 1 / Tier 2 / Tier 3) push shape
 * entries onto `SHAPES_UNDER_TEST` — the assertion helpers themselves do not
 * change.
 *
 * Each helper mirrors one bullet from the feature spec
 * (.tonal-guitar/features/extended-chord-shapes-import/spec.md §Testing):
 *   - assertRegistered            — registry + uniqueness
 *   - assertBuildsPlayable        — applyChordShape produces a real, playable grip
 *   - assertResolutionSubset      — shape intervals ⊆ Chord.get(root+chordType)
 *   - assertArpeggioMembership    — chord tones survive arpeggioFromShape
 *   - assertOmissionIntegrity     — omittedIntervals bookkeeping (or full-chord coverage)
 *   - assertIdentification        — split by completeness (D-007)
 */

import { describe, it, expect } from "vitest";
import { get as getChord } from "@tonaljs/chord";
import { chroma as noteChroma, transpose as noteTranspose } from "@tonaljs/note";

import { chordShapes, ChordShape, ScaleShape } from "../shape";
import { applyChordShape } from "../build";
import { arpeggioFromShape, identifyChord } from "../integration";
import { STANDARD } from "../tuning";

import { EXTENDED_CHORD_SHAPES } from "./extended-chords";

// ============================================================
// Shared helpers
// ============================================================

/** Chroma set (0-11) for a list of intervals transposed off `root`. */
function chromaSet(intervals: string[], root: string): Set<number> {
  return new Set(
    intervals
      .map((ivl) => noteChroma(noteTranspose(root, ivl)))
      .filter((c): c is number => c != null && !Number.isNaN(c)),
  );
}

/** Non-null (played) intervals for a shape, low→high string order preserved. */
function playedIntervals(shape: ChordShape): string[] {
  return shape.strings.filter((s): s is string => s != null);
}

/** The played string indices implied by `strings`, used when `stringSet` is absent. */
function impliedStringSet(shape: ChordShape): number[] {
  if (shape.stringSet) return shape.stringSet;
  return shape.strings
    .map((s, i) => (s != null ? i : null))
    .filter((i): i is number => i != null);
}

/** Convert a ChordShape to the single-interval-per-string ScaleShape applyChordShape uses. */
function asParentScaleShape(shape: ChordShape): ScaleShape {
  return {
    name: shape.name,
    system: shape.system,
    strings: shape.strings.map((s) => (s != null ? [s] : null)),
    rootString: shape.rootString,
  };
}

// ============================================================
// Assertion helpers (R-1.x — reusable across every shape/tier)
// ============================================================

/** Registered under its chordType and globally unique by name. */
function assertRegistered(shape: ChordShape): void {
  const matches = chordShapes.query({ chordType: shape.chordType });
  expect(matches.some((s) => s.name === shape.name)).toBe(true);

  const occurrences = chordShapes.names().filter((n) => n === shape.name).length;
  expect(occurrences).toBe(1);
}

/**
 * Builds to a playable fingering at `root` (STANDARD tuning): no notes
 * dropped by the fret window, built intervals match the interval row, the
 * fretted span is playable, and the implied finger count is plausible.
 */
function assertBuildsPlayable(shape: ChordShape, root: string, maxSpan = 4): void {
  const result = applyChordShape(shape, root, STANDARD);

  const nonNullFrets = result.frets.filter((f): f is number => f != null);
  expect(nonNullFrets.length).toBe(impliedStringSet(shape).length);

  const builtIntervals = result.positions
    .slice()
    .sort((a, b) => a.string - b.string)
    .map((p) => p.interval);
  expect(builtIntervals.slice().sort()).toEqual(playedIntervals(shape).slice().sort());

  if (nonNullFrets.length > 0) {
    const span = Math.max(...nonNullFrets) - Math.min(...nonNullFrets);
    expect(span).toBeLessThanOrEqual(maxSpan);
  }

  const distinctFingers = new Set(
    shape.fingers.filter((f): f is number => f != null && f > 0),
  );
  expect(distinctFingers.size).toBeLessThanOrEqual(4);
}

/** Shape intervals (as chromas off `root`) are a subset of Chord.get's intervals. */
function assertResolutionSubset(shape: ChordShape, root: string): void {
  const chord = getChord(`${root}${shape.chordType}`);
  expect(chord.empty).toBe(false);

  const chordChromas = chromaSet(chord.intervals, root);
  const shapeChromas = chromaSet(playedIntervals(shape), root);
  for (const c of shapeChromas) {
    expect(chordChromas.has(c)).toBe(true);
  }
}

/**
 * Chord tones survive arpeggioFromShape — none of the notes built by the
 * shape are dropped as "not a chord tone" when re-derived through the
 * chord-membership (chroma) filter in src/integration.ts.
 */
function assertArpeggioMembership(shape: ChordShape, root: string): void {
  const parentShape = asParentScaleShape(shape);
  const result = arpeggioFromShape(parentShape, `${root}${shape.chordType}`, root, STANDARD);

  expect(result.empty).toBe(false);
  expect(result.notes.length).toBe(playedIntervals(shape).length);
}

/**
 * If `omittedIntervals` is set: those intervals are absent from `strings`
 * and present in the full Chord.get chord. Otherwise: the shape's chromas
 * cover every chord tone (nothing silently missing).
 */
function assertOmissionIntegrity(shape: ChordShape, root: string): void {
  const chord = getChord(`${root}${shape.chordType}`);
  expect(chord.empty).toBe(false);

  const shapeChromas = chromaSet(playedIntervals(shape), root);
  const chordChromas = chromaSet(chord.intervals, root);

  if (shape.omittedIntervals && shape.omittedIntervals.length > 0) {
    const omittedChromas = chromaSet(shape.omittedIntervals, root);
    for (const c of omittedChromas) {
      expect(shapeChromas.has(c)).toBe(false);
      expect(chordChromas.has(c)).toBe(true);
    }
  } else {
    for (const c of chordChromas) {
      expect(shapeChromas.has(c)).toBe(true);
    }
  }
}

/**
 * Split by completeness (D-007). Full voicings (no omittedIntervals) must
 * `detect` as the exact symbol or a documented alias. Partial voicings only
 * need to be a chroma subset of the full chord — `detect` is allowed to
 * return an unrelated/empty label for an incomplete grip.
 */
function assertIdentification(
  shape: ChordShape,
  root: string,
  options: { aliases?: string[] } = {},
): void {
  const chordName = `${root}${shape.chordType}`;
  const result = applyChordShape(shape, root, STANDARD);
  const detected = identifyChord(result.frets, STANDARD);

  if (!shape.omittedIntervals || shape.omittedIntervals.length === 0) {
    expect(detected.length).toBeGreaterThan(0);
    const acceptable = options.aliases ?? [chordName];
    expect(acceptable).toContain(detected[0]);
  } else {
    const chord = getChord(chordName);
    expect(chord.empty).toBe(false);
    const chordChromas = chromaSet(chord.intervals, root);
    const builtChromas = new Set(
      result.positions
        .map((p) => noteChroma(p.pc))
        .filter((c): c is number => c != null && !Number.isNaN(c)),
    );
    for (const c of builtChromas) {
      expect(chordChromas.has(c)).toBe(true);
    }
  }
}

// ============================================================
// Parametrized per-shape suite
// ============================================================

interface ShapeCase {
  name: string;
  shape: ChordShape;
  root: string;
  /** Acceptable `detect(notes)[0]` values for full voicings (D-007 aliases). */
  aliases?: string[];
}

/**
 * Populated by later task groups (Tier 1/2/3): each entry is one registered
 * shape plus the representative root it should build against. Empty here —
 * TG1 only proves the harness compiles and runs green with zero cases.
 */
const SHAPES_UNDER_TEST: ShapeCase[] = [];

describe.each(SHAPES_UNDER_TEST)("$name — root $root", ({ shape, root, aliases }) => {
  it("is registered and queryable by chordType, with a unique name", () => {
    assertRegistered(shape);
  });

  it("builds a playable fingering", () => {
    assertBuildsPlayable(shape, root);
  });

  it("resolves as a chroma-subset of the Tonal chord", () => {
    assertResolutionSubset(shape, root);
  });

  it("chord tones are arpeggio-derivable", () => {
    assertArpeggioMembership(shape, root);
  });

  it("has correct omission bookkeeping", () => {
    assertOmissionIntegrity(shape, root);
  });

  it("identifies per the full/partial split (D-007)", () => {
    assertIdentification(shape, root, { aliases });
  });
});

// ============================================================
// Scaffold-level sanity (TG1 acceptance criteria)
// ============================================================

describe("extended-chords: TG1 scaffold", () => {
  it("registers zero shapes for the empty tier scaffold", () => {
    expect(EXTENDED_CHORD_SHAPES.length).toBe(0);
    expect(chordShapes.all().length).toBe(0);
  });

  it("importing the module does not throw and produces no duplicate names", () => {
    const names = chordShapes.names();
    expect(new Set(names).size).toBe(names.length);
  });
});
