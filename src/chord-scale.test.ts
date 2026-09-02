import { describe, expect, it } from "vitest";
import {
  CHORD_SCALE_RULE,
  CHORD_SCALE_RULE_VERSION,
  scaleTypeForChordType,
} from "./chord-scale";

describe("CHORD_SCALE_RULE_VERSION", () => {
  it("is 1", () => {
    expect(CHORD_SCALE_RULE_VERSION).toBe(1);
  });
});

describe("scaleTypeForChordType", () => {
  it("maps M to major", () => {
    expect(scaleTypeForChordType("M")).toEqual({ scaleType: "major" });
  });

  it("maps maj7 to major", () => {
    expect(scaleTypeForChordType("maj7")).toEqual({ scaleType: "major" });
  });

  it("maps m to aeolian with dorian/major alternates", () => {
    expect(scaleTypeForChordType("m")).toEqual({
      scaleType: "aeolian",
      alternates: ["dorian", "major"],
    });
  });

  it("maps m7 to aeolian with dorian/major alternates", () => {
    expect(scaleTypeForChordType("m7")).toEqual({
      scaleType: "aeolian",
      alternates: ["dorian", "major"],
    });
  });

  it('maps "7" to mixolydian', () => {
    expect(scaleTypeForChordType("7")).toEqual({ scaleType: "mixolydian" });
  });

  it("maps m7b5 to locrian", () => {
    expect(scaleTypeForChordType("m7b5")).toEqual({ scaleType: "locrian" });
  });

  it.each(["dim", "dim7", "aug"])(
    "returns undefined for %s (no box system yet)",
    (chordType) => {
      expect(scaleTypeForChordType(chordType)).toBeUndefined();
    },
  );

  it("returns undefined for an unknown chord type", () => {
    expect(scaleTypeForChordType("sus4")).toBeUndefined();
  });
});

describe("CHORD_SCALE_RULE", () => {
  it("contains exactly the six v1 entries", () => {
    expect(Object.keys(CHORD_SCALE_RULE).sort()).toEqual(
      ["7", "M", "m", "m7", "m7b5", "maj7"].sort(),
    );
  });
});
