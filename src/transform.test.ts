import { describe, expect, it } from "vitest";
import { addPassingTone, get, relabelShape, STANDARD } from "./index";
import type { PassingToneOptions, RelabelOptions, ScaleShape } from "./index";
import { PENTA_BOX_1 } from "./data/pentatonic";
import { CAGED_G, CAGED_E } from "./data/caged-scales";

const NATURAL_MINOR = ["1P", "2M", "3m", "4P", "5P", "6m", "7m"];
const MINOR_PENTATONIC = ["1P", "3m", "4P", "5P", "7m"];
const DORIAN = ["1P", "2M", "3m", "4P", "5P", "6M", "7m"];

describe("transform scaffolding", () => {
  it("resolves relabelShape and RelabelOptions from the public index", () => {
    expect(typeof relabelShape).toBe("function");

    // Type-only check: this assignment only needs to compile.
    const options: RelabelOptions = {
      name: "Em Shape",
      quality: "minor",
      parentShape: "G Shape",
    };
    expect(options.name).toBe("Em Shape");
  });

  it("allows quality and parentShape on a ScaleShape literal while keeping them optional", () => {
    const withMetadata: ScaleShape = {
      name: "Em Shape",
      system: "caged",
      strings: [["1P"], null],
      rootString: 0,
      span: 4,
      quality: "minor",
      parentShape: "G Shape",
    };
    expect(withMetadata.quality).toBe("minor");
    expect(withMetadata.parentShape).toBe("G Shape");

    // Existing shape literals (no quality/parentShape) remain valid.
    const withoutMetadata: ScaleShape = {
      name: "G Shape",
      system: "caged",
      strings: [["1P"], null],
      rootString: 0,
    };
    expect(withoutMetadata.quality).toBeUndefined();
    expect(withoutMetadata.parentShape).toBeUndefined();
  });

  it("relabelShape returns undefined for an empty targetIntervals array", () => {
    const anyShape: ScaleShape = {
      name: "G Shape",
      system: "caged",
      strings: [["1P", "2M"], null],
      rootString: 0,
    };
    expect(relabelShape(anyShape, [])).toBeUndefined();
  });
});

describe("relabelShape (R2.3-R2.9)", () => {
  it("rewrites CAGED_G into natural minor cell-by-cell (R2.4)", () => {
    const result = relabelShape(CAGED_G, NATURAL_MINOR, {
      name: "Em Shape",
      quality: "minor",
      parentShape: "G Shape",
    });
    expect(result).toBeDefined();
    if (!result) return;

    // R2.4 table applied to every CAGED_G string.
    const expectedStrings: (string[] | null)[] = [
      ["1P", "2M", "3m"],
      ["4P", "5P", "6m"],
      ["7m", "1P"],
      ["2M", "3m", "4P"],
      ["5P", "6m", "7m"],
      ["1P", "2M", "3m"],
    ];
    expect(result.strings).toEqual(expectedStrings);
    expect(result.rootString).toBe(0);
    expect(result.name).toBe("Em Shape");
    expect(result.quality).toBe("minor");
    expect(result.parentShape).toBe("G Shape");
    expect(result.system).toBe("caged");
  });

  it("does not mutate the input shape", () => {
    const before = JSON.parse(JSON.stringify(CAGED_G.strings)) as (
      | string[]
      | null
    )[];
    relabelShape(CAGED_G, NATURAL_MINOR, {
      name: "Em Shape",
      quality: "minor",
      parentShape: "G Shape",
    });
    expect(CAGED_G.strings).toEqual(before);
  });

  it("selects t=0 (identity) when relabeling a minor-frame shape to the same minor frame", () => {
    const minorShape = relabelShape(CAGED_G, NATURAL_MINOR, {
      name: "Em Shape",
      quality: "minor",
      parentShape: "G Shape",
    });
    expect(minorShape).toBeDefined();
    if (!minorShape) return;

    const identity = relabelShape(minorShape, NATURAL_MINOR);
    expect(identity).toBeDefined();
    if (!identity) return;
    expect(identity.strings).toEqual(minorShape.strings);
    expect(identity.rootString).toBe(minorShape.rootString);
  });

  it("returns undefined when the parent chroma set is not a subset of the target frame (R2.6)", () => {
    const result = relabelShape(CAGED_E, MINOR_PENTATONIC);
    expect(result).toBeUndefined();
  });

  it("preserves null string entries at the same index", () => {
    const shapeWithNull: ScaleShape = {
      name: "Custom Shape",
      system: "custom",
      strings: [["1P", "2M", "3M"], null, ["5P", "6M"]],
      rootString: 0,
    };
    const result = relabelShape(shapeWithNull, NATURAL_MINOR);
    expect(result).toBeDefined();
    if (!result) return;
    expect(result.strings[1]).toBeNull();
    expect(result.strings[0]).not.toBeNull();
    expect(result.strings[2]).not.toBeNull();
  });

  it("returns undefined for a shape with all-null strings", () => {
    const emptyShape: ScaleShape = {
      name: "Empty Shape",
      system: "custom",
      strings: [null, null, null],
      rootString: 0,
    };
    expect(relabelShape(emptyShape, NATURAL_MINOR)).toBeUndefined();
  });

  it("returns undefined for a shape with an empty strings array", () => {
    const emptyShape: ScaleShape = {
      name: "Empty Shape",
      system: "custom",
      strings: [],
      rootString: 0,
    };
    expect(relabelShape(emptyShape, NATURAL_MINOR)).toBeUndefined();
  });

  it("relabels CAGED_G into the dorian frame with t=2 (R5.3)", () => {
    const result = relabelShape(CAGED_G, DORIAN);
    expect(result).toBeDefined();
    if (!result) return;
    // Every rewritten interval must be a member of the dorian frame.
    for (const stringIntervals of result.strings) {
      if (!stringIntervals) continue;
      for (const ivl of stringIntervals) {
        expect(DORIAN).toContain(ivl);
      }
    }
  });

  it("recomputes rootString for the natural-minor rewrite of CAGED_E (R2.7)", () => {
    const result = relabelShape(CAGED_E, NATURAL_MINOR, {
      name: "Dm Shape",
      quality: "minor",
      parentShape: "E Shape",
    });
    expect(result).toBeDefined();
    if (!result) return;
    expect(result.rootString).toBe(2);
  });

  it("uses options.name when provided, otherwise the input shape's name (R2.8)", () => {
    const withOverride = relabelShape(CAGED_G, NATURAL_MINOR, {
      name: "Em Shape",
    });
    expect(withOverride?.name).toBe("Em Shape");

    const withoutOverride = relabelShape(CAGED_G, NATURAL_MINOR);
    expect(withoutOverride?.name).toBe(CAGED_G.name);
  });

  it("preserves system from the input shape (R2.9)", () => {
    const result = relabelShape(CAGED_G, NATURAL_MINOR);
    expect(result?.system).toBe(CAGED_G.system);
    expect(result?.system).toBe("caged");
  });

  it("resolves chroma collisions in targetIntervals with first-wins (R2.3)", () => {
    // "3M" and "4d" are enharmonic (both chroma 4, via @tonaljs/interval
    // semitones). "3M" is listed first, so it must win the chroma slot.
    const targetWithCollision = ["1P", "3M", "4d", "5P", "6M", "7M"];
    const shapeWithDiminishedFourth: ScaleShape = {
      name: "Custom Shape",
      system: "custom",
      strings: [["1P", "4d"]],
      rootString: 0,
    };

    const result = relabelShape(shapeWithDiminishedFourth, targetWithCollision);
    expect(result).toBeDefined();
    if (!result) return;

    // The chroma-4 note must be relabeled to "3M" (first-wins), not "4d".
    expect(result.strings[0]).toEqual(["1P", "3M"]);
  });

  it("recomputes rootString to the lowest non-null string carrying the tonic, ignoring an input rootString that points at a null string (R2.7)", () => {
    const shapeWithNullAtRootString: ScaleShape = {
      name: "Custom Shape",
      system: "custom",
      strings: [null, ["1P", "2M"], ["1P", "4P"]],
      rootString: 0, // points at a null string entry
    };

    const result = relabelShape(shapeWithNullAtRootString, NATURAL_MINOR);
    expect(result).toBeDefined();
    if (!result) return;

    // The new tonic ("1P") first appears on string index 1 (string 0 is
    // null), so rootString must follow the tonic, not the stale input value.
    expect(result.rootString).toBe(1);
    expect(result.strings[0]).toBeNull();
  });
});

describe("addPassingTone", () => {
  const minorBox = (n: number) => get(`Pentatonic Box ${n} Minor`)!;

  it("is exported from the public index", () => {
    expect(typeof addPassingTone).toBe("function");
    const options: PassingToneOptions = { name: "x", tuning: STANDARD };
    expect(options.tuning).toBe(STANDARD);
  });

  it("inserts the tone right after each semitone-below neighbor on the same string", () => {
    const result = addPassingTone(minorBox(1), "5d");
    expect(result?.strings).toEqual([
      ["1P", "3m"],
      ["4P", "5d", "5P"],
      ["7m", "1P"],
      ["3m", "4P", "5d"],
      ["5P", "7m"],
      ["1P", "3m"],
    ]);
  });

  it("drops a tone that would be a new edge note AND need a stretch", () => {
    // Box 2 Minor: high E [3m,4P] is the top string at the box's max fret,
    // so its b5 is dropped; low E's b5 is a stretch but inside the range.
    const result = addPassingTone(minorBox(2), "5d");
    expect(result?.strings[0]).toEqual(["3m", "4P", "5d"]);
    expect(result?.strings[5]).toEqual(["3m", "4P"]);
  });

  it("defaults name to the input and parentShape to the input name; applies options", () => {
    const source = minorBox(1);
    const plain = addPassingTone(source, "5d")!;
    expect(plain.name).toBe(source.name);
    expect(plain.parentShape).toBe(source.name);
    expect(plain.quality).toBeUndefined();
    expect(plain.rootString).toBe(source.rootString);
    expect(plain.system).toBe(source.system);

    const named = addPassingTone(source, "5d", {
      name: "Custom",
      quality: "minor-blues",
      parentShape: "Other",
    })!;
    expect(named).toMatchObject({
      name: "Custom",
      quality: "minor-blues",
      parentShape: "Other",
    });
  });

  it("does not mutate the input shape", () => {
    const source = minorBox(3);
    const before = JSON.stringify(source);
    addPassingTone(source, "5d");
    expect(JSON.stringify(source)).toBe(before);
  });

  it("works on non-pentatonic shapes (e.g. a b5 on a CAGED shape)", () => {
    const result = addPassingTone(CAGED_E, "4A");
    expect(result).toBeDefined();
    const added = result!.strings
      .flatMap((s) => s ?? [])
      .filter((i) => i === "4A");
    expect(added.length).toBeGreaterThan(0);
  });

  it("returns undefined for an invalid tone", () => {
    expect(addPassingTone(minorBox(1), "nope")).toBeUndefined();
  });

  it("returns undefined when the shape has no semitone-below neighbor", () => {
    // Major pentatonic has no 4P, so there is nowhere to hang a 5d.
    expect(addPassingTone(PENTA_BOX_1, "5d")).toBeUndefined();
  });

  it("returns undefined when the tone's pitch is already present", () => {
    const blues = addPassingTone(minorBox(1), "5d")!;
    expect(addPassingTone(blues, "5d")).toBeUndefined();
  });

  it("returns undefined for a shape that does not build", () => {
    const empty: ScaleShape = {
      name: "Empty",
      system: "custom",
      strings: [null, null, null, null, null, null],
      rootString: 0,
    };
    expect(addPassingTone(empty, "5d")).toBeUndefined();
  });

  it("evaluates geometry against options.tuning (7-string maps onto the high side)", () => {
    const seven = ["B1", ...STANDARD];
    expect(
      addPassingTone(minorBox(1), "5d", { tuning: seven })?.strings,
    ).toEqual(addPassingTone(minorBox(1), "5d")?.strings);
  });
});
