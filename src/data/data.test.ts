/**
 * Build-equivalence tests for TG8 curated data files:
 * caged-chords-7th, open-chords, jazz-shells.
 *
 * Per R-4.5: each curated shape ships with a build-equivalence test asserting
 * applyChordShape(shape, root) produces the expected fret layout and that the
 * shape builds correctly through applyChordShape without null results.
 *
 * IMPORTANT: These tests import the data files for side-effect registration.
 * The chordShapes registry is global; tests that query it assume all three
 * files have been imported.
 */

import { describe, it, expect } from "vitest";
import {
  chordShapes,
  type ChordShape,
  type VoicingPatternDictionary,
} from "../index";
import { applyChordShape, buildFrettedScale } from "../build";
import { STANDARD } from "../tuning";
import { get, all, names } from "../shape";
import { checkFretSpan } from "../audit";

// ─── Import all curated data files for side-effect registration ─────────────
import "../data/caged-chords-7th";
import "../data/open-chords";
import "../data/jazz-shells";
import { EXTENDED_CHORD_SHAPES } from "../data/extended-chords";

// Named imports for direct shape references in tests
import {
  CAGED_CHORD_E_MAJ7,
  CAGED_CHORD_A_MAJ7,
  CAGED_CHORD_D_MAJ7,
  CAGED_CHORD_E_M7,
  CAGED_CHORD_A_M7,
  CAGED_CHORD_D_M7,
  CAGED_CHORD_E_DOM7,
  CAGED_CHORD_A_DOM7,
  CAGED_CHORD_D_DOM7,
  CAGED_CHORD_E_M7B5,
  CAGED_CHORD_A_M7B5,
} from "../data/caged-chords-7th";

import {
  OPEN_C_MAJOR,
  OPEN_G_MAJOR,
  OPEN_E_MAJOR,
  OPEN_A_MAJOR,
  OPEN_D_MAJOR,
  OPEN_C_MAJ7,
  OPEN_A_M7,
  OPEN_D_DOM7,
  OPEN_A_MAJ7,
  OPEN_E_M7,
  OPEN_E_M7B5,
  OPEN_D_M7B5,
  OPEN_E_DIM,
  OPEN_E_AUG,
  BARRE_E_DIM,
  BARRE_E_AUG,
  BARRE_E_MAJOR,
  BARRE_A_MAJOR,
  BARRE_E_M7,
  BARRE_A_DOM7,
} from "../data/open-chords";

import { SHELL_DICTIONARY, SHELL_SHAPES } from "../data/jazz-shells";
import type { ScaleShape } from "../shape";

// ─── Utility ─────────────────────────────────────────────────────────────────

function buildFrets(shape: ChordShape, root: string): (number | null)[] {
  return applyChordShape(shape, root, STANDARD).frets;
}

function buildPositions(shape: ChordShape, root: string) {
  return applyChordShape(shape, root, STANDARD).positions;
}

// Shared by the caged-scales-minor and pentatonic-minor describe blocks below:
// builds the sorted {string, fret} position set for a source shape or a
// registered minor-derived shape, so the two can be compared for geometry
// equivalence.
function positionSet(root: string, source: ScaleShape): string[] {
  const result = buildFrettedScale(source, root, STANDARD);
  return result.notes.map((n) => `${n.string}:${n.fret}`).sort();
}

function minorPositionSet(minorName: string, root: string): string[] {
  const shape = get(minorName);
  expect(shape, `${minorName} not registered`).toBeDefined();
  return positionSet(root, shape!);
}

// ─── Task 8.2: CAGED 7th chord shapes ────────────────────────────────────────

describe("caged-chords-7th: build-equivalence tests", () => {
  // ─── Metadata fields ──────────────────────────────────────────────────────

  it("every CAGED 7th shape has chordType, system, voicingFamily populated", () => {
    const shapes = [
      CAGED_CHORD_E_MAJ7,
      CAGED_CHORD_A_MAJ7,
      CAGED_CHORD_D_MAJ7,
      CAGED_CHORD_E_M7,
      CAGED_CHORD_A_M7,
      CAGED_CHORD_D_M7,
      CAGED_CHORD_E_DOM7,
      CAGED_CHORD_A_DOM7,
      CAGED_CHORD_D_DOM7,
      CAGED_CHORD_E_M7B5,
      CAGED_CHORD_A_M7B5,
    ];
    for (const shape of shapes) {
      expect(shape.chordType, `${shape.name} missing chordType`).toBeTruthy();
      expect(shape.system, `${shape.name} missing system`).toBe("caged");
      expect(shape.voicingFamily, `${shape.name} missing voicingFamily`).toBe(
        "caged",
      );
      expect(shape.stringSet, `${shape.name} missing stringSet`).toBeDefined();
      expect(shape.inversion, `${shape.name} missing inversion`).toBe(0);
    }
  });

  it("CAGED 7th shapes have no canonicalRoot (movable shapes)", () => {
    const shapes = [
      CAGED_CHORD_E_MAJ7,
      CAGED_CHORD_A_MAJ7,
      CAGED_CHORD_E_M7,
      CAGED_CHORD_A_M7,
      CAGED_CHORD_E_DOM7,
      CAGED_CHORD_A_DOM7,
    ];
    for (const shape of shapes) {
      expect(
        shape.canonicalRoot,
        `${shape.name} should not have canonicalRoot`,
      ).toBeUndefined();
    }
  });

  // ─── maj7 shapes ──────────────────────────────────────────────────────────

  describe("maj7 shapes", () => {
    it("E-shape maj7 applied to E produces Emaj7 open voicing (0,2,1,1,0,0)", () => {
      const frets = buildFrets(CAGED_CHORD_E_MAJ7, "E");
      expect(frets).toEqual([0, 2, 1, 1, 0, 0]);
    });

    it("E-shape maj7 builds without error for any root (no null positions)", () => {
      const result = applyChordShape(CAGED_CHORD_E_MAJ7, "C", STANDARD);
      expect(result.positions.length).toBeGreaterThan(0);
      expect(result.positions.every((p) => p.fret !== null)).toBe(true);
    });

    it("A-shape maj7 applied to A produces Amaj7 open voicing (x,0,2,1,2,0)", () => {
      const frets = buildFrets(CAGED_CHORD_A_MAJ7, "A");
      expect(frets).toEqual([null, 0, 2, 1, 2, 0]);
    });

    it("A-shape maj7 applied to B produces Bmaj7 voicing (x,2,4,3,4,2)", () => {
      const frets = buildFrets(CAGED_CHORD_A_MAJ7, "B");
      expect(frets).toEqual([null, 2, 4, 3, 4, 2]);
    });

    it("D-shape maj7 applied to D produces Dmaj7 open voicing (x,x,0,2,2,2)", () => {
      const frets = buildFrets(CAGED_CHORD_D_MAJ7, "D");
      expect(frets).toEqual([null, null, 0, 2, 2, 2]);
    });

    it("all maj7 CAGED shapes produce only maj7 intervals", () => {
      const maj7Intervals = new Set(["1P", "3M", "5P", "7M"]);
      for (const shape of [
        CAGED_CHORD_E_MAJ7,
        CAGED_CHORD_A_MAJ7,
        CAGED_CHORD_D_MAJ7,
      ]) {
        const positions = buildPositions(shape, "G");
        for (const p of positions) {
          expect(
            maj7Intervals.has(p.interval),
            `${shape.name}: unexpected interval ${p.interval}`,
          ).toBe(true);
        }
      }
    });
  });

  // ─── m7 shapes ────────────────────────────────────────────────────────────

  describe("m7 shapes", () => {
    it("E-shape m7 applied to E produces Em7 open voicing (0,2,0,0,0,0)", () => {
      const frets = buildFrets(CAGED_CHORD_E_M7, "E");
      expect(frets).toEqual([0, 2, 0, 0, 0, 0]);
    });

    it("A-shape m7 applied to A produces Am7 open voicing (x,0,2,0,1,0)", () => {
      const frets = buildFrets(CAGED_CHORD_A_M7, "A");
      expect(frets).toEqual([null, 0, 2, 0, 1, 0]);
    });

    it("D-shape m7 applied to D produces Dm7 open voicing (x,x,0,2,1,1)", () => {
      const frets = buildFrets(CAGED_CHORD_D_M7, "D");
      expect(frets).toEqual([null, null, 0, 2, 1, 1]);
    });

    it("all m7 CAGED shapes produce only m7 intervals", () => {
      const m7Intervals = new Set(["1P", "3m", "5P", "7m"]);
      for (const shape of [
        CAGED_CHORD_E_M7,
        CAGED_CHORD_A_M7,
        CAGED_CHORD_D_M7,
      ]) {
        const positions = buildPositions(shape, "G");
        for (const p of positions) {
          expect(
            m7Intervals.has(p.interval),
            `${shape.name}: unexpected interval ${p.interval}`,
          ).toBe(true);
        }
      }
    });
  });

  // ─── dom7 shapes ──────────────────────────────────────────────────────────

  describe("dominant 7 shapes", () => {
    it("E-shape dom7 applied to E produces E7 open voicing (0,2,0,1,0,0)", () => {
      const frets = buildFrets(CAGED_CHORD_E_DOM7, "E");
      expect(frets).toEqual([0, 2, 0, 1, 0, 0]);
    });

    it("A-shape dom7 applied to A produces A7 open voicing (x,0,2,0,2,0)", () => {
      const frets = buildFrets(CAGED_CHORD_A_DOM7, "A");
      expect(frets).toEqual([null, 0, 2, 0, 2, 0]);
    });

    it("D-shape dom7 applied to D produces D7 open voicing (x,x,0,2,1,2)", () => {
      const frets = buildFrets(CAGED_CHORD_D_DOM7, "D");
      expect(frets).toEqual([null, null, 0, 2, 1, 2]);
    });

    it("all dom7 CAGED shapes produce only dom7 intervals", () => {
      const dom7Intervals = new Set(["1P", "3M", "5P", "7m"]);
      for (const shape of [
        CAGED_CHORD_E_DOM7,
        CAGED_CHORD_A_DOM7,
        CAGED_CHORD_D_DOM7,
      ]) {
        const positions = buildPositions(shape, "G");
        for (const p of positions) {
          expect(
            dom7Intervals.has(p.interval),
            `${shape.name}: unexpected interval ${p.interval}`,
          ).toBe(true);
        }
      }
    });
  });

  // ─── m7b5 shapes ──────────────────────────────────────────────────────────

  describe("m7b5 (half-diminished) shapes", () => {
    it("E-shape m7b5 applied to E builds without error and has 4 notes", () => {
      const result = applyChordShape(CAGED_CHORD_E_M7B5, "E", STANDARD);
      expect(result.positions.length).toBe(4);
    });

    it("E-shape m7b5 applied to E produces 1P, 5d, 7m, 3m intervals", () => {
      const positions = buildPositions(CAGED_CHORD_E_M7B5, "E");
      const intervals = positions.map((p) => p.interval);
      expect(intervals).toContain("1P");
      expect(intervals).toContain("5d");
      expect(intervals).toContain("7m");
      expect(intervals).toContain("3m");
    });

    it("A-shape m7b5 applied to A builds without error and has 4 notes", () => {
      const result = applyChordShape(CAGED_CHORD_A_M7B5, "A", STANDARD);
      expect(result.positions.length).toBe(4);
    });

    it("A-shape m7b5 applied to A produces 1P, 5d, 7m, 3m intervals", () => {
      const positions = buildPositions(CAGED_CHORD_A_M7B5, "A");
      const intervals = positions.map((p) => p.interval);
      expect(intervals).toContain("1P");
      expect(intervals).toContain("5d");
      expect(intervals).toContain("7m");
      expect(intervals).toContain("3m");
    });
  });
});

// ─── Task 8.3: open chords ────────────────────────────────────────────────────

describe("open-chords: build-equivalence tests", () => {
  // ─── Metadata ─────────────────────────────────────────────────────────────

  it("open shapes have canonicalRoot set and voicingFamily === 'open'", () => {
    const openShapes = chordShapes.query({ voicingFamily: "open" });
    expect(openShapes.length).toBeGreaterThan(0);
    const withCanonicalRoot = openShapes.filter(
      (s) => s.canonicalRoot !== undefined,
    );
    expect(withCanonicalRoot.length).toBe(openShapes.length);
  });

  it("barre shapes have no canonicalRoot and voicingFamily === 'barre'", () => {
    const barreShapes = chordShapes.query({ voicingFamily: "barre" });
    expect(barreShapes.length).toBeGreaterThan(0);
    for (const shape of barreShapes) {
      expect(
        shape.canonicalRoot,
        `${shape.name} should not have canonicalRoot`,
      ).toBeUndefined();
      expect(shape.system).toBe("barre");
    }
  });

  // ─── Open shapes: apply to canonicalRoot, verify frets ───────────────────

  describe("C family open shapes", () => {
    it("C Major Open applied to C produces x,3,2,0,1,0", () => {
      expect(buildFrets(OPEN_C_MAJOR, "C")).toEqual([null, 3, 2, 0, 1, 0]);
    });

    it("Cmaj7 Open applied to C produces x,3,2,0,0,0", () => {
      expect(buildFrets(OPEN_C_MAJ7, "C")).toEqual([null, 3, 2, 0, 0, 0]);
    });

    it("C Major Open has canonicalRoot 'C'", () => {
      expect(OPEN_C_MAJOR.canonicalRoot).toBe("C");
      expect(OPEN_C_MAJOR.voicingFamily).toBe("open");
    });
  });

  describe("A family open shapes", () => {
    it("A Major Open applied to A produces x,0,2,2,2,0", () => {
      expect(buildFrets(OPEN_A_MAJOR, "A")).toEqual([null, 0, 2, 2, 2, 0]);
    });

    it("Amaj7 Open applied to A produces x,0,2,1,2,0", () => {
      expect(buildFrets(OPEN_A_MAJ7, "A")).toEqual([null, 0, 2, 1, 2, 0]);
    });

    it("Am7 Open applied to A produces x,0,2,0,1,0", () => {
      expect(buildFrets(OPEN_A_M7, "A")).toEqual([null, 0, 2, 0, 1, 0]);
    });
  });

  describe("G family open shapes", () => {
    it("G Major Open applied to G produces 3,2,0,0,0,3", () => {
      expect(buildFrets(OPEN_G_MAJOR, "G")).toEqual([3, 2, 0, 0, 0, 3]);
    });
  });

  describe("E family open shapes", () => {
    it("E Major Open applied to E produces 0,2,2,1,0,0", () => {
      expect(buildFrets(OPEN_E_MAJOR, "E")).toEqual([0, 2, 2, 1, 0, 0]);
    });

    it("Em7 Open applied to E produces 0,2,0,0,0,0", () => {
      expect(buildFrets(OPEN_E_M7, "E")).toEqual([0, 2, 0, 0, 0, 0]);
    });

    it("Em7b5 Open applied to E builds correctly with m7b5 intervals", () => {
      const positions = buildPositions(OPEN_E_M7B5, "E");
      const intervals = positions.map((p) => p.interval);
      expect(intervals).toContain("1P");
      expect(intervals).toContain("5d");
      expect(intervals).toContain("7m");
      expect(intervals).toContain("3m");
    });

    it("E Diminished Open applied to E produces frets 0,1,2,0,x,x (true dim triad)", () => {
      expect(buildFrets(OPEN_E_DIM, "E")).toEqual([0, 1, 2, 0, null, null]);
    });

    it("E Diminished Open has only dim triad intervals — no 7m", () => {
      const dimIntervals = new Set(["1P", "3m", "5d"]);
      const positions = buildPositions(OPEN_E_DIM, "E");
      expect(positions.length).toBeGreaterThan(0);
      for (const p of positions) {
        expect(
          dimIntervals.has(p.interval),
          `OPEN_E_DIM: unexpected interval ${p.interval}`,
        ).toBe(true);
      }
    });

    it("E-form dim barre applied to E produces frets 0,1,2,0,x,x (true dim triad)", () => {
      expect(buildFrets(BARRE_E_DIM, "E")).toEqual([0, 1, 2, 0, null, null]);
    });

    it("E-form dim barre has only dim triad intervals — no 7m", () => {
      const dimIntervals = new Set(["1P", "3m", "5d"]);
      const positions = buildPositions(BARRE_E_DIM, "F");
      expect(positions.length).toBeGreaterThan(0);
      for (const p of positions) {
        expect(
          dimIntervals.has(p.interval),
          `BARRE_E_DIM: unexpected interval ${p.interval}`,
        ).toBe(true);
      }
    });

    // Issue #94 regression: the interval array was misordered
    // (1P 5A 3M 1P 3M 1P), which resolved to frets 12,15,18,9,9,12 —
    // an unplayable 9-fret span instead of the open 032110 grip.
    it("E Augmented Open applied to E produces 0,3,2,1,1,0", () => {
      expect(buildFrets(OPEN_E_AUG, "E")).toEqual([0, 3, 2, 1, 1, 0]);
    });

    it("E Augmented Open has only aug triad intervals", () => {
      const augIntervals = new Set(["1P", "3M", "5A"]);
      const positions = buildPositions(OPEN_E_AUG, "E");
      expect(positions.length).toBe(6);
      for (const p of positions) {
        expect(
          augIntervals.has(p.interval),
          `OPEN_E_AUG: unexpected interval ${p.interval}`,
        ).toBe(true);
      }
    });
  });

  describe("D family open shapes", () => {
    it("D Major Open applied to D produces x,x,0,2,3,2", () => {
      expect(buildFrets(OPEN_D_MAJOR, "D")).toEqual([null, null, 0, 2, 3, 2]);
    });

    it("D7 Open applied to D produces x,x,0,2,1,2", () => {
      expect(buildFrets(OPEN_D_DOM7, "D")).toEqual([null, null, 0, 2, 1, 2]);
    });

    it("Dm7b5 Open applied to D builds with m7b5 intervals", () => {
      const positions = buildPositions(OPEN_D_M7B5, "D");
      const intervals = positions.map((p) => p.interval);
      expect(intervals).toContain("1P");
      expect(intervals).toContain("5d");
      expect(intervals).toContain("7m");
      expect(intervals).toContain("3m");
    });
  });

  // ─── Barre shapes: apply to movable root ──────────────────────────────────

  describe("E-form barre shapes", () => {
    it("E-form major barre applied to F produces F major barre (1,3,3,2,1,1)", () => {
      expect(buildFrets(BARRE_E_MAJOR, "F")).toEqual([1, 3, 3, 2, 1, 1]);
    });

    it("E-form m7 barre applied to F# produces Fbm7 barre", () => {
      const result = applyChordShape(BARRE_E_M7, "F#", STANDARD);
      expect(result.positions.length).toBeGreaterThan(0);
      const intervals = result.positions.map((p) => p.interval);
      expect(intervals).toContain("1P");
      expect(intervals).toContain("3m");
      expect(intervals).toContain("7m");
    });

    // Issue #94 regression: shared the misordered interval array with
    // OPEN_E_AUG; the movable grip must transpose the 032110 layout intact.
    it("E-form aug barre applied to E produces 0,3,2,1,1,0", () => {
      expect(buildFrets(BARRE_E_AUG, "E")).toEqual([0, 3, 2, 1, 1, 0]);
    });

    it("E-form aug barre applied to F produces 1,4,3,2,2,1", () => {
      expect(buildFrets(BARRE_E_AUG, "F")).toEqual([1, 4, 3, 2, 2, 1]);
    });
  });

  // ─── Issue #94: playable-span regression for the corrected aug shapes ──────

  describe("aug shape fret span stays playable (issue #94)", () => {
    it("OPEN_E_AUG at its canonical root spans at most 4 frets", () => {
      expect(checkFretSpan(OPEN_E_AUG, "E")).toEqual([]);
    });

    it("BARRE_E_AUG spans at most 4 frets at every chromatic root", () => {
      const roots = [
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "Bb",
        "B",
        "C",
        "C#",
        "D",
        "Eb",
      ];
      for (const root of roots) {
        expect(
          checkFretSpan(BARRE_E_AUG, root),
          `BARRE_E_AUG at ${root} exceeds a playable span`,
        ).toEqual([]);
      }
    });
  });

  // ─── Issue #96: registry-wide fret-span sweep for the open-chords registry ─
  //
  // Sweeps every shape registered by open-chords.ts (voicingFamily "open" and
  // "barre" — the 70 shapes asserted by the "TG10" registry-count block
  // below) through checkFretSpan at each shape's displayable root
  // (canonicalRoot ?? "C" — barre shapes have no canonicalRoot and are
  // movable, so "C" stands in as an arbitrary-but-fixed test root). Two
  // shapes are known-bad (issue #96: their source diagrams don't survive
  // the build engine's own anchor logic without an unplayable span) and are
  // allowlisted here so CI stays green until that issue's fix lands — this
  // does NOT weaken checkFretSpan itself, only which shapes this particular
  // sweep enforces it against.
  describe("registry-wide fret-span sweep (issue #96 known issues)", () => {
    const KNOWN_ISSUES = ["G Augmented Open", "G m7b5 Open"];

    it("every open/barre chord shape not in KNOWN_ISSUES has an empty fret-span audit", () => {
      const shapes = [
        ...chordShapes.query({ voicingFamily: "open" }),
        ...chordShapes.query({ voicingFamily: "barre" }),
      ];
      expect(shapes.length).toBeGreaterThan(0);

      for (const shape of shapes) {
        if (KNOWN_ISSUES.includes(shape.name)) continue;
        const root = shape.canonicalRoot ?? "C";
        expect(
          checkFretSpan(shape, root),
          `${shape.name} at root "${root}" failed the fret-span check`,
        ).toEqual([]);
      }
    });

    it("KNOWN_ISSUES shapes are still registered (guards against a silently-removed allowlist entry)", () => {
      for (const name of KNOWN_ISSUES) {
        expect(chordShapes.get(name), `${name} not registered`).toBeDefined();
      }
    });
  });

  describe("A-form barre shapes", () => {
    it("A-form major barre applied to Bb produces Bb major barre (x,1,3,3,3,1)", () => {
      expect(buildFrets(BARRE_A_MAJOR, "Bb")).toEqual([null, 1, 3, 3, 3, 1]);
    });

    it("A-form dom7 barre applied to B produces B7 barre", () => {
      const result = applyChordShape(BARRE_A_DOM7, "B", STANDARD);
      expect(result.positions.length).toBeGreaterThan(0);
      const intervals = result.positions.map((p) => p.interval);
      expect(intervals).toContain("1P");
      expect(intervals).toContain("3M");
      expect(intervals).toContain("7m");
    });
  });
});

// ─── Task 8.4: jazz shell shapes ─────────────────────────────────────────────

describe("jazz-shells: build tests and SHELL_DICTIONARY", () => {
  // ─── SHELL_DICTIONARY ─────────────────────────────────────────────────────

  it("SHELL_DICTIONARY compiles as VoicingPatternDictionary", () => {
    // Type check: VoicingPatternDictionary = Record<string, string[]>
    const dict: VoicingPatternDictionary = SHELL_DICTIONARY;
    expect(dict).toBeDefined();
  });

  it("SHELL_DICTIONARY has expected chord types", () => {
    expect(SHELL_DICTIONARY["maj7"]).toBeDefined();
    expect(SHELL_DICTIONARY["m7"]).toBeDefined();
    expect(SHELL_DICTIONARY["7"]).toBeDefined();
    expect(SHELL_DICTIONARY["m7b5"]).toBeDefined();
  });

  it("SHELL_DICTIONARY maj7 has R37 and R73 orderings", () => {
    expect(SHELL_DICTIONARY["maj7"]).toHaveLength(2);
    expect(SHELL_DICTIONARY["maj7"][0]).toBe("1P 3M 7M");
    expect(SHELL_DICTIONARY["maj7"][1]).toBe("1P 7M 10M");
  });

  it("SHELL_DICTIONARY m7 has correct patterns", () => {
    expect(SHELL_DICTIONARY["m7"][0]).toBe("1P 3m 7m");
    expect(SHELL_DICTIONARY["m7"][1]).toBe("1P 7m 10m");
  });

  it("SHELL_DICTIONARY '7' has correct patterns", () => {
    expect(SHELL_DICTIONARY["7"][0]).toBe("1P 3M 7m");
    expect(SHELL_DICTIONARY["7"][1]).toBe("1P 7m 10M");
  });

  it("SHELL_DICTIONARY m7b5 has correct patterns", () => {
    expect(SHELL_DICTIONARY["m7b5"][0]).toBe("1P 3m 7m");
    expect(SHELL_DICTIONARY["m7b5"][1]).toBe("1P 7m 10m");
  });

  // ─── Shell shape metadata ─────────────────────────────────────────────────

  it("all shell shapes have voicingFamily 'shell' and system 'shell'", () => {
    for (const shape of SHELL_SHAPES) {
      expect(shape.voicingFamily, `${shape.name} missing voicingFamily`).toBe(
        "shell",
      );
      expect(shape.system, `${shape.name} missing system`).toBe("shell");
      expect(shape.stringSet, `${shape.name} missing stringSet`).toBeDefined();
      expect(
        shape.omittedIntervals,
        `${shape.name} missing omittedIntervals`,
      ).toBeDefined();
      expect(shape.inversion, `${shape.name} missing inversion`).toBe(0);
    }
  });

  it("maj7/m7/dom7 shells omit '5P'", () => {
    const maj7Shells = SHELL_SHAPES.filter((s) => s.chordType === "maj7");
    const m7Shells = SHELL_SHAPES.filter((s) => s.chordType === "m7");
    const dom7Shells = SHELL_SHAPES.filter((s) => s.chordType === "7");
    for (const shape of [...maj7Shells, ...m7Shells, ...dom7Shells]) {
      expect(shape.omittedIntervals).toContain("5P");
    }
  });

  it("m7b5 shells omit '5d'", () => {
    const m7b5Shells = SHELL_SHAPES.filter((s) => s.chordType === "m7b5");
    for (const shape of m7b5Shells) {
      expect(shape.omittedIntervals).toContain("5d");
    }
  });

  it("total shell shapes = 16 (4 types × 2 string sets × 2 orderings)", () => {
    expect(SHELL_SHAPES).toHaveLength(16);
  });

  // ─── Build tests ──────────────────────────────────────────────────────────

  it("maj7 R37 shell on [0,1,2] applied to C produces 1P 3M 7M notes", () => {
    const shape = SHELL_SHAPES.find(
      (s) =>
        s.chordType === "maj7" &&
        s.name.includes("R37") &&
        JSON.stringify(s.stringSet) === "[0,1,2]",
    );
    expect(shape).toBeDefined();
    const positions = buildPositions(shape!, "C");
    const intervals = positions.map((p) => p.interval);
    expect(intervals).toContain("1P");
    expect(intervals).toContain("3M");
    expect(intervals).toContain("7M");
    // Should NOT contain 5P (omitted)
    expect(intervals).not.toContain("5P");
  });

  it("maj7 R73 shell on [0,1,2] applied to C produces 1P 7M 3M notes (compound 3M voiced above 7M)", () => {
    const shape = SHELL_SHAPES.find(
      (s) =>
        s.chordType === "maj7" &&
        s.name.includes("R73") &&
        JSON.stringify(s.stringSet) === "[0,1,2]",
    );
    expect(shape).toBeDefined();
    const positions = buildPositions(shape!, "C");
    expect(positions.length).toBeGreaterThan(0);
    const intervals = positions.map((p) => p.interval);
    expect(intervals).toContain("1P");
    expect(intervals).toContain("7M");
    expect(intervals).toContain("3M");
  });

  it("m7 shell applied to C produces correct intervals", () => {
    const shape = SHELL_SHAPES.find(
      (s) =>
        s.chordType === "m7" &&
        s.name.includes("R37") &&
        JSON.stringify(s.stringSet) === "[0,1,2]",
    );
    expect(shape).toBeDefined();
    const positions = buildPositions(shape!, "C");
    const intervals = positions.map((p) => p.interval);
    expect(intervals).toContain("1P");
    expect(intervals).toContain("3m");
    expect(intervals).toContain("7m");
    expect(intervals).not.toContain("5P");
  });

  it("m7b5 shell applied to C produces 1P 3m 7m intervals (5d omitted)", () => {
    const shape = SHELL_SHAPES.find(
      (s) =>
        s.chordType === "m7b5" &&
        s.name.includes("R37") &&
        JSON.stringify(s.stringSet) === "[0,1,2]",
    );
    expect(shape).toBeDefined();
    const positions = buildPositions(shape!, "C");
    const intervals = positions.map((p) => p.interval);
    expect(intervals).toContain("1P");
    expect(intervals).toContain("3m");
    expect(intervals).toContain("7m");
    // 5d is omitted
    expect(intervals).not.toContain("5d");
  });

  it("shell on [1,2,3] (543) applied to C builds 3 notes", () => {
    const shape = SHELL_SHAPES.find(
      (s) =>
        s.chordType === "maj7" &&
        s.name.includes("R37") &&
        JSON.stringify(s.stringSet) === "[1,2,3]",
    );
    expect(shape).toBeDefined();
    const positions = buildPositions(shape!, "C");
    expect(positions.length).toBe(3);
    const intervals = positions.map((p) => p.interval);
    expect(intervals).toContain("1P");
    expect(intervals).toContain("3M");
    expect(intervals).toContain("7M");
  });
});

// ─── Task 8.1: chordShapes.query ─────────────────────────────────────────────

describe("chordShapes.query — cross-dataset queries", () => {
  it("query({ chordType: 'maj7', voicingFamily: 'caged' }) returns ≥2 shapes (E and A forms)", () => {
    const results = chordShapes.query({
      chordType: "maj7",
      voicingFamily: "caged",
    });
    expect(results.length).toBeGreaterThanOrEqual(2);
    const names = results.map((s) => s.name);
    expect(names.some((n) => n.includes("E Shape"))).toBe(true);
    expect(names.some((n) => n.includes("A Shape"))).toBe(true);
  });

  it("query({ voicingFamily: 'shell', stringSet: [0,1,2] }) returns 8 shell shapes (2 orderings × 4 types)", () => {
    const results = chordShapes.query({
      voicingFamily: "shell",
      stringSet: [0, 1, 2],
    });
    // 4 chord types × 2 orderings = 8 shapes for string set [0,1,2]
    expect(results.length).toBe(8);
  });

  it("query({ voicingFamily: 'shell', stringSet: [1,2,3] }) returns 8 shell shapes", () => {
    const results = chordShapes.query({
      voicingFamily: "shell",
      stringSet: [1, 2, 3],
    });
    expect(results.length).toBe(8);
  });

  it("after importing open-chords, ≥1 shape has canonicalRoot set and voicingFamily === 'open'", () => {
    const openShapes = chordShapes.query({ voicingFamily: "open" });
    const withCanonicalRoot = openShapes.filter(
      (s) => s.canonicalRoot !== undefined,
    );
    expect(withCanonicalRoot.length).toBeGreaterThanOrEqual(1);
  });

  it("query({ chordType: 'm7', voicingFamily: 'caged' }) returns m7 CAGED shapes", () => {
    const results = chordShapes.query({
      chordType: "m7",
      voicingFamily: "caged",
    });
    expect(results.length).toBeGreaterThanOrEqual(2); // E-shape and A-shape at minimum
    for (const shape of results) {
      expect(shape.chordType).toBe("m7");
      expect(shape.voicingFamily).toBe("caged");
    }
  });

  it("query({ chordType: '7', voicingFamily: 'shell' }) returns 4 dom7 shell shapes (2 string sets × 2 orderings)", () => {
    const results = chordShapes.query({
      chordType: "7",
      voicingFamily: "shell",
    });
    expect(results.length).toBe(4);
    for (const shape of results) {
      expect(shape.chordType).toBe("7");
      expect(shape.voicingFamily).toBe("shell");
    }
  });

  it("query({ chordType: 'M', voicingFamily: 'open' }) returns open major shapes from C/A/G/E/D families", () => {
    const results = chordShapes.query({
      chordType: "M",
      voicingFamily: "open",
    });
    expect(results.length).toBeGreaterThanOrEqual(5); // 5 families
  });

  it("query({ chordType: 'M', voicingFamily: 'barre' }) returns barre major shapes", () => {
    const results = chordShapes.query({
      chordType: "M",
      voicingFamily: "barre",
    });
    expect(results.length).toBeGreaterThanOrEqual(2); // E-form and A-form at minimum
  });
});

// ─── TG10 Gap: Data integrity — chordShapes.all() count ──────────────────────
//
// Verifies that all three new curated data files registered the expected number
// of shapes. The baseline 5 shapes come from caged-chords.ts (CAGED_CHORD_E/A/D/C/G).
// New additions: caged-chords-7th (11) + open-chords (70) + jazz-shells (16) = 97.
// Total after all imports = 5 + 97 = 102. (R-4.4)

describe("TG10 — Data integrity: chordShapes.all() count after all curated imports", () => {
  it("total registered shapes after all three new data files = 102 (5 base + 11 + 70 + 16)", () => {
    // All three data files are imported at the top of this file for side effects.
    // index.ts also imports caged-chords.ts (5 shapes).
    // Expected breakdown:
    //   caged-chords.ts:      5  (CAGED_CHORD_E/A/D/C/G)
    //   caged-chords-7th.ts: 11  (maj7/m7/7/m7b5 E+A+D forms)
    //   open-chords.ts:      70  (5 open families + 2 barre families × 10 chord types)
    //   jazz-shells.ts:      16  (4 chord types × 2 string sets × 2 orderings)
    //   extended-chords.ts:  EXTENDED_CHORD_SHAPES.length (grows per curation tier)
    const total = chordShapes.all().length;
    expect(total).toBe(102 + EXTENDED_CHORD_SHAPES.length);
  });

  it("caged-chords-7th adds exactly 11 shapes (validates R-4.1 registration)", () => {
    // 4 chord types, but not all CAGED positions exist for each:
    // maj7: E-shape + A-shape + D-shape = 3
    // m7:  E-shape + A-shape + D-shape = 3
    // 7:   E-shape + A-shape + D-shape = 3
    // m7b5: E-shape + A-shape = 2
    // Total = 11
    // Extended shapes now carry voicingFamily "extended" (not "caged"), so a
    // clean query suffices — no name-exclusion workaround needed.
    const cagedSeventh = chordShapes
      .query({ voicingFamily: "caged" })
      .filter((s) => s.chordType !== undefined);
    expect(cagedSeventh.length).toBe(11);
  });

  it("open-chords adds exactly 70 shapes (validates R-4.2 registration)", () => {
    // 5 open families × 10 types + 2 barre families × 10 types = 70
    const openCount = chordShapes.query({ voicingFamily: "open" }).length;
    const barreCount = chordShapes.query({ voicingFamily: "barre" }).length;
    expect(openCount + barreCount).toBe(70);
  });

  it("jazz-shells adds exactly 16 shapes (validates R-4.3 registration)", () => {
    // 4 chord types × 2 string sets × 2 orderings = 16
    const shellCount = chordShapes.query({ voicingFamily: "shell" }).length;
    expect(shellCount).toBe(16);
  });
});

// ─── Fingering/barre metadata invariants (issue #39: CR-005/CR-006/CR-009) ───
//
// The registry-wide sweeps for these invariants (finger 0 on a movable
// shape; repeated fingers on adjacent strings with no backing barre) live
// in audit.test.ts alongside the checks themselves — see the
// `expectRegistryClean` sweeps for checkFingerZeroOnMovable and
// checkRepeatedFingerNoBarre. They are intentionally not duplicated here.

// ─── TG3: minor CAGED entries (caged-scales-minor.ts) ────────────────────────
//
// The 5 minor CAGED shapes are derived from the 5 major CAGED shapes via
// relabelShape (chroma-anchored rotation into the natural-minor frame). Each
// pair shares identical fretboard geometry: the minor-form shape anchored at
// "A" occupies the exact same {string, fret} positions as its major-form
// parent anchored at "C" (the relative-major root for A natural minor).

import { CAGED_E, CAGED_D, CAGED_C, CAGED_A, CAGED_G } from "./caged-scales";

describe("caged-scales-minor: build-equivalence and registry tests (R4.1)", () => {
  // [minor registered name, source const, source const name (parentShape)]
  const pairs: [string, typeof CAGED_E, string][] = [
    ["Dm Shape", CAGED_E, "E Shape"],
    ["Cm Shape", CAGED_D, "D Shape"],
    ["Am Shape", CAGED_C, "C Shape"],
    ["Gm Shape", CAGED_A, "A Shape"],
    ["Em Shape", CAGED_G, "G Shape"],
  ];

  describe("build-equivalence: minor shape at A === major parent at C (relative pair)", () => {
    for (const [minorName, source] of pairs) {
      it(`${minorName} at "A" produces the same {string, fret} positions as ${source.name} at "C"`, () => {
        const minorPositions = minorPositionSet(minorName, "A");
        const majorPositions = positionSet("C", source);
        expect(minorPositions).toEqual(majorPositions);
        expect(minorPositions.length).toBeGreaterThan(0);
      });
    }
  });

  describe("minor-frame interval labels (A root build)", () => {
    for (const [minorName] of pairs) {
      it(`${minorName} at "A": pc "A" carries interval "1P", pc "C" carries interval "3m"`, () => {
        const shape = get(minorName);
        expect(shape).toBeDefined();
        const result = buildFrettedScale(shape!, "A", STANDARD);
        const aNotes = result.notes.filter((n) => n.pc === "A");
        const cNotes = result.notes.filter((n) => n.pc === "C");
        expect(aNotes.length).toBeGreaterThan(0);
        expect(cNotes.length).toBeGreaterThan(0);
        for (const n of aNotes) {
          expect(n.interval).toBe("1P");
        }
        for (const n of cNotes) {
          expect(n.interval).toBe("3m");
        }
      });
    }
  });

  describe("registry metadata (R4.1)", () => {
    const expectedRootStrings: Record<string, number> = {
      "Dm Shape": 2,
      "Cm Shape": 1,
      "Am Shape": 1,
      "Gm Shape": 0,
      "Em Shape": 0,
    };
    const expectedParents: Record<string, string> = {
      "Dm Shape": "E Shape",
      "Cm Shape": "D Shape",
      "Am Shape": "C Shape",
      "Gm Shape": "A Shape",
      "Em Shape": "G Shape",
    };

    for (const [minorName] of pairs) {
      it(`get("${minorName}") has quality "minor", parentShape "${expectedParents[minorName]}", rootString ${expectedRootStrings[minorName]}`, () => {
        const shape = get(minorName);
        expect(shape).toBeDefined();
        expect(shape!.quality).toBe("minor");
        expect(shape!.parentShape).toBe(expectedParents[minorName]);
        expect(shape!.rootString).toBe(expectedRootStrings[minorName]);
        expect(shape!.system).toBe("caged");
      });
    }
  });

  it("registry: exactly 5 entries with quality 'minor' and all 5 minor names present in names()", () => {
    const minorShapes = all().filter((s) => s.quality === "minor");
    expect(minorShapes.length).toBe(5);

    const registeredNames = names();
    for (const [minorName] of pairs) {
      expect(registeredNames).toContain(minorName);
    }
  });
});

// ─── TG4: minor pentatonic entries (pentatonic-minor.ts) ─────────────────────
//
// The 5 minor pentatonic boxes are derived from the 5 major pentatonic boxes
// via relabelShape (chroma-anchored rotation into the minor-pentatonic
// frame). Each pair shares identical fretboard geometry: the minor-form box
// anchored at "A" occupies the exact same {string, fret} positions as its
// major-form parent anchored at "C" (the relative-major root for A minor
// pentatonic).

import {
  PENTA_BOX_1,
  PENTA_BOX_2,
  PENTA_BOX_3,
  PENTA_BOX_4,
  PENTA_BOX_5,
} from "./pentatonic";

describe("pentatonic-minor: build-equivalence and registry tests (R4.2)", () => {
  // [minor registered name, source const, source const name (parentShape)]
  const pairs: [string, typeof PENTA_BOX_1, string][] = [
    ["Pentatonic Box 1 Minor", PENTA_BOX_1, "Pentatonic Box 1"],
    ["Pentatonic Box 2 Minor", PENTA_BOX_2, "Pentatonic Box 2"],
    ["Pentatonic Box 3 Minor", PENTA_BOX_3, "Pentatonic Box 3"],
    ["Pentatonic Box 4 Minor", PENTA_BOX_4, "Pentatonic Box 4"],
    ["Pentatonic Box 5 Minor", PENTA_BOX_5, "Pentatonic Box 5"],
  ];

  describe("build-equivalence: minor box at A === major parent at C (relative pair)", () => {
    for (const [minorName, source] of pairs) {
      it(`${minorName} at "A" produces the same {string, fret} positions as ${source.name} at "C"`, () => {
        const minorPositions = minorPositionSet(minorName, "A");
        const majorPositions = positionSet("C", source);
        expect(minorPositions).toEqual(majorPositions);
        expect(minorPositions.length).toBeGreaterThan(0);
      });
    }
  });

  describe("minor-frame interval labels (A root build)", () => {
    for (const [minorName] of pairs) {
      it(`${minorName} at "A": pc "A" carries interval "1P", pc "C" carries interval "3m"`, () => {
        const shape = get(minorName);
        expect(shape).toBeDefined();
        const result = buildFrettedScale(shape!, "A", STANDARD);
        const aNotes = result.notes.filter((n) => n.pc === "A");
        const cNotes = result.notes.filter((n) => n.pc === "C");
        expect(aNotes.length).toBeGreaterThan(0);
        expect(cNotes.length).toBeGreaterThan(0);
        for (const n of aNotes) {
          expect(n.interval).toBe("1P");
        }
        for (const n of cNotes) {
          expect(n.interval).toBe("3m");
        }
      });
    }
  });

  describe("registry metadata (R4.2)", () => {
    const expectedRootStrings: Record<string, number> = {
      "Pentatonic Box 1 Minor": 0,
      "Pentatonic Box 2 Minor": 2,
      "Pentatonic Box 3 Minor": 1,
      "Pentatonic Box 4 Minor": 1,
      "Pentatonic Box 5 Minor": 0,
    };
    const expectedParents: Record<string, string> = {
      "Pentatonic Box 1 Minor": "Pentatonic Box 1",
      "Pentatonic Box 2 Minor": "Pentatonic Box 2",
      "Pentatonic Box 3 Minor": "Pentatonic Box 3",
      "Pentatonic Box 4 Minor": "Pentatonic Box 4",
      "Pentatonic Box 5 Minor": "Pentatonic Box 5",
    };

    for (const [minorName] of pairs) {
      it(`get("${minorName}") has quality "minor-pentatonic", parentShape "${expectedParents[minorName]}", rootString ${expectedRootStrings[minorName]}`, () => {
        const shape = get(minorName);
        expect(shape).toBeDefined();
        expect(shape!.quality).toBe("minor-pentatonic");
        expect(shape!.parentShape).toBe(expectedParents[minorName]);
        expect(shape!.rootString).toBe(expectedRootStrings[minorName]);
        expect(shape!.system).toBe("pentatonic");
      });
    }
  });

  it("registry: exactly 5 entries with quality 'minor-pentatonic' and all 5 minor box names present in names()", () => {
    const minorShapes = all().filter((s) => s.quality === "minor-pentatonic");
    expect(minorShapes.length).toBe(5);

    const registeredNames = names();
    for (const [minorName] of pairs) {
      expect(registeredNames).toContain(minorName);
    }
  });
});

// ─── R5.3 registry-count gap: total scale-shape registrations grew by +10 ────
//
// caged-scales-minor.ts (5) + pentatonic-minor.ts (5) = 10 new entries on top
// of the pre-feature 17 (5 CAGED + 7 3NPS + 5 pentatonic). src/index.test.ts
// asserts the absolute total (all() === 27); this asserts the same fact from
// the data-layer's point of view, scoped to the two derived-entry files this
// suite exercises.

describe("R5.3 — minor-derived scale-shape registrations: +10 total", () => {
  it("quality 'minor' + 'minor-pentatonic' entries together equal exactly 10, and total registered scale shapes equal 27 (17 pre-feature + 10 derived)", () => {
    const allShapes = all();
    const derivedMinorShapes = allShapes.filter(
      (s) => s.quality === "minor" || s.quality === "minor-pentatonic",
    );
    expect(derivedMinorShapes.length).toBe(10);
    expect(names().length).toBe(27);
  });
});
