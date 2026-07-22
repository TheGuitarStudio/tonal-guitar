import { describe, expect, it } from "vitest";
import {
  auditAllShapes,
  auditChordShape,
  auditScaleShape,
  checkChordBuildLoss,
  checkChordMetadataCompleteness,
  checkFingerZeroOnMovable,
  checkFretSpan,
  checkGeometryMismatch,
  checkRepeatedFingerNoBarre,
  checkScaleBuildLoss,
  checkScaleMetadataCompleteness,
  chordShapeGeometry,
  CHECK_BUILD_LOSS,
  CHECK_FINGER_ZERO_ON_MOVABLE,
  CHECK_FRET_SPAN,
  CHECK_GEOMETRY_MISMATCH,
  CHECK_METADATA_COMPLETENESS,
  CHECK_REPEATED_FINGER_NO_BARRE,
  displayRootFor,
  gripRootFor,
  sourceFrets,
} from "./audit";
import type { AuditSeverity, ShapeAuditIssue, ShapeAuditOptions } from "./audit";
import {
  displayRootFor as displayRootForFromIndex,
  VERSION as VERSION_FROM_INDEX,
} from "./index";
import type {
  AuditSeverity as AuditSeverityFromIndex,
  ShapeAuditIssue as ShapeAuditIssueFromIndex,
  ShapeAuditOptions as ShapeAuditOptionsFromIndex,
} from "./index";
import { VERSION } from "./version";
import { applyChordShape } from "./build";
import { STANDARD } from "./tuning";
import { all as allScaleShapes, chordShapes, get as getScaleShape, ChordShape, ScaleShape } from "./shape";
import {
  BARRE_E_SUS2,
  OPEN_C_MAJOR,
  OPEN_C_MINOR,
  OPEN_G_AUG,
  OPEN_G_M7B5,
} from "./data/open-chords";
import { SHELL_SHAPES } from "./data/jazz-shells";
import { EXT_CHORD_E_6, EXT_CHORD_A_6 } from "./data/extended-chords";
import { CAGED_CHORD_C, CAGED_CHORD_E, CAGED_CHORD_G } from "./data/caged-chords";
import { CAGED_E } from "./data/caged-scales";
import { CAGED_DM } from "./data/caged-scales-minor";
import { PENTA_BOX_1_MINOR } from "./data/pentatonic-minor";

/**
 * Shared registry-wide assertion: every shape in `shapes` must pass `check`
 * cleanly (`[]`). Asserts `shapes.length > 0` first (so an empty registry
 * can't silently pass), then loops with an intent-revealing failure message
 * naming both the offending shape and `label`.
 */
function expectRegistryClean<T extends { name: string }>(
  shapes: T[],
  check: (shape: T) => unknown[],
  label: string,
): void {
  expect(shapes.length).toBeGreaterThan(0);
  for (const shape of shapes) {
    expect(check(shape), `${shape.name} unexpectedly flagged by ${label}`).toEqual([]);
  }
}

describe("displayRootFor", () => {
  it("returns canonicalRoot when set", () => {
    expect(displayRootFor({ canonicalRoot: "C" })).toBe("C");
  });

  it("returns canonicalRoot for a non-C root", () => {
    expect(displayRootFor({ canonicalRoot: "G" })).toBe("G");
  });

  it("defaults to 'C' when canonicalRoot is absent", () => {
    expect(displayRootFor({})).toBe("C");
  });

  it("defaults to 'C' when canonicalRoot is explicitly undefined", () => {
    expect(displayRootFor({ canonicalRoot: undefined })).toBe("C");
  });
});

describe("audit scaffolding — type-only compile checks", () => {
  it("resolves AuditSeverity, ShapeAuditIssue, ShapeAuditOptions from ./audit", () => {
    const severity: AuditSeverity = "warning";
    const issue: ShapeAuditIssue = {
      id: "fret-span",
      severity,
      message: "example",
    };
    const options: ShapeAuditOptions = {
      root: "C",
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      maxFretSpan: 4,
    };
    expect(issue.id).toBe("fret-span");
    expect(options.maxFretSpan).toBe(4);
  });

  it("resolves AuditSeverity, ShapeAuditIssue, ShapeAuditOptions from ./index", () => {
    const severity: AuditSeverityFromIndex = "error";
    const issue: ShapeAuditIssueFromIndex = {
      id: "geometry-mismatch",
      severity,
      message: "example",
      details: { span: 5 },
    };
    const options: ShapeAuditOptionsFromIndex = {};
    expect(issue.severity).toBe("error");
    expect(options.root).toBeUndefined();
  });

  it("exposes displayRootFor identically from ./audit and ./index", () => {
    expect(typeof displayRootFor).toBe("function");
    expect(typeof displayRootForFromIndex).toBe("function");
    expect(displayRootForFromIndex({ canonicalRoot: "D" })).toBe("D");
    expect(displayRootForFromIndex({})).toBe("C");
  });
});

describe("VERSION", () => {
  it("is exported from ./version as \"0.1.0\"", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("is re-exported from ./index and matches ./version", () => {
    expect(VERSION_FROM_INDEX).toBe("0.1.0");
    expect(VERSION_FROM_INDEX).toBe(VERSION);
  });
});

describe("checkGeometryMismatch fixtures", () => {
  it("OPEN_C_MAJOR: sourceFrets reproduces baseFret as min fretted fret; built == source", () => {
    const gr = gripRootFor(OPEN_C_MAJOR);
    expect(gr).toBe("C");
    const src = sourceFrets(OPEN_C_MAJOR, gr as string, OPEN_C_MAJOR.baseFret as number);
    const fretted = src.filter((f): f is number => f != null && f > 0);
    expect(Math.min(...fretted)).toBe(OPEN_C_MAJOR.baseFret);
    const issues = checkGeometryMismatch(OPEN_C_MAJOR);
    expect(issues).toEqual([]);
  });

  it("OPEN_C_MINOR: grip root parsed from name; built == source, []", () => {
    expect(OPEN_C_MINOR.canonicalRoot).toBeUndefined();
    const gr = gripRootFor(OPEN_C_MINOR);
    expect(gr).toBe("C");
    const issues = checkGeometryMismatch(OPEN_C_MINOR);
    expect(issues).toEqual([]);
  });

  it("OPEN_G_AUG (#96 known-bad): built diverges from source", () => {
    const issues = checkGeometryMismatch(OPEN_G_AUG);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe("geometry-mismatch");
    const details = issues[0].details as { mismatchedStrings: number[] };
    expect(details.mismatchedStrings.length).toBeGreaterThan(0);
  });

  it("OPEN_G_M7B5 (#96 known-bad): built diverges from source", () => {
    const issues = checkGeometryMismatch(OPEN_G_M7B5);
    expect(issues.length).toBe(1);
    const details = issues[0].details as { mismatchedStrings: number[] };
    expect(details.mismatchedStrings.length).toBeGreaterThan(0);
  });

  it("jazz shell (no baseFret): skipped, []", () => {
    const shell = SHELL_SHAPES.find((s) => s.name === "Shell maj7 R37 012");
    expect(shell).toBeDefined();
    expect(shell?.baseFret).toBeUndefined();
    expect(checkGeometryMismatch(shell as ChordShape)).toEqual([]);
  });

  it("EXT_CHORD_E_6 (no baseFret): skipped, []", () => {
    expect(EXT_CHORD_E_6.baseFret).toBeUndefined();
    expect(checkGeometryMismatch(EXT_CHORD_E_6)).toEqual([]);
  });

  it("EXT_CHORD_A_6 (no baseFret): skipped, []", () => {
    expect(EXT_CHORD_A_6.baseFret).toBeUndefined();
    expect(checkGeometryMismatch(EXT_CHORD_A_6)).toEqual([]);
  });

  describe("gripRootFor unit cases", () => {
    it("uses canonicalRoot when present", () => {
      expect(
        gripRootFor({
          name: "whatever",
          system: "open",
          strings: [],
          fingers: [],
          barres: [],
          rootString: 0,
          canonicalRoot: "G",
        }),
      ).toBe("G");
    });

    it("parses leading root token from name: 'G m7b5 Open' -> 'G'", () => {
      expect(
        gripRootFor({
          name: "G m7b5 Open",
          system: "barre",
          strings: [],
          fingers: [],
          barres: [],
          rootString: 0,
        }),
      ).toBe("G");
    });

    it("parses leading root token from name: 'C Minor Open' -> 'C'", () => {
      expect(
        gripRootFor({
          name: "C Minor Open",
          system: "barre",
          strings: [],
          fingers: [],
          barres: [],
          rootString: 0,
        }),
      ).toBe("C");
    });

    it("returns undefined when neither canonicalRoot nor a parseable root token exists", () => {
      expect(
        gripRootFor({
          name: "Shell maj7 R37 012",
          system: "shell",
          strings: [],
          fingers: [],
          barres: [],
          rootString: 0,
        }),
      ).toBeUndefined();
    });

    it("does not misread a CAGED form-family letter as a root: 'E Form Major Barre' -> undefined", () => {
      expect(
        gripRootFor({
          name: "E Form Major Barre",
          system: "barre",
          strings: [],
          fingers: [],
          barres: [],
          rootString: 0,
        }),
      ).toBeUndefined();
    });
  });
});

describe("checkGeometryMismatch registry-wide validation", () => {
  it("checkGeometryMismatch returns [] for all shapes with no baseFret", () => {
    const noBaseFret = chordShapes.all().filter((s) => s.baseFret == null);
    expect(noBaseFret.length).toBeGreaterThan(0);
    for (const shape of noBaseFret) {
      const issues = checkGeometryMismatch(shape);
      expect(issues).toEqual([]);
    }
  });

  // The spec.md lift rule ("let f = raw; while (f < shape.baseFret) f +=
  // 12;") is implemented verbatim. The name-parsing fallback in gripRootFor
  // is restricted to the `"<Root> ... Open"` naming convention the spec
  // describes: the 20 movable "E/A Form ... Barre" shapes (baseFret: 1, no
  // canonicalRoot, barre at the nut) would otherwise have their leading
  // CAGED-form-family letter misread as an authored chord root, producing a
  // structural false-positive class — a nut-position barre grip (fret 0
  // with a non-zero finger) is indistinguishable from a genuine
  // off-by-octave defect (OPEN_G_AUG's B-string defect has the exact same
  // raw=0/finger!=0/baseFret=1 signature). Those 20 shapes are therefore
  // skipped (no grip root), per the spec's "if neither yields a root, skip
  // the check" rule.
  //
  // A full registry sweep over the remaining 50 `"<Root> ... Open"` shapes
  // flags 7, not just the 2 seeded #96 fixtures:
  //
  //   1. The 2 seeded #96 shapes (OPEN_G_AUG, OPEN_G_M7B5) — genuine
  //      misordered-interval defects, confirmed by hand against their own
  //      fret-diagram comments and fingers/barres data.
  //   2. 5 additional open-chords.ts shapes with the SAME class of genuine
  //      defect, independently discovered by this sweep (verified by hand
  //      against each shape's own diagram comment/fingers data — these are
  //      not artifacts of this check):
  //        - "G Dominant 7 Open" / "G Major 7 Open": fingers[5] === 0
  //          (implies open) while the diagram's high-e string is fretted
  //          (fret 1 / fret 2 respectively) — a fingers-array bug.
  //        - "E Sus2 Open": same class of fingers-array bug on the D string.
  //        - "G Sus2 Open": strings[1..3] are cyclically misordered
  //          (2M/5P/1P recorded as 5P/1P/2M) — a misordered-interval defect,
  //          the same class as #96.
  //        - "E m7b5 Open": the D-string interval ("7m") is inconsistent
  //          with its own fret-diagram comment ("0120xx") and fingers data
  //          (finger 2, i.e. fretted, not open) — fret 2 on an open-D string
  //          sounds the root (E), not the 7th (D); a mislabeled interval.
  it("checkGeometryMismatch's registry-wide mismatch set matches the documented, hand-verified list above", () => {
    const knownMismatching = new Set([
      // #96 seeded pair
      "G Augmented Open",
      "G m7b5 Open",
      // additional genuine defects discovered by the sweep
      "G Dominant 7 Open",
      "G Major 7 Open",
      "G Sus2 Open",
      "E Sus2 Open",
      "E m7b5 Open",
    ]);
    expect(knownMismatching.size).toBe(7);

    const withBaseFret = chordShapes.all().filter((s) => s.baseFret != null);
    expect(withBaseFret.length).toBe(70);

    const actuallyMismatching = new Set(
      withBaseFret
        .filter((shape) => checkGeometryMismatch(shape).length > 0)
        .map((shape) => shape.name),
    );
    expect(actuallyMismatching).toEqual(knownMismatching);
  });

  it("both #96 known-bad shapes DO mismatch", () => {
    const gAug = chordShapes.get("G Augmented Open");
    const gM7b5 = chordShapes.get("G m7b5 Open");
    expect(gAug).toBeDefined();
    expect(gM7b5).toBeDefined();
    expect(checkGeometryMismatch(gAug as ChordShape).length).toBe(1);
    expect(checkGeometryMismatch(gM7b5 as ChordShape).length).toBe(1);
  });
});

// ============================================================
// checkFretSpan
// ============================================================

describe("checkFretSpan", () => {
  it("OPEN_C_MAJOR (clean, baseFret 1): no issues", () => {
    expect(checkFretSpan(OPEN_C_MAJOR, "C")).toEqual([]);
  });

  it("OPEN_G_AUG (#96 known-bad, 10-fret span): one error issue with span > 4", () => {
    const issues = checkFretSpan(OPEN_G_AUG, "G");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_FRET_SPAN);
    expect(issues[0].severity).toBe("error");
    const details = issues[0].details as { span: number };
    expect(details.span).toBeGreaterThan(4);
  });

  it("OPEN_G_M7B5 (#96 known-bad): one error issue with span > 4", () => {
    const issues = checkFretSpan(OPEN_G_M7B5, "G");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_FRET_SPAN);
    expect(issues[0].severity).toBe("error");
    const details = issues[0].details as { span: number };
    expect(details.span).toBeGreaterThan(4);
  });

  it("boundary: span === maxSpan (4) does not flag (strict >, not >=)", () => {
    // BARRE_E_SUS2 applied at its movable E-form convention root ("F")
    // spans exactly 4 frets — the canonical boundary case.
    const issues = checkFretSpan(BARRE_E_SUS2, "F");
    expect(issues).toEqual([]);
  });

  it("all strings open or muted: fretted array is empty, span defaults to 0, no issue", () => {
    // Exercises the `fretted.length ? max - min : 0` ternary's false
    // branch directly: root "E" against tuning[0] ("E2") builds string 0
    // at fret 0 (open) via applyChordShape, and every other string is
    // muted — so there is no fret > 0 anywhere and `fretted` is empty,
    // which must compute span as 0 rather than throw on
    // Math.max(...[])/Math.min(...[]).
    const allOpenOrMuted: ChordShape = {
      name: "Synthetic All Open Or Muted",
      system: "test",
      strings: ["1P", null, null, null, null, null],
      fingers: [0, null, null, null, null, null],
      barres: [],
      rootString: 0,
      canonicalRoot: "E",
    };
    const built = applyChordShape(allOpenOrMuted, "E");
    expect(built.frets.some((f) => f !== null && f > 0)).toBe(false);
    expect(checkFretSpan(allOpenOrMuted, "E")).toEqual([]);
  });

  it("CAGED_CHORD_C (#114 regression): builds to the open C-major grip at root C and passes checkFretSpan at every chromatic root", () => {
    // Prior to #114's fix, strings[1]/strings[2] ("A" and "D" strings) held
    // swapped intervals (3M/1P instead of 1P/3M), anchoring the shape an
    // octave away from the intended grip and producing a 6-fret span.
    const built = applyChordShape(CAGED_CHORD_C, "C");
    expect(built.frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(checkFretSpan(CAGED_CHORD_C, "C")).toEqual([]);

    const roots = [
      "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    for (const root of roots) {
      expect(
        checkFretSpan(CAGED_CHORD_C, root),
        `CAGED_CHORD_C at root "${root}" unexpectedly failed checkFretSpan`,
      ).toEqual([]);
    }
  });

  it("CAGED_CHORD_G (#114 regression): builds to the open G-major grip at root G and passes checkFretSpan at every chromatic root", () => {
    // Prior to #114's fix, strings[5] (the high-e string) held "5P" instead
    // of "1P", so it resolved to a fret an octave away from the rest of the
    // grip, producing a 10-fret span.
    const built = applyChordShape(CAGED_CHORD_G, "G");
    expect(built.frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(checkFretSpan(CAGED_CHORD_G, "G")).toEqual([]);

    const roots = [
      "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    for (const root of roots) {
      expect(
        checkFretSpan(CAGED_CHORD_G, root),
        `CAGED_CHORD_G at root "${root}" unexpectedly failed checkFretSpan`,
      ).toEqual([]);
    }
  });

  it("custom maxSpan override moves the pass/fail boundary", () => {
    // "Shell m7 R73 012" applied at C spans exactly 5 frets: fails the
    // default maxSpan (4) but passes when maxSpan is raised to 5.
    const shellM7R73 = SHELL_SHAPES.find(
      (s) =>
        s.chordType === "m7" &&
        s.name.includes("R73") &&
        JSON.stringify(s.stringSet) === "[0,1,2]",
    );
    expect(shellM7R73).toBeDefined();

    const defaultIssues = checkFretSpan(shellM7R73 as ChordShape, "C");
    expect(defaultIssues.length).toBe(1);
    expect((defaultIssues[0].details as { span: number }).span).toBe(5);

    const raisedMaxSpanIssues = checkFretSpan(
      shellM7R73 as ChordShape,
      "C",
      undefined,
      5,
    );
    expect(raisedMaxSpanIssues).toEqual([]);
  });
});

// ============================================================
// checkFingerZeroOnMovable / checkRepeatedFingerNoBarre
// ============================================================

describe("checkFingerZeroOnMovable", () => {
  it("movable shape (no canonicalRoot) with finger 0: one error issue with details.fingers", () => {
    const movableWithOpenFinger: ChordShape = {
      name: "Synthetic Movable Bad",
      system: "test",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 0, 4, 2, 1, 1],
      barres: [],
      rootString: 0,
    };
    const issues = checkFingerZeroOnMovable(movableWithOpenFinger);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_FINGER_ZERO_ON_MOVABLE);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].details).toBeDefined();
    expect((issues[0].details as { fingers: unknown }).fingers).toEqual(
      movableWithOpenFinger.fingers,
    );
  });

  it("movable shape (no canonicalRoot) with no finger 0: []", () => {
    expect(CAGED_CHORD_E.canonicalRoot).toBeUndefined();
    expect(checkFingerZeroOnMovable(CAGED_CHORD_E)).toEqual([]);
  });

  it("open shape (canonicalRoot set) with finger 0: [] (movable-only check)", () => {
    expect(OPEN_C_MAJOR.canonicalRoot).toBe("C");
    expect(OPEN_C_MAJOR.fingers.includes(0)).toBe(true);
    expect(checkFingerZeroOnMovable(OPEN_C_MAJOR)).toEqual([]);
  });

  it("registry-wide: no currently-registered shape fails checkFingerZeroOnMovable", () => {
    // The sweep is only meaningful if the registry actually contains movable
    // shapes (no canonicalRoot) — the branch this check exists to police.
    const movableShapes = chordShapes
      .all()
      .filter((s) => s.canonicalRoot === undefined);
    expect(movableShapes.length).toBeGreaterThan(0);
    expectRegistryClean(
      chordShapes.all(),
      checkFingerZeroOnMovable,
      "checkFingerZeroOnMovable",
    );
  });
});

describe("checkRepeatedFingerNoBarre", () => {
  it("adjacent repeated fingers covered by a matching barres entry: []", () => {
    // CAGED_CHORD_E: fingers [1,3,4,2,1,1], barre {fret:0, fromString:0,
    // toString:5, finger:1} covers the repeated finger-1 pair on strings 4,5.
    expect(checkRepeatedFingerNoBarre(CAGED_CHORD_E)).toEqual([]);
  });

  it("adjacent repeated fingers NOT covered by any barres entry: one error issue per pair", () => {
    const uncoveredRepeat: ChordShape = {
      name: "Synthetic Uncovered Repeat",
      system: "test",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 2, 2, 3, 4, 4],
      barres: [],
      rootString: 0,
    };
    const issues = checkRepeatedFingerNoBarre(uncoveredRepeat);
    expect(issues.length).toBe(2);
    for (const issue of issues) {
      expect(issue.id).toBe(CHECK_REPEATED_FINGER_NO_BARRE);
      expect(issue.severity).toBe("error");
    }
    expect((issues[0].details as { finger: number; strings: number[] })).toEqual({
      finger: 2,
      strings: [1, 2],
    });
    expect((issues[1].details as { finger: number; strings: number[] })).toEqual({
      finger: 4,
      strings: [4, 5],
    });
  });

  it("repeated finger 0 (open) on adjacent strings: [] (excluded per spec semantics)", () => {
    const repeatedOpen: ChordShape = {
      name: "Synthetic Repeated Open",
      system: "test",
      strings: ["1P", "5P", null, "3M", "5P", "1P"],
      fingers: [0, 0, null, 2, 3, 4],
      barres: [],
      rootString: 0,
      canonicalRoot: "C",
    };
    expect(checkRepeatedFingerNoBarre(repeatedOpen)).toEqual([]);
  });

  it("repeated finger null (muted) on adjacent strings: [] (excluded per spec semantics)", () => {
    const repeatedNull: ChordShape = {
      name: "Synthetic Repeated Null",
      system: "test",
      strings: [null, null, "1P", "3M", "5P", "1P"],
      fingers: [null, null, 1, 2, 3, 4],
      barres: [],
      rootString: 2,
    };
    expect(checkRepeatedFingerNoBarre(repeatedNull)).toEqual([]);
  });

  it("registry-wide: no currently-registered shape fails checkRepeatedFingerNoBarre", () => {
    expectRegistryClean(
      chordShapes.all(),
      checkRepeatedFingerNoBarre,
      "checkRepeatedFingerNoBarre",
    );
  });
});

// ============================================================
// checkChordBuildLoss / checkScaleBuildLoss
// ============================================================

describe("checkChordBuildLoss", () => {
  it("OPEN_C_MAJOR (clean chord shape): []", () => {
    expect(checkChordBuildLoss(OPEN_C_MAJOR, "C")).toEqual([]);
  });

  it("synthetic shape with an unresolvable interval: one error issue, builtCount < playedCount", () => {
    // "not-an-interval" fails @tonaljs/interval parsing, so transpose()
    // returns "" for that string and buildFrettedScale drops the note —
    // the string is still "played" (non-null in shape.strings) but never
    // makes it into the built frets.
    const shape: ChordShape = {
      name: "Synthetic Build Loss Chord",
      system: "test",
      strings: ["1P", "not-an-interval", "5P", null, null, null],
      fingers: [1, 2, 1, null, null, null],
      barres: [],
      rootString: 0,
    };
    const issues = checkChordBuildLoss(shape, "C");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_BUILD_LOSS);
    expect(issues[0].severity).toBe("error");
    const details = issues[0].details as {
      playedCount: number;
      builtCount: number;
      frets: (number | null)[];
    };
    expect(details.playedCount).toBe(3);
    expect(details.builtCount).toBe(2);
    expect(details.builtCount).toBeLessThan(details.playedCount);
    expect(details.frets).toEqual([8, null, 5, null, null, null]);
  });

  it("registry-wide: no currently-registered chord shape fails checkChordBuildLoss at displayRootFor", () => {
    expectRegistryClean(
      chordShapes.all(),
      (shape) => checkChordBuildLoss(shape, displayRootFor(shape)),
      "checkChordBuildLoss",
    );
  });

  it("fully unresolvable root (NoFrettedScale sentinel path): builtCount 0, one error issue", () => {
    // "H" is not a valid Tonal note letter, so applyChordShape's underlying
    // buildFrettedScale call short-circuits to the NoFrettedScale sentinel
    // (empty: true, notes: []) before placing anything — every played
    // string is dropped, not just one, exercising the total-loss path
    // (as opposed to the single-dropped-interval case above).
    const issues = checkChordBuildLoss(OPEN_C_MAJOR, "H");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_BUILD_LOSS);
    expect(issues[0].severity).toBe("error");
    const playedCount = OPEN_C_MAJOR.strings.filter((s) => s != null).length;
    const details = issues[0].details as {
      playedCount: number;
      builtCount: number;
      frets: (number | null)[];
    };
    expect(details.playedCount).toBe(playedCount);
    expect(details.builtCount).toBe(0);
    expect(details.frets.every((f) => f === null)).toBe(true);
  });
});

describe("checkScaleBuildLoss", () => {
  it("CAGED_E (clean scale shape from the registry): []", () => {
    expect(checkScaleBuildLoss(CAGED_E, "E")).toEqual([]);
  });

  it("NoFrettedScale sentinel (unresolvable root): one error issue", () => {
    // "H" is not a valid Tonal note letter, so Note.pitchClass("H") returns
    // "" and buildFrettedScale short-circuits to the NoFrettedScale
    // sentinel (empty: true) before placing anything.
    const issues = checkScaleBuildLoss(CAGED_E, "H");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_BUILD_LOSS);
    expect(issues[0].severity).toBe("error");
  });

  it("synthetic shape with an unresolvable interval: one error issue, builtCount < slotCount", () => {
    const shape: ScaleShape = {
      name: "Synthetic Build Loss Scale",
      system: "test",
      strings: [["1P"], ["not-an-interval"], ["5P"], null, null, null],
      rootString: 0,
    };
    const issues = checkScaleBuildLoss(shape, "C");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_BUILD_LOSS);
    expect(issues[0].severity).toBe("error");
    const details = issues[0].details as {
      slotCount: number;
      builtCount: number;
    };
    expect(details.slotCount).toBe(3);
    expect(details.builtCount).toBe(2);
    expect(details.builtCount).toBeLessThan(details.slotCount);
  });

  it("scale shape with a null string entry: slot counting skips it, no false positive", () => {
    const shape: ScaleShape = {
      name: "Synthetic Null String Scale",
      system: "test",
      strings: [null, ["1P", "3M", "5P"], null, ["1P"], null, null],
      rootString: 1,
    };
    expect(checkScaleBuildLoss(shape, "C")).toEqual([]);
  });

  it("registry-wide: no currently-registered scale shape fails checkScaleBuildLoss at 'C' (ScaleShape has no canonicalRoot; 'C' mirrors displayRootFor's default)", () => {
    expectRegistryClean(
      allScaleShapes(),
      (shape) => checkScaleBuildLoss(shape, "C"),
      "checkScaleBuildLoss",
    );
  });
});

// ============================================================
// checkChordMetadataCompleteness / checkScaleMetadataCompleteness
// ============================================================

describe("checkChordMetadataCompleteness", () => {
  it("CAGED_CHORD_E (base CAGED major, lacks both chordType and voicingFamily): one warning issue, details.missing includes both fields — legitimately incomplete metadata, not a bug", () => {
    expect(CAGED_CHORD_E.chordType).toBeUndefined();
    expect(CAGED_CHORD_E.voicingFamily).toBeUndefined();

    const issues = checkChordMetadataCompleteness(CAGED_CHORD_E);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_METADATA_COMPLETENESS);
    expect(issues[0].severity).toBe("warning");
    const details = issues[0].details as { missing: string[] };
    expect(details.missing).toEqual(
      expect.arrayContaining(["chordType", "voicingFamily"]),
    );
    expect(details.missing.length).toBe(2);
  });

  it("OPEN_C_MAJOR (has both chordType and voicingFamily): []", () => {
    expect(OPEN_C_MAJOR.chordType).toBeDefined();
    expect(OPEN_C_MAJOR.voicingFamily).toBeDefined();
    expect(checkChordMetadataCompleteness(OPEN_C_MAJOR)).toEqual([]);
  });

  it("shape with only chordType missing: details.missing === ['chordType']", () => {
    const shape: ChordShape = {
      ...OPEN_C_MAJOR,
      chordType: undefined,
    };
    const issues = checkChordMetadataCompleteness(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("warning");
    const details = issues[0].details as { missing: string[] };
    expect(details.missing).toEqual(["chordType"]);
  });

  it("shape with only voicingFamily missing: details.missing === ['voicingFamily']", () => {
    const shape: ChordShape = {
      ...OPEN_C_MAJOR,
      voicingFamily: undefined,
    };
    const issues = checkChordMetadataCompleteness(shape);
    expect(issues.length).toBe(1);
    const details = issues[0].details as { missing: string[] };
    expect(details.missing).toEqual(["voicingFamily"]);
  });

  it("registry-wide: exactly the 5 base CAGED majors fail checkChordMetadataCompleteness", () => {
    const allShapes = chordShapes.all();
    expect(allShapes.length).toBeGreaterThan(0);
    const flagged = allShapes
      .filter((shape) => checkChordMetadataCompleteness(shape).length > 0)
      .map((shape) => shape.name);
    expect(new Set(flagged)).toEqual(
      new Set([
        "E Shape Major",
        "A Shape Major",
        "D Shape Major",
        "C Shape Major",
        "G Shape Major",
      ]),
    );
  });
});

describe("checkScaleMetadataCompleteness", () => {
  it("base scale shape 'G Shape' (no quality/parentShape): []", () => {
    const gShape = getScaleShape("G Shape");
    expect(gShape).toBeDefined();
    expect(gShape?.quality).toBeUndefined();
    expect(gShape?.parentShape).toBeUndefined();
    expect(checkScaleMetadataCompleteness(gShape as ScaleShape)).toEqual([]);
  });

  it("derived scale shape CAGED_DM (caged-scales-minor.ts, both quality and parentShape set): []", () => {
    expect(CAGED_DM.quality).toBeDefined();
    expect(CAGED_DM.parentShape).toBeDefined();
    expect(checkScaleMetadataCompleteness(CAGED_DM)).toEqual([]);
  });

  it("derived scale shape PENTA_BOX_1_MINOR (pentatonic-minor.ts, both quality and parentShape set): []", () => {
    expect(PENTA_BOX_1_MINOR.quality).toBeDefined();
    expect(PENTA_BOX_1_MINOR.parentShape).toBeDefined();
    expect(checkScaleMetadataCompleteness(PENTA_BOX_1_MINOR)).toEqual([]);
  });

  it("synthetic fixture with quality set but parentShape stripped (both-or-neither violation): one warning issue, details.quality present, details.parentShape undefined", () => {
    const shape: ScaleShape = { ...CAGED_DM, parentShape: undefined };
    const issues = checkScaleMetadataCompleteness(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_METADATA_COMPLETENESS);
    expect(issues[0].severity).toBe("warning");
    const details = issues[0].details as {
      quality?: string;
      parentShape?: string;
    };
    expect(details.quality).toBeDefined();
    expect(details.parentShape).toBeUndefined();
  });

  it("synthetic fixture with parentShape set but quality stripped (both-or-neither violation): one warning issue", () => {
    const shape: ScaleShape = { ...CAGED_DM, quality: undefined };
    const issues = checkScaleMetadataCompleteness(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("warning");
    const details = issues[0].details as {
      quality?: string;
      parentShape?: string;
    };
    expect(details.quality).toBeUndefined();
    expect(details.parentShape).toBeDefined();
  });

  it("registry-wide: all 10 relabelShape-derived scale entries (caged-scales-minor.ts + pentatonic-minor.ts) pass checkScaleMetadataCompleteness cleanly", () => {
    const derived = allScaleShapes().filter((s) => s.parentShape !== undefined);
    expect(derived.length).toBe(10);
    expectRegistryClean(
      derived,
      checkScaleMetadataCompleteness,
      "checkScaleMetadataCompleteness",
    );
  });

  it("registry-wide: no currently-registered scale shape fails checkScaleMetadataCompleteness", () => {
    expectRegistryClean(
      allScaleShapes(),
      checkScaleMetadataCompleteness,
      "checkScaleMetadataCompleteness",
    );
  });
});

// ============================================================
// auditChordShape / auditScaleShape / auditAllShapes
// ============================================================

describe("auditChordShape", () => {
  it("OPEN_G_AUG (#96 known-bad): combines checkFretSpan (error) + checkGeometryMismatch (warning), using displayRootFor as the default root", () => {
    expect(OPEN_G_AUG.canonicalRoot).toBe("G");
    const issues = auditChordShape(OPEN_G_AUG);

    const fretSpanIssues = issues.filter((i) => i.id === CHECK_FRET_SPAN);
    const geometryIssues = issues.filter((i) => i.id === CHECK_GEOMETRY_MISMATCH);
    expect(fretSpanIssues.length).toBe(1);
    expect(fretSpanIssues[0].severity).toBe("error");
    expect(geometryIssues.length).toBe(1);
    expect(geometryIssues[0].severity).toBe("warning");

    // No other check fires for this shape.
    expect(issues.length).toBe(2);

    // Confirms the default root matches displayRootFor(shape), not a
    // hardcoded literal.
    expect(checkFretSpan(OPEN_G_AUG, displayRootFor(OPEN_G_AUG))).toEqual(
      fretSpanIssues,
    );
  });

  it("auditChordShape(shape, { root: 'D' }) overrides the default root", () => {
    const defaultIssues = auditChordShape(OPEN_C_MAJOR);
    const overriddenIssues = auditChordShape(OPEN_C_MAJOR, { root: "D" });

    // Applying the C-shape grip at D transposes every fretted note up by
    // a whole step, changing the built frets (and therefore, potentially,
    // the fret-span/geometry results) relative to the default root.
    const defaultFretSpan = checkFretSpan(OPEN_C_MAJOR, "C");
    const overriddenFretSpan = checkFretSpan(OPEN_C_MAJOR, "D");
    expect(auditChordShape(OPEN_C_MAJOR, { root: "D" })).toEqual(
      auditChordShape(OPEN_C_MAJOR, { root: "D", tuning: undefined }),
    );
    expect(defaultIssues).not.toBe(overriddenIssues);
    expect(overriddenFretSpan).toEqual(
      checkFretSpan(OPEN_C_MAJOR, "D", STANDARD),
    );
    expect(defaultFretSpan).toEqual(checkFretSpan(OPEN_C_MAJOR, "C", STANDARD));
  });

  it("auditChordShape(shape, { maxFretSpan }) threads through to checkFretSpan without affecting checkGeometryMismatch", () => {
    // OPEN_G_AUG's ~10-fret span fails the default maxFretSpan (4), but
    // raising it above the actual span clears only the fret-span error —
    // the geometry-mismatch warning (which doesn't take a maxSpan) still
    // fires, confirming maxFretSpan is wired to the right check only.
    const defaultIssues = auditChordShape(OPEN_G_AUG);
    expect(defaultIssues.some((i) => i.id === CHECK_FRET_SPAN)).toBe(true);

    const raisedIssues = auditChordShape(OPEN_G_AUG, { maxFretSpan: 20 });
    expect(raisedIssues.some((i) => i.id === CHECK_FRET_SPAN)).toBe(false);
    expect(raisedIssues.some((i) => i.id === CHECK_GEOMETRY_MISMATCH)).toBe(true);
    expect(raisedIssues).toEqual(
      checkGeometryMismatch(OPEN_G_AUG, STANDARD),
    );
  });
});

describe("auditScaleShape", () => {
  it("runs only checkScaleBuildLoss + checkScaleMetadataCompleteness — never fret-span/finger/geometry", () => {
    const gShape = getScaleShape("G Shape");
    expect(gShape).toBeDefined();

    const issues = auditScaleShape(gShape as ScaleShape);
    const expected = [
      ...checkScaleBuildLoss(gShape as ScaleShape, "C"),
      ...checkScaleMetadataCompleteness(gShape as ScaleShape),
    ];
    expect(issues).toEqual(expected);

    // None of the chord-only check IDs ever appear.
    const chordOnlyIds = new Set([
      CHECK_FRET_SPAN,
      CHECK_FINGER_ZERO_ON_MOVABLE,
      CHECK_REPEATED_FINGER_NO_BARRE,
      CHECK_GEOMETRY_MISMATCH,
    ]);
    for (const issue of issues) {
      expect(chordOnlyIds.has(issue.id)).toBe(false);
    }
  });

  it("registry-wide: auditScaleShape never emits a chord-only check ID for any registered scale shape", () => {
    const chordOnlyIds = new Set([
      CHECK_FRET_SPAN,
      CHECK_FINGER_ZERO_ON_MOVABLE,
      CHECK_REPEATED_FINGER_NO_BARRE,
      CHECK_GEOMETRY_MISMATCH,
    ]);
    for (const shape of allScaleShapes()) {
      const issues = auditScaleShape(shape);
      for (const issue of issues) {
        expect(chordOnlyIds.has(issue.id)).toBe(false);
      }
    }
  });

  it("auditScaleShape(shape, { root, tuning }) threads both overrides into checkScaleBuildLoss", () => {
    // Default root "C" builds CAGED_E cleanly; overriding root to the
    // unresolvable "H" flips it to the NoFrettedScale sentinel build-loss
    // path, and an explicit tuning override is honored identically to the
    // default STANDARD tuning — confirming both ShapeAuditOptions fields
    // reach checkScaleBuildLoss, not just root.
    expect(auditScaleShape(CAGED_E)).toEqual([]);

    const overridden = auditScaleShape(CAGED_E, { root: "H" });
    expect(overridden.some((i) => i.id === CHECK_BUILD_LOSS)).toBe(true);
    expect(overridden).toEqual(checkScaleBuildLoss(CAGED_E, "H", STANDARD));

    expect(auditScaleShape(CAGED_E, { root: "E", tuning: STANDARD })).toEqual(
      auditScaleShape(CAGED_E, { root: "E" }),
    );
  });
});

describe("auditAllShapes", () => {
  it("returns { chord: Map, scale: Map } keyed by shape.name, sized to the registries", () => {
    const { chord, scale } = auditAllShapes();

    expect(chord).toBeInstanceOf(Map);
    expect(scale).toBeInstanceOf(Map);
    expect(chord.size).toBe(chordShapes.all().length);
    expect(scale.size).toBe(allScaleShapes().length);

    for (const shape of chordShapes.all()) {
      expect(chord.has(shape.name)).toBe(true);
    }
    for (const shape of allScaleShapes()) {
      expect(scale.has(shape.name)).toBe(true);
    }
  });

  it("never throws for the full registry", () => {
    expect(() => auditAllShapes()).not.toThrow();
  });

  it("spot-check: chord.get('G Augmented Open') and chord.get('G m7b5 Open') both contain at least one error-severity issue (regression guard for #96 staying visible)", () => {
    const { chord } = auditAllShapes();

    const gAug = chord.get("G Augmented Open");
    const gM7b5 = chord.get("G m7b5 Open");
    expect(gAug).toBeDefined();
    expect(gM7b5).toBeDefined();
    expect(gAug?.issues.some((i) => i.severity === "error")).toBe(true);
    expect(gM7b5?.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("chord results are { issues, geometry } — issues match auditChordShape's own output", () => {
    const { chord } = auditAllShapes();
    for (const shape of chordShapes.all()) {
      const result = chord.get(shape.name);
      expect(result).toBeDefined();
      expect(result?.issues).toEqual(auditChordShape(shape));
      expect(result?.geometry).toEqual(chordShapeGeometry(shape, STANDARD));
    }
  });

  it("geometry is populated for a resolvable-grip-root shape even when it does NOT mismatch (OPEN_C_MAJOR)", () => {
    const { chord } = auditAllShapes();
    const result = chord.get(OPEN_C_MAJOR.name);
    expect(result?.geometry).toBeDefined();
    expect(result?.geometry?.gripRoot).toBe("C");
    expect(result?.issues.some((i) => i.id === CHECK_GEOMETRY_MISMATCH)).toBe(
      false,
    );
  });

  it("geometry is populated for a mismatching shape too (OPEN_G_AUG), independent of the issue firing", () => {
    const { chord } = auditAllShapes();
    const result = chord.get(OPEN_G_AUG.name);
    expect(result?.geometry).toBeDefined();
    expect(result?.geometry?.gripRoot).toBe("G");
    expect(result?.issues.some((i) => i.id === CHECK_GEOMETRY_MISMATCH)).toBe(
      true,
    );
  });

  it("geometry is undefined for shapes with no baseFret (jazz shell)", () => {
    const { chord } = auditAllShapes();
    const shell = SHELL_SHAPES.find((s) => s.name === "Shell maj7 R37 012");
    expect(shell).toBeDefined();
    const result = chord.get((shell as ChordShape).name);
    expect(result?.geometry).toBeUndefined();
  });

  it("geometry is undefined for movable barre shapes with no resolvable grip root", () => {
    const { chord } = auditAllShapes();
    const noGripRoot = chordShapes
      .all()
      .filter((s) => s.baseFret != null && gripRootFor(s) == null);
    expect(noGripRoot.length).toBeGreaterThan(0);
    for (const shape of noGripRoot) {
      expect(chord.get(shape.name)?.geometry).toBeUndefined();
    }
  });

  it("options.tuning threads into geometry's sourceFrets computation", () => {
    const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"];
    const { chord } = auditAllShapes({ tuning: dropD });
    const result = chord.get(OPEN_C_MAJOR.name);
    expect(result?.geometry).toEqual(chordShapeGeometry(OPEN_C_MAJOR, dropD));
  });
});

describe("chordShapeGeometry", () => {
  it("OPEN_C_MAJOR: gripRoot 'C', sourceFrets matches the exported sourceFrets() helper", () => {
    const geometry = chordShapeGeometry(OPEN_C_MAJOR);
    expect(geometry).toBeDefined();
    expect(geometry?.gripRoot).toBe("C");
    expect(geometry?.sourceFrets).toEqual(
      sourceFrets(OPEN_C_MAJOR, "C", OPEN_C_MAJOR.baseFret as number),
    );
  });

  it("returns undefined when shape.baseFret is null (jazz shell)", () => {
    const shell = SHELL_SHAPES.find((s) => s.name === "Shell maj7 R37 012");
    expect(chordShapeGeometry(shell as ChordShape)).toBeUndefined();
  });

  it("returns undefined when there is no resolvable grip root (movable E/A Form barre shape)", () => {
    const noGripRoot = chordShapes
      .all()
      .find((s) => s.baseFret != null && gripRootFor(s) == null);
    expect(noGripRoot).toBeDefined();
    expect(chordShapeGeometry(noGripRoot as ChordShape)).toBeUndefined();
  });

  it("defaults tuning to STANDARD", () => {
    expect(chordShapeGeometry(OPEN_C_MAJOR)).toEqual(
      chordShapeGeometry(OPEN_C_MAJOR, STANDARD),
    );
  });
});
