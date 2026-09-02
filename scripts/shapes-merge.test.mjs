/**
 * Marker-parsing tests for Task Group 15 (shape-workbench spec §6.3/§6.4):
 * generator-owned-block prep. `scripts/lib/owned-blocks.mjs` is the parser
 * `scripts/shapes-merge.mjs` (Task Group 17) will reuse; these tests
 * validate it against the real, human-prepped marker set rather than only
 * synthetic fixtures — the whole point of this task group is that the
 * markers actually parse.
 */
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  existsSync,
  statSync,
  rmSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseOwnedBlocks, findOwnedBlock, parseCountMarkers } from "./lib/owned-blocks.mjs";
import { runMerge, MergeRefusal, UsageError, parseArgs, GENERATED_HEADER } from "./shapes-merge.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const CAGED_CHORDS_PATH = "../src/data/caged-chords.ts";
const INDEX_TS_PATH = "../src/index.ts";
const DATA_TEST_PATH = "../src/data/data.test.ts";
const INDEX_TEST_PATH = "../src/index.test.ts";

// Baseline mtime/content-hash of the real (never fixture-rooted)
// src/data/caged-chords.ts, captured at module load — i.e. before any test
// in this file has run. Task 18.4's real-checkout-untouched assertion (at
// the very bottom of this file, after every other test) compares against
// this baseline, proving the entire fixture suite above never wrote to the
// real checkout, not just the one merge each "--root never touches the
// real checkout" test already exercises.
const REAL_CAGED_CHORDS_ABS_PATH = fileURLToPath(new URL(CAGED_CHORDS_PATH, import.meta.url));
const realCagedChordsBaselineMtimeMs = statSync(REAL_CAGED_CHORDS_ABS_PATH).mtimeMs;
const realCagedChordsBaselineHash = createHash("sha256")
  .update(readFileSync(REAL_CAGED_CHORDS_ABS_PATH))
  .digest("hex");

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

/**
 * Tests for Task Group 17 (shape-workbench spec §6): the merge script
 * itself, `scripts/shapes-merge.mjs`. Every scenario runs against a
 * `--root`-isolated temp copy of `src/data`/`src/index.ts`/`src/index.test.ts`
 * so the real checkout is never touched (verified explicitly below).
 */

const LIBRARY_VERSION = "0.2.0"; // src/version.ts VERSION
const STANDARD_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"]; // src/tuning.ts STANDARD

function createFixtureRoot() {
  const dir = mkdtempSync(path.join(tmpdir(), "shapes-merge-fixture-"));
  const realDataDir = path.join(repoRoot, "src", "data");
  const fixtureDataDir = path.join(dir, "src", "data");
  mkdirSync(fixtureDataDir, { recursive: true });
  for (const file of readdirSync(realDataDir)) {
    if (file.endsWith(".ts")) {
      copyFileSync(path.join(realDataDir, file), path.join(fixtureDataDir, file));
    }
  }
  copyFileSync(path.join(repoRoot, "src", "index.ts"), path.join(dir, "src", "index.ts"));
  copyFileSync(path.join(repoRoot, "src", "index.test.ts"), path.join(dir, "src", "index.test.ts"));
  return dir;
}

function withFixtureRoot(fn) {
  return async () => {
    const dir = createFixtureRoot();
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

function writeChangeset(dir, changeset, name = "changeset.json") {
  const p = path.join(dir, name);
  writeFileSync(p, JSON.stringify(changeset, null, 2));
  return p;
}

function realDataFile(dir, basename) {
  return path.join(dir, "src", "data", `${basename}.ts`);
}

function realIndexFile(dir) {
  return path.join(dir, "src", "index.ts");
}

function baseChangeset(changes, overrides = {}) {
  return {
    $schema: "tonal-guitar/changeset@1",
    version: LIBRARY_VERSION,
    tuning: [...STANDARD_TUNING],
    changes,
    ...overrides,
  };
}

// ------------------------------------------------------------------------
// Task Group 18: committed fixture changesets (`scripts/__fixtures__/`,
// D-008/spec §6.7) + their expected output trees, hand-reviewed once and
// committed alongside the changesets that produce them.
// ------------------------------------------------------------------------

const FIXTURES_DIR = fileURLToPath(new URL("./__fixtures__", import.meta.url));

function fixtureChangesetPath(name) {
  return path.join(FIXTURES_DIR, "changesets", name);
}

function readExpectedFile(fixtureName, relPath) {
  return readFileSync(path.join(FIXTURES_DIR, "expected", fixtureName, relPath), "utf8");
}

// A small movable minor-triad chord shape in the spirit of the spec §4.3
// "C Shape Minor" dogfooding example (verified audit-clean: built at the
// default root "C" via applyChordShape produces frets [null,3,1,0,1,null],
// zero errors/warnings from auditChordShapeFull).
const C_SHAPE_MINOR = {
  name: "C Shape Minor",
  system: "caged",
  strings: [null, "1P", "3m", "5P", "1P", null],
  fingers: [null, 3, 1, 4, 2, null],
  barres: [],
  rootString: 1,
  chordType: "m",
  voicingFamily: "caged",
  cagedPosition: "C",
  parentShape: "C Shape Major",
  tags: ["caged", "triad", "core"],
};

// Same shape family, a distinct name/cagedPosition — for the "two constants
// in one generated file" scenarios. Also verified audit-clean.
const G_SHAPE_MINOR = {
  name: "G Shape Minor",
  system: "caged",
  strings: [null, "1P", "3m", "5P", null, null],
  fingers: [null, 2, 1, 3, null, null],
  barres: [],
  rootString: 1,
  chordType: "m",
  voicingFamily: "caged",
  cagedPosition: "G",
  parentShape: "G Shape Major",
  tags: ["caged", "triad", "core"],
};

describe("shapes-merge: --root never touches the real checkout", () => {
  it(
    "the real src/data tree is byte-identical before and after a fixture-rooted merge",
    withFixtureRoot(async (dir) => {
      const realCagedChords = read(CAGED_CHORDS_PATH);
      const realIndexTs = read(INDEX_TS_PATH);
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      await runMerge([changesetPath, "--root", dir]);
      expect(read(CAGED_CHORDS_PATH)).toBe(realCagedChords);
      expect(read(INDEX_TS_PATH)).toBe(realIndexTs);
    }),
  );
});

describe("shapes-merge: add — new-file creation + registration order (17.2/17.3)", () => {
  it(
    "creates a generator-owned file and inserts its import after the parentShape's file",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      const result = await runMerge([changesetPath, "--root", dir]);
      expect(result.mode).toBe("merge");
      expect(result.plan.added).toBe(1);

      const newFilePath = realDataFile(dir, "caged-chords-minor");
      expect(existsSync(newFilePath)).toBe(true);
      const newFileText = readFileSync(newFilePath, "utf8");
      expect(newFileText.startsWith(GENERATED_HEADER)).toBe(true);
      expect(newFileText).toContain("shapes-merge:begin CHORD_C_SHAPE_MINOR");
      expect(newFileText).toContain('export const CHORD_C_SHAPE_MINOR: ChordShape = {');
      expect(newFileText).toContain('name: "C Shape Minor"');
      expect(newFileText).toContain("shapes-merge:end CHORD_C_SHAPE_MINOR");
      expect(newFileText).toContain("[CHORD_C_SHAPE_MINOR].forEach(chordShapes.add.bind(chordShapes));");

      const indexText = readFileSync(realIndexFile(dir), "utf8");
      expect(indexText).toContain('import "./data/caged-chords-minor";');
      const lines = indexText.split("\n");
      const cagedChordsLine = lines.findIndex((l) => l.trim() === 'import "./data/caged-chords";');
      expect(lines[cagedChordsLine + 1].trim()).toBe('import "./data/caged-chords-minor";');
    }),
  );

  it(
    "respects an explicit `after` anchor over the parentShape default",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          {
            op: "add",
            kind: "chord",
            file: "caged-chords-minor",
            after: "open-chords",
            shape: C_SHAPE_MINOR,
          },
        ]),
      );
      await runMerge([changesetPath, "--root", dir]);
      const indexText = readFileSync(realIndexFile(dir), "utf8");
      const lines = indexText.split("\n");
      const openChordsLine = lines.findIndex((l) => l.trim() === 'import "./data/open-chords";');
      expect(lines[openChordsLine + 1].trim()).toBe('import "./data/caged-chords-minor";');
    }),
  );
});

describe("shapes-merge: update — surgical owned-block replace (17.2)", () => {
  it(
    "rewrites only the targeted owned block, byte-preserving everything else in the file",
    withFixtureRoot(async (dir) => {
      const before = readFileSync(realDataFile(dir, "caged-chords"), "utf8");
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          {
            op: "update",
            kind: "chord",
            name: "A Shape Major",
            patch: { chordType: "M", voicingFamily: "caged", cagedPosition: "A" },
          },
        ]),
      );
      const result = await runMerge([changesetPath, "--root", dir]);
      expect(result.plan.updated).toBe(1);

      const after = readFileSync(realDataFile(dir, "caged-chords"), "utf8");
      expect(after).not.toBe(before);
      expect(after).toContain('chordType: "M"');
      expect(after).toContain('cagedPosition: "A"');
      // The hand-written comment directly above the CAGED_CHORD_A block (CR-005/
      // CR-006 sweep) sits outside the marker pair and must survive verbatim.
      expect(after).toContain("CR-005/CR-006 sweep");
      // Every OTHER owned block (E/D/C/G) is untouched.
      for (const untouched of ["CAGED_CHORD_E", "CAGED_CHORD_D", "CAGED_CHORD_C", "CAGED_CHORD_G"]) {
        const b = findOwnedBlock(before, untouched);
        const a = findOwnedBlock(after, untouched);
        expect(a.content).toBe(b.content);
      }
    }),
  );
});

describe("shapes-merge: remove — drops the owned block, deletes an emptied generated file (17.2)", () => {
  it(
    "removes one constant from a 2-constant generated file, then deletes the file + import once empty",
    withFixtureRoot(async (dir) => {
      const addChangesetPath = writeChangeset(
        dir,
        baseChangeset([
          { op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR },
          { op: "add", kind: "chord", file: "caged-chords-minor", shape: G_SHAPE_MINOR },
        ]),
        "add.json",
      );
      await runMerge([addChangesetPath, "--root", dir]);

      const removeOnePath = writeChangeset(
        dir,
        baseChangeset([{ op: "remove", kind: "chord", name: "G Shape Minor" }]),
        "remove-one.json",
      );
      const r1 = await runMerge([removeOnePath, "--root", dir]);
      expect(r1.plan.removed).toBe(1);
      const afterOneRemoved = readFileSync(realDataFile(dir, "caged-chords-minor"), "utf8");
      expect(afterOneRemoved).toContain("C Shape Minor");
      expect(afterOneRemoved).not.toContain("G Shape Minor");
      expect(readFileSync(realIndexFile(dir), "utf8")).toContain('import "./data/caged-chords-minor";');

      const removeLastPath = writeChangeset(
        dir,
        baseChangeset([{ op: "remove", kind: "chord", name: "C Shape Minor" }]),
        "remove-last.json",
      );
      await runMerge([removeLastPath, "--root", dir]);
      expect(existsSync(realDataFile(dir, "caged-chords-minor"))).toBe(false);
      expect(readFileSync(realIndexFile(dir), "utf8")).not.toContain("caged-chords-minor");
    }),
  );

  it(
    "refuses to remove a constant from the hand-written caged-chords.ts allow-listed file",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "remove", kind: "chord", name: "A Shape Major" }]),
      );
      await expect(runMerge([changesetPath, "--root", dir])).rejects.toThrow(MergeRefusal);
      expect(readFileSync(realDataFile(dir, "caged-chords"), "utf8")).toContain("A Shape Major");
    }),
  );
});

// Shared by the ad hoc refusal-scenario tests below (Task Group 17) and the
// committed-fixture refusal tests (Task Group 18) — asserts a MergeRefusal
// was thrown and that not one file under src/data or src/index.ts changed,
// then returns the caught error for rule-specific assertions.
async function expectRefusalWithNoWrites(dir, changesetPath, argsExtra = []) {
  const before = new Map();
  const dataDir = path.join(dir, "src", "data");
  for (const file of readdirSync(dataDir)) {
    before.set(file, readFileSync(path.join(dataDir, file), "utf8"));
  }
  const beforeIndex = readFileSync(realIndexFile(dir), "utf8");
  let caught;
  try {
    await runMerge([changesetPath, "--root", dir, ...argsExtra]);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(MergeRefusal);
  for (const file of readdirSync(dataDir)) {
    expect(readFileSync(path.join(dataDir, file), "utf8")).toBe(before.get(file) ?? undefined);
  }
  expect(readFileSync(realIndexFile(dir), "utf8")).toBe(beforeIndex);
  return caught;
}

describe("shapes-merge: refusal scenarios (spec §6.2, in order) — every one writes nothing", () => {
  it(
    "rule 1: invalid $schema is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(dir, {
        ...baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
        $schema: "wrong-schema@1",
      });
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("schema");
    }),
  );

  it(
    "rule 2: version drift is refused without --force, and proceeds with --force",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }], {
          version: "0.0.1",
        }),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("version-drift");

      const result = await runMerge([changesetPath, "--root", dir, "--force"]);
      expect(result.mode).toBe("merge");
      expect(result.plan.added).toBe(1);
    }),
  );

  it(
    "rule 3: non-STANDARD tuning is refused without --force, and proceeds with --force",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }], {
          tuning: ["D2", "A2", "D3", "G3", "B3", "E4"],
        }),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("tuning-mismatch");

      const result = await runMerge([changesetPath, "--root", dir, "--force"]);
      expect(result.mode).toBe("merge");
    }),
  );

  it(
    "rule 4: a chord shape missing required fields (fingers) is refused",
    withFixtureRoot(async (dir) => {
      const { fingers, ...withoutFingers } = C_SHAPE_MINOR;
      void fingers;
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: withoutFingers }]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("required-fields");
      expect(err.message).toMatch(/fingers/);
    }),
  );

  it(
    "rule 5: an invalid file basename (uppercase) is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "Caged-Chords-Minor", shape: C_SHAPE_MINOR }]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("file-name");
    }),
  );

  it(
    "rule 5: the computed-file deny list refuses even with --force",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "scale", file: "pentatonic-minor", shape: {
          name: "Pentatonic Box 1 Minor Duplicate",
          system: "pentatonic",
          strings: [["1P"], ["1P"], ["1P"], ["1P"], ["1P"], ["1P"]],
          rootString: 0,
        } }]),
      );
      const err1 = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err1.rule).toBe("computed-file-deny-list");
      const err2 = await expectRefusalWithNoWrites(dir, changesetPath, ["--force"]);
      expect(err2.rule).toBe("computed-file-deny-list");
    }),
  );

  it(
    "rule 6: adding a shape whose name already exists in the registry is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          {
            op: "add",
            kind: "chord",
            file: "caged-chords-minor",
            shape: { ...C_SHAPE_MINOR, name: "E Shape Major" },
          },
        ]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("name-unique");
    }),
  );

  it(
    "rule 6: an explicit `ident` colliding with an existing src/data identifier is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          {
            op: "add",
            kind: "chord",
            file: "caged-chords-minor",
            ident: "CAGED_CHORD_E",
            shape: C_SHAPE_MINOR,
          },
        ]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("name-unique");
    }),
  );

  it(
    "rule 6: two adds in the same changeset sharing a name collide with each other",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          { op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR },
          { op: "add", kind: "chord", file: "caged-chords-minor", shape: { ...C_SHAPE_MINOR } },
        ]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("name-unique");
    }),
  );

  it(
    "rule 7: an unresolvable overrides target is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          {
            op: "add",
            kind: "arpeggio",
            file: "arpeggios-test",
            shape: {
              name: "Test Arpeggio Override",
              system: "caged",
              strings: [["1P"], null, null, null, null, null],
              rootString: 0,
              chordType: "m7",
              overrides: "Nonexistent Arpeggio",
            },
          },
        ]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("overrides-target");
    }),
  );

  it(
    "rule 8: an audit ERROR (finger 0 on a movable shape) refuses; warnings alone do not",
    withFixtureRoot(async (dir) => {
      const movableWithOpenString = {
        ...C_SHAPE_MINOR,
        name: "C Shape Minor Bad",
        fingers: [null, 0, 1, 4, 2, null],
      };
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: movableWithOpenString }]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("audit-error");
      expect(err.message).toMatch(/finger-zero-on-movable/);
    }),
  );

  it(
    "rule 8: --force never bypasses an audit error, even alongside version drift",
    withFixtureRoot(async (dir) => {
      const movableWithOpenString = {
        ...C_SHAPE_MINOR,
        name: "C Shape Minor Bad",
        fingers: [null, 0, 1, 4, 2, null],
      };
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: movableWithOpenString }], {
          version: "0.0.1",
        }),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath, ["--force"]);
      expect(err.rule).toBe("audit-error");
    }),
  );

  it(
    "rule 8: --force never bypasses the computed-file deny list, even alongside version drift",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset(
          [
            {
              op: "add",
              kind: "scale",
              file: "caged-scales-minor",
              shape: {
                name: "Duplicate Minor Scale",
                system: "caged",
                strings: [["1P"], ["1P"], ["1P"], ["1P"], ["1P"], ["1P"]],
                rootString: 0,
              },
            },
          ],
          { version: "0.0.1" },
        ),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath, ["--force"]);
      expect(err.rule).toBe("computed-file-deny-list");
    }),
  );

  it(
    "rule 8: audit warnings (no errors) do not refuse the merge",
    withFixtureRoot(async (dir) => {
      // stringset-mismatch is a warning: an explicit stringSet that disagrees
      // with the actually-played strings.
      const withWarning = { ...C_SHAPE_MINOR, stringSet: [0, 1, 2, 3, 4, 5] };
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: withWarning }]),
      );
      const result = await runMerge([changesetPath, "--root", dir]);
      expect(result.mode).toBe("merge");
      expect(result.plan.warnings.some((w) => w.includes("stringset-mismatch"))).toBe(true);
    }),
  );

  it(
    "rule 9: updating a shape that lives in an unmanaged file (open-chords.ts) is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([
          { op: "update", kind: "chord", name: "C Major Open", patch: { tags: ["open"] } },
        ]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("unowned-region");
      expect(err.message).toMatch(/open-chords/);
    }),
  );

  it(
    "rule 9: updating a name that doesn't exist anywhere in src/data is refused",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "update", kind: "chord", name: "Nonexistent Shape Name", patch: { notes: "x" } }]),
      );
      const err = await expectRefusalWithNoWrites(dir, changesetPath);
      expect(err.rule).toBe("unowned-region");
    }),
  );
});

describe("shapes-merge: CLI modes (spec §6.6)", () => {
  it(
    "--dry-run writes nothing (verified by mtime + content hash)",
    withFixtureRoot(async (dir) => {
      const target = realDataFile(dir, "caged-chords-minor"); // doesn't exist yet
      const indexPath = realIndexFile(dir);
      const beforeIndexMtime = statSync(indexPath).mtimeMs;
      const beforeIndexText = readFileSync(indexPath, "utf8");

      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      const result = await runMerge([changesetPath, "--root", dir, "--dry-run"]);
      expect(result.mode).toBe("dry-run");
      expect(existsSync(target)).toBe(false);
      expect(statSync(indexPath).mtimeMs).toBe(beforeIndexMtime);
      expect(readFileSync(indexPath, "utf8")).toBe(beforeIndexText);
    }),
  );

  it(
    "--check reports a diff (exit non-zero) before merging, then reports no-op after merging",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );

      const before = await runMerge([changesetPath, "--root", dir, "--check"]);
      expect(before.mode).toBe("check");
      expect(before.ok).toBe(false);
      expect(existsSync(realDataFile(dir, "caged-chords-minor"))).toBe(false);

      await runMerge([changesetPath, "--root", dir]);

      const after = await runMerge([changesetPath, "--root", dir, "--check"]);
      expect(after.mode).toBe("check");
      expect(after.ok).toBe(true);
    }),
  );

  it(
    "idempotence: re-running an already-merged changeset produces zero file changes",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      await runMerge([changesetPath, "--root", dir]);
      const target = realDataFile(dir, "caged-chords-minor");
      const indexPath = realIndexFile(dir);
      const textAfterFirst = readFileSync(target, "utf8");
      const indexAfterFirst = readFileSync(indexPath, "utf8");
      const mtimeAfterFirst = statSync(target).mtimeMs;

      const second = await runMerge([changesetPath, "--root", dir]);
      expect(second.plan.files.changed()).toHaveLength(0);
      expect(readFileSync(target, "utf8")).toBe(textAfterFirst);
      expect(readFileSync(indexPath, "utf8")).toBe(indexAfterFirst);
      expect(statSync(target).mtimeMs).toBe(mtimeAfterFirst);
    }),
  );

  it(
    "--out <ident> prints the generated TS for one change to stdout and writes nothing",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      const logs = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk) => {
        logs.push(String(chunk));
        return true;
      };
      try {
        await runMerge([changesetPath, "--root", dir, "--out", "CHORD_C_SHAPE_MINOR"]);
      } finally {
        process.stdout.write = originalWrite;
      }
      expect(logs.join("")).toContain("export const CHORD_C_SHAPE_MINOR: ChordShape");
      expect(existsSync(realDataFile(dir, "caged-chords-minor"))).toBe(false);
    }),
  );

  it(
    "--json prints a machine-readable summary with the documented fields",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);
      try {
        await runMerge([changesetPath, "--root", dir, "--json"]);
      } finally {
        console.log = originalLog;
      }
      const summary = JSON.parse(logs.join("\n"));
      expect(summary).toMatchObject({ added: 1, updated: 0, removed: 0 });
      expect(Array.isArray(summary.filesWritten)).toBe(true);
      expect(Array.isArray(summary.warnings)).toBe(true);
      expect(Array.isArray(summary.countsTouched)).toBe(true);
    }),
  );
});

describe("shapes-merge: --update-counts (17.5, spec §6.4)", () => {
  it(
    "default mode reports touched counts without editing any file",
    withFixtureRoot(async (dir) => {
      const scaleShape = {
        name: "Test Scale For Counts",
        system: "custom",
        strings: [["1P"], ["1P"], ["1P"], ["1P"], ["1P"], ["1P"]],
        rootString: 0,
      };
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "scale", file: "test-scale-counts", shape: scaleShape }]),
      );
      const dataTestPath = path.join(dir, "src", "data", "data.test.ts");
      const before = readFileSync(dataTestPath, "utf8");

      const result = await runMerge([changesetPath, "--root", dir]);
      expect(result.plan.countsTouched.some((c) => c.name === "scale-shape-total")).toBe(true);
      // default mode never edits data.test.ts / index.test.ts
      expect(readFileSync(dataTestPath, "utf8")).toBe(before);
    }),
  );

  it(
    "--update-counts rewrites only the annotated, simple-literal count lines it touches",
    withFixtureRoot(async (dir) => {
      const scaleShape = {
        name: "Test Scale For Counts",
        system: "custom",
        strings: [["1P"], ["1P"], ["1P"], ["1P"], ["1P"], ["1P"]],
        rootString: 0,
      };
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "scale", file: "test-scale-counts", shape: scaleShape }]),
      );
      const dataTestPath = path.join(dir, "src", "data", "data.test.ts");
      const before = readFileSync(dataTestPath, "utf8");
      const beforeMarkers = parseCountMarkers(before);

      const result = await runMerge([changesetPath, "--root", dir, "--update-counts"]);
      const after = readFileSync(dataTestPath, "utf8");
      expect(after).not.toBe(before);

      const touchedEditable = result.plan.countsTouched.filter((c) => c.editable && c.file.endsWith("data.test.ts"));
      expect(touchedEditable.length).toBeGreaterThan(0);

      const afterMarkers = parseCountMarkers(after);
      for (const marker of beforeMarkers) {
        const wasTouched = touchedEditable.some((c) => c.name === marker.name);
        const afterMarker = afterMarkers.find((m) => m.name === marker.name);
        if (!wasTouched) {
          // Every unannotated-for-this-changeset (or non-editable) line is
          // byte-identical before/after.
          expect(afterMarker.lineText).toBe(marker.lineText);
        } else {
          expect(afterMarker.lineText).not.toBe(marker.lineText);
        }
      }
    }),
  );
});

// Task 18.3's printer-parity placeholder ("printer parity between
// scripts/lib/render-shape.mjs's output and shape-catalog's renderShapeTs
// re-export") is resolved by `packages/shape-catalog/src/render.test.ts`
// (Task 22.3) — it asserts `renderShapeTs` IS `renderShape` (same function
// reference, since render.ts just re-exports it) and exercises
// byte-identical output for representative chord/scale shapes, an explicit
// `ident` override, and both the prettier and fallback-formatter paths. Not
// duplicated here; the test below instead asserts THIS script's own writes
// go through that same printer unmodified.
describe("shapes-merge: printed output matches the render-shape printer directly (parity)", () => {
  it(
    "the block content shapes-merge writes for an add is exactly renderShape's output (minus trailing newline)",
    withFixtureRoot(async (dir) => {
      const changesetPath = writeChangeset(
        dir,
        baseChangeset([{ op: "add", kind: "chord", file: "caged-chords-minor", shape: C_SHAPE_MINOR }]),
      );
      await runMerge([changesetPath, "--root", dir]);
      const fileText = readFileSync(realDataFile(dir, "caged-chords-minor"), "utf8");
      const block = findOwnedBlock(fileText, "CHORD_C_SHAPE_MINOR");

      const { renderShape } = await import("./lib/render-shape.mjs");
      const rendered = await renderShape("chord", C_SHAPE_MINOR, { ident: "CHORD_C_SHAPE_MINOR" });
      expect(block.content).toBe(rendered.replace(/\n$/, ""));
    }),
  );
});

describe("shapes-merge: CLI arg parsing", () => {
  it("parseArgs recognizes every documented flag", () => {
    const args = parseArgs([
      "changeset.json",
      "--dry-run",
      "--check",
      "--force",
      "--update-counts",
      "--json",
      "--out",
      "IDENT",
      "--root",
      "/tmp/somewhere",
    ]);
    expect(args).toMatchObject({
      changesetPath: "changeset.json",
      dryRun: true,
      check: true,
      force: true,
      updateCounts: true,
      json: true,
      out: "IDENT",
      root: "/tmp/somewhere",
    });
  });

  it("throws UsageError with no changeset path", () => {
    expect(() => parseArgs(["--dry-run"])).toThrow(UsageError);
  });

  it("throws UsageError on an unknown flag", () => {
    expect(() => parseArgs(["changeset.json", "--nope"])).toThrow(UsageError);
  });
});

/**
 * Task Group 18: committed fixtures (spec §6.7/D-008, `scripts/__fixtures__/`).
 * Task Group 17 above already exercises every refusal RULE via ad hoc
 * inline changesets; this section normalizes coverage onto the committed
 * fixture files (18.1) and asserts write-producing fixtures against their
 * committed expected output trees (18.2), so the fixtures are load-bearing
 * test inputs, not just documentation.
 */
describe("shapes-merge: committed fixtures (Task Group 18, spec §6.7/D-008)", () => {
  it(
    "add-new-file.json: creates the generator-owned file + index import, byte-identical to the committed expected tree",
    withFixtureRoot(async (dir) => {
      const result = await runMerge([fixtureChangesetPath("add-new-file.json"), "--root", dir]);
      expect(result.mode).toBe("merge");
      expect(result.plan.added).toBe(1);
      expect(readFileSync(realDataFile(dir, "caged-chords-minor"), "utf8")).toBe(
        readExpectedFile("add-new-file", "src/data/caged-chords-minor.ts"),
      );
      expect(readFileSync(realIndexFile(dir), "utf8")).toBe(readExpectedFile("add-new-file", "src/index.ts"));
    }),
  );

  it(
    "update-owned-block.json: rewrites only the targeted owned block, byte-identical to the committed expected tree",
    withFixtureRoot(async (dir) => {
      const result = await runMerge([fixtureChangesetPath("update-owned-block.json"), "--root", dir]);
      expect(result.plan.updated).toBe(1);
      expect(readFileSync(realDataFile(dir, "caged-chords"), "utf8")).toBe(
        readExpectedFile("update-owned-block", "src/data/caged-chords.ts"),
      );
    }),
  );

  it(
    "remove-setup.json + remove.json: drops one constant from a 2-constant file, byte-identical to the committed expected tree",
    withFixtureRoot(async (dir) => {
      await runMerge([fixtureChangesetPath("remove-setup.json"), "--root", dir]);
      const result = await runMerge([fixtureChangesetPath("remove.json"), "--root", dir]);
      expect(result.plan.removed).toBe(1);
      expect(readFileSync(realDataFile(dir, "caged-chords-minor"), "utf8")).toBe(
        readExpectedFile("remove", "src/data/caged-chords-minor.ts"),
      );
      expect(readFileSync(realIndexFile(dir), "utf8")).toBe(readExpectedFile("remove", "src/index.ts"));
    }),
  );

  it(
    "identifier-collision.json: an explicit ident colliding with an existing src/data identifier is refused",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("identifier-collision.json"));
      expect(err.rule).toBe("name-unique");
    }),
  );

  it(
    "name-collision.json: adding a shape whose name already exists in the registry is refused",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("name-collision.json"));
      expect(err.rule).toBe("name-unique");
    }),
  );

  it(
    "version-drift.json: refused without --force, proceeds with --force",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("version-drift.json"));
      expect(err.rule).toBe("version-drift");
      const result = await runMerge([fixtureChangesetPath("version-drift.json"), "--root", dir, "--force"]);
      expect(result.mode).toBe("merge");
    }),
  );

  it(
    "non-standard-tuning.json: refused without --force, proceeds with --force",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("non-standard-tuning.json"));
      expect(err.rule).toBe("tuning-mismatch");
      const result = await runMerge([fixtureChangesetPath("non-standard-tuning.json"), "--root", dir, "--force"]);
      expect(result.mode).toBe("merge");
    }),
  );

  it(
    "computed-file-refusal.json: refused even with --force",
    withFixtureRoot(async (dir) => {
      const err1 = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("computed-file-refusal.json"));
      expect(err1.rule).toBe("computed-file-deny-list");
      const err2 = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("computed-file-refusal.json"), [
        "--force",
      ]);
      expect(err2.rule).toBe("computed-file-deny-list");
    }),
  );

  it(
    "audit-error-refusal.json: an audit error (finger 0 on a movable shape) refuses the merge",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("audit-error-refusal.json"));
      expect(err.rule).toBe("audit-error");
      expect(err.message).toMatch(/finger-zero-on-movable/);
    }),
  );

  it(
    "unmanaged-file-refusal.json: updating a shape that lives in an unmanaged file (open-chords.ts) is refused",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("unmanaged-file-refusal.json"));
      expect(err.rule).toBe("unowned-region");
      expect(err.message).toMatch(/open-chords/);
    }),
  );
});

/**
 * Layer 7 oversight fix A: `add` targeting an existing UNMANAGED
 * hand-written file (e.g. `file: "open-chords"`) was only exercised for
 * `update`-to-unmanaged before this task group; the `add` path refuses
 * correctly (spec §6.3's write allow-list — a hand-written file that isn't
 * `caged-chords.ts` never gets new constants added to it) but had no
 * dedicated test.
 */
describe("shapes-merge: oversight fix A — add targeting an existing unmanaged file is refused", () => {
  it(
    "add-existing-unmanaged-file.json: adding a new constant to open-chords.ts (hand-written, not generator-created) is refused",
    withFixtureRoot(async (dir) => {
      const err = await expectRefusalWithNoWrites(dir, fixtureChangesetPath("add-existing-unmanaged-file.json"));
      expect(err.rule).toBe("unowned-region");
      expect(err.message).toMatch(/open-chords/);
    }),
  );
});

/**
 * Layer 7 oversight fix B: `computeCountsTouched` under-reported on
 * `remove` — only `chord-shape-total`/`scale-shape-total` were ever
 * considered, so removing e.g. a `featured`/`system`-scoped shape silently
 * failed to report the `featured-*-total`/`*-scale-total` markers it also
 * invalidates (spec §6.4). Fixed by recovering the removed shape's full
 * field set from its owned-block content before the block is dropped — the
 * same way `update`'s base object is recovered — and running every
 * `COUNT_RULES` predicate against it, not just the two kind-only ones.
 */
describe("shapes-merge: oversight fix B — remove reports every annotated count it invalidates", () => {
  it(
    "remove-counts-setup.json + remove-counts.json: removing a featured caged scale reports scale-shape-total, featured-scale-total, AND caged-scale-total (not just scale-shape-total)",
    withFixtureRoot(async (dir) => {
      await runMerge([fixtureChangesetPath("remove-counts-setup.json"), "--root", dir]);
      const result = await runMerge([fixtureChangesetPath("remove-counts.json"), "--root", dir]);

      const byName = new Map(result.plan.countsTouched.map((c) => [c.name, c]));
      for (const name of ["scale-shape-total", "featured-scale-total", "caged-scale-total"]) {
        const entry = byName.get(name);
        expect(entry, `expected countsTouched to report "${name}"`).toBeDefined();
        expect(entry.delta).toBe(-1);
        expect(entry.editable).toBe(true);
      }
      // Not touched: this removed shape isn't a chord, a shell voicing, a
      // 3nps/pentatonic scale, or a featured chord.
      for (const untouched of [
        "chord-shape-total",
        "shell-shape-total",
        "shell-voicing-family-count",
        "featured-chord-total",
        "three-nps-scale-total",
        "pentatonic-scale-total",
      ]) {
        expect(byName.has(untouched)).toBe(false);
      }
    }),
  );
});

/**
 * Layer 7 oversight fix C: an `UpdateChange` whose patch renames the shape
 * (`patch.name`) merged fine on first run, but every SUBSEQUENT run —
 * `--check` included — threw `MergeRefusal("unowned-region")`, because
 * `locateOwnedRegion` looked up the owned block by the change's now-stale
 * `name` (the pre-rename name no longer appears in the file). Fixed by
 * falling back, when that lookup fails on an `update`, to locating the
 * block by its export identifier (stable across renames — fixed at `add`
 * time) and, failing that, by the patch's own new `name` (covers
 * hand-authored files like `caged-chords.ts` whose marker identifiers are
 * shorthands that never matched the generated-formula identifier anyway).
 */
describe("shapes-merge: oversight fix C — a renaming update stays idempotent across re-runs", () => {
  it(
    "update-rename.json: merge -> re-run --check -> exit 0 (no MergeRefusal), matching the committed expected tree",
    withFixtureRoot(async (dir) => {
      await runMerge([fixtureChangesetPath("add-new-file.json"), "--root", dir]);
      const merged = await runMerge([fixtureChangesetPath("update-rename.json"), "--root", dir]);
      expect(merged.plan.updated).toBe(1);
      expect(readFileSync(realDataFile(dir, "caged-chords-minor"), "utf8")).toBe(
        readExpectedFile("update-rename", "src/data/caged-chords-minor.ts"),
      );
      expect(readFileSync(realIndexFile(dir), "utf8")).toBe(readExpectedFile("update-rename", "src/index.ts"));

      // Before the fix: locateOwnedRegion(dataDir, files, "C Shape Minor")
      // finds nothing (the block's `name` field is now "C Shape Minor
      // (Renamed)"), so this --check throws MergeRefusal("unowned-region")
      // instead of detecting the no-op.
      const recheck = await runMerge([fixtureChangesetPath("update-rename.json"), "--root", dir, "--check"]);
      expect(recheck.mode).toBe("check");
      expect(recheck.ok).toBe(true);

      const rerun = await runMerge([fixtureChangesetPath("update-rename.json"), "--root", dir]);
      expect(rerun.plan.files.changed()).toHaveLength(0);
    }),
  );

  it(
    "the ident fallback also resolves a hand-authored file's shorthand marker (CAGED_CHORD_A) via the patch's new name — its identifier never matched the generated formula in the first place",
    withFixtureRoot(async (dir) => {
      const renamePatch = baseChangeset([
        { op: "update", kind: "chord", name: "A Shape Major", patch: { name: "A Shape Major (CAGED)" } },
      ]);
      const changesetPath = writeChangeset(dir, renamePatch, "hand-authored-rename.json");

      await runMerge([changesetPath, "--root", dir]);
      expect(readFileSync(realDataFile(dir, "caged-chords"), "utf8")).toContain('name: "A Shape Major (CAGED)"');

      const recheck = await runMerge([changesetPath, "--root", dir, "--check"]);
      expect(recheck.mode).toBe("check");
      expect(recheck.ok).toBe(true);
    }),
  );
});

/**
 * Task 18.4: every fixture test above runs against a `--root`-isolated temp
 * copy — this is the suite-wide proof that none of them ever fell through
 * to the real checkout. Placed last in this file (vitest runs `it`s within
 * one file in declaration order) so it validates against the baseline
 * captured at module load, after the full fixture suite above has run.
 */
describe("shapes-merge: real checkout provably untouched by the full fixture suite (18.4)", () => {
  it("src/data/caged-chords.ts mtime + content hash are unchanged after every test in this file has run", () => {
    expect(statSync(REAL_CAGED_CHORDS_ABS_PATH).mtimeMs).toBe(realCagedChordsBaselineMtimeMs);
    const hash = createHash("sha256").update(readFileSync(REAL_CAGED_CHORDS_ABS_PATH)).digest("hex");
    expect(hash).toBe(realCagedChordsBaselineHash);
  });
});
