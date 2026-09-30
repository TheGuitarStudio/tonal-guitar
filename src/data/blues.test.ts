/**
 * Blues box shapes (issue #56): 5 minor blues boxes derived from the minor
 * pentatonic boxes via addPassingTone("5d"), and 5 major blues boxes
 * relabeled from them. Covers registry metadata, the agreed b5 placement,
 * Tonal "blues" scale-name integration, and the audit module's scale checks.
 */

import { describe, it, expect } from "vitest";
import {
  addPassingTone,
  all,
  auditScaleShape,
  buildFromScale,
  buildFrettedScale,
  get,
  isShapeCompatible,
  modeShapes,
  relatedScales,
} from "../index";
import type { ScaleShape } from "../index";
import {
  PENTA_BOX_1,
  PENTA_BOX_2,
  PENTA_BOX_3,
  PENTA_BOX_4,
  PENTA_BOX_5,
} from "./pentatonic";

const BOXES = [1, 2, 3, 4, 5] as const;
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const PENTA_MAJOR = [
  PENTA_BOX_1,
  PENTA_BOX_2,
  PENTA_BOX_3,
  PENTA_BOX_4,
  PENTA_BOX_5,
];

function box(n: number, quality: "Minor" | "Major"): ScaleShape {
  const shape = get(`Blues Box ${n} ${quality}`);
  expect(shape, `Blues Box ${n} ${quality}`).toBeDefined();
  return shape!;
}

function pitchSet(shape: ScaleShape, root: string, scale?: string) {
  const built = scale
    ? buildFromScale(shape, scale)
    : buildFrettedScale(shape, root);
  return built.notes.map((n) => `${n.string}:${n.fret}:${n.midi}`).sort();
}

describe("blues registry entries", () => {
  it("registers 5 minor and 5 major blues boxes in the pentatonic system", () => {
    const minor = all().filter((s) => s.quality === "minor-blues");
    const major = all().filter((s) => s.quality === "major-blues");
    expect(minor.map((s) => s.name)).toEqual(
      BOXES.map((n) => `Blues Box ${n} Minor`),
    );
    expect(major.map((s) => s.name)).toEqual(
      BOXES.map((n) => `Blues Box ${n} Major`),
    );
    for (const s of [...minor, ...major]) expect(s.system).toBe("pentatonic");
  });

  it("minor blues boxes derive from the minor pentatonic boxes; major from minor blues", () => {
    for (const n of BOXES) {
      expect(box(n, "Minor").parentShape).toBe(`Pentatonic Box ${n} Minor`);
      expect(box(n, "Major").parentShape).toBe(`Blues Box ${n} Minor`);
    }
  });

  it("each minor blues box is its minor pentatonic parent plus only 5d slots", () => {
    for (const n of BOXES) {
      const blues = box(n, "Minor");
      const parent = get(`Pentatonic Box ${n} Minor`)!;
      expect(blues.rootString).toBe(parent.rootString);
      blues.strings.forEach((ivls, s) => {
        expect(ivls!.filter((i) => i !== "5d")).toEqual(parent.strings[s]);
      });
    }
  });

  it("places the b5 per the agreed rule (A minor blues frets)", () => {
    // Box 2's high-E b5 (fret 11) is dropped: it would be the new top note
    // AND need a stretch. Stretches inside the pitch range are kept (Box 2
    // low E 11, Box 4 B string, Box 5 A string). Box 4 builds an octave
    // down at A (frets 1/4 = 13/16).
    const expected: Record<number, string[]> = {
      1: ["1@6", "3@8"],
      2: ["0@11", "3@8"],
      3: ["0@11", "2@13", "5@11"],
      4: ["2@1", "4@4"],
      5: ["1@6", "4@4"],
    };
    for (const n of BOXES) {
      const b5 = buildFrettedScale(box(n, "Minor"), "A")
        .notes.filter((note) => note.interval === "5d")
        .map((note) => `${note.string}@${note.fret}`)
        .sort();
      expect(b5, `Box ${n}`).toEqual(expected[n]);
    }
  });

  it("every b5 sits one fret above a 4P on the same string, at every root", () => {
    for (const n of BOXES) {
      for (const root of ROOTS) {
        const notes = buildFrettedScale(box(n, "Minor"), root).notes;
        for (const b5 of notes.filter((note) => note.interval === "5d")) {
          const fourth = notes.find(
            (note) => note.string === b5.string && note.interval === "4P",
          );
          expect(fourth?.fret, `Box ${n} @ ${root}`).toBe(b5.fret - 1);
        }
      }
    }
  });

  it("major blues boxes share geometry with minor blues (C major blues = A minor blues)", () => {
    for (const n of BOXES) {
      expect(pitchSet(box(n, "Major"), "C")).toEqual(
        pitchSet(box(n, "Minor"), "A"),
      );
    }
  });

  it("major blues boxes equal major pentatonic + b3 via addPassingTone", () => {
    for (const n of BOXES) {
      const derived = addPassingTone(PENTA_MAJOR[n - 1], "3m");
      expect(derived?.strings).toEqual(box(n, "Major").strings);
    }
  });
});

describe("blues boxes with Tonal scale names", () => {
  it('buildFromScale relabels cleanly for "blues", "minor blues", and "major blues"', () => {
    for (const n of BOXES) {
      for (const name of ["A blues", "A minor blues"]) {
        const built = buildFromScale(box(n, "Minor"), name);
        expect(built.empty).toBe(false);
        expect(built.relabeled).toBe(true);
        expect(built.scaleName).toBe("A minor blues");
        expect(new Set(built.notes.map((note) => note.pc))).toEqual(
          new Set(["A", "C", "D", "Eb", "E", "G"]),
        );
      }
      const major = buildFromScale(box(n, "Major"), "C major blues");
      expect(major.relabeled).toBe(true);
      expect(new Set(major.notes.map((note) => note.pc))).toEqual(
        new Set(["C", "D", "Eb", "E", "G", "A"]),
      );
      // Either box builds the relative scale at the same frets.
      expect(pitchSet(box(n, "Minor"), "C", "C major blues")).toEqual(
        pitchSet(box(n, "Major"), "C"),
      );
    }
  });

  it("isShapeCompatible accepts the blues frames and rejects the 5-note pentatonic frames", () => {
    for (const n of BOXES) {
      const minor = box(n, "Minor");
      expect(isShapeCompatible(minor, "A blues")).toBe(true);
      expect(isShapeCompatible(minor, "A minor blues")).toBe(true);
      expect(isShapeCompatible(minor, "A minor pentatonic")).toBe(false);
      expect(isShapeCompatible(box(n, "Major"), "C major blues")).toBe(true);
      expect(isShapeCompatible(box(n, "Major"), "C major pentatonic")).toBe(
        false,
      );
    }
  });

  it('modeShapes("blues") returns the minor blues boxes (plus the subset minor pentatonic boxes)', () => {
    const names = modeShapes("A blues", "pentatonic").map((s) => s.name);
    for (const n of BOXES) {
      expect(names).toContain(`Blues Box ${n} Minor`);
      expect(names).toContain(`Pentatonic Box ${n} Minor`);
      expect(names).not.toContain(`Blues Box ${n} Major`);
    }
    const majorNames = modeShapes("C major blues", "pentatonic").map(
      (s) => s.name,
    );
    for (const n of BOXES) expect(majorNames).toContain(`Blues Box ${n} Major`);
    expect(
      modeShapes("A minor pentatonic").some((s) => s.quality === "minor-blues"),
    ).toBe(false);
  });

  it("relatedScales pairs minor blues with its relative major blues", () => {
    const built = buildFromScale(box(1, "Minor"), "A blues");
    expect(relatedScales(built)).toEqual([
      { root: "A", scale: "minor blues" },
      { root: "C", scale: "major blues" },
    ]);
  });
});

describe("blues boxes pass the audit module's scale checks", () => {
  it("auditScaleShape reports no issues at any root", () => {
    for (const quality of ["Minor", "Major"] as const) {
      for (const n of BOXES) {
        for (const root of ROOTS) {
          expect(
            auditScaleShape(box(n, quality), { root }),
            `${n} ${quality} @ ${root}`,
          ).toEqual([]);
        }
      }
    }
  });
});
