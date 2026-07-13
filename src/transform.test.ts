import { describe, expect, it } from "vitest";
import { relabelShape } from "./index";
import type { RelabelOptions, ScaleShape } from "./index";

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

  it("stub relabelShape always returns undefined", () => {
    const anyShape: ScaleShape = {
      name: "G Shape",
      system: "caged",
      strings: [["1P", "2M"], null],
      rootString: 0,
    };
    expect(relabelShape(anyShape, [])).toBeUndefined();
    expect(
      relabelShape(anyShape, ["1P", "2M", "3m", "4P", "5P", "6m", "7m"], {
        name: "Em Shape",
        quality: "minor",
        parentShape: "G Shape",
      }),
    ).toBeUndefined();
  });
});
