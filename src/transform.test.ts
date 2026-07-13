import { describe, expect, it } from "vitest";
import { relabelShape } from "./index";
import type { RelabelOptions, ScaleShape } from "./index";
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
    const before = JSON.parse(JSON.stringify(CAGED_G.strings)) as (string[] | null)[];
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
    const withOverride = relabelShape(CAGED_G, NATURAL_MINOR, { name: "Em Shape" });
    expect(withOverride?.name).toBe("Em Shape");

    const withoutOverride = relabelShape(CAGED_G, NATURAL_MINOR);
    expect(withoutOverride?.name).toBe(CAGED_G.name);
  });

  it("preserves system from the input shape (R2.9)", () => {
    const result = relabelShape(CAGED_G, NATURAL_MINOR);
    expect(result?.system).toBe(CAGED_G.system);
    expect(result?.system).toBe("caged");
  });
});
