/**
 * Test harness for src/data/extended-chords.ts.
 *
 * TG1 scaffolded this harness with `EXTENDED_CHORD_SHAPES` empty. TG2 (Tier
 * 1 — `6 m6 9 maj9 m9 add9`) populates `SHAPES_UNDER_TEST` with the first 12
 * shapes; later task groups (Tier 2 / Tier 3) push further entries — the
 * assertion helpers themselves do not change.
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

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { get as getChord } from "@tonaljs/chord";
import {
  chroma as noteChroma,
  transpose as noteTranspose,
} from "@tonaljs/note";

import { chordShapes, ChordShape, ScaleShape } from "../shape";
import { applyChordShape } from "../build";
import { analyzeInKey, arpeggioFromShape, identifyChord } from "../integration";
import { STANDARD } from "../tuning";

import {
  EXTENDED_CHORD_SHAPES,
  EXT_CHORD_E_6,
  EXT_CHORD_A_6,
  EXT_CHORD_E_M6,
  EXT_CHORD_A_M6,
  EXT_CHORD_E_9,
  EXT_CHORD_A_9,
  EXT_CHORD_E_MAJ9,
  EXT_CHORD_A_MAJ9,
  EXT_CHORD_E_M9,
  EXT_CHORD_A_M9,
  EXT_CHORD_E_ADD9,
  EXT_CHORD_A_ADD9,
  EXT_CHORD_E_13,
  EXT_CHORD_A_13,
  EXT_CHORD_E_DIM7,
  EXT_CHORD_A_DIM7,
  EXT_CHORD_E_MMAJ7,
  EXT_CHORD_A_MMAJ7,
  EXT_CHORD_E_7SUS4,
  EXT_CHORD_A_7SUS4,
  EXT_CHORD_E_69,
  EXT_CHORD_A_69,
  EXT_CHORD_E_7B9,
  EXT_CHORD_A_7B9,
  EXT_CHORD_E_7SHARP9,
  EXT_CHORD_A_7SHARP9,
  EXT_CHORD_E_7SHARP5,
  EXT_CHORD_A_7SHARP5,
  EXT_CHORD_E_7B5,
  EXT_CHORD_A_7B5,
} from "./extended-chords";

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

  const occurrences = chordShapes
    .names()
    .filter((n) => n === shape.name).length;
  expect(occurrences).toBe(1);
}

/**
 * Builds to a playable fingering at `root` (STANDARD tuning): no notes
 * dropped by the fret window, built intervals match the interval row, the
 * fretted span is playable, and the implied finger count is plausible.
 */
function assertBuildsPlayable(
  shape: ChordShape,
  root: string,
  maxSpan = 4,
): void {
  const result = applyChordShape(shape, root, STANDARD);

  const nonNullFrets = result.frets.filter((f): f is number => f != null);
  expect(nonNullFrets.length).toBe(impliedStringSet(shape).length);

  const builtIntervals = result.positions
    .slice()
    .sort((a, b) => a.string - b.string)
    .map((p) => p.interval);
  expect(builtIntervals.slice().sort()).toEqual(
    playedIntervals(shape).slice().sort(),
  );

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
  const result = arpeggioFromShape(
    parentShape,
    `${root}${shape.chordType}`,
    root,
    STANDARD,
  );

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
 * shape plus the representative root it should build against.
 *
 * Tier 1 (this task group) uses root F for E-form shapes and root C for
 * A-form shapes — both avoid the open-string edge case (F is a uniform
 * +1-semitone shift off each E-form's open-E prototype; C is the exact
 * reference root the A-form shells are conventionally taught at).
 *
 * `add9` full voicings pass `aliases: ["${root}Madd9"]` — the empirically
 * verified `detect` alias for `add9` (see the divergence catalog in this
 * file's header JSDoc). All other Tier 1 full voicings (`6`, `m6`, `9`,
 * `maj9`, `m9` E-form) detect cleanly with no alias needed. The A-form
 * `9`/`maj9`/`m9` shells are partial (5th omitted) and skip the detect
 * requirement entirely per D-007.
 */
const SHAPES_UNDER_TEST: ShapeCase[] = [
  { name: "E Shape 6", shape: EXT_CHORD_E_6, root: "F" },
  { name: "A Shape 6", shape: EXT_CHORD_A_6, root: "C" },
  { name: "E Shape m6", shape: EXT_CHORD_E_M6, root: "F" },
  { name: "A Shape m6", shape: EXT_CHORD_A_M6, root: "C" },
  { name: "E Shape 9", shape: EXT_CHORD_E_9, root: "F" },
  { name: "A Shape 9", shape: EXT_CHORD_A_9, root: "C" },
  { name: "E Shape maj9", shape: EXT_CHORD_E_MAJ9, root: "F" },
  { name: "A Shape maj9", shape: EXT_CHORD_A_MAJ9, root: "C" },
  { name: "E Shape m9", shape: EXT_CHORD_E_M9, root: "F" },
  { name: "A Shape m9", shape: EXT_CHORD_A_M9, root: "C" },
  {
    name: "E Shape add9",
    shape: EXT_CHORD_E_ADD9,
    root: "F",
    aliases: ["FMadd9"],
  },
  {
    name: "A Shape add9",
    shape: EXT_CHORD_A_ADD9,
    root: "C",
    aliases: ["CMadd9"],
  },
  // --- Tier 2 (TG3). Same root convention: F for E-forms, C for A-forms
  // (E Shape 6/9 uses G — its cited prototype grip is the classic G6/9
  // 3,2,2,2,3,x, and G keeps the movable build fully fretted).
  // Full voicings that need an alias per the divergence catalog: mMaj7
  // (`m/ma7`) and 6/9 (`6add9`). `13`/`dim7`/`7sus4` detect exactly. The
  // A-form 13 is partial (5th omitted) and skips detect per D-007.
  { name: "E Shape 13", shape: EXT_CHORD_E_13, root: "F" },
  { name: "A Shape 13", shape: EXT_CHORD_A_13, root: "C" },
  { name: "E Shape dim7", shape: EXT_CHORD_E_DIM7, root: "F" },
  { name: "A Shape dim7", shape: EXT_CHORD_A_DIM7, root: "C" },
  {
    name: "E Shape mMaj7",
    shape: EXT_CHORD_E_MMAJ7,
    root: "F",
    aliases: ["Fm/ma7"],
  },
  {
    name: "A Shape mMaj7",
    shape: EXT_CHORD_A_MMAJ7,
    root: "C",
    aliases: ["Cm/ma7"],
  },
  { name: "E Shape 7sus4", shape: EXT_CHORD_E_7SUS4, root: "F" },
  { name: "A Shape 7sus4", shape: EXT_CHORD_A_7SUS4, root: "C" },
  {
    name: "E Shape 6/9",
    shape: EXT_CHORD_E_69,
    root: "G",
    aliases: ["G6add9"],
  },
  {
    name: "A Shape 6/9",
    shape: EXT_CHORD_A_69,
    root: "C",
    aliases: ["C6add9"],
  },
  // --- Tier 3 (TG4). Same root convention: F for E-forms, C for A-forms.
  // Full voicings detect exactly for all four Tier 3 types (no alias
  // needed) — `7b9`/`7#9` E-forms and both `7#5`/`7b5` forms. The A-form
  // `7b9`/`7#9` shells are partial (5th omitted) and skip the detect
  // requirement per D-007 (`7b9` shell detects `Calt7`; the Hendrix-chord
  // `7#9` shell detects `[]`).
  { name: "E Shape 7b9", shape: EXT_CHORD_E_7B9, root: "F" },
  { name: "A Shape 7b9", shape: EXT_CHORD_A_7B9, root: "C" },
  { name: "E Shape 7#9", shape: EXT_CHORD_E_7SHARP9, root: "F" },
  { name: "A Shape 7#9", shape: EXT_CHORD_A_7SHARP9, root: "C" },
  { name: "E Shape 7#5", shape: EXT_CHORD_E_7SHARP5, root: "F" },
  { name: "A Shape 7#5", shape: EXT_CHORD_A_7SHARP5, root: "C" },
  { name: "E Shape 7b5", shape: EXT_CHORD_E_7B5, root: "F" },
  { name: "A Shape 7b5", shape: EXT_CHORD_A_7B5, root: "C" },
];

describe.each(SHAPES_UNDER_TEST)(
  "$name — root $root",
  ({ shape, root, aliases }) => {
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
  },
);

// ============================================================
// Aggregate sanity (TG2 Tier 1 + TG3 Tier 2 acceptance criteria)
// ============================================================

describe("extended-chords: Tier 1 + Tier 2 + Tier 3 aggregate sanity", () => {
  /**
   * Reset the chord-shape registry to exactly the 30 extended-chord shapes
   * before each run of this block. This makes count assertions
   * (`.all().length` and per-tier `.query().length`) order- and
   * isolation-independent: they produce the same result regardless of whether
   * other data files have already registered shapes (e.g. under
   * `isolate:false` or future config changes).
   *
   * The `afterAll` mirror restores the same clean state so the final
   * cross-registry describe block that follows this one always begins with
   * exactly the 30 extended shapes in the registry (dynamic imports in that
   * block then add the remaining chord data files on top).
   */
  function resetToExtendedOnly(): void {
    chordShapes.removeAll();
    EXTENDED_CHORD_SHAPES.forEach(chordShapes.add.bind(chordShapes));
  }
  beforeAll(resetToExtendedOnly);
  afterAll(resetToExtendedOnly);

  it("registers exactly the 30 Tier 1+2+3 shapes (15 types x E/A-form)", () => {
    expect(EXTENDED_CHORD_SHAPES.length).toBe(30);
    expect(chordShapes.all().length).toBe(30);
  });

  it("registers exactly 15 distinct canonical chordTypes (TG5 5.3)", () => {
    const distinctTypes = new Set(
      EXTENDED_CHORD_SHAPES.map((s) => s.chordType).filter(
        (t): t is string => t !== undefined,
      ),
    );
    expect(distinctTypes.size).toBe(15);
  });

  it.each([
    // Tier 1 (6 types)
    "6",
    "m6",
    "9",
    "maj9",
    "m9",
    "add9",
    // Tier 2 (5 types)
    "13",
    "dim7",
    "mMaj7",
    "7sus4",
    "6/9",
    // Tier 3 (4 types)
    "7b9",
    "7#9",
    "7#5",
    "7b5",
  ])(
    "covers chordType %s with exactly 2 shapes (E-form + A-form)",
    (chordType) => {
      expect(chordShapes.query({ chordType }).length).toBe(2);
    },
  );

  it("registers 7#5 (not aug7) as the altered-aug entry", () => {
    expect(chordShapes.query({ chordType: "7#5" }).length).toBe(2);
    for (const shape of chordShapes.query({ chordType: "7#5" })) {
      expect(shape.chordType).toBe("7#5");
    }
  });

  it("7#5/7b5 shapes never omit the altered 5th (it is the defining tone)", () => {
    for (const shape of [
      ...chordShapes.query({ chordType: "7#5" }),
      ...chordShapes.query({ chordType: "7b5" }),
    ]) {
      expect(shape.omittedIntervals ?? []).toEqual([]);
    }
  });

  it("13 voicings retain root, 3rd, b7, and the 13th", () => {
    for (const shape of chordShapes.query({ chordType: "13" })) {
      const played = shape.strings.filter((s): s is string => s != null);
      for (const required of ["1P", "3M", "7m", "13M"]) {
        expect(played).toContain(required);
      }
    }
  });

  it("7sus4 shapes contain no 3rd and never omit the 4th", () => {
    for (const shape of chordShapes.query({ chordType: "7sus4" })) {
      const played = shape.strings.filter((s): s is string => s != null);
      expect(played).toContain("4P");
      expect(played).not.toContain("3M");
      expect(played).not.toContain("3m");
      expect(shape.omittedIntervals ?? []).not.toContain("4P");
    }
  });

  it("importing the module does not throw and produces no duplicate names", () => {
    const names = chordShapes.names();
    expect(new Set(names).size).toBe(names.length);
  });
});

// ============================================================
// Divergence catalog assertions (D-007 — add9, mMaj7, 6/9)
// ============================================================

describe("extended-chords: divergence catalog", () => {
  it("add9 full voicing detects as the Madd9 alias, not the Chord.get symbol", () => {
    const result = applyChordShape(EXT_CHORD_E_ADD9, "F", STANDARD);
    const detected = identifyChord(result.frets, STANDARD);
    expect(detected[0]).toBe("FMadd9");
    expect(detected[0]).not.toBe("Fadd9");

    const chord = getChord("Fadd9");
    expect(chord.empty).toBe(false);
    expect(chord.symbol).toBe("Fadd9");
  });

  it("mMaj7 full voicing detects as the m/ma7 alias, not the Chord.get symbol", () => {
    const result = applyChordShape(EXT_CHORD_E_MMAJ7, "F", STANDARD);
    const detected = identifyChord(result.frets, STANDARD);
    expect(detected[0]).toBe("Fm/ma7");
    expect(detected[0]).not.toBe("FmMaj7");

    const chord = getChord("FmMaj7");
    expect(chord.empty).toBe(false);
    expect(chord.symbol).toBe("FmMaj7");
  });

  it("6/9 full voicing detects as the 6add9 alias while Chord.get keeps the 6/9 symbol", () => {
    const result = applyChordShape(EXT_CHORD_A_69, "C", STANDARD);
    const detected = identifyChord(result.frets, STANDARD);
    expect(detected[0]).toBe("C6add9");
    expect(detected[0]).not.toBe("C6/9");

    const chord = getChord("C6/9");
    expect(chord.empty).toBe(false);
    expect(chord.symbol).toBe("C6/9");
  });

  it("7#5 full voicing detects itself first, with 7b13 as a secondary alias", () => {
    const result = applyChordShape(EXT_CHORD_A_7SHARP5, "C", STANDARD);
    const detected = identifyChord(result.frets, STANDARD);
    expect(detected[0]).toBe("C7#5");
    expect(detected).toContain("C7b13");
  });

  it("aug7 and 7#5 are the same Tonal chord, but only 7#5 is registered", () => {
    const aug7 = getChord("Caug7");
    const sharp5 = getChord("C7#5");
    expect(aug7.empty).toBe(false);
    expect(sharp5.empty).toBe(false);
    expect(aug7.symbol).toBe("Caug7");
    expect(aug7.intervals).toEqual(sharp5.intervals);

    // detect() for the shared pitch-class set prefers the 7#5 spelling —
    // see the "7#5 full voicing detects itself first" test above for the
    // build+detect assertion.

    // Exact-string registry: querying by the aug7 alias returns nothing.
    expect(chordShapes.query({ chordType: "aug7" })).toEqual([]);
  });
});

// ============================================================
// analyzeInKey documented limit (TG5 5.2)
// ============================================================

describe("extended-chords: analyzeInKey documented limit", () => {
  it("Cmaj9 (a representative extension) returns an empty numeral/degree — analyzeInKey only looks up diatonic 7ths", () => {
    const result = applyChordShape(EXT_CHORD_E_MAJ9, "C", STANDARD);
    const analysis = analyzeInKey(result.frets, "C", STANDARD);

    // The chord itself is still identified (detect() finds *a* label)...
    expect(identifyChord(result.frets, STANDARD).length).toBeGreaterThan(0);
    // ...but analyzeInKey's key.chords table only enumerates the seven
    // diatonic *7th* chords (e.g. "Cmaj7"), never 9th/6th/altered
    // extensions, so a maj9 voicing can never match an entry and always
    // resolves to the empty analysis. This is expected/documented behavior,
    // not a bug — see spec.md "Key analysis (documented limit)".
    expect(analysis.empty).toBe(true);
    expect(analysis.numeral).toBe("");
    expect(analysis.degree).toBe(0);
  });
});

// ============================================================
// Whole-registry aggregate checks (TG5 5.3)
//
// The tests above (and TG2-4's) only assert uniqueness/counts within this
// file's own module realm, where extended-chords.ts is the only chord data
// file imported (vitest gives each test file an isolated module registry,
// so chordShapes here starts empty). This block additionally pulls in every
// other chord-bearing data file via dynamic import so we can assert name
// uniqueness across the *whole* registry, not just the extended set. It is
// intentionally the last describe block in this file: the dynamic imports
// mutate the shared chordShapes singleton for the remainder of this file's
// module realm, which would invalidate the exact "30 shapes" counts the
// aggregate-sanity block above depends on if it ran any earlier.
// ============================================================

describe("extended-chords: name uniqueness across the whole chord-shape registry", () => {
  it("no extended-chord shape name collides with caged/open/jazz-shell chord data", async () => {
    await import("../data/caged-chords");
    await import("../data/caged-chords-7th");
    await import("../data/open-chords");
    await import("../data/jazz-shells");

    const names = chordShapes.names();
    expect(new Set(names).size).toBe(names.length);
    // Sanity: the merge actually happened (more than just the 30 extended shapes).
    expect(names.length).toBeGreaterThan(EXTENDED_CHORD_SHAPES.length);
  });
});
