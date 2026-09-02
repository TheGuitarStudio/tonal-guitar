/**
 * Task 22.1/22.4: `draftToChange` add-vs-update construction, and
 * `buildChangeset` envelope + collision detection (including
 * `exportIdentifierFor`).
 */
import { describe, expect, it } from "vitest";
import type { ChangesetChange, ChordShape } from "tonal-guitar";
import { buildChangeset, draftToChange } from "./changeset";
import type { DraftShape } from "./changeset";

const A_SHAPE_MAJOR: ChordShape = {
  name: "A Shape Major",
  system: "caged",
  strings: [null, "1P", "5P", "1P", "3M", "5P"],
  fingers: [null, 1, 3, 3, 3, 1],
  barres: [
    { fret: 0, fromString: 1, toString: 5, finger: 1 },
    { fret: 2, fromString: 2, toString: 4, finger: 3 },
  ],
  rootString: 1,
};

describe("draftToChange — gap origin (AddChange)", () => {
  it("produces an AddChange carrying the drafted shape and target file", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "gap",
      shape: {
        name: "D Shape Minor",
        system: "caged",
        strings: [null, null, "1P", "5P", "b3m", null],
        fingers: [null, null, 1, 3, 2, null],
        barres: [],
        rootString: 2,
        chordType: "m",
        cagedPosition: "D",
      },
      file: "caged-chords-minor",
    };
    const change = draftToChange(draft);
    expect(change).toEqual<ChangesetChange>({
      op: "add",
      kind: "chord",
      file: "caged-chords-minor",
      shape: draft.shape,
    });
  });

  it("carries through an explicit `ident` override and `after` anchor", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "gap",
      shape: { ...A_SHAPE_MAJOR, name: "A Shape Minor" },
      file: "caged-chords-minor",
      ident: "CAGED_CHORD_AM",
      after: "caged-chords",
    };
    const change = draftToChange(draft);
    expect(change).toMatchObject({ ident: "CAGED_CHORD_AM", after: "caged-chords" });
  });

  it("throws when a gap-origin draft has no target file", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "gap",
      shape: { ...A_SHAPE_MAJOR, name: "New Shape" },
    };
    expect(() => draftToChange(draft)).toThrow(/must set `file`/);
  });
});

describe("draftToChange — existing origin (UpdateChange), the §4.4 metadata-backfill path", () => {
  it("emits an UpdateChange whose patch is exactly the fields that changed", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "existing",
      original: A_SHAPE_MAJOR,
      shape: {
        ...A_SHAPE_MAJOR,
        chordType: "M",
        voicingFamily: "caged",
        cagedPosition: "A",
      },
    };
    const change = draftToChange(draft);
    expect(change).toEqual<ChangesetChange>({
      op: "update",
      kind: "chord",
      name: "A Shape Major",
      patch: { chordType: "M", voicingFamily: "caged", cagedPosition: "A" },
    });
  });

  it("keys the UpdateChange by the original name even if the draft shape was renamed", () => {
    const draft: DraftShape = {
      kind: "chord",
      origin: "existing",
      original: A_SHAPE_MAJOR,
      shape: { ...A_SHAPE_MAJOR, name: "A Shape Major (Renamed)" },
    };
    const change = draftToChange(draft);
    expect(change).toMatchObject({ op: "update", name: "A Shape Major" });
    expect((change as { patch: Record<string, unknown> }).patch).toEqual({
      name: "A Shape Major (Renamed)",
    });
  });

  it("throws when an existing-origin draft has no `original` snapshot", () => {
    const draft: DraftShape = { kind: "chord", origin: "existing", shape: A_SHAPE_MAJOR };
    expect(() => draftToChange(draft)).toThrow(/must carry `original`/);
  });
});

describe("buildChangeset — envelope construction", () => {
  it("wraps changes with the schema envelope, omitting unset optional fields", () => {
    const changes: ChangesetChange[] = [
      { op: "update", kind: "chord", name: "A Shape Major", patch: { chordType: "M" } },
    ];
    const result = buildChangeset({ version: "0.2.0", tuning: ["E2", "A2"], changes });
    expect(result.changeset).toEqual({
      $schema: "tonal-guitar/changeset@1",
      version: "0.2.0",
      tuning: ["E2", "A2"],
      changes,
    });
  });

  it("includes generator/createdAt when supplied", () => {
    const result = buildChangeset({
      version: "0.2.0",
      tuning: ["E2"],
      changes: [],
      generator: "shape-workbench@0.1.0",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.changeset.generator).toBe("shape-workbench@0.1.0");
    expect(result.changeset.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("buildChangeset — collision detection", () => {
  it("reports no collisions for a name/identifier that isn't registered anywhere", () => {
    const changes: ChangesetChange[] = [
      {
        op: "add",
        kind: "chord",
        file: "caged-chords-minor",
        shape: { ...A_SHAPE_MAJOR, name: "Totally Novel Shape Name" },
      },
    ];
    const result = buildChangeset({ version: "0.2.0", tuning: ["E2"], changes });
    expect(result.collisions).toEqual([]);
  });

  it("flags a name collision against an already-registered live shape (name AND its identifier both collide)", () => {
    const changes: ChangesetChange[] = [
      { op: "add", kind: "chord", file: "caged-chords-minor", shape: { ...A_SHAPE_MAJOR } },
    ];
    const result = buildChangeset({ version: "0.2.0", tuning: ["E2"], changes });
    // An exact duplicate of a registered shape collides on BOTH its name
    // and its derived export identifier — checkNameUnique reports both.
    expect(result.collisions.map((c) => c.reason).sort()).toEqual(["identifier", "name"]);
  });

  it("flags a name collision between two `add` changes in the same batch", () => {
    const changes: ChangesetChange[] = [
      {
        op: "add",
        kind: "chord",
        file: "caged-chords-minor",
        shape: { ...A_SHAPE_MAJOR, name: "Duplicate Draft Name" },
      },
      {
        op: "add",
        kind: "chord",
        file: "caged-chords-minor",
        shape: { ...A_SHAPE_MAJOR, name: "Duplicate Draft Name" },
      },
    ];
    const result = buildChangeset({ version: "0.2.0", tuning: ["E2"], changes });
    // Same identical-name case as above, but within-batch: name AND
    // identifier both collide against the first change.
    expect(result.collisions.map((c) => c.reason).sort()).toEqual(["identifier", "name"]);
  });

  it("flags an export-identifier collision even when names differ", () => {
    // "A Shape, Minor" and "A Shape Minor" slugify to the same identifier
    // (CHORD_A_SHAPE_MINOR) via exportIdentifierFor's punctuation collapse.
    const changes: ChangesetChange[] = [
      {
        op: "add",
        kind: "chord",
        file: "caged-chords-minor",
        shape: { ...A_SHAPE_MAJOR, name: "A Shape Minor" },
      },
      {
        op: "add",
        kind: "chord",
        file: "caged-chords-minor",
        shape: { ...A_SHAPE_MAJOR, name: "A Shape, Minor" },
      },
    ];
    const result = buildChangeset({ version: "0.2.0", tuning: ["E2"], changes });
    expect(result.collisions.some((c) => c.reason === "identifier")).toBe(true);
  });

  it("ignores update/remove changes for collision purposes", () => {
    const changes: ChangesetChange[] = [
      { op: "update", kind: "chord", name: "A Shape Major", patch: { tags: ["core"] } },
      { op: "remove", kind: "chord", name: "A Shape Major" },
    ];
    const result = buildChangeset({ version: "0.2.0", tuning: ["E2"], changes });
    expect(result.collisions).toEqual([]);
  });
});
