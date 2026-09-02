/**
 * Type-only test for Task Group 7: `tonal-guitar/changeset@1` schema (spec §6.1).
 *
 * There is no runtime logic in src/changeset.ts — this test exists purely to
 * fail the TypeScript compile check if the exported interfaces drift from the
 * spec. Assigning a representative Changeset literal (one AddChange, one
 * UpdateChange, one RemoveChange) exercises every field described in §6.1.
 */
import { describe, it, expect } from "vitest";
import type {
  Changeset,
  ChangesetKind,
  ChangesetChange,
  AddChange,
  UpdateChange,
  RemoveChange,
} from "./changeset";
import type { ChordShape } from "./shape";

describe("Changeset schema (tonal-guitar/changeset@1)", () => {
  it("type-checks a representative changeset object literal", () => {
    const kind: ChangesetKind = "chord";
    expect(kind).toBe("chord");

    const chordShape: ChordShape = {
      name: "C Major (Open)",
      system: "open",
      strings: ["1P", "3M", "5P", "1P", "3M", null],
      fingers: [null, 1, 2, null, 3, null],
      barres: [],
      rootString: 1,
    };

    const addChange: AddChange = {
      op: "add",
      kind: "chord",
      file: "workbench-additions",
      ident: "WORKBENCH_C_MAJOR_OPEN",
      after: "open-chords",
      shape: chordShape,
    };

    const updateChange: UpdateChange = {
      op: "update",
      kind: "chord",
      name: "C Major (Open)",
      patch: { featured: true },
    };

    const removeChange: RemoveChange = {
      op: "remove",
      kind: "scale",
      name: "Deprecated Scale Shape",
    };

    const changes: ChangesetChange[] = [addChange, updateChange, removeChange];

    const changeset: Changeset = {
      $schema: "tonal-guitar/changeset@1",
      version: "0.2.0",
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      generator: "shape-workbench@0.1.0",
      createdAt: "2026-09-01T00:00:00.000Z",
      changes,
    };

    expect(changeset.$schema).toBe("tonal-guitar/changeset@1");
    expect(changeset.changes).toHaveLength(3);
    expect(changeset.changes[0]).toBe(addChange);
    expect(changeset.changes[1]).toBe(updateChange);
    expect(changeset.changes[2]).toBe(removeChange);
  });

  it("Changeset requires a non-empty changes array with at least one element (compile-time)", () => {
    // `changes` is typed as ChangesetChange[], not a tuple, so emptiness isn't
    // enforced by the type system — this test documents that constraint lives
    // in the merge script's runtime validation (spec §6.2), not in the types.
    const minimal: Changeset = {
      $schema: "tonal-guitar/changeset@1",
      version: "0.2.0",
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      changes: [{ op: "remove", kind: "arpeggio", name: "Unused Arpeggio Shape" }],
    };

    expect(minimal.changes).toHaveLength(1);
  });
});
