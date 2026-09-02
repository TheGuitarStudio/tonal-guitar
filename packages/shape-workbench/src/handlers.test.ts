import { describe, expect, it } from "vitest";
import { auditAllShapes } from "tonal-guitar";
import type { AddChange, CagedPosition } from "tonal-guitar";
import { buildCatalog, type ChordCatalogEntry, type ChordSlot, type ShapeCatalogEntry } from "shape-catalog";
import { createEditCapabilities, slotKeyFor, type HandlerDeps } from "./handlers";
import { initialWorkbenchState, type WorkbenchAction, type WorkbenchState } from "./store";
import type { Route } from "./router";

const catalog: ShapeCatalogEntry[] = buildCatalog(auditAllShapes());
const chordEntry: ChordCatalogEntry = catalog.find(
  (entry): entry is ChordCatalogEntry => entry.kind === "chord",
)!;

function harness(state: WorkbenchState = initialWorkbenchState) {
  const dispatched: WorkbenchAction[] = [];
  const navigated: Route[] = [];
  const deps: HandlerDeps = {
    state,
    dispatch: (action) => dispatched.push(action),
    navigate: (route) => navigated.push(route),
  };
  return { deps, dispatched, navigated };
}

const gapChordSlot: ChordSlot = {
  kind: "chord",
  rowGrouping: "chordType",
  rowKey: "m7",
  axis: "cagedPosition",
  columnKey: "C",
  chordType: "m7",
  cagedPosition: "C",
};

describe("slotKeyFor", () => {
  it("keys a ChordSlot as rowKey::columnKey", () => {
    expect(slotKeyFor(gapChordSlot)).toBe("m7::C");
  });
});

describe("createEditCapabilities", () => {
  it("onCreateShape seeds a gap-origin draft prefilled from the slot and navigates to the editor", () => {
    const { deps, dispatched, navigated } = harness();
    createEditCapabilities(deps).onCreateShape!(gapChordSlot);

    expect(dispatched).toHaveLength(1);
    const action = dispatched[0];
    expect(action.type).toBe("SET_DRAFT");
    if (action.type !== "SET_DRAFT") throw new Error("unreachable");
    expect(action.key).toBe("m7::C");
    expect(action.draft.origin).toBe("gap");
    expect(action.draft.kind).toBe("chord");
    expect(action.draft.shape.chordType).toBe("m7");
    expect(action.draft.shape.cagedPosition).toBe("C");
    expect(action.draft.shape.strings).toHaveLength(initialWorkbenchState.tuning.length);

    expect(navigated).toEqual([{ type: "editor", id: "m7::C" }]);
  });

  it("onEditShape seeds an existing-origin draft keyed by the shape name and navigates to the editor", () => {
    const { deps, dispatched, navigated } = harness();
    createEditCapabilities(deps).onEditShape!(chordEntry);

    expect(dispatched).toHaveLength(1);
    const action = dispatched[0];
    if (action.type !== "SET_DRAFT") throw new Error("unreachable");
    expect(action.key).toBe(chordEntry.shape.name);
    expect(action.draft.origin).toBe("existing");
    expect(action.draft.shape).toEqual(chordEntry.shape);
    expect(action.draft.original).toEqual(chordEntry.shape);
    // Must not alias the registered shape object (so editor mutation can't
    // corrupt the live registry entry).
    expect(action.draft.shape).not.toBe(chordEntry.shape);

    expect(navigated).toEqual([{ type: "editor", id: chordEntry.shape.name }]);
  });

  it("onDuplicateToPosition seeds a gap-origin draft at the target position and navigates to the editor", () => {
    const { deps, dispatched, navigated } = harness();
    const position: CagedPosition = "G";
    createEditCapabilities(deps).onDuplicateToPosition!(chordEntry, position);

    expect(dispatched).toHaveLength(1);
    const action = dispatched[0];
    if (action.type !== "SET_DRAFT") throw new Error("unreachable");
    expect(action.draft.origin).toBe("gap");
    expect(action.draft.shape.cagedPosition).toBe("G");
    expect(action.draft.shape.name).toBe("");
    const expectedKey = `${chordEntry.shape.chordType ?? chordEntry.shape.name}::G`;
    expect(action.key).toBe(expectedKey);
    expect(navigated).toEqual([{ type: "editor", id: expectedKey }]);
  });

  it("onAddTag seeds/updates an existing-origin draft with the tag appended, without navigating", () => {
    const { deps, dispatched, navigated } = harness();
    createEditCapabilities(deps).onAddTag!(chordEntry, "beginner");

    expect(dispatched).toHaveLength(1);
    const action = dispatched[0];
    if (action.type !== "SET_DRAFT") throw new Error("unreachable");
    expect(action.key).toBe(chordEntry.shape.name);
    expect(action.draft.shape.tags).toContain("beginner");
    expect(navigated).toEqual([]);
  });

  it("onAddTag does not duplicate a tag that's already present", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      drafts: {
        [chordEntry.shape.name]: {
          kind: "chord",
          origin: "existing",
          shape: { ...chordEntry.shape, tags: ["beginner"] },
          original: chordEntry.shape,
        },
      },
    };
    const { deps, dispatched } = harness(state);
    createEditCapabilities(deps).onAddTag!(chordEntry, "beginner");
    const action = dispatched[0];
    if (action.type !== "SET_DRAFT") throw new Error("unreachable");
    expect(action.draft.shape.tags).toEqual(["beginner"]);
  });

  it("draftFor returns undefined when no draft exists for the key", () => {
    const { deps } = harness();
    expect(createEditCapabilities(deps).draftFor!("nope")).toBeUndefined();
  });

  it("draftFor reports status 'draft' when the draft has no matching changeset entry", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      drafts: {
        "m7::C": { kind: "chord", origin: "gap", shape: { ...chordEntry.shape, name: "New Shape" } },
      },
    };
    const { deps } = harness(state);
    expect(createEditCapabilities(deps).draftFor!("m7::C")).toEqual({
      label: "New Shape",
      status: "draft",
    });
  });

  it("draftFor reports status 'in-changeset' once a matching change has been recorded", () => {
    const addChange: AddChange = {
      op: "add",
      kind: "chord",
      file: "caged-chords",
      shape: { ...chordEntry.shape, name: "New Shape" },
    };
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      drafts: {
        "m7::C": { kind: "chord", origin: "gap", shape: { ...chordEntry.shape, name: "New Shape" } },
      },
      changes: [addChange],
    };
    const { deps } = harness(state);
    expect(createEditCapabilities(deps).draftFor!("m7::C")).toEqual({
      label: "New Shape",
      status: "in-changeset",
    });
  });

  it("exportState reports the live pending count and onExport navigates to #/export", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      changes: [
        { op: "remove", kind: "chord", name: "x" },
        { op: "remove", kind: "chord", name: "y" },
      ],
    };
    const { deps, navigated } = harness(state);
    const capabilities = createEditCapabilities(deps);
    expect(capabilities.exportState!.pendingCount).toBe(2);
    capabilities.exportState!.onExport();
    expect(navigated).toEqual([{ type: "export" }]);
  });
});
