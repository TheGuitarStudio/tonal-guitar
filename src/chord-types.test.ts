/**
 * Audit and purity tests for the canonical chord-type table (TG-5, TG-6).
 *
 * The table is hand-written so that `tonal-guitar/chord-types` can be imported
 * without pulling Tonal or the shape registry in. These tests are what keep a
 * hand-written table honest: they recompute every derived field from Tonal and
 * from the live registry and fail on any drift.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getChord } from "@tonaljs/chord";

import {
  CHORD_TYPE_TABLE,
  CHORD_TYPE_KEYS,
  type ChordTypeKey,
} from "./chord-types";

const SOURCE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "chord-types.ts",
);

describe("CHORD_TYPE_TABLE — registry coverage (TG-5a)", () => {
  it("covers exactly the chord types the shape registry indexes", async () => {
    // Import through the barrel so every `src/data/*` side-effect import runs
    // and the registry is fully populated.
    const { chordShapes } = await import("./index");

    const registered = new Set(
      chordShapes
        .all()
        .map((shape) => shape.chordType)
        .filter((chordType): chordType is string => chordType !== undefined),
    );
    const tabled = new Set<string>(CHORD_TYPE_TABLE.map((row) => row.id));

    // Both directions: every registered type is described, and every described
    // type is voiceable.
    expect([...tabled].sort()).toEqual([...registered].sort());
  });

  it("has at least one registered shape per row", async () => {
    const { chordShapes } = await import("./index");

    const missing = CHORD_TYPE_TABLE.filter(
      (row) => chordShapes.query({ chordType: row.id }).length === 0,
    ).map((row) => row.id);

    expect(missing).toEqual([]);
  });

  it("does not give `aug7` a row — the registry spells that chord `7#5`", async () => {
    const { chordShapes } = await import("./index");

    // `aug7` and `7#5` are the same Tonal chord, but the registry is an
    // exact-string index and registers `7#5` only (see extended-chords.ts).
    // A row for `aug7` would claim a voicing that does not exist.
    expect(chordShapes.query({ chordType: "aug7" })).toEqual([]);
    expect(CHORD_TYPE_TABLE.map((row) => row.id)).not.toContain("aug7");
    expect(getChord("aug7").intervals).toEqual(
      CHORD_TYPE_TABLE.find((row) => row.id === "7#5")?.intervals,
    );
  });
});

describe("CHORD_TYPE_TABLE — Tonal conformance (TG-5b)", () => {
  it.each(CHORD_TYPE_TABLE.map((row) => [row.id, row] as const))(
    "%s: tonalCanonical and intervals match Tonal",
    (_id, row) => {
      const chordType = getChord(row.id);

      expect(chordType.empty).toBe(false);
      expect(chordType.aliases[0]).toBe(row.tonalCanonical);
      expect(chordType.intervals).toEqual([...row.intervals]);
    },
  );

  it("records exactly three alias divergences", () => {
    const divergent = CHORD_TYPE_TABLE.filter(
      (row) => row.tonalCanonical !== row.id,
    ).map((row) => [row.id, row.tonalCanonical]);

    expect(divergent).toEqual([
      ["mMaj7", "m/ma7"],
      ["add9", "Madd9"],
      ["6/9", "6add9"],
    ]);
  });
});

describe("CHORD_TYPE_TABLE — internal consistency (TG-5c)", () => {
  it("has unique ids", () => {
    const ids = CHORD_TYPE_TABLE.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique glyphs", () => {
    const glyphs = CHORD_TYPE_TABLE.map((row) => row.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("has a non-empty label and at least three intervals per row", () => {
    for (const row of CHORD_TYPE_TABLE) {
      expect(row.label, `${row.id} label`).not.toBe("");
      expect(
        row.intervals.length,
        `${row.id} intervals`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the seven legacy glyphs audio-core's JAZZ_SUFFIX already ships", () => {
    const glyphFor = (id: ChordTypeKey) =>
      CHORD_TYPE_TABLE.find((row) => row.id === id)?.glyph;

    expect(glyphFor("M")).toBe("");
    expect(glyphFor("m")).toBe("-");
    expect(glyphFor("dim")).toBe("°");
    expect(glyphFor("maj7")).toBe("△7");
    expect(glyphFor("m7")).toBe("-7");
    expect(glyphFor("7")).toBe("7");
    expect(glyphFor("m7b5")).toBe("ø7");
  });

  it("CHORD_TYPE_KEYS mirrors the table's ids in order", () => {
    expect([...CHORD_TYPE_KEYS]).toEqual(CHORD_TYPE_TABLE.map((row) => row.id));
  });
});

describe("chord-types module purity (TG-6)", () => {
  it("imports nothing at all", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");

    // Strip block and line comments so the divergence tables and prose in the
    // file header cannot produce a false positive.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    const specifiers = [
      ...code.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s*["']([^"']+)["']/g),
      ...code.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g),
      ...code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g),
      ...code.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
    ].map((match) => match[1]);

    expect(specifiers).toEqual([]);
  });

  it("registers no shapes when imported on its own", async () => {
    // A fresh module graph: `./chord-types` is imported first and in isolation,
    // then `./shape` is imported separately. If `./chord-types` reached any
    // `src/data/*` module, the registry would already be populated here.
    vi.resetModules();

    const table = await import("./chord-types");
    const { chordShapes, arpeggioShapes, all } = await import("./shape");

    expect(table.CHORD_TYPE_TABLE.length).toBeGreaterThan(0);
    expect(chordShapes.all()).toEqual([]);
    expect(arpeggioShapes.all()).toEqual([]);
    expect(all()).toEqual([]);
  });
});
