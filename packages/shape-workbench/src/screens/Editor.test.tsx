import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ChordShape } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import { ShapeLibraryProvider } from "shape-library-ui";
import { EditorScreen } from "./Editor";
import { WorkbenchDispatchContext, WorkbenchStateContext } from "../StoreProvider";
import { initialWorkbenchState, type WorkbenchState } from "../store";
import { CHORD_CHECK_IDS } from "../editor/checks";

/** See `Board.test.tsx`'s doc comment: React SSR inserts `<!-- -->` comment
 * markers between adjacent text/expression children. */
function stripReactComments(html: string): string {
  return html.replace(/<!--\s*-->/g, "");
}

function renderEditor(state: WorkbenchState): string {
  return renderToString(
    <WorkbenchStateContext.Provider value={state}>
      <WorkbenchDispatchContext.Provider value={() => {}}>
        <ShapeLibraryProvider>
          <EditorScreen slotKey="m::C" />
        </ShapeLibraryProvider>
      </WorkbenchDispatchContext.Provider>
    </WorkbenchStateContext.Provider>,
  );
}

const E_SHAPE_MINOR: ChordShape = {
  name: "E Shape Minor",
  system: "caged",
  strings: ["1P", "5P", "1P", "3m", "5P", "1P"],
  fingers: [1, 3, 4, 1, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "m",
  cagedPosition: "E",
  voicingFamily: "caged",
};

function stateWithDraft(draft: DraftShape, extra: Partial<WorkbenchState> = {}): WorkbenchState {
  return {
    ...initialWorkbenchState,
    authorRoot: "A",
    drafts: { "m::C": draft },
    ...extra,
  };
}

describe("EditorScreen", () => {
  it("renders under renderToString with no window access", () => {
    const state = stateWithDraft({ kind: "chord", origin: "gap", shape: E_SHAPE_MINOR });
    expect(() => renderEditor(state)).not.toThrow();
  });

  it("shows 'No draft yet' when the slotKey has no matching draft", () => {
    const html = renderEditor(initialWorkbenchState);
    expect(html).toContain("No draft yet.");
  });

  it("shows an explicit unsupported-kind message for a scale-kind draft rather than crashing", () => {
    const state = stateWithDraft({
      kind: "scale",
      origin: "gap",
      shape: { name: "", system: "caged", strings: [null, null, null, null, null, null], rootString: 0 },
    });
    const html = renderEditor(state);
    expect(html).toContain('data-testid="editor-unsupported-kind"');
  });

  it("shows the breadcrumb with the shape name and 'draft · not in changeset' status when unsaved", () => {
    const state = stateWithDraft({ kind: "chord", origin: "gap", shape: E_SHAPE_MINOR });
    const html = stripReactComments(renderEditor(state));
    expect(html).toContain("E Shape Minor");
    expect(html).toContain("draft · not in changeset");
  });

  it("shows 'in changeset' status once a matching change has been recorded", () => {
    const state = stateWithDraft(
      { kind: "chord", origin: "gap", shape: E_SHAPE_MINOR },
      { changes: [{ op: "add", kind: "chord", file: "caged-chords-minor", shape: E_SHAPE_MINOR }] },
    );
    const html = stripReactComments(renderEditor(state));
    expect(html).toContain("in changeset");
    expect(html).not.toContain("draft · not in changeset");
  });

  it("renders the full six-tool palette (Select/Note/Root/Finger/Barre/Mute)", () => {
    const state = stateWithDraft({ kind: "chord", origin: "gap", shape: E_SHAPE_MINOR });
    const html = renderEditor(state);
    for (const tool of ["Select", "Note", "Root", "Finger", "Barre", "Mute"]) {
      expect(html).toContain(`>${tool}<`);
    }
  });

  it("seeds the fretboard from an existing-origin draft's own geometry (no cells lost on open)", () => {
    const state = stateWithDraft({
      kind: "chord",
      origin: "existing",
      shape: E_SHAPE_MINOR,
      original: E_SHAPE_MINOR,
    });
    const html = stripReactComments(renderEditor(state));
    // The interval/finger/fret/note table (ChordTable) reflects the seeded
    // shape's own strings — "1P" appears (root interval), and the barre
    // summary line renders in the exact spec §5.4 format.
    expect(html).toContain("1P");
    expect(html).toContain("barre · finger 1: strings 0–5 @ offset 0 (fret 5 at A)");
  });

  it("renders exactly one Checks-card row per CHORD_CHECK_IDS entry, each carrying its check id", () => {
    const state = stateWithDraft({
      kind: "chord",
      origin: "existing",
      shape: E_SHAPE_MINOR,
      original: E_SHAPE_MINOR,
    });
    const html = renderEditor(state);
    for (const id of CHORD_CHECK_IDS) {
      expect(html).toContain(`data-check-id="${id}"`);
    }
    const rowCount = (html.match(/data-check-id="/g) ?? []).length;
    expect(rowCount).toBe(CHORD_CHECK_IDS.length);
  });

  it("renders the Properties form with the shape's current field values", () => {
    const state = stateWithDraft({
      kind: "chord",
      origin: "existing",
      shape: E_SHAPE_MINOR,
      original: E_SHAPE_MINOR,
    });
    const html = renderEditor(state);
    expect(html).toContain('data-testid="properties-form"');
    expect(html).toContain('data-testid="field-name"');
    expect(html).toMatch(/value="E Shape Minor"/);
    expect(html).toContain('data-testid="movable-reason"');
  });

  it("shows a target-file field only for a gap-origin draft, never for an existing-origin draft", () => {
    const gapState = stateWithDraft({ kind: "chord", origin: "gap", shape: E_SHAPE_MINOR });
    expect(renderEditor(gapState)).toContain('data-testid="field-file"');

    const existingState = stateWithDraft({
      kind: "chord",
      origin: "existing",
      shape: E_SHAPE_MINOR,
      original: E_SHAPE_MINOR,
    });
    expect(renderEditor(existingState)).not.toContain('data-testid="field-file"');
  });

  it("Output preview shows the 'set a target file' placeholder for an unfiled gap-origin draft", () => {
    const state = stateWithDraft({
      kind: "chord",
      origin: "gap",
      shape: { ...E_SHAPE_MINOR, strings: [null, null, null, null, null, null], fingers: [null, null, null, null, null, null] },
    });
    const html = renderEditor(state);
    expect(html).toContain('data-testid="output-preview-unavailable"');
  });

  it("renders the Identify row and the At-other-roots strip", () => {
    const state = stateWithDraft({
      kind: "chord",
      origin: "existing",
      shape: E_SHAPE_MINOR,
      original: E_SHAPE_MINOR,
    });
    const html = renderEditor(state);
    expect(html).toContain('data-testid="identify-row"');
    expect(html).toContain('data-testid="at-other-roots"');
    for (const root of ["C", "D", "E", "G", "A"]) {
      expect(html).toContain(`data-testid="at-other-root-${root}"`);
    }
  });
});
