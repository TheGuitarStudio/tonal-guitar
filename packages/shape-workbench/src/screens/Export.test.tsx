import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { AddChange, ChordShape, RemoveChange, UpdateChange } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import { ExportScreen } from "./Export";
import { WorkbenchDispatchContext, WorkbenchStateContext } from "../StoreProvider";
import { initialWorkbenchState, type WorkbenchState } from "../store";
import { changeCheckStatus } from "../export/changeInfo";
import { DRY_RUN_HINT, MERGE_COMMAND, SAMPLE_TRANSCRIPT, UNDO_HINT } from "../export/mergeCommand";
import type { FetchLike, FetchResponseLike } from "../export/writeChangeset";

/** See `Board.test.tsx`'s doc comment: React SSR inserts `<!-- -->` comment
 * markers between adjacent text/expression children. */
function stripReactComments(html: string): string {
  return html.replace(/<!--\s*-->/g, "");
}

function noopFetch(): FetchLike {
  const response: FetchResponseLike = { ok: true, status: 200, json: async () => ({}) };
  return async () => response;
}

function renderExport(state: WorkbenchState, fetchImpl: FetchLike = noopFetch()): string {
  return renderToString(
    <WorkbenchStateContext.Provider value={state}>
      <WorkbenchDispatchContext.Provider value={() => {}}>
        <ExportScreen fetchImpl={fetchImpl} />
      </WorkbenchDispatchContext.Provider>
    </WorkbenchStateContext.Provider>,
  );
}

const NEW_SHAPE: ChordShape = {
  name: "D Shape Minor",
  system: "caged",
  strings: [null, null, "1P", "5P", "b3m", null],
  fingers: [null, null, 1, 3, 2, null],
  barres: [],
  rootString: 2,
  chordType: "m",
};

const addChange: AddChange = { op: "add", kind: "chord", file: "caged-chords-minor", shape: NEW_SHAPE };

const ORIGINAL_SHAPE: ChordShape = {
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
const UPDATED_SHAPE: ChordShape = { ...ORIGINAL_SHAPE, chordType: "maj", cagedPosition: "A" };

const metadataOnlyUpdate: UpdateChange = {
  op: "update",
  kind: "chord",
  name: "A Shape Major",
  patch: { chordType: "maj", cagedPosition: "A" },
};
const updateDraft: DraftShape = { kind: "chord", origin: "existing", shape: UPDATED_SHAPE, original: ORIGINAL_SHAPE };

const removeChange: RemoveChange = { op: "remove", kind: "chord", name: "Some Shape" };

// A collision: shape.name matches a real, already-registered chord
// (`src/data/caged-chords.ts`'s "A Shape Major") — `buildChangeset`'s
// collision detection (`checkNameUnique`) flags this against the live
// registry.
const collidingAdd: AddChange = { ...addChange, shape: { ...NEW_SHAPE, name: "A Shape Major" } };

describe("ExportScreen", () => {
  it("renders under renderToString with no window access", () => {
    const state: WorkbenchState = { ...initialWorkbenchState, changes: [addChange] };
    expect(() => renderExport(state)).not.toThrow();
  });

  it("shows 'No pending changes.' when there are none", () => {
    const html = renderExport(initialWorkbenchState);
    expect(html).toContain("No pending changes.");
    expect(html).not.toContain("export-change-list");
  });

  it("lists every pending change with its op glyph, shape name, target file, and check status", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      changes: [addChange, metadataOnlyUpdate, removeChange],
      drafts: { "A Shape Major": updateDraft },
    };
    const html = stripReactComments(renderExport(state));

    // Op glyphs, one per change type.
    expect(html).toContain(">+<");
    expect(html).toContain(">~<");
    expect(html).toContain(">−<");

    // Shape names.
    expect(html).toContain("D Shape Minor");
    expect(html).toContain("A Shape Major");
    expect(html).toContain("Some Shape");

    // Target file: resolved for "add", punted to shapes:merge for update/remove.
    expect(html).toContain("src/data/caged-chords-minor.ts");
    expect((html.match(/resolved by shapes:merge/g) ?? []).length).toBe(2);

    // Check status mirrors changeCheckStatus for each change (cross-checked
    // independently rather than hard-coded, per Board.test.tsx's convention).
    for (const change of [addChange, metadataOnlyUpdate, removeChange]) {
      const status = changeCheckStatus(state, change);
      expect(html).toContain(`>${status}<`);
    }
  });

  it("shows the 'geometry unchanged' badge for a metadata-only update, selected by default (index 0)", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      changes: [metadataOnlyUpdate],
      drafts: { "A Shape Major": updateDraft },
    };
    const html = renderExport(state);
    expect(html).toContain("geometry unchanged");
  });

  it("does not show the 'geometry unchanged' badge for a geometry-touching add", () => {
    const state: WorkbenchState = { ...initialWorkbenchState, changes: [addChange] };
    const html = renderExport(state);
    expect(html).not.toContain("geometry unchanged");
  });

  it("renders the per-change diff view's TS/JSON/before-after tabs for the selected change", () => {
    const state: WorkbenchState = { ...initialWorkbenchState, changes: [addChange] };
    const html = stripReactComments(renderExport(state));
    expect(html).toContain("TS diff");
    expect(html).toContain(">JSON<");
    expect(html).toContain("Before / after");
    expect(html).toContain("export-diff-view");
  });

  it("reports a conflicts row for a name collision against the live registry, and none when there is none", () => {
    const withCollision: WorkbenchState = { ...initialWorkbenchState, changes: [collidingAdd] };
    const collisionHtml = renderExport(withCollision);
    expect(collisionHtml).toContain("export-conflict-row");
    expect(collisionHtml).toContain("A Shape Major");

    const withoutCollision: WorkbenchState = { ...initialWorkbenchState, changes: [addChange] };
    const cleanHtml = renderExport(withoutCollision);
    expect(cleanHtml).toContain("No name/identifier collisions detected.");
  });

  it("shows a 'Test counts touched' summary tallying changes by kind and op", () => {
    const state: WorkbenchState = { ...initialWorkbenchState, changes: [addChange, removeChange] };
    const html = stripReactComments(renderExport(state));
    expect(html).toContain("Test counts touched");
    expect(html).toContain("1 chord shape(s) added");
    expect(html).toContain("1 chord shape(s) removed");
  });

  it("shows the Write changeset.json button and the last-written-at line when set", () => {
    const state: WorkbenchState = {
      ...initialWorkbenchState,
      changes: [addChange],
      lastWrittenAt: "2026-09-01T00:00:00.000Z",
    };
    const html = stripReactComments(renderExport(state));
    expect(html).toContain("write-changeset-button");
    expect(html).toContain("Last written: 2026-09-01T00:00:00.000Z");
  });

  it("displays the exact shapes:merge command, a sample transcript, and the Dry run/Undo hints verbatim", () => {
    const state: WorkbenchState = { ...initialWorkbenchState, changes: [addChange] };
    const html = stripReactComments(renderExport(state));
    expect(MERGE_COMMAND).toBe("npm run shapes:merge -- .workbench/changeset.json");
    expect(html).toContain(MERGE_COMMAND);
    expect(html).toContain(SAMPLE_TRANSCRIPT.split("\n")[0]);
    expect(html).toContain(DRY_RUN_HINT);
    expect(html).toContain(UNDO_HINT);
  });
});
