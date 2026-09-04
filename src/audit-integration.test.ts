import { describe, expect, it } from "vitest";
// Vite/Vitest raw-import: reads audit.ts's own source text at test time (no
// Node `fs` — this project carries no `@types/node`/Node-lib types for
// `src/**` to depend on, and a wildcard ambient module declaration for
// "*?raw" can only be recognized from a global .d.ts, not from within this
// module file, so the specifier is left untyped here on purpose).
// @ts-expect-error -- untyped Vite `?raw` raw-source import, see note above
import auditSource from "./audit.ts?raw";

import {
  auditAllShapesIntegration,
  auditArpeggioShapeIntegration,
  auditChordShapeFull,
  auditChordShapeIntegration,
  checkChordTonesOnly,
  checkContainsChordGrip,
  checkCoversChord,
  checkIdentifyMismatch,
  CHECK_CHORD_TONES_ONLY,
  CHECK_CONTAINS_CHORD_GRIP,
  CHECK_COVERS_CHORD,
  CHECK_IDENTIFY_MISMATCH,
} from "./audit-integration";
import { auditChordShape } from "./audit";
import { STANDARD } from "./tuning";
import { arpeggioShapes, chordShapes, ArpeggioShape, ChordShape } from "./shape";

// ============================================================
// Fixtures
// ============================================================
// Hand-built — mirrors audit.test.ts's own ArpeggioShape fixtures (no seeded
// arpeggio data ships in this feature). `fingers` uses `[]`, never `null`,
// for unfingered/muted string slots, per ArpeggioShape.fingers's
// `(number | null)[][]` contract.

const majorTriadOpenGrip: ChordShape = {
  name: "Synthetic Major Triad Fixture",
  system: "caged",
  strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
};

const cleanArpeggio: ArpeggioShape = {
  name: "Synthetic Clean Arpeggio Fixture",
  system: "caged",
  chordType: "M",
  strings: [["1P"], ["3M"], ["5P"], null, null, null],
  rootString: 0,
  fingers: [[1], [2], [3], [], [], []],
};

// ============================================================
// checkIdentifyMismatch
// ============================================================

describe("checkIdentifyMismatch", () => {
  it("positive: detect() on the built grip does not include the declared chordType", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip, chordType: "m" };
    const issues = checkIdentifyMismatch(shape, "C", STANDARD);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: CHECK_IDENTIFY_MISMATCH,
      severity: "warning",
      details: { expected: "Cm", root: "C" },
    });
    // The built grip is an unambiguous C major triad — detect() must name it,
    // just not as the (wrong) declared "Cm".
    expect((issues[0].details as { detected: string[] }).detected).toContain("CM");
  });

  it("negative: detect() on the built grip includes the declared chordType", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip, chordType: "M" };
    expect(checkIdentifyMismatch(shape, "C", STANDARD)).toEqual([]);
  });

  it("skipped ([]) when chordType is undefined", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip };
    delete shape.chordType;
    expect(checkIdentifyMismatch(shape, "C", STANDARD)).toEqual([]);
  });

  it("uses the normalized build root (Fingering.root) in expected/details, not the raw root argument", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip, chordType: "M" };
    // "C4" is not itself a pitch class but applyChordShape normalizes it via
    // toPitchClass; expected/details.root must reflect that normalization.
    const issues = checkIdentifyMismatch(shape, "C4", STANDARD);
    expect(issues).toEqual([]);
  });
});

// ============================================================
// checkChordTonesOnly
// ============================================================

describe("checkChordTonesOnly", () => {
  it("clean fixture: []", () => {
    expect(checkChordTonesOnly(cleanArpeggio, "C", STANDARD)).toEqual([]);
  });

  it("flags a built note outside the declared chord's tones", () => {
    const shape: ArpeggioShape = {
      ...cleanArpeggio,
      name: "Synthetic Extra Tone Arpeggio Fixture",
      strings: [["1P"], ["3M"], ["5P"], ["2M"], null, null],
      fingers: [[1], [2], [3], [4], [], []],
    };
    const issues = checkChordTonesOnly(shape, "C", STANDARD);

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe(CHECK_CHORD_TONES_ONLY);
    expect(issues[0].severity).toBe("warning");
    const details = issues[0].details as { extraNotes: { pc: string }[] };
    expect(details.extraNotes.map((n) => n.pc)).toEqual(["D"]);
  });

  it("skipped when chordType does not resolve to a chord with intervals", () => {
    const shape: ArpeggioShape = { ...cleanArpeggio, chordType: "not-a-real-chord-type" };
    expect(checkChordTonesOnly(shape, "C", STANDARD)).toEqual([]);
  });
});

// ============================================================
// checkCoversChord
// ============================================================

describe("checkCoversChord", () => {
  it("clean fixture: []", () => {
    expect(checkCoversChord(cleanArpeggio, "C", STANDARD)).toEqual([]);
  });

  it("flags a chord tone the arpeggio never plays", () => {
    const shape: ArpeggioShape = {
      ...cleanArpeggio,
      name: "Synthetic Missing Fifth Arpeggio Fixture",
      strings: [["1P"], ["3M"], null, null, null, null],
      fingers: [[1], [2], [], [], [], []],
    };
    const issues = checkCoversChord(shape, "C", STANDARD);

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe(CHECK_COVERS_CHORD);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].details).toMatchObject({ missingIntervals: ["5P"] });
  });

  it("skipped when chordType does not resolve to a chord with intervals", () => {
    const shape: ArpeggioShape = { ...cleanArpeggio, chordType: "not-a-real-chord-type" };
    expect(checkCoversChord(shape, "C", STANDARD)).toEqual([]);
  });
});

// ============================================================
// checkContainsChordGrip
// ============================================================

describe("checkContainsChordGrip", () => {
  const grip: ChordShape = {
    name: "Synthetic Contains-Grip Fixture",
    system: "caged",
    strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
    rootString: 0,
  };

  it("skipped ([]) when shape.chordShape is absent", () => {
    expect(checkContainsChordGrip(cleanArpeggio, "C", STANDARD)).toEqual([]);
  });

  it("skipped ([]) when shape.chordShape does not resolve in chordShapes", () => {
    const shape: ArpeggioShape = { ...cleanArpeggio, chordShape: "Not Registered Anywhere" };
    expect(checkContainsChordGrip(shape, "C", STANDARD)).toEqual([]);
  });

  it("clean: an arpeggio that plays every one of the grip's fretted positions", () => {
    chordShapes.add(grip);
    try {
      const shape: ArpeggioShape = {
        name: "Synthetic Full-Coverage Arpeggio Fixture",
        system: "caged",
        chordType: "M",
        chordShape: grip.name,
        strings: [["1P"], ["5P"], ["1P"], ["3M"], ["5P"], ["1P"]],
        rootString: 0,
        fingers: [[1], [3], [4], [2], [1], [1]],
      };
      expect(checkContainsChordGrip(shape, "C", STANDARD)).toEqual([]);
    } finally {
      chordShapes.remove(grip.name);
    }
  });

  it("flags grip positions the arpeggio never plays", () => {
    chordShapes.add(grip);
    try {
      const shape: ArpeggioShape = {
        name: "Synthetic Partial-Coverage Arpeggio Fixture",
        system: "caged",
        chordType: "M",
        chordShape: grip.name,
        // Omits string 3 (the "3M" string of the grip) entirely.
        strings: [["1P"], ["5P"], ["1P"], null, ["5P"], ["1P"]],
        rootString: 0,
        fingers: [[1], [3], [4], [], [1], [1]],
      };
      const issues = checkContainsChordGrip(shape, "C", STANDARD);

      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe(CHECK_CONTAINS_CHORD_GRIP);
      expect(issues[0].severity).toBe("warning");
      const details = issues[0].details as { missing: { string: number }[] };
      expect(details.missing.map((m) => m.string)).toEqual([3]);
    } finally {
      chordShapes.remove(grip.name);
    }
  });
});

// ============================================================
// Aggregates
// ============================================================

describe("auditChordShapeIntegration", () => {
  it("runs identify-mismatch with the same root/tuning defaults as auditChordShape", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip, chordType: "m" };
    expect(auditChordShapeIntegration(shape)).toEqual(checkIdentifyMismatch(shape, "C", STANDARD));
  });

  it("options.root/tuning thread through", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip, chordType: "M", canonicalRoot: "C" };
    const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"];
    expect(auditChordShapeIntegration(shape, { root: "D", tuning: dropD })).toEqual(
      checkIdentifyMismatch(shape, "D", dropD),
    );
  });
});

describe("auditArpeggioShapeIntegration", () => {
  it("clean fixture: []", () => {
    expect(auditArpeggioShapeIntegration(cleanArpeggio)).toEqual([]);
  });

  it("combines all three chord-tone checks when every one fails at once", () => {
    chordShapes.add(majorTriadOpenGrip);
    try {
      const shape: ArpeggioShape = {
        name: "Synthetic Everything-Wrong Arpeggio Fixture",
        system: "caged",
        chordType: "M",
        chordShape: majorTriadOpenGrip.name,
        // Extra tone (2M/D), missing the 5th, and doesn't cover the grip.
        strings: [["1P"], ["2M"], null, null, null, null],
        rootString: 0,
        fingers: [[1], [2], [], [], [], []],
      };
      const issues = auditArpeggioShapeIntegration(shape);

      expect(issues.some((i) => i.id === CHECK_CHORD_TONES_ONLY)).toBe(true);
      expect(issues.some((i) => i.id === CHECK_COVERS_CHORD)).toBe(true);
      expect(issues.some((i) => i.id === CHECK_CONTAINS_CHORD_GRIP)).toBe(true);
      expect(issues).toEqual([
        ...checkChordTonesOnly(shape, "C", STANDARD),
        ...checkCoversChord(shape, "C", STANDARD),
        ...checkContainsChordGrip(shape, "C", STANDARD),
      ]);
    } finally {
      chordShapes.remove(majorTriadOpenGrip.name);
    }
  });

  it("root defaults to 'C' (ArpeggioShape has no canonicalRoot)", () => {
    expect(auditArpeggioShapeIntegration(cleanArpeggio)).toEqual(
      auditArpeggioShapeIntegration(cleanArpeggio, { root: "C" }),
    );
  });
});

describe("auditChordShapeFull", () => {
  it("equals auditChordShape ++ auditChordShapeIntegration", () => {
    const shape: ChordShape = { ...majorTriadOpenGrip, chordType: "m" };
    expect(auditChordShapeFull(shape)).toEqual([
      ...auditChordShape(shape),
      ...auditChordShapeIntegration(shape),
    ]);
  });
});

describe("auditAllShapesIntegration", () => {
  it("keys results by shape.name for every registered chord and arpeggio shape", () => {
    chordShapes.add(majorTriadOpenGrip);
    arpeggioShapes.add(cleanArpeggio);
    try {
      const result = auditAllShapesIntegration();

      expect(result.chord.has(majorTriadOpenGrip.name)).toBe(true);
      expect(result.arpeggio.has(cleanArpeggio.name)).toBe(true);
      expect(result.chord.get(majorTriadOpenGrip.name)).toEqual(
        auditChordShapeIntegration(majorTriadOpenGrip),
      );
      expect(result.arpeggio.get(cleanArpeggio.name)).toEqual(
        auditArpeggioShapeIntegration(cleanArpeggio),
      );
    } finally {
      chordShapes.remove(majorTriadOpenGrip.name);
      arpeggioShapes.remove(cleanArpeggio.name);
    }
  });
});

// ============================================================
// D-006 tier-boundary import-graph assertion
// ============================================================
// src/audit.ts (required-peer tier) must never import ./audit-integration
// or @tonaljs/chord — directly or transitively. This is enforced by
// asserting audit.ts's own source text never references either, which is
// sufficient: audit-integration.ts is the ONLY place @tonaljs/chord is used
// outside of integration.ts (also optional tier), so the only way audit.ts
// could transitively reach @tonaljs/chord is by importing one of those two
// modules directly — ruled out by the same grep.

describe("D-006 tier boundary: src/audit.ts must not reach the optional tier", () => {
  it("does not import ./audit-integration", () => {
    expect(auditSource).not.toMatch(/["'](\.\/)?audit-integration["']/);
  });

  it("does not import @tonaljs/chord", () => {
    expect(auditSource).not.toMatch(/["']@tonaljs\/chord["']/);
  });

  it("has no reference to ./integration either (required-peer tier boundary, CLAUDE.md)", () => {
    expect(auditSource).not.toMatch(/["'](\.\/)?integration["']/);
  });

  it("src/audit-integration.ts is never imported by src/audit.ts (redundant, explicit check)", () => {
    const importLines: string[] = auditSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      expect(line).not.toContain("audit-integration");
    }
  });
});
