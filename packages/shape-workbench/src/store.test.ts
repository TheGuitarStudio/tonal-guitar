import { describe, expect, it } from "vitest";
import type { AddChange, ChordShape } from "tonal-guitar";
import { STANDARD } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import {
  WORKBENCH_STORAGE_KEY,
  initialWorkbenchState,
  loadPersistedState,
  persistState,
  workbenchReducer,
  type WorkbenchState,
  type WorkbenchStorage,
} from "./store";

function emptyChordShape(name: string): ChordShape {
  return {
    name,
    system: "caged",
    strings: [null, null, null, null, null, null],
    fingers: [null, null, null, null, null, null],
    barres: [],
    rootString: 0,
  };
}

function gapDraft(name: string): DraftShape {
  return { kind: "chord", origin: "gap", shape: emptyChordShape(name) };
}

function addChangeFor(name: string): AddChange {
  return { op: "add", kind: "chord", file: "caged-chords", shape: emptyChordShape(name) };
}

/** In-memory `WorkbenchStorage` — a plain object, no DOM/jsdom required. */
function createMemoryStorage(): WorkbenchStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("initialWorkbenchState", () => {
  it("matches spec §5.4's defaults", () => {
    expect(initialWorkbenchState).toEqual({
      tuning: STANDARD,
      authorRoot: "A",
      orientation: "vertical",
      columnAxis: "cagedPosition",
      drafts: {},
      changes: [],
      changeKeys: [],
    });
  });
});

describe("workbenchReducer", () => {
  it("SET_DRAFT keys a draft by an arbitrary slotKey (rowKey::columnKey shape)", () => {
    const state = workbenchReducer(initialWorkbenchState, {
      type: "SET_DRAFT",
      key: "m7::C",
      draft: gapDraft(""),
    });
    expect(Object.keys(state.drafts)).toEqual(["m7::C"]);
    expect(state.drafts["m7::C"]).toEqual(gapDraft(""));
    // Reducer must not mutate its input.
    expect(initialWorkbenchState.drafts).toEqual({});
  });

  it("SET_DRAFT keys a draft by a registered shape name", () => {
    const state = workbenchReducer(initialWorkbenchState, {
      type: "SET_DRAFT",
      key: "A Shape Major",
      draft: gapDraft("A Shape Major"),
    });
    expect(state.drafts["A Shape Major"].shape.name).toBe("A Shape Major");
  });

  it("SET_DRAFT on an existing key overwrites just that entry", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "SET_DRAFT",
      key: "m7::C",
      draft: gapDraft("first"),
    });
    state = workbenchReducer(state, {
      type: "SET_DRAFT",
      key: "other::D",
      draft: gapDraft("second"),
    });
    state = workbenchReducer(state, {
      type: "SET_DRAFT",
      key: "m7::C",
      draft: gapDraft("first-updated"),
    });
    expect(state.drafts["m7::C"].shape.name).toBe("first-updated");
    expect(state.drafts["other::D"].shape.name).toBe("second");
  });

  it("REMOVE_DRAFT deletes only the targeted key", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "SET_DRAFT",
      key: "m7::C",
      draft: gapDraft("keep"),
    });
    state = workbenchReducer(state, { type: "SET_DRAFT", key: "gone::D", draft: gapDraft("gone") });
    state = workbenchReducer(state, { type: "REMOVE_DRAFT", key: "gone::D" });
    expect(Object.keys(state.drafts)).toEqual(["m7::C"]);
  });

  it("REMOVE_DRAFT is a no-op for an unknown key", () => {
    const state = workbenchReducer(initialWorkbenchState, { type: "REMOVE_DRAFT", key: "nope" });
    expect(state).toBe(initialWorkbenchState);
  });

  it("ADD_CHANGE accumulates changes in order", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("A Shape Major"),
      sourceKey: "slot-a",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("D Shape Major"),
      sourceKey: "slot-d",
    });
    expect(state.changes.map((c) => (c as AddChange).shape.name)).toEqual([
      "A Shape Major",
      "D Shape Major",
    ]);
    expect(initialWorkbenchState.changes).toEqual([]);
  });

  it("ADD_CHANGE replaces an existing change from the SAME draft (sourceKey) instead of appending a duplicate (CR-059)", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("A Shape Major"),
      sourceKey: "slot-a",
    });
    const updated: AddChange = { ...addChangeFor("A Shape Major"), file: "caged-chords-updated" };
    state = workbenchReducer(state, { type: "ADD_CHANGE", change: updated, sourceKey: "slot-a" });

    expect(state.changes).toHaveLength(1);
    expect((state.changes[0] as AddChange).file).toBe("caged-chords-updated");
  });

  it("ADD_CHANGE replaces the same draft's earlier add even after a rename, keyed by the stable sourceKey, not the shape name (CR-113)", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("Original Name"),
      sourceKey: "slot-a",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("Renamed"),
      sourceKey: "slot-a",
    });
    expect(state.changes).toHaveLength(1);
    expect((state.changes[0] as AddChange).shape.name).toBe("Renamed");
  });

  it("ADD_CHANGE keeps two DISTINCT drafts (different sourceKeys) that save shapes sharing a name — detectCollisions needs both present (CR-112)", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("Dup Name"),
      sourceKey: "slot-1",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("Dup Name"),
      sourceKey: "slot-2",
    });
    expect(state.changes).toHaveLength(2);
    expect(state.changes.every((c) => (c as AddChange).shape.name === "Dup Name")).toBe(true);
  });

  it("ADD_CHANGE for an add never collides with an update/remove targeting the same name (CR-112)", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: { op: "update", kind: "chord", name: "Shared Name", patch: {} },
      sourceKey: "Shared Name",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("Shared Name"),
      sourceKey: "gap-slot",
    });
    expect(state.changes).toHaveLength(2);
  });

  it("ADD_CHANGE dedups an update against an earlier update for the same name (kept keyed by op+name, CR-112)", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: { op: "update", kind: "chord", name: "Shared Name", patch: { chordType: "m" } },
      sourceKey: "Shared Name",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: { op: "update", kind: "chord", name: "Shared Name", patch: { chordType: "maj" } },
      sourceKey: "Shared Name",
    });
    expect(state.changes).toEqual([{ op: "update", kind: "chord", name: "Shared Name", patch: { chordType: "maj" } }]);
  });

  it("ADD_CHANGE does NOT dedup an update against a remove for the same name — op is part of the key (CR-112)", () => {
    // Neither op currently reaches ADD_CHANGE from this package's own UI
    // (`draftToChange` only ever emits "add"/"update"), so this is
    // exercising the reducer's dedup key directly per the CR-112 spec:
    // `update::<name>` and `remove::<name>` are deliberately distinct keys,
    // unlike the pre-fix `kind::name` key that collapsed them together.
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: { op: "update", kind: "chord", name: "Shared Name", patch: {} },
      sourceKey: "Shared Name",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: { op: "remove", kind: "chord", name: "Shared Name" },
      sourceKey: "Shared Name",
    });
    expect(state.changes).toHaveLength(2);
  });

  it("REMOVE_CHANGE deletes only the targeted index", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("A Shape Major"),
      sourceKey: "slot-a",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("D Shape Major"),
      sourceKey: "slot-d",
    });
    state = workbenchReducer(state, { type: "REMOVE_CHANGE", index: 0 });
    expect(state.changes.map((c) => (c as AddChange).shape.name)).toEqual(["D Shape Major"]);
  });

  it("REMOVE_CHANGE keeps changeKeys in lockstep with changes (so a later ADD_CHANGE dedups correctly)", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("A Shape Major"),
      sourceKey: "slot-a",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("D Shape Major"),
      sourceKey: "slot-d",
    });
    state = workbenchReducer(state, { type: "REMOVE_CHANGE", index: 0 });
    expect(state.changeKeys).toEqual(["add::slot-d"]);
  });

  it("REMOVE_CHANGE is a no-op for an out-of-range index", () => {
    const state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("A Shape Major"),
      sourceKey: "slot-a",
    });
    const next = workbenchReducer(state, { type: "REMOVE_CHANGE", index: 5 });
    expect(next).toBe(state);
  });

  it("CLEAR_CHANGES empties the changeset", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "ADD_CHANGE",
      change: addChangeFor("A Shape Major"),
      sourceKey: "slot-a",
    });
    state = workbenchReducer(state, {
      type: "ADD_CHANGE",
      change: addChangeFor("D Shape Major"),
      sourceKey: "slot-d",
    });
    state = workbenchReducer(state, { type: "CLEAR_CHANGES" });
    expect(state.changes).toEqual([]);
    expect(state.changeKeys).toEqual([]);
  });

  it("CLEAR_CHANGES is a no-op (same reference) when already empty", () => {
    const next = workbenchReducer(initialWorkbenchState, { type: "CLEAR_CHANGES" });
    expect(next).toBe(initialWorkbenchState);
  });

  it("SET_LAST_WRITTEN_AT records the write timestamp", () => {
    const state = workbenchReducer(initialWorkbenchState, {
      type: "SET_LAST_WRITTEN_AT",
      timestamp: "2026-09-01T00:00:00.000Z",
    });
    expect(state.lastWrittenAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("SET_ORIENTATION / SET_COLUMN_AXIS / SET_AUTHOR_ROOT update their single field", () => {
    let state = workbenchReducer(initialWorkbenchState, {
      type: "SET_ORIENTATION",
      orientation: "horizontal",
    });
    state = workbenchReducer(state, { type: "SET_COLUMN_AXIS", axis: "stringSet" });
    state = workbenchReducer(state, { type: "SET_AUTHOR_ROOT", root: "C" });
    expect(state.orientation).toBe("horizontal");
    expect(state.columnAxis).toBe("stringSet");
    expect(state.authorRoot).toBe("C");
  });

  it("tuning stays locked to STANDARD across every action (no reducer case mutates it)", () => {
    const state = workbenchReducer(initialWorkbenchState, {
      type: "SET_DRAFT",
      key: "x",
      draft: gapDraft("x"),
    });
    expect(state.tuning).toEqual(STANDARD);
  });
});

describe("loadPersistedState", () => {
  it("returns the initial state when storage is undefined", () => {
    expect(loadPersistedState(undefined)).toEqual(initialWorkbenchState);
  });

  it("returns the initial state when nothing has been persisted yet", () => {
    expect(loadPersistedState(createMemoryStorage())).toEqual(initialWorkbenchState);
  });

  it("returns the initial state when the persisted value is corrupt JSON", () => {
    const storage = createMemoryStorage();
    storage.data.set(WORKBENCH_STORAGE_KEY, "{not json");
    expect(loadPersistedState(storage)).toEqual(initialWorkbenchState);
  });

  it("restores a previously persisted state", () => {
    const storage = createMemoryStorage();
    const persisted: WorkbenchState = {
      ...initialWorkbenchState,
      authorRoot: "E",
      drafts: { "m7::C": gapDraft("draft-shape") },
    };
    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify(persisted));
    expect(loadPersistedState(storage)).toEqual(persisted);
  });

  it("forces tuning back to STANDARD even if a stale persisted value differs", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, tuning: ["D2", "A2", "D3", "G3", "B3", "E4"] }),
    );
    expect(loadPersistedState(storage).tuning).toEqual(STANDARD);
  });

  it("falls back to {} for drafts when the persisted value is an array, not a plain object (CR-105)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, drafts: ["not", "an", "object"] }),
    );
    expect(loadPersistedState(storage).drafts).toEqual({});
  });

  it("falls back to {} for drafts when the persisted value is null (CR-105)", () => {
    const storage = createMemoryStorage();
    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify({ ...initialWorkbenchState, drafts: null }));
    expect(loadPersistedState(storage).drafts).toEqual({});
  });

  it("falls back to [] for changes when the persisted value is not an array (CR-105)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, changes: { hostile: true } }),
    );
    expect(loadPersistedState(storage).changes).toEqual([]);
  });

  it("falls back to [] for changes when any entry is not an object (CR-105)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({
        ...initialWorkbenchState,
        changes: [addChangeFor("A Shape Major"), "not an object", 42],
      }),
    );
    expect(loadPersistedState(storage).changes).toEqual([]);
  });

  it("falls back to the initial authorRoot when the persisted value isn't a string (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify({ ...initialWorkbenchState, authorRoot: 42 }));
    expect(loadPersistedState(storage).authorRoot).toBe("A");
  });

  it("falls back to the initial orientation when the persisted value isn't a legal Orientation (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, orientation: "sideways" }),
    );
    expect(loadPersistedState(storage).orientation).toBe("vertical");
  });

  it("falls back to the initial columnAxis when the persisted value isn't a legal ColumnAxis (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify({ ...initialWorkbenchState, columnAxis: "hostile" }));
    expect(loadPersistedState(storage).columnAxis).toBe("cagedPosition");
  });

  it("drops a non-string lastWrittenAt rather than carrying it through (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify({ ...initialWorkbenchState, lastWrittenAt: 12345 }));
    expect(loadPersistedState(storage).lastWrittenAt).toBeUndefined();
  });

  it("keeps a valid string lastWrittenAt (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, lastWrittenAt: "2026-01-01T00:00:00.000Z" }),
    );
    expect(loadPersistedState(storage).lastWrittenAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("drops a null draft entry rather than crashing downstream matchers (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, drafts: { "m7::C": null } }),
    );
    expect(loadPersistedState(storage).drafts).toEqual({});
  });

  it("drops a draft entry missing `shape`, keeping other valid entries (CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({
        ...initialWorkbenchState,
        drafts: {
          "bad::slot": { kind: "chord", origin: "gap" },
          "good::slot": gapDraft("kept"),
        },
      }),
    );
    const drafts = loadPersistedState(storage).drafts;
    expect(Object.keys(drafts)).toEqual(["good::slot"]);
    expect(drafts["good::slot"].shape.name).toBe("kept");
  });

  it("drops a malformed rawGeometry but keeps the draft itself (CR-122)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({
        ...initialWorkbenchState,
        drafts: {
          "m7::C": { ...gapDraft("kept"), rawGeometry: { cells: "oops", barres: [] } },
        },
      }),
    );
    const drafts = loadPersistedState(storage).drafts;
    expect(Object.keys(drafts)).toEqual(["m7::C"]);
    expect(drafts["m7::C"].shape.name).toBe("kept");
    expect(drafts["m7::C"].rawGeometry).toBeUndefined();
  });

  it("keeps a well-formed rawGeometry (CR-122)", () => {
    const storage = createMemoryStorage();
    const rawGeometry = { cells: [{ string: 2, fret: 3 }], barres: [] };
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({
        ...initialWorkbenchState,
        drafts: { "m7::C": { ...gapDraft("kept"), rawGeometry } },
      }),
    );
    expect(loadPersistedState(storage).drafts["m7::C"].rawGeometry).toEqual(rawGeometry);
  });

  it("regenerates changeKeys from change content when the persisted value is missing/wrong-length (CR-112/CR-119)", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      WORKBENCH_STORAGE_KEY,
      JSON.stringify({ ...initialWorkbenchState, changes: [addChangeFor("A Shape Major")] }),
    );
    expect(loadPersistedState(storage).changeKeys).toEqual(["add::A Shape Major"]);
  });

  it("falls back to the initial state entirely when the persisted JSON top-level value isn't a plain object (CR-105)", () => {
    const storage = createMemoryStorage();

    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify(["a", "malicious", "array"]));
    expect(loadPersistedState(storage)).toEqual(initialWorkbenchState);

    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify("just a string"));
    expect(loadPersistedState(storage)).toEqual(initialWorkbenchState);

    storage.data.set(WORKBENCH_STORAGE_KEY, JSON.stringify(42));
    expect(loadPersistedState(storage)).toEqual(initialWorkbenchState);
  });
});

describe("persistState", () => {
  it("does nothing when storage is undefined", () => {
    expect(() => persistState(initialWorkbenchState, undefined)).not.toThrow();
  });

  it("swallows a setItem failure rather than throwing", () => {
    const storage: WorkbenchStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(() => persistState(initialWorkbenchState, storage)).not.toThrow();
  });

  it("writes the state under WORKBENCH_STORAGE_KEY as JSON", () => {
    const storage = createMemoryStorage();
    persistState(initialWorkbenchState, storage);
    expect(JSON.parse(storage.data.get(WORKBENCH_STORAGE_KEY)!)).toEqual(initialWorkbenchState);
  });

  it("persists on every change when driven through a reduce/persist sequence", () => {
    const storage = createMemoryStorage();
    let state = initialWorkbenchState;
    persistState(state, storage);
    expect(JSON.parse(storage.data.get(WORKBENCH_STORAGE_KEY)!).drafts).toEqual({});

    state = workbenchReducer(state, { type: "SET_DRAFT", key: "m7::C", draft: gapDraft("one") });
    persistState(state, storage);
    expect(Object.keys(JSON.parse(storage.data.get(WORKBENCH_STORAGE_KEY)!).drafts)).toEqual(["m7::C"]);

    state = workbenchReducer(state, { type: "ADD_CHANGE", change: addChangeFor("one"), sourceKey: "m7::C" });
    persistState(state, storage);
    expect(JSON.parse(storage.data.get(WORKBENCH_STORAGE_KEY)!).changes).toHaveLength(1);

    state = workbenchReducer(state, { type: "SET_LAST_WRITTEN_AT", timestamp: "t" });
    persistState(state, storage);
    expect(JSON.parse(storage.data.get(WORKBENCH_STORAGE_KEY)!).lastWrittenAt).toBe("t");
  });
});
