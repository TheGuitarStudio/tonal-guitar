/**
 * Tests for Task Group 16: the single TS printer, `scripts/lib/render-shape.mjs`
 * (shape-workbench spec §6.5).
 */
import { describe, it, expect } from "vitest";
import { renderShape, exportIdentifierFor } from "./render-shape.mjs";

// A representative ChordShape (spec §1.2 fields) — mirrors the shape of
// `src/data/caged-chords.ts`'s `CAGED_CHORD_A` (movable A-shape barre chord,
// two barres) plus a few optional metadata fields to exercise the full
// chord field order.
const REPRESENTATIVE_CHORD = {
  name: "A Shape Minor",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "4P", "5P"],
  fingers: [null, 1, 3, 4, 1, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 3, toString: 4, finger: 4 },
  ],
  rootString: 1,
  chordType: "m",
  cagedPosition: "A",
  tags: ["barre", "movable"],
};

// A representative ScaleShape (spec §1.1/§1.3 fields).
const REPRESENTATIVE_SCALE = {
  name: "E Shape Major Scale",
  system: "caged",
  strings: [["1P", "2M"], ["3M"], ["5P", "6M"], ["1P", "2M"], ["3M"], ["1P"]],
  rootString: 0,
  quality: "major",
  cagedPosition: "E",
};

// A representative ArpeggioShape (spec §1.3 `ArpeggioShape extends ScaleShape`).
const REPRESENTATIVE_ARPEGGIO = {
  name: "E Shape m7 Arpeggio",
  system: "caged",
  strings: [["1P"], null, ["b3m"], ["5P"], ["b7m"], ["1P"]],
  rootString: 0,
  chordType: "m7",
  chordShape: "E Shape Minor",
  cagedPosition: "E",
  fingers: [[1], null, [1], [3], [1], [4]],
};

/**
 * Evaluates the object-literal RHS of a printed `export const IDENT: Type = { ... };`
 * statement back into a plain JS value, so tests can assert structural
 * equality ("modulo whitespace/formatting") instead of comparing exact text.
 */
function evalPrintedShape(source) {
  const match = source.match(/^export const \w+: \w+ = ([\s\S]*);\s*$/);
  if (!match) {
    throw new Error(`evalPrintedShape: could not parse printed source:\n${source}`);
  }
  return (0, eval)(`(${match[1]})`);
}

describe("exportIdentifierFor", () => {
  it("builds <KIND_PREFIX>_<NAME_UPPER_SNAKE>, per spec §1.8's example", () => {
    expect(exportIdentifierFor("chord", { name: "E Shape Minor" })).toBe("CHORD_E_SHAPE_MINOR");
  });

  it("uses the correct prefix per kind", () => {
    expect(exportIdentifierFor("scale", { name: "E Shape Major" })).toBe("SCALE_E_SHAPE_MAJOR");
    expect(exportIdentifierFor("arpeggio", { name: "E Shape m7" })).toBe("ARPEGGIO_E_SHAPE_M7");
  });

  it("collapses punctuation/whitespace runs to single underscores and trims edges", () => {
    expect(exportIdentifierFor("chord", { name: "  G/B  Slash Chord!! " })).toBe(
      "CHORD_G_B_SLASH_CHORD"
    );
  });

  it("turns apostrophes into separators, matching src/shape.ts's exportIdentifierFor", () => {
    expect(exportIdentifierFor("chord", { name: "Travis's Voicing" })).toBe(
      "CHORD_TRAVIS_S_VOICING"
    );
  });

  it("never collides two distinct shape names it's exercised against", () => {
    const names = ["E Shape Minor", "E Shape Major", "A Shape Minor", "A Shape Major", "D Shape"];
    const idents = new Set(names.map((name) => exportIdentifierFor("chord", { name })));
    expect(idents.size).toBe(names.length);
  });

  it("rejects an unknown kind", () => {
    expect(() => exportIdentifierFor("triad", { name: "E Shape" })).toThrow(TypeError);
  });

  it("rejects an empty/missing name", () => {
    expect(() => exportIdentifierFor("chord", { name: "" })).toThrow(TypeError);
    expect(() => exportIdentifierFor("chord", {})).toThrow(TypeError);
  });
});

describe("renderShape — determinism and idempotence", () => {
  it("produces byte-identical output across repeated calls (prettier path)", async () => {
    const first = await renderShape("chord", REPRESENTATIVE_CHORD);
    const second = await renderShape("chord", REPRESENTATIVE_CHORD);
    expect(second).toBe(first);
  });

  it("produces byte-identical output across repeated calls (fallback path, usePrettier: false)", async () => {
    const first = await renderShape("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    const second = await renderShape("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    expect(second).toBe(first);
  });

  it("is deterministic across freshly-constructed but deep-equal input objects", async () => {
    const a = await renderShape("chord", REPRESENTATIVE_CHORD);
    const b = await renderShape("chord", JSON.parse(JSON.stringify(REPRESENTATIVE_CHORD)));
    expect(b).toBe(a);
  });

  it("prettier and fallback formatting agree structurally on the same shape", async () => {
    const withPrettier = await renderShape("chord", REPRESENTATIVE_CHORD);
    const fallback = await renderShape("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    expect(evalPrintedShape(fallback)).toEqual(evalPrintedShape(withPrettier));
  });
});

describe("renderShape — identifier naming", () => {
  it("generates the identifier via exportIdentifierFor when no override is given", async () => {
    const out = await renderShape("chord", REPRESENTATIVE_CHORD);
    expect(out).toContain("export const CHORD_A_SHAPE_MINOR: ChordShape = {");
  });

  it("respects an explicit ident override", async () => {
    const out = await renderShape("chord", REPRESENTATIVE_CHORD, { ident: "CAGED_CHORD_AM" });
    expect(out).toContain("export const CAGED_CHORD_AM: ChordShape = {");
    expect(out).not.toContain("CHORD_A_SHAPE_MINOR");
  });

  it("rejects an ident override that is not a valid identifier", async () => {
    await expect(renderShape("chord", REPRESENTATIVE_CHORD, { ident: "2-bad" })).rejects.toThrow(
      TypeError
    );
  });

  it("rejects an unknown kind", async () => {
    await expect(renderShape("triad", REPRESENTATIVE_CHORD)).rejects.toThrow(TypeError);
  });
});

describe("renderShape — stable key order", () => {
  it("prints chord fields in declaration order regardless of input key order", async () => {
    const shuffled = {
      tags: REPRESENTATIVE_CHORD.tags,
      rootString: REPRESENTATIVE_CHORD.rootString,
      name: REPRESENTATIVE_CHORD.name,
      barres: REPRESENTATIVE_CHORD.barres,
      cagedPosition: REPRESENTATIVE_CHORD.cagedPosition,
      strings: REPRESENTATIVE_CHORD.strings,
      chordType: REPRESENTATIVE_CHORD.chordType,
      fingers: REPRESENTATIVE_CHORD.fingers,
      system: REPRESENTATIVE_CHORD.system,
    };
    const inOrder = await renderShape("chord", REPRESENTATIVE_CHORD, { usePrettier: false });
    const outOfOrder = await renderShape("chord", shuffled, { usePrettier: false });
    expect(outOfOrder).toBe(inOrder);

    const keyOrder = [...inOrder.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    expect(keyOrder).toEqual([
      "name",
      "system",
      "strings",
      "fingers",
      "barres",
      "rootString",
      "chordType",
      "cagedPosition",
      "tags",
    ]);
  });

  it("prints an unrecognized extra field alphabetized after the known fields", async () => {
    const withExtra = { ...REPRESENTATIVE_CHORD, zetaField: "z", alphaField: "a" };
    const out = await renderShape("chord", withExtra, { usePrettier: false });
    const keyOrder = [...out.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    const tail = keyOrder.slice(-2);
    expect(tail).toEqual(["alphaField", "zetaField"]);
  });

  it("orders nested Barre object keys as fret, fromString, toString, finger", async () => {
    const shape = {
      name: "Test Shape",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 1, 1, 1, 1, 1],
      barres: [{ finger: 1, toString: 5, fromString: 0, fret: 0 }],
      rootString: 0,
    };
    const out = await renderShape("chord", shape, { usePrettier: false });
    expect(out).toContain("{ fret: 0, fromString: 0, toString: 5, finger: 1 }");
  });
});

describe("renderShape — quoting and literal formatting", () => {
  it("uses double quotes for every string literal", async () => {
    const out = await renderShape("chord", REPRESENTATIVE_CHORD);
    // No single-quoted string literals anywhere in the printed body.
    expect(out).not.toMatch(/:\s*'/);
    expect(out).toContain('"A Shape Minor"');
    expect(out).toContain('"caged"');
  });

  it("prints null (muted string / no finger) as bare null, not a string", async () => {
    const out = await renderShape("chord", REPRESENTATIVE_CHORD);
    expect(out).toMatch(/strings: \[null, "1P"/);
    expect(out).toMatch(/fingers: \[null, 1/);
  });
});

describe("renderShape — CR-101: unrecognized object keys must be valid identifiers", () => {
  const HOSTILE_KEY = 'x": 1 }; injected(); const y = { z';

  it("rejects a hostile key on an unrecognized top-level field", async () => {
    const hostile = { ...REPRESENTATIVE_CHORD, [HOSTILE_KEY]: 1 };
    await expect(renderShape("chord", hostile)).rejects.toThrow(TypeError);
  });

  it("rejects a hostile key inside a nested object value", async () => {
    const hostile = { ...REPRESENTATIVE_CHORD, weirdField: { [HOSTILE_KEY]: 1 } };
    await expect(renderShape("chord", hostile)).rejects.toThrow(TypeError);
  });

  it("still accepts a well-formed unrecognized extra field", async () => {
    const shape = { ...REPRESENTATIVE_CHORD, extraField: "fine" };
    const out = await renderShape("chord", shape, { usePrettier: false });
    expect(out).toContain('extraField: "fine"');
  });
});

describe("renderShape — scale and arpeggio kinds", () => {
  it("renders a representative ScaleShape with the SCALE_ prefix and ScaleShape type", async () => {
    const out = await renderShape("scale", REPRESENTATIVE_SCALE);
    expect(out).toContain("export const SCALE_E_SHAPE_MAJOR_SCALE: ScaleShape = {");
    expect(evalPrintedShape(out)).toEqual(REPRESENTATIVE_SCALE);
  });

  it("renders a representative ArpeggioShape with the ARPEGGIO_ prefix and ArpeggioShape type", async () => {
    const out = await renderShape("arpeggio", REPRESENTATIVE_ARPEGGIO);
    expect(out).toContain("export const ARPEGGIO_E_SHAPE_M7_ARPEGGIO: ArpeggioShape = {");
    expect(evalPrintedShape(out)).toEqual(REPRESENTATIVE_ARPEGGIO);
  });
});

// ============================================================
// Task 16.4 — round-trip parity against `src/data/caged-chords.ts`
// ============================================================
//
// Restated as fixtures (per task 16.4's explicit allowance) rather than
// imported, so this test stays independent of the TS build: the 5 CAGED
// major chord shape object literals, byte-for-byte as authored in
// `src/data/caged-chords.ts`.
const CAGED_CHORDS_FIXTURES = [
  {
    ident: "CAGED_CHORD_E",
    shape: {
      name: "E Shape Major",
      system: "caged",
      strings: ["1P", "5P", "1P", "3M", "5P", "1P"],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
      rootString: 0,
    },
  },
  {
    ident: "CAGED_CHORD_A",
    shape: {
      name: "A Shape Major",
      system: "caged",
      strings: [null, "1P", "5P", "1P", "3M", "5P"],
      fingers: [null, 1, 3, 3, 3, 1],
      barres: [
        { fret: 0, fromString: 1, toString: 5, finger: 1 },
        { fret: 2, fromString: 2, toString: 4, finger: 3 },
      ],
      rootString: 1,
    },
  },
  {
    ident: "CAGED_CHORD_D",
    shape: {
      name: "D Shape Major",
      system: "caged",
      strings: [null, null, "1P", "5P", "1P", "3M"],
      fingers: [null, null, 1, 2, 3, 4],
      barres: [],
      rootString: 2,
    },
  },
  {
    ident: "CAGED_CHORD_C",
    shape: {
      name: "C Shape Major",
      system: "caged",
      strings: [null, "1P", "3M", "5P", "1P", "3M"],
      fingers: [null, 4, 3, 1, 2, 1],
      barres: [{ fret: 0, fromString: 3, toString: 5, finger: 1 }],
      rootString: 1,
    },
  },
  {
    ident: "CAGED_CHORD_G",
    shape: {
      name: "G Shape Major",
      system: "caged",
      strings: ["1P", "3M", "5P", "1P", "3M", "1P"],
      fingers: [2, 1, 4, 4, 4, 3],
      barres: [{ fret: 0, fromString: 2, toString: 4, finger: 4 }],
      rootString: 0,
    },
  },
];

describe("renderShape — round-trip parity with src/data/caged-chords.ts (task 16.4)", () => {
  for (const { ident, shape } of CAGED_CHORDS_FIXTURES) {
    it(`renders ${ident} structurally identical to the hand-written source`, async () => {
      const out = await renderShape("chord", shape, { ident });
      expect(out).toContain(`export const ${ident}: ChordShape = {`);
      expect(evalPrintedShape(out)).toEqual(shape);
    });

    it(`renders ${ident} identically via the fallback formatter (no prettier)`, async () => {
      const out = await renderShape("chord", shape, { ident, usePrettier: false });
      expect(evalPrintedShape(out)).toEqual(shape);
    });
  }

  it("prints a single barre inline, matching the hand-written E/C/G shapes", async () => {
    const out = await renderShape("chord", CAGED_CHORDS_FIXTURES[0].shape, {
      ident: "CAGED_CHORD_E",
    });
    expect(out).toContain('barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],');
  });

  it("prints an empty barres array as [], matching the hand-written D shape", async () => {
    const out = await renderShape("chord", CAGED_CHORDS_FIXTURES[2].shape, {
      ident: "CAGED_CHORD_D",
    });
    expect(out).toContain("barres: [],");
  });

  it("breaks a two-entry barres array onto multiple lines, matching the hand-written A shape", async () => {
    const out = await renderShape("chord", CAGED_CHORDS_FIXTURES[1].shape, {
      ident: "CAGED_CHORD_A",
    });
    expect(out).toContain(
      "barres: [\n" +
        "    { fret: 0, fromString: 1, toString: 5, finger: 1 },\n" +
        "    { fret: 2, fromString: 2, toString: 4, finger: 3 },\n" +
        "  ],"
    );
  });
});
