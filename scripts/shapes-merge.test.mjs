/**
 * Marker-parsing tests for Task Group 15 (shape-workbench spec §6.3/§6.4):
 * generator-owned-block prep. `scripts/lib/owned-blocks.mjs` is the parser
 * `scripts/shapes-merge.mjs` (Task Group 17) will reuse; these tests
 * validate it against the real, human-prepped marker set rather than only
 * synthetic fixtures — the whole point of this task group is that the
 * markers actually parse.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseOwnedBlocks, findOwnedBlock, parseCountMarkers } from "./lib/owned-blocks.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const CAGED_CHORDS_PATH = "../src/data/caged-chords.ts";
const INDEX_TS_PATH = "../src/index.ts";
const DATA_TEST_PATH = "../src/data/data.test.ts";
const INDEX_TEST_PATH = "../src/index.test.ts";

describe("parseOwnedBlocks: src/data/caged-chords.ts (spec §6.3 write allow-list)", () => {
  const source = read(CAGED_CHORDS_PATH);
  const blocks = parseOwnedBlocks(source);

  it("finds exactly the 5 CAGED major chord constants, in file order", () => {
    expect(blocks.map((b) => b.name)).toEqual([
      "CAGED_CHORD_E",
      "CAGED_CHORD_A",
      "CAGED_CHORD_D",
      "CAGED_CHORD_C",
      "CAGED_CHORD_G",
    ]);
  });

  it("every block's begin line precedes its end line", () => {
    for (const block of blocks) {
      expect(block.beginLine).toBeLessThan(block.endLine);
    }
  });

  it("every block's content contains its own export const declaration", () => {
    for (const block of blocks) {
      expect(block.content).toContain(`export const ${block.name}: ChordShape`);
    }
  });

  it("findOwnedBlock resolves each of the 5 identifiers individually", () => {
    for (const name of ["CAGED_CHORD_E", "CAGED_CHORD_A", "CAGED_CHORD_D", "CAGED_CHORD_C", "CAGED_CHORD_G"]) {
      const block = findOwnedBlock(source, name);
      expect(block, `expected an owned block named "${name}"`).toBeDefined();
      expect(block.name).toBe(name);
    }
  });

  it("findOwnedBlock returns undefined for a name with no marker pair", () => {
    expect(findOwnedBlock(source, "CAGED_CHORD_MINOR_E")).toBeUndefined();
  });
});

describe("parseOwnedBlocks: src/index.ts data-imports block (spec §6.3 registration order)", () => {
  it("locates the data-imports block by name", () => {
    const source = read(INDEX_TS_PATH);
    const block = findOwnedBlock(source, "data-imports");
    expect(block).toBeDefined();
    expect(block.name).toBe("data-imports");
    expect(block.beginLine).toBeLessThan(block.endLine);
  });

  it("the data-imports block content is the registration import statements", () => {
    const source = read(INDEX_TS_PATH);
    const block = findOwnedBlock(source, "data-imports");
    expect(block.content).toContain('import "./data/caged-chords";');
    expect(block.content).toContain('import "./data/caged-scales";');
  });
});

describe("parseCountMarkers: registry-total assertions (spec §6.4)", () => {
  it("finds the 6 annotated registry-count assertions in src/data/data.test.ts", () => {
    const markers = parseCountMarkers(read(DATA_TEST_PATH));
    expect(markers.map((m) => m.name)).toEqual([
      "shell-shape-total",
      "chord-shape-total",
      "shell-voicing-family-count",
      "scale-shape-total",
      "featured-chord-total",
      "featured-scale-total",
    ]);
  });

  it("finds the 4 annotated registry-count assertions in src/index.test.ts", () => {
    const markers = parseCountMarkers(read(INDEX_TEST_PATH));
    expect(markers.map((m) => m.name)).toEqual([
      "caged-scale-total",
      "three-nps-scale-total",
      "pentatonic-scale-total",
      "scale-shape-total",
    ]);
  });

  it("each marker's line text is the assertion it annotates, not the marker alone", () => {
    const markers = parseCountMarkers(read(DATA_TEST_PATH));
    for (const marker of markers) {
      expect(marker.lineText).toMatch(/expect\(/);
      expect(marker.lineText).toContain(`shapes-merge:count ${marker.name}`);
    }
  });
});

describe("parseOwnedBlocks: synthetic marker-format edge cases", () => {
  it("throws when an end marker has no matching begin", () => {
    expect(() => parseOwnedBlocks("// shapes-merge:end FOO\n")).toThrow(/unmatched/);
  });

  it("throws when a begin marker is never closed", () => {
    expect(() => parseOwnedBlocks("// shapes-merge:begin FOO\nconst x = 1;\n")).toThrow(/unclosed/);
  });

  it("throws when begin/end identifiers don't match", () => {
    const source = "// shapes-merge:begin FOO\nconst x = 1;\n// shapes-merge:end BAR\n";
    expect(() => parseOwnedBlocks(source)).toThrow(/names must match/);
  });

  it("throws when two blocks share a name", () => {
    const source = [
      "// shapes-merge:begin FOO",
      "const a = 1;",
      "// shapes-merge:end FOO",
      "// shapes-merge:begin FOO",
      "const b = 2;",
      "// shapes-merge:end FOO",
      "",
    ].join("\n");
    expect(() => parseOwnedBlocks(source)).toThrow(/duplicate marker name/);
  });

  it("throws when a begin marker opens before its predecessor closes (no nesting)", () => {
    const source = [
      "// shapes-merge:begin FOO",
      "// shapes-merge:begin BAR",
      "// shapes-merge:end BAR",
      "// shapes-merge:end FOO",
      "",
    ].join("\n");
    expect(() => parseOwnedBlocks(source)).toThrow(/opens before/);
  });

  it("parses a clean two-block file and returns content excluding the marker lines themselves", () => {
    const source = [
      "// shapes-merge:begin FOO",
      "export const FOO = 1;",
      "// shapes-merge:end FOO",
      "// shapes-merge:begin BAR",
      "export const BAR = 2;",
      "// shapes-merge:end BAR",
      "",
    ].join("\n");
    const blocks = parseOwnedBlocks(source);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ name: "FOO", beginLine: 1, endLine: 3, content: "export const FOO = 1;" });
    expect(blocks[1]).toMatchObject({ name: "BAR", beginLine: 4, endLine: 6, content: "export const BAR = 2;" });
  });
});

describe("parseCountMarkers: synthetic edge cases", () => {
  it("throws when two count markers in the same source share a name", () => {
    const source = [
      "expect(a).toBe(1); // shapes-merge:count dup",
      "expect(b).toBe(2); // shapes-merge:count dup",
      "",
    ].join("\n");
    expect(() => parseCountMarkers(source)).toThrow(/duplicate count marker name/);
  });

  it("returns an empty array when no count markers are present", () => {
    expect(parseCountMarkers("expect(a).toBe(1);\n")).toEqual([]);
  });
});

// Sanity check that the fixture paths above actually resolve inside this
// checkout — a silent "file not found" would otherwise make every prior
// `describe` in this file vacuously pass on an empty string.
describe("fixture sanity", () => {
  it("repo-relative fixture files are non-empty", () => {
    expect(repoRoot.length).toBeGreaterThan(0);
    for (const relativePath of [CAGED_CHORDS_PATH, INDEX_TS_PATH, DATA_TEST_PATH, INDEX_TEST_PATH]) {
      expect(read(relativePath).length).toBeGreaterThan(0);
    }
  });
});
