import { describe, expect, it } from "vitest";
import {
  checkFretSpan,
  checkGeometryMismatch,
  CHECK_FRET_SPAN,
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
import { chordShapes, ChordShape } from "./shape";
import {
  BARRE_E_SUS2,
  OPEN_C_MAJOR,
  OPEN_C_MINOR,
  OPEN_G_AUG,
  OPEN_G_M7B5,
} from "./data/open-chords";
import { SHELL_SHAPES } from "./data/jazz-shells";
import { EXT_CHORD_E_6, EXT_CHORD_A_6 } from "./data/extended-chords";

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
    const src = sourceFrets(OPEN_C_MAJOR, gr as string);
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
// checkFretSpan — Task Group 2
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
