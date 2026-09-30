/**
 * Task 22.1/22.2: `boardModel` gap/count/column/row correctness against a
 * small synthetic catalog fixture (not the live registry, so the expected
 * numbers below are hand-computed and independent of registry churn).
 */
import { describe, expect, it } from "vitest";
import { auditAllShapes, impliedStringSet, type ChordShape, type ScaleShape } from "tonal-guitar";
import { boardModel, type BoardAxis, type BoardRowGrouping } from "./board";
import { buildCatalog, type ChordCatalogEntry, type ScaleCatalogEntry, type ShapeCatalogEntry } from "./catalog";

// ============================================================
// Fixture builders
// ============================================================

const STUB_FRETTED_SCALE = {
  empty: true,
  root: "",
  scaleType: "",
  scaleName: "",
  shapeName: "",
  tuning: [],
  notes: [],
};

let nextIndex = 0;

function chordEntry(overrides: Partial<ChordShape> & { name: string }): ChordCatalogEntry {
  const shape: ChordShape = {
    system: "caged",
    strings: [null, null, null, null, null, null],
    fingers: [null, null, null, null, null, null],
    barres: [],
    rootString: 0,
    ...overrides,
  };
  return {
    kind: "chord",
    name: shape.name,
    shape,
    index: nextIndex++,
    renderRoot: "C",
    frettedScale: STUB_FRETTED_SCALE,
    builtFrets: [null, null, null, null, null, null],
    issues: [],
  };
}

function scaleEntry(overrides: Partial<ScaleShape> & { name: string }): ScaleCatalogEntry {
  const shape: ScaleShape = {
    system: "caged",
    strings: [null, null, null, null, null, null],
    rootString: 0,
    ...overrides,
  };
  return {
    kind: "scale",
    name: shape.name,
    shape,
    index: nextIndex++,
    renderRoot: "C",
    frettedScale: STUB_FRETTED_SCALE,
    builtFrets: [null, null, null, null, null, null],
    issues: [],
  };
}

// ============================================================
// Chord-kind fixture: 3 chordType rows (M, m, 7) × 5 CAGED columns.
//
//   M (Triads):    E, A, G filled   -> C, D gaps        (3 filled, 2 gaps)
//   m (Triads):    A filled         -> C, G, E, D gaps   (1 filled, 4 gaps)
//   7 (Sevenths):  C filled         -> A, G, E, D gaps    (1 filled, 4 gaps)
//
// Unfiltered: rows=3, columns=5 -> total=15, filled=5, gaps=10.
// ============================================================

const CHORD_CATALOG: ShapeCatalogEntry[] = [
  chordEntry({ name: "E Shape Major", chordType: "M", cagedPosition: "E" }),
  chordEntry({ name: "A Shape Major", chordType: "M", cagedPosition: "A" }),
  chordEntry({ name: "G Shape Major", chordType: "M", cagedPosition: "G" }),
  chordEntry({ name: "A Shape Minor", chordType: "m", cagedPosition: "A" }),
  chordEntry({ name: "C Shape Dominant7", chordType: "7", cagedPosition: "C" }),
];

describe("boardModel — chord kind, cagedPosition axis, chordType rowGrouping", () => {
  it("derives the fixed C-A-G-E-D column order regardless of data", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    expect(board.columns.map((c) => c.key)).toEqual(["C", "A", "G", "E", "D"]);
  });

  it("derives one row per distinct chordType present, alphabetized", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    // `localeCompare` sorts lowercase before uppercase for equal letters.
    expect(board.rows.map((r) => r.key)).toEqual(["7", "m", "M"]);
  });

  it("hand-computed gap/filled counts with no filters", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    expect(board.counts).toEqual({ shown: 5, total: 15, gaps: 10 });
  });

  it("marks filled cells with their catalog entry and gap cells with none", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    const filled = board.cells.get("M::E");
    expect(filled?.state).toBe("filled");
    expect(filled?.entry?.name).toBe("E Shape Major");

    expect(filled?.entries.map((e) => e.name)).toEqual(["E Shape Major"]);

    const gap = board.cells.get("M::D");
    expect(gap?.state).toBe("gap");
    expect(gap?.entry).toBeUndefined();
    expect(gap?.entries).toEqual([]);
  });

  it("keeps every match in a shared cell — featured first, then by name (CR-030)", () => {
    const catalog = [
      chordEntry({ name: "Zeta E Shape Major", chordType: "M", cagedPosition: "E" }),
      chordEntry({ name: "Beta E Shape Major", chordType: "M", cagedPosition: "E" }),
      chordEntry({ name: "Omega E Shape Major", chordType: "M", cagedPosition: "E", featured: true }),
      chordEntry({ name: "Alpha E Shape Major", chordType: "M", cagedPosition: "E" }),
    ];
    const board = boardModel(catalog, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    const cell = board.cells.get("M::E");
    expect(cell?.state).toBe("filled");
    expect(cell?.entries.map((e) => e.name)).toEqual([
      "Omega E Shape Major",
      "Alpha E Shape Major",
      "Beta E Shape Major",
      "Zeta E Shape Major",
    ]);
    expect(cell?.entry).toBe(cell?.entries[0]);
    // Counts are per cell: one filled cell, however many matches it holds.
    expect(board.counts).toEqual({ shown: 1, total: 5, gaps: 4 });
  });

  it("narrows a shared cell's matches with search without dropping the cell", () => {
    const catalog = [
      chordEntry({ name: "Alpha E Shape Major", chordType: "M", cagedPosition: "E" }),
      chordEntry({ name: "Beta E Shape Major", chordType: "M", cagedPosition: "E" }),
    ];
    const board = boardModel(catalog, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
      search: "Beta",
    });
    expect(board.cells.get("M::E")?.entries.map((e) => e.name)).toEqual(["Beta E Shape Major"]);
  });

  it("cell slots carry the row/column semantics as a ChordSlot", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    const cell = board.cells.get("M::D");
    expect(cell?.slot).toEqual({
      kind: "chord",
      rowGrouping: "chordType",
      rowKey: "M",
      axis: "cagedPosition",
      columnKey: "D",
      chordType: "M",
      cagedPosition: "D",
    });
  });

  it("typeFilter narrows rows to the selected quality groups (Triads excludes 7/Sevenths)", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
      typeFilter: ["Triads"],
    });
    expect(board.rows.map((r) => r.key).sort()).toEqual(["M", "m"].sort());
    expect(board.counts).toEqual({ shown: 4, total: 10, gaps: 6 });
  });

  it("search narrows which entries count as filled without removing rows/columns", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
      search: "Major",
    });
    // Structure is unchanged (still 3 rows x 5 columns = 15 cells)...
    expect(board.rows).toHaveLength(3);
    expect(board.columns).toHaveLength(5);
    // ...but only the 3 "* Shape Major" entries count as filled; the
    // Minor/Dominant7 entries that don't match "Major" revert to gaps.
    expect(board.counts).toEqual({ shown: 3, total: 15, gaps: 12 });
    expect(board.cells.get("m::A")?.state).toBe("gap");
  });

  it("a draft badge turns a gap cell into a draft cell without touching counts.shown", () => {
    const drafts = new Map([["M::D", { label: "D Shape Major (draft)", status: "draft" as const }]]);
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
      drafts,
    });
    expect(board.cells.get("M::D")?.state).toBe("draft");
    expect(board.counts).toEqual({ shown: 5, total: 15, gaps: 9 });
  });

  it("an empty catalog yields an all-gap grid with matching structure", () => {
    const board = boardModel([], {
      kind: "chord",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    expect(board.rows).toEqual([]);
    expect(board.columns).toEqual(["C", "A", "G", "E", "D"].map((k) => ({ key: k, label: k })));
    expect(board.counts).toEqual({ shown: 0, total: 0, gaps: 0 });
  });
});

describe("boardModel — inversion axis", () => {
  it("derives the fixed 0-3 inversion columns with friendly labels", () => {
    const board = boardModel(CHORD_CATALOG, {
      kind: "chord",
      axis: "inversion",
      rowGrouping: "chordType",
    });
    expect(board.columns).toEqual([
      { key: "0", label: "Root position" },
      { key: "1", label: "1st inversion" },
      { key: "2", label: "2nd inversion" },
      { key: "3", label: "3rd inversion" },
    ]);
    // None of the fixture entries set `inversion`, so every cell is a gap.
    expect(board.counts).toEqual({ shown: 0, total: 12, gaps: 12 });
  });

  it("fills a cell once an entry's inversion matches the column", () => {
    const catalog = [...CHORD_CATALOG, chordEntry({ name: "A Shape Major 1st Inv", chordType: "M", inversion: 1 })];
    const board = boardModel(catalog, {
      kind: "chord",
      axis: "inversion",
      rowGrouping: "chordType",
    });
    expect(board.cells.get("M::1")?.state).toBe("filled");
    expect(board.cells.get("M::1")?.entry?.name).toBe("A Shape Major 1st Inv");
  });
});

describe("boardModel — stringSet axis and rowGrouping", () => {
  it("derives stringSet columns/rows from the data (no fixed order)", () => {
    const catalog = [
      chordEntry({ name: "Shell m7 E-root", chordType: "m7", stringSet: [0, 2, 3] }),
      chordEntry({ name: "Shell m7 A-root", chordType: "m7", stringSet: [1, 2, 3] }),
    ];
    const board = boardModel(catalog, {
      kind: "chord",
      axis: "stringSet",
      rowGrouping: "stringSet",
    });
    // Same field drives both axis and rowGrouping here, so rows === columns
    // and every entry sits on its own diagonal cell.
    expect(board.rows.map((r) => r.key)).toEqual(["[0,2,3]", "[1,2,3]"]);
    expect(board.columns.map((c) => c.key)).toEqual(["[0,2,3]", "[1,2,3]"]);
    expect(board.cells.get("[0,2,3]::[0,2,3]")?.state).toBe("filled");
    expect(board.cells.get("[1,2,3]::[1,2,3]")?.state).toBe("filled");
    expect(board.cells.get("[0,2,3]::[1,2,3]")?.state).toBe("gap");
  });
});

describe("boardModel — scale kind", () => {
  it("grids scale entries by chordType row / cagedPosition column", () => {
    const catalog: ShapeCatalogEntry[] = [
      scaleEntry({ name: "E Shape m7 Box", chordType: "m7", cagedPosition: "E" }),
      scaleEntry({ name: "A Shape m7 Box", chordType: "m7", cagedPosition: "A" }),
    ];
    const board = boardModel(catalog, {
      kind: "scale",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    expect(board.rows.map((r) => r.key)).toEqual(["m7"]);
    expect(board.counts).toEqual({ shown: 2, total: 5, gaps: 3 });
  });
});

describe("boardModel — arpeggio kind (no seeded catalog data)", () => {
  it("falls back to CHORD_SCALE_RULE chord types for rows and produces real ArpeggioSlot cells", () => {
    const board = boardModel([], {
      kind: "arpeggio",
      axis: "cagedPosition",
      rowGrouping: "chordType",
    });
    // v1 CHORD_SCALE_RULE table: M, maj7, m, m7, 7, m7b5 (spec §1.10).
    expect(board.rows.map((r) => r.key).sort()).toEqual(["7", "M", "m", "m7", "m7b5", "maj7"].sort());
    expect(board.counts.total).toBe(board.rows.length * 5);
    // No arpeggio entries exist in the (chord/scale-only) catalog, so every
    // cell is a gap.
    expect(board.counts.shown).toBe(0);
    expect(board.counts.gaps).toBe(board.counts.total);

    const cell = board.cells.get("m7::E");
    expect(cell?.state).toBe("gap");
    expect(cell?.slot).toEqual({ chordType: "m7", cagedPosition: "E", rootString: -1 });
  });

  it("a draft on an arpeggio slot renders as a draft cell", () => {
    const drafts = new Map([["m7::E", { label: "E Shape m7 Arpeggio (draft)", status: "draft" as const }]]);
    const board = boardModel([], {
      kind: "arpeggio",
      axis: "cagedPosition",
      rowGrouping: "chordType",
      drafts,
    });
    expect(board.cells.get("m7::E")?.state).toBe("draft");
  });
});

// ============================================================
// Live catalog: no shape is silently dropped (CR-030)
// ============================================================

describe("boardModel — live catalog places every shape exactly once", () => {
  const liveCatalog = buildCatalog(auditAllShapes());
  const ROW_GROUPINGS: BoardRowGrouping[] = ["chordType", "stringSet"];
  const AXES: BoardAxis[] = ["cagedPosition", "stringSet", "inversion"];

  // Independent of `board.ts`'s own extraction: an entry is placeable when
  // it carries both the row and the column facet, and the column value is
  // one the axis actually renders (inversion columns are fixed 0–3).
  function facet(entry: ShapeCatalogEntry, field: BoardRowGrouping | BoardAxis): string | undefined {
    if (field === "chordType") return entry.shape.chordType;
    if (field === "cagedPosition") return entry.shape.cagedPosition;
    if (entry.kind !== "chord") return undefined;
    if (field === "inversion") return entry.shape.inversion === undefined ? undefined : String(entry.shape.inversion);
    const stringSet = impliedStringSet(entry.shape);
    return stringSet ? JSON.stringify(stringSet) : undefined;
  }

  // Chord only: no live scale shape carries `chordType`, so every scale
  // board is empty and the check would pass vacuously.
  const kind = "chord";
  for (const rowGrouping of ROW_GROUPINGS) {
    for (const axis of AXES) {
      it(`${rowGrouping} × ${axis}`, () => {
        const board = boardModel(liveCatalog, { kind, axis, rowGrouping });
        const columnKeys = new Set(board.columns.map((c) => c.key));
        const placed = liveCatalog.filter((entry) => {
          if (entry.kind !== kind) return false;
          const column = facet(entry, axis);
          return facet(entry, rowGrouping) !== undefined && column !== undefined && columnKeys.has(column);
        });

        const inCells = [...board.cells.values()].flatMap((cell) => cell.entries);
        expect(inCells.length).toBe(placed.length);
        expect(new Set(inCells.map((e) => e.name))).toEqual(new Set(placed.map((e) => e.name)));
      });
    }
  }

  it("the chordType × stringSet board really does stack several shapes per cell", () => {
    const board = boardModel(liveCatalog, { kind: "chord", axis: "stringSet", rowGrouping: "chordType" });
    const stacked = [...board.cells.values()].filter((cell) => cell.entries.length > 1);
    expect(stacked.length).toBeGreaterThan(0);
  });
});
