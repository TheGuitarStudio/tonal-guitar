import { describe, expect, it } from "vitest";
import {
  auditAllShapes,
  auditArpeggioShape,
  auditChordShape,
  auditScaleShape,
  checkBarreFretOrigin,
  checkChordBuildLoss,
  checkChordMetadataCompleteness,
  checkFingerZeroOnMovable,
  checkFingeringComplete,
  checkFretSpan,
  checkGeometryMismatch,
  checkNameUnique,
  checkOverridesTarget,
  checkPositionSpan,
  checkRepeatedFingerNoBarre,
  checkScaleBuildLoss,
  checkScaleMetadataCompleteness,
  checkStringsetMismatch,
  checkTuningMismatch,
  chordShapeGeometry,
  CHECK_BARRE_FRET_ORIGIN,
  CHECK_BUILD_LOSS,
  CHECK_FINGER_ZERO_ON_MOVABLE,
  CHECK_FINGERING_COMPLETE,
  CHECK_FRET_SPAN,
  CHECK_GEOMETRY_MISMATCH,
  CHECK_METADATA_COMPLETENESS,
  CHECK_NAME_UNIQUE,
  CHECK_OVERRIDES_TARGET,
  CHECK_POSITION_SPAN,
  CHECK_REPEATED_FINGER_NO_BARRE,
  CHECK_STRINGSET_MISMATCH,
  CHECK_TUNING_MISMATCH,
  displayRootFor,
  gripRootFor,
  sourceFrets,
} from "./audit";
import type {
  AuditSeverity,
  ShapeAuditIssue,
  ShapeAuditOptions,
} from "./audit";
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
import { applyChordShape, buildFrettedScale } from "./build";
import { STANDARD } from "./tuning";
import {
  all as allScaleShapes,
  arpeggioShapes,
  chordShapes,
  get as getScaleShape,
  ArpeggioShape,
  ChordShape,
  ScaleShape,
} from "./shape";
import {
  BARRE_E_MAJOR,
  BARRE_E_SUS2,
  OPEN_A_MAJOR,
  OPEN_C_MAJOR,
  OPEN_C_MINOR,
  OPEN_C_SUS2,
  OPEN_G_AUG,
  OPEN_G_M7B5,
  OPEN_G_SUS2,
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
    expect(
      check(shape),
      `${shape.name} unexpectedly flagged by ${label}`,
    ).toEqual([]);
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
  it('is exported from ./version as "0.2.0"', () => {
    expect(VERSION).toBe("0.2.0");
  });

  it("is re-exported from ./index and matches ./version", () => {
    expect(VERSION_FROM_INDEX).toBe("0.2.0");
    expect(VERSION_FROM_INDEX).toBe(VERSION);
  });
});

describe("checkGeometryMismatch fixtures", () => {
  it("OPEN_C_MAJOR: sourceFrets reproduces baseFret as min fretted fret; built == source", () => {
    const gr = gripRootFor(OPEN_C_MAJOR);
    expect(gr).toBe("C");
    const src = sourceFrets(
      OPEN_C_MAJOR,
      gr as string,
      OPEN_C_MAJOR.baseFret as number,
    );
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

  it("OPEN_G_AUG (issue #96, fixed): built matches source, no mismatch", () => {
    const issues = checkGeometryMismatch(OPEN_G_AUG);
    expect(issues).toEqual([]);
  });

  it("OPEN_G_M7B5 (issue #96, fixed): built matches source, no mismatch", () => {
    const issues = checkGeometryMismatch(OPEN_G_M7B5);
    expect(issues).toEqual([]);
  });

  it("jazz shell (no baseFret): skipped, []", () => {
    const shell = SHELL_SHAPES.find((s) => s.name === "Shell maj7 E-root");
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
          name: "Shell maj7 E-root",
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
  // off-by-octave defect. Those 20 shapes are therefore skipped (no grip
  // root), per the spec's "if neither yields a root, skip the check" rule.
  //
  // A full registry sweep over the remaining 50 `"<Root> ... Open"` shapes
  // now flags none. It originally flagged 7 shapes, all genuine defects
  // verified by hand against each shape's own diagram comment/fingers data,
  // and all since fixed:
  //        - OPEN_G_AUG / OPEN_G_M7B5 (#96): misordered-interval defects
  //          (string 5 encoded "5A" instead of "1P"; strings 4-5's "3m"/"7m"
  //          swapped), each also producing an unplayable fret span — see
  //          data.test.ts's "G family open shapes" regression tests.
  //        - "G Sus2 Open" (#112): strings[1..3] were cyclically misordered
  //          (2M/5P/1P recorded as 5P/1P/2M) — a misordered-interval defect,
  //          the same class as #96. Fixed; see OPEN_G_SUS2 in
  //          data/open-chords.ts.
  //        - "E m7b5 Open" (#113): the D-string interval ("7m") was
  //          inconsistent with its own fret-diagram comment ("0120xx") and
  //          fingers data — fret 2 on an open-D string sounds the root (E),
  //          not the 7th (D). Fixed to "1P" in #113 — which left the shape
  //          with no 7th at all (pitch-identical to OPEN_E_DIM). #138 then
  //          replaced the grip entirely with a true m7b5 voicing (010030)
  //          that includes the 7m.
  //        - "G Dominant 7 Open" / "G Major 7 Open" / "E Sus2 Open" (#111):
  //          fingers[i] === 0 (implies open) on a string the diagram comment
  //          shows fretted — a fingers-array bug, fixed by assigning the
  //          fretted string a nonzero finger.
  it("checkGeometryMismatch's registry-wide mismatch set matches the documented, hand-verified list above", () => {
    const knownMismatching = new Set<string>([]);
    expect(knownMismatching.size).toBe(0);

    const withBaseFret = chordShapes.all().filter((s) => s.baseFret != null);
    expect(withBaseFret.length).toBe(70);

    const actuallyMismatching = new Set(
      withBaseFret
        .filter((shape) => checkGeometryMismatch(shape).length > 0)
        .map((shape) => shape.name),
    );
    expect(actuallyMismatching).toEqual(knownMismatching);
  });

  it("both formerly-#96-known-bad shapes no longer mismatch", () => {
    const gAug = chordShapes.get("G Augmented Open");
    const gM7b5 = chordShapes.get("G m7b5 Open");
    expect(gAug).toBeDefined();
    expect(gM7b5).toBeDefined();
    expect(checkGeometryMismatch(gAug as ChordShape)).toEqual([]);
    expect(checkGeometryMismatch(gM7b5 as ChordShape)).toEqual([]);
  });

  it("OPEN_G_SUS2 (#112 fixed): built frets match the 300033 diagram exactly, no mismatch", () => {
    expect(checkGeometryMismatch(OPEN_G_SUS2)).toEqual([]);

    const { frets } = applyChordShape(OPEN_G_SUS2, "G", STANDARD);
    expect(frets).toEqual([3, 0, 0, 0, 3, 3]);
  });

  // #111 regression: these three shapes each had fingers[i] === 0 on a
  // string their own fret-diagram comment shows fretted (see open-chords.ts
  // OPEN_G_DOM7/OPEN_G_MAJ7/OPEN_E_SUS2), which sourceFrets read as "open,"
  // producing a false geometry-mismatch against the build engine's fretted
  // reconstruction. Fixed by assigning the fretted string a nonzero finger;
  // asserts they no longer mismatch.
  it("#111 fixed shapes (G Dominant 7 Open, G Major 7 Open, E Sus2 Open) no longer mismatch", () => {
    const gDom7 = chordShapes.get("G Dominant 7 Open");
    const gMaj7 = chordShapes.get("G Major 7 Open");
    const eSus2 = chordShapes.get("E Sus2 Open");
    expect(gDom7).toBeDefined();
    expect(gMaj7).toBeDefined();
    expect(eSus2).toBeDefined();
    expect(checkGeometryMismatch(gDom7 as ChordShape)).toEqual([]);
    expect(checkGeometryMismatch(gMaj7 as ChordShape)).toEqual([]);
    expect(checkGeometryMismatch(eSus2 as ChordShape)).toEqual([]);
  });
});

// ============================================================
// checkFretSpan
// ============================================================

describe("checkFretSpan", () => {
  it("OPEN_C_MAJOR (clean, baseFret 1): no issues", () => {
    expect(checkFretSpan(OPEN_C_MAJOR, "C")).toEqual([]);
  });

  it("OPEN_G_AUG (issue #96, fixed): no longer exceeds the playable span", () => {
    expect(checkFretSpan(OPEN_G_AUG, "G")).toEqual([]);
  });

  it("OPEN_G_M7B5 (issue #96, fixed): no longer exceeds the playable span", () => {
    expect(checkFretSpan(OPEN_G_M7B5, "G")).toEqual([]);
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
    // D-012 removed the cross-product "Shell m7 R73 012" (root E string,
    // 7th A string, 3rd D string, stringSet [0,1,2]) — pairing the R-7-3
    // ordering with a string set it was never meant for produced this
    // unplayable 5-fret span at root C. No currently-registered shape
    // reproduces that span, so this fixture reconstructs it verbatim
    // (same strings/fingers/stringSet the old generator emitted) to keep
    // exercising the maxSpan-override wiring against a real failure mode.
    const shellM7R73Fixture: ChordShape = {
      name: "Synthetic Shell m7 R73 Fixture (pre-D-012 cross-product, now removed)",
      system: "shell",
      strings: ["1P", "7m", "3m", null, null, null],
      fingers: [1, 2, 3, null, null, null],
      barres: [],
      rootString: 0,
      chordType: "m7",
      voicingFamily: "shell",
      stringSet: [0, 1, 2],
      omittedIntervals: ["5P"],
      inversion: 0,
    };

    const defaultIssues = checkFretSpan(shellM7R73Fixture, "C");
    expect(defaultIssues.length).toBe(1);
    expect((defaultIssues[0].details as { span: number }).span).toBe(5);

    const raisedMaxSpanIssues = checkFretSpan(
      shellM7R73Fixture,
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
    expect(issues[0].details as { finger: number; strings: number[] }).toEqual({
      finger: 2,
      strings: [1, 2],
    });
    expect(issues[1].details as { finger: number; strings: number[] }).toEqual({
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
// shape-workbench spec §3.1 — required-tier checks (Group 9)
// ============================================================

describe("checkStringsetMismatch", () => {
  it("shape.stringSet absent: []", () => {
    const shape: ChordShape = {
      name: "Synthetic No StringSet Fixture",
      system: "open",
      strings: ["1P", "5P", null, null, null, null],
      fingers: [1, 2, null, null, null, null],
      barres: [],
      rootString: 0,
    };
    expect(checkStringsetMismatch(shape)).toEqual([]);
  });

  it("shape.stringSet matches playedStringSet(shape): []", () => {
    expect(checkStringsetMismatch(OPEN_C_MAJOR)).toEqual([]);
  });

  it("shape.stringSet diverges from playedStringSet(shape): one warning issue with both sets in details", () => {
    const shape: ChordShape = {
      ...OPEN_C_MAJOR,
      name: "Synthetic StringSet Mismatch Fixture",
      stringSet: [1, 2, 3],
    };
    const issues = checkStringsetMismatch(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_STRINGSET_MISMATCH);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].details).toEqual({
      stringSet: [1, 2, 3],
      playedStringSet: [1, 2, 3, 4, 5],
    });
  });

  it("registry-wide: no currently-registered chord shape fails checkStringsetMismatch", () => {
    expectRegistryClean(chordShapes.all(), checkStringsetMismatch, "checkStringsetMismatch");
  });
});

describe("checkTuningMismatch", () => {
  it("shape.tuning absent: []", () => {
    expect(checkTuningMismatch(OPEN_C_MAJOR)).toEqual([]);
    expect(checkTuningMismatch(OPEN_C_MAJOR, STANDARD)).toEqual([]);
  });

  it("shape.tuning matches the build tuning (default STANDARD): []", () => {
    const shape: ChordShape = { ...OPEN_C_MAJOR, tuning: [...STANDARD] };
    expect(checkTuningMismatch(shape)).toEqual([]);
  });

  it("shape.tuning diverges from the build tuning: one warning issue with both tunings in details", () => {
    const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"];
    const shape: ChordShape = { ...OPEN_C_MAJOR, tuning: dropD };
    const issues = checkTuningMismatch(shape, STANDARD);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_TUNING_MISMATCH);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].details).toEqual({ shapeTuning: dropD, buildTuning: STANDARD });
  });

  it("shape.tuning matches an explicitly-passed non-standard tuning: []", () => {
    const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"];
    const shape: ChordShape = { ...OPEN_C_MAJOR, tuning: dropD };
    expect(checkTuningMismatch(shape, dropD)).toEqual([]);
  });

  it("registry-wide: no currently-registered chord shape fails checkTuningMismatch at STANDARD", () => {
    expectRegistryClean(
      chordShapes.all(),
      (shape) => checkTuningMismatch(shape, STANDARD),
      "checkTuningMismatch",
    );
  });
});

describe("checkBarreFretOrigin", () => {
  it("no barres: []", () => {
    expect(checkBarreFretOrigin(OPEN_C_MAJOR, "C")).toEqual([]);
  });

  it("D-010 worked example — 'A Major Open' (x02220, baseFret 1, barre fret 2, strings 2-4): grip base 2, flags with suggestedOffset 0 (still pre-migration absolute data)", () => {
    const issues = checkBarreFretOrigin(OPEN_A_MAJOR, "A", STANDARD);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_BARRE_FRET_ORIGIN);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].details).toMatchObject({
      barreIndex: 0,
      fret: 2,
      gripBase: 2,
      suggestedOffset: 0,
    });
  });

  it("D-010 worked example — 'C Minor Open' (x35543, baseFret 3, barre fret 3, full barre): grip base 3, flags with suggestedOffset 0", () => {
    const issues = checkBarreFretOrigin(OPEN_C_MINOR, "C", STANDARD);
    expect(issues.length).toBe(1);
    expect(issues[0].details).toMatchObject({
      barreIndex: 0,
      fret: 3,
      gripBase: 3,
      suggestedOffset: 0,
    });
  });

  it("D-010 worked example — 'C Sus2 Open' (x30033, baseFret 1, barre fret 3, strings 4-5): flags, offset derived from the source diagram's grip base", () => {
    const issues = checkBarreFretOrigin(OPEN_C_SUS2, "C", STANDARD);
    expect(issues.length).toBe(1);
    expect(issues[0].details).toMatchObject({ barreIndex: 0, fret: 3 });
  });

  it("D-010 worked example — 'E Form Major Barre' (movable, baseFret 1, barre fret 0): already an offset, not flagged — the trap a blanket fret-baseFret transform would fall into", () => {
    expect(checkBarreFretOrigin(BARRE_E_MAJOR, "C", STANDARD)).toEqual([]);
  });

  it("negative fret: flagged regardless of geometry", () => {
    const shape: ChordShape = {
      name: "Synthetic Negative Barre Fret Fixture",
      system: "barre",
      strings: ["1P", "1P", "1P", null, null, null],
      fingers: [1, 1, 1, null, null, null],
      barres: [{ fret: -1, fromString: 0, toString: 2, finger: 1 }],
      rootString: 0,
    };
    const issues = checkBarreFretOrigin(shape, "C", STANDARD);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].details).toMatchObject({ barreIndex: 0, fret: -1 });
  });

  it("fret exceeds the shape's fretted span: flagged", () => {
    const shape: ChordShape = {
      name: "Synthetic Oversized Barre Fret Fixture",
      system: "barre",
      strings: ["1P", "3M", null, null, null, null],
      fingers: [1, 2, null, null, null, null],
      barres: [{ fret: 99, fromString: 0, toString: 1, finger: 1 }],
      rootString: 0,
    };
    const built = applyChordShape(shape, "C", STANDARD);
    const fretted = built.frets.filter((f): f is number => f != null && f > 0);
    const span = Math.max(...fretted) - Math.min(...fretted);
    const issues = checkBarreFretOrigin(shape, "C", STANDARD);
    expect(issues.length).toBe(1);
    expect(issues[0].details).toMatchObject({ barreIndex: 0, fret: 99, span });
  });

  it("prebuilt, if supplied, is used instead of an internal applyChordShape call", () => {
    const built = applyChordShape(OPEN_A_MAJOR, "A", STANDARD);
    expect(checkBarreFretOrigin(OPEN_A_MAJOR, "A", STANDARD, built)).toEqual(
      checkBarreFretOrigin(OPEN_A_MAJOR, "A", STANDARD),
    );
  });

  it("no baseFret (jazz shell-style fixture) still applies the span-based checks", () => {
    const shape: ChordShape = {
      name: "Synthetic No-BaseFret Barre Fixture",
      system: "shell",
      strings: ["1P", "3M", null, null, null, null],
      fingers: [1, 1, null, null, null, null],
      barres: [{ fret: 0, fromString: 0, toString: 1, finger: 1 }],
      rootString: 0,
    };
    // fret 0 is within [0, span] and there's no baseFret/geometry — clean.
    expect(checkBarreFretOrigin(shape, "C", STANDARD)).toEqual([]);
  });
});

describe("checkNameUnique", () => {
  it("brand-new name/identifier against the live chord registry: []", () => {
    expect(
      checkNameUnique({ name: "Synthetic Definitely Not Registered Fixture" }, "chord"),
    ).toEqual([]);
  });

  it("an already-registered chord shape audited against itself (same object): [] — self-comparison never flags", () => {
    expect(checkNameUnique(OPEN_C_MAJOR, "chord")).toEqual([]);
  });

  it("a NEW shape whose name collides with an already-registered chord shape: the name-collision issue fires", () => {
    // An identical name also derives an identical identifier, so the
    // identifier-collision issue fires alongside it (see "colliding on both
    // name and identifier" below) — this test isolates the name-check half.
    const issues = checkNameUnique({ name: OPEN_C_MAJOR.name }, "chord");
    const nameIssue = issues.find((i) => i.details?.name === OPEN_C_MAJOR.name && !("identifier" in (i.details ?? {})));
    expect(nameIssue).toBeDefined();
    expect(nameIssue?.id).toBe(CHECK_NAME_UNIQUE);
    expect(nameIssue?.severity).toBe("error");
    expect(nameIssue?.details).toEqual({ name: OPEN_C_MAJOR.name, kind: "chord" });
  });

  it("a NEW shape whose derived export identifier collides with an already-registered shape's: one error issue", () => {
    // "C Major Open!!!" slugs to the identical CHORD_C_MAJOR_OPEN identifier
    // as the registered OPEN_C_MAJOR ("C Major Open") — different name,
    // colliding identifier.
    const issues = checkNameUnique({ name: "C Major Open!!!" }, "chord");
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_NAME_UNIQUE);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].details).toMatchObject({ name: "C Major Open!!!" });
  });

  it("a shape colliding on both name and identifier: two error issues", () => {
    const issues = checkNameUnique({ name: OPEN_C_MAJOR.name }, "chord");
    // Same name => same derived identifier => both checks fire.
    expect(issues.length).toBe(2);
    expect(issues.every((i) => i.id === CHECK_NAME_UNIQUE)).toBe(true);
    expect(issues.every((i) => i.severity === "error")).toBe(true);
  });

  it("options.knownNames is consulted INSTEAD of the live registry for the name check — a merge-time-only collision is caught without touching chordShapes", () => {
    const knownNames = new Set(["Some Draft Shape Name"]);
    const issues = checkNameUnique({ name: "Some Draft Shape Name" }, "chord", { knownNames });
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_NAME_UNIQUE);

    // A name that IS registered live, but absent from knownNames, is NOT
    // flagged by the NAME check when knownNames is supplied — it replaces
    // the live lookup for that half of the check. knownIdentifiers is passed
    // as an explicit empty set here too, to isolate that from the
    // independent identifier-check default (which would otherwise still
    // consult the live registry and flag the identical derived identifier).
    expect(
      checkNameUnique({ name: OPEN_C_MAJOR.name }, "chord", {
        knownNames,
        knownIdentifiers: new Set(),
      }),
    ).toEqual([]);
  });

  it("options.knownIdentifiers is consulted INSTEAD of the live registry", () => {
    const knownIdentifiers = new Set(["CHORD_SOME_DRAFT_SHAPE"]);
    const issues = checkNameUnique({ name: "Some Draft Shape" }, "chord", {
      knownIdentifiers,
    });
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_NAME_UNIQUE);
  });

  it("works against the scale and arpeggio registries via the kind parameter", () => {
    const gShape = getScaleShape("G Shape");
    expect(gShape).toBeDefined();
    expect(checkNameUnique(gShape as ScaleShape, "scale")).toEqual([]);
    // Colliding name also derives a colliding identifier (both checks fire).
    expect(checkNameUnique({ name: (gShape as ScaleShape).name }, "scale").length).toBe(2);

    // Empty arpeggio registry today (no seeded data) — nothing to collide with.
    expect(checkNameUnique({ name: "Any Arpeggio Name" }, "arpeggio")).toEqual([]);
  });
});

// ============================================================
// `featured` metadata field — audit interaction (shape-detail-panel TG1)
// ============================================================

describe("featured metadata field — audit interaction", () => {
  it("checkChordMetadataCompleteness: a chord shape with featured set but missing chordType/voicingFamily still only reports the existing metadata-completeness warning (no new issue for featured)", () => {
    const shape: ChordShape = { ...CAGED_CHORD_E, featured: true };
    const issues = checkChordMetadataCompleteness(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_METADATA_COMPLETENESS);
    const details = issues[0].details as { missing: string[] };
    expect(details.missing).toEqual(
      expect.arrayContaining(["chordType", "voicingFamily"]),
    );
    expect(details.missing).not.toContain("featured");
    // Identical to the unfeatured baseline — featured is invisible to this check.
    expect(issues).toEqual(checkChordMetadataCompleteness(CAGED_CHORD_E));
  });

  it("checkScaleMetadataCompleteness: a scale shape with featured set but no quality/parentShape passes cleanly", () => {
    const gShape = getScaleShape("G Shape");
    expect(gShape).toBeDefined();
    const shape: ScaleShape = { ...(gShape as ScaleShape), featured: true };
    expect(checkScaleMetadataCompleteness(shape)).toEqual([]);
  });

  it("a failing + featured chord shape still ranks as failing: featured alone never appears in ShapeAuditIssue[]", () => {
    // D-012 removed the cross-product "Shell m7 R73 012" fixture that used
    // to be the registry's known-failing checkFretSpan case (root "C",
    // 5-fret span vs. the default maxSpan of 4) — see the "custom maxSpan
    // override" test above for the same reconstruction and rationale. No
    // currently-registered shape reproduces that failure, so this fixture
    // stands in for it rather than a purely synthetic one.
    const shellM7R73: ChordShape = {
      name: "Synthetic Shell m7 R73 Fixture (pre-D-012 cross-product, now removed)",
      system: "shell",
      strings: ["1P", "7m", "3m", null, null, null],
      fingers: [1, 2, 3, null, null, null],
      barres: [],
      rootString: 0,
      chordType: "m7",
      voicingFamily: "shell",
      stringSet: [0, 1, 2],
      omittedIntervals: ["5P"],
      inversion: 0,
    };

    const unfeaturedIssues = auditChordShape(shellM7R73, { root: "C" });
    expect(unfeaturedIssues.some((i) => i.id === CHECK_FRET_SPAN)).toBe(true);

    const featuredShape: ChordShape = { ...shellM7R73, featured: true };
    const featuredIssues = auditChordShape(featuredShape, { root: "C" });

    // featured is still failing — the fret-span error is still present —
    // and the issue list is byte-for-byte identical to the unfeatured case.
    expect(featuredIssues.some((i) => i.id === CHECK_FRET_SPAN)).toBe(true);
    expect(featuredIssues).toEqual(unfeaturedIssues);
    // featured never surfaces as its own issue id or inside any issue's details.
    for (const issue of featuredIssues) {
      expect(issue.id).not.toBe("featured");
      expect(JSON.stringify(issue)).not.toContain("featured");
    }
  });

  it("a failing + featured scale shape: featured alone never appears in ShapeAuditIssue[]", () => {
    const featuredShape: ScaleShape = { ...CAGED_DM, parentShape: undefined, featured: true };
    const unfeaturedShape: ScaleShape = { ...CAGED_DM, parentShape: undefined };

    const featuredIssues = auditScaleShape(featuredShape);
    const unfeaturedIssues = auditScaleShape(unfeaturedShape);

    expect(featuredIssues).toEqual(unfeaturedIssues);
    for (const issue of featuredIssues) {
      expect(issue.id).not.toBe("featured");
      expect(JSON.stringify(issue)).not.toContain("featured");
    }
  });
});

// ============================================================
// auditChordShape / auditScaleShape / auditAllShapes
// ============================================================

describe("auditChordShape", () => {
  // Issue #96 originally shipped OPEN_G_AUG with a misordered interval
  // (string 5 encoded "5A" instead of "1P") that both blew the playable
  // fret span AND diverged from its own source diagram — the only
  // registered shape combining a checkFretSpan error with a
  // checkGeometryMismatch warning. OPEN_G_AUG is now fixed (see
  // data.test.ts's "G family open shapes" regression tests), so this
  // fixture reproduces that pre-fix shape verbatim to keep exercising the
  // "combines an error + a warning" wiring in auditChordShape/auditAllShapes
  // independent of any single production shape's correctness.
  const buggyAugFixture: ChordShape = {
    name: "Synthetic Bad Aug Fixture (pre-#96-fix OPEN_G_AUG)",
    system: "open",
    strings: ["1P", null, "5A", "1P", "3M", "5A"],
    fingers: [2, null, 3, 1, 1, 4],
    barres: [{ fret: 1, fromString: 3, toString: 4, finger: 1 }],
    rootString: 0,
    chordType: "aug",
    voicingFamily: "open",
    stringSet: [0, 2, 3, 4, 5],
    inversion: 0,
    canonicalRoot: "G",
    baseFret: 1,
  };

  it("synthetic fixture: combines checkFretSpan (error) + checkGeometryMismatch (warning), using displayRootFor as the default root", () => {
    expect(buggyAugFixture.canonicalRoot).toBe("G");
    const issues = auditChordShape(buggyAugFixture);

    const fretSpanIssues = issues.filter((i) => i.id === CHECK_FRET_SPAN);
    const geometryIssues = issues.filter(
      (i) => i.id === CHECK_GEOMETRY_MISMATCH,
    );
    expect(fretSpanIssues.length).toBe(1);
    expect(fretSpanIssues[0].severity).toBe("error");
    expect(geometryIssues.length).toBe(1);
    expect(geometryIssues[0].severity).toBe("warning");

    // No other check fires for this shape.
    expect(issues.length).toBe(2);

    // Confirms the default root matches displayRootFor(shape), not a
    // hardcoded literal.
    expect(
      checkFretSpan(buggyAugFixture, displayRootFor(buggyAugFixture)),
    ).toEqual(fretSpanIssues);
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
    // The fixture's ~10-fret span fails the default maxFretSpan (4), but
    // raising it above the actual span clears only the fret-span error —
    // the geometry-mismatch warning (which doesn't take a maxSpan) still
    // fires, confirming maxFretSpan is wired to the right check only.
    const defaultIssues = auditChordShape(buggyAugFixture);
    expect(defaultIssues.some((i) => i.id === CHECK_FRET_SPAN)).toBe(true);

    const raisedIssues = auditChordShape(buggyAugFixture, { maxFretSpan: 20 });
    expect(raisedIssues.some((i) => i.id === CHECK_FRET_SPAN)).toBe(false);
    expect(raisedIssues.some((i) => i.id === CHECK_GEOMETRY_MISMATCH)).toBe(
      true,
    );
    expect(raisedIssues).toEqual(
      checkGeometryMismatch(buggyAugFixture, STANDARD),
    );
  });

  it("composes the four new required-tier checks alongside the original six", () => {
    // A shape combining a stringSet mismatch, a tuning mismatch, and an
    // absolute (pre-D-010) barre fret all at once — one issue per new check.
    const shape: ChordShape = {
      ...OPEN_A_MAJOR,
      name: "Synthetic Multi-New-Check Fixture",
      stringSet: [1, 2, 3], // diverges from playedStringSet
      tuning: ["D2", "A2", "D3", "G3", "B3", "E4"], // diverges from STANDARD
    };
    const issues = auditChordShape(shape);

    expect(issues.some((i) => i.id === CHECK_STRINGSET_MISMATCH)).toBe(true);
    expect(issues.some((i) => i.id === CHECK_TUNING_MISMATCH)).toBe(true);
    expect(issues.some((i) => i.id === CHECK_BARRE_FRET_ORIGIN)).toBe(true);
    // Brand-new name — no collision.
    expect(issues.some((i) => i.id === CHECK_NAME_UNIQUE)).toBe(false);

    expect(issues).toEqual([
      ...checkFretSpan(shape, "A", STANDARD),
      ...checkFingerZeroOnMovable(shape),
      ...checkRepeatedFingerNoBarre(shape),
      ...checkChordBuildLoss(shape, "A", STANDARD),
      ...checkChordMetadataCompleteness(shape),
      ...checkGeometryMismatch(shape, STANDARD),
      ...checkStringsetMismatch(shape),
      ...checkTuningMismatch(shape, STANDARD),
      ...checkBarreFretOrigin(shape, "A", STANDARD),
      ...checkNameUnique(shape, "chord"),
    ]);
  });

  it("checkNameUnique composed into auditChordShape flags a NEW shape colliding with a registered name", () => {
    const shape: ChordShape = { ...OPEN_C_MAJOR, name: OPEN_C_MAJOR.name };
    // Same name, different object — a genuine collision, not self-comparison.
    expect(shape).not.toBe(OPEN_C_MAJOR);
    const issues = auditChordShape(shape);
    expect(issues.some((i) => i.id === CHECK_NAME_UNIQUE && i.severity === "error")).toBe(
      true,
    );
  });

  it("checkNameUnique composed into auditChordShape does NOT flag an already-registered shape audited via its own object reference", () => {
    const issues = auditChordShape(OPEN_C_MAJOR);
    expect(issues.some((i) => i.id === CHECK_NAME_UNIQUE)).toBe(false);
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

// ============================================================
// shape-workbench spec §3.1 — arpeggio-only checks (Group 9)
// ============================================================

describe("checkPositionSpan", () => {
  it("build fails (unresolvable root): [] — checkScaleBuildLoss's issue to report, not this one's", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Position Span Unresolvable Fixture",
      system: "caged",
      chordType: "M",
      strings: [["1P"], null, null, null, null, null],
      rootString: 0,
    };
    expect(checkPositionSpan(shape, "H", STANDARD)).toEqual([]);
  });

  it("single-note run: span is trivially 0, within any maxSpan: []", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Position Span Single-Note Fixture",
      system: "caged",
      chordType: "M",
      strings: [["1P"], null, null, null, null, null],
      rootString: 0,
    };
    expect(checkPositionSpan(shape, "C", STANDARD)).toEqual([]);
  });

  it("span exceeds maxSpan: one error issue, span computed independently via buildFrettedScale", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Position Span Wide Fixture",
      system: "caged",
      chordType: "M",
      strings: [["1P"], ["7M"], null, null, null, null],
      rootString: 0,
    };
    const result = buildFrettedScale(shape, "C", STANDARD);
    const fretted = result.notes.map((n) => n.fret).filter((f) => f > 0);
    const expectedSpan = fretted.length
      ? Math.max(...fretted) - Math.min(...fretted)
      : 0;
    expect(expectedSpan).toBeGreaterThan(0);

    const issues = checkPositionSpan(shape, "C", STANDARD, 0);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_POSITION_SPAN);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].details).toEqual({ span: expectedSpan, maxSpan: 0 });
  });
});

describe("checkFingeringComplete", () => {
  const baseStrings = [["1P"], ["3M"], null, null, null, null] as (string[] | null)[];

  it("shape.fingers absent: []", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Fingering Fixture (no fingers)",
      system: "caged",
      chordType: "M",
      strings: baseStrings,
      rootString: 0,
    };
    expect(checkFingeringComplete(shape)).toEqual([]);
  });

  it("fingers parallel and consistent with strings: []", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Fingering Fixture (clean)",
      system: "caged",
      chordType: "M",
      strings: baseStrings,
      rootString: 0,
      fingers: [[1], [2], [], [], [], []],
    };
    expect(checkFingeringComplete(shape)).toEqual([]);
  });

  it("fingers.length !== strings.length: one error issue", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Fingering Fixture (length mismatch)",
      system: "caged",
      chordType: "M",
      strings: baseStrings,
      rootString: 0,
      fingers: [[1], [2], []],
    };
    const issues = checkFingeringComplete(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_FINGERING_COMPLETE);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].details).toEqual({ fingersLength: 3, stringsLength: 6 });
  });

  it("finger entries present for a muted string: one error issue", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Fingering Fixture (muted-with-fingers)",
      system: "caged",
      chordType: "M",
      strings: [["1P"], null, null, null, null, null],
      rootString: 0,
      fingers: [[1], [2], [], [], [], []],
    };
    const issues = checkFingeringComplete(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].details).toEqual({ string: 1, fingerSlot: [2] });
  });

  it("finger sub-array length mismatch against its string's note count: one error issue", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Fingering Fixture (sub-array mismatch)",
      system: "caged",
      chordType: "M",
      strings: [["1P", "3M"], ["5P"], null, null, null, null],
      rootString: 0,
      fingers: [[1], [3], [], [], [], []],
    };
    const issues = checkFingeringComplete(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].details).toEqual({ string: 0, notesLength: 2, fingersLength: 1 });
  });
});

describe("checkOverridesTarget", () => {
  it("shape.overrides absent: []", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Overrides Fixture (none)",
      system: "caged",
      chordType: "M",
      strings: [["1P"], null, null, null, null, null],
      rootString: 0,
    };
    expect(checkOverridesTarget(shape)).toEqual([]);
  });

  it("shape.overrides names a registered arpeggio: []", () => {
    const core: ArpeggioShape = {
      name: "Synthetic Overrides Core Fixture",
      system: "caged",
      chordType: "M",
      strings: [["1P"], null, null, null, null, null],
      rootString: 0,
    };
    arpeggioShapes.add(core);
    try {
      const override: ArpeggioShape = {
        ...core,
        name: "Synthetic Overrides Override Fixture",
        overrides: core.name,
      };
      expect(checkOverridesTarget(override)).toEqual([]);
    } finally {
      arpeggioShapes.remove(core.name);
    }
  });

  it("shape.overrides names an unregistered arpeggio: one error issue", () => {
    const shape: ArpeggioShape = {
      name: "Synthetic Overrides Fixture (dangling)",
      system: "caged",
      chordType: "M",
      strings: [["1P"], null, null, null, null, null],
      rootString: 0,
      overrides: "Not Registered Anywhere",
    };
    const issues = checkOverridesTarget(shape);
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(CHECK_OVERRIDES_TARGET);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].details).toEqual({ overrides: "Not Registered Anywhere" });
  });
});

describe("auditArpeggioShape", () => {
  // Hand-built fixture — no seeded ArpeggioShape data exists yet (spec
  // §3.1), so this is fixture-only, mirroring auditScaleShape's own tests.
  const cleanFixture: ArpeggioShape = {
    name: "Synthetic Clean Arpeggio Fixture",
    system: "caged",
    chordType: "M",
    strings: [["1P"], null, null, null, null, null],
    rootString: 0,
    fingers: [[1], [], [], [], [], []],
  };

  it("clean fixture: []", () => {
    expect(auditArpeggioShape(cleanFixture)).toEqual([]);
  });

  it("runs only build-loss/position-span/fingering-complete/overrides-target — never a chord-only check id", () => {
    const chordOnlyIds = new Set([
      CHECK_FRET_SPAN,
      CHECK_FINGER_ZERO_ON_MOVABLE,
      CHECK_REPEATED_FINGER_NO_BARRE,
      CHECK_GEOMETRY_MISMATCH,
      CHECK_STRINGSET_MISMATCH,
      CHECK_TUNING_MISMATCH,
      CHECK_BARRE_FRET_ORIGIN,
      CHECK_NAME_UNIQUE,
    ]);
    for (const issue of auditArpeggioShape(cleanFixture)) {
      expect(chordOnlyIds.has(issue.id)).toBe(false);
    }
  });

  it("root defaults to 'C' (ArpeggioShape has no canonicalRoot, mirroring auditScaleShape)", () => {
    expect(auditArpeggioShape(cleanFixture)).toEqual(
      auditArpeggioShape(cleanFixture, { root: "C" }),
    );
  });

  it("combines build-loss + fingering-complete + overrides-target when all three fail at once", () => {
    const brokenFixture: ArpeggioShape = {
      name: "Synthetic Broken Arpeggio Fixture",
      system: "caged",
      chordType: "M",
      strings: [["1P"], ["3M"], null, null, null, null],
      rootString: 0,
      fingers: [[1]], // length mismatch against the 6-entry strings array
      overrides: "Not Registered Anywhere",
    };
    const issues = auditArpeggioShape(brokenFixture, { root: "H" }); // unresolvable root

    expect(issues.some((i) => i.id === CHECK_BUILD_LOSS)).toBe(true);
    expect(issues.some((i) => i.id === CHECK_FINGERING_COMPLETE)).toBe(true);
    expect(issues.some((i) => i.id === CHECK_OVERRIDES_TARGET)).toBe(true);
    expect(issues).toEqual([
      ...checkScaleBuildLoss(brokenFixture, "H", STANDARD),
      ...checkPositionSpan(brokenFixture, "H", STANDARD, undefined),
      ...checkFingeringComplete(brokenFixture),
      ...checkOverridesTarget(brokenFixture),
    ]);
  });

  it("options.maxFretSpan threads into checkPositionSpan only", () => {
    const issues = auditArpeggioShape(cleanFixture, { maxFretSpan: 0 });
    expect(issues).toEqual([
      ...checkScaleBuildLoss(cleanFixture, "C", STANDARD),
      ...checkPositionSpan(cleanFixture, "C", STANDARD, 0),
      ...checkFingeringComplete(cleanFixture),
      ...checkOverridesTarget(cleanFixture),
    ]);
  });

  it("options.tuning threads into both checkScaleBuildLoss and checkPositionSpan", () => {
    const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"];
    expect(auditArpeggioShape(cleanFixture, { tuning: dropD })).toEqual([
      ...checkScaleBuildLoss(cleanFixture, "C", dropD),
      ...checkPositionSpan(cleanFixture, "C", dropD, undefined),
      ...checkFingeringComplete(cleanFixture),
      ...checkOverridesTarget(cleanFixture),
    ]);
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

  it("spot-check: chord.get('G Augmented Open') and chord.get('G m7b5 Open') no longer contain any error-severity issue (issue #96 fixed)", () => {
    const { chord } = auditAllShapes();

    const gAug = chord.get("G Augmented Open");
    const gM7b5 = chord.get("G m7b5 Open");
    expect(gAug).toBeDefined();
    expect(gM7b5).toBeDefined();
    expect(gAug?.issues.some((i) => i.severity === "error")).toBe(false);
    expect(gM7b5?.issues.some((i) => i.severity === "error")).toBe(false);
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

  // With every formerly-mismatching registry shape now fixed (#96, #111,
  // #112, #113), the registry no longer exercises the "geometry populated
  // while the mismatch issue fires" case here — that wiring is covered by
  // the synthetic pre-#96-fix fixture in the auditChordShape block above.
  // This sweep instead asserts geometry is populated for EVERY chord shape
  // with a baseFret and a resolvable grip root (the movable "E/A Form ...
  // Barre" shapes have a baseFret but no grip root, so geometry is
  // intentionally undefined for them — covered by the test below),
  // independent of any issue firing.
  it("geometry is populated for every baseFret-bearing chord shape with a resolvable grip root, independent of the issue firing", () => {
    const { chord } = auditAllShapes();
    const withGripRoot = chordShapes
      .all()
      .filter((s) => s.baseFret != null && gripRootFor(s) != null);
    expect(withGripRoot.length).toBeGreaterThan(0);
    for (const shape of withGripRoot) {
      const result = chord.get(shape.name);
      expect(result?.geometry, `${shape.name} missing geometry`).toBeDefined();
    }
    const gSus2 = chord.get("G Sus2 Open");
    expect(gSus2?.geometry?.gripRoot).toBe("G");
    expect(gSus2?.issues.some((i) => i.id === CHECK_GEOMETRY_MISMATCH)).toBe(
      false,
    );
  });

  it("geometry is undefined for shapes with no baseFret (jazz shell)", () => {
    const { chord } = auditAllShapes();
    const shell = SHELL_SHAPES.find((s) => s.name === "Shell maj7 E-root");
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
    const shell = SHELL_SHAPES.find((s) => s.name === "Shell maj7 E-root");
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
