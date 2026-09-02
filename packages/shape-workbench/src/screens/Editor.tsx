/**
 * Editor screen (spec §5.4 Editor requirements, tasks.md Group 26, closes
 * #66). Composes the tool palette + editing fretboard (`FretboardEditor`),
 * the interval/finger/fret/note table, and the right-hand panel (Identify,
 * At other roots, Output preview, Properties, Checks) around one
 * `WorkbenchState.drafts[slotKey]` entry.
 *
 * All the non-trivial logic — tool-driven cell mutation, cells<->ChordShape
 * conversion, the save refusal, the checks roster, the TS/JSON preview text
 * — lives in pure, independently-tested modules under `../editor/*`; this
 * file is wiring: local UI state (tool/labels/fret window/orientation),
 * effects (auto-fingering seed, async TS preview), and the three actions
 * (Discard / Run checks / Save to changeset) against `WorkbenchStore`.
 *
 * `<EditorInner key={slotKey} .../>` remounts (and so resets every local
 * `useState`) whenever the route's slotKey changes, so navigating from one
 * editor slot straight to another (e.g. via "Duplicate to position") never
 * leaks the previous draft's in-progress cell/tool state into the next.
 */
import { useEffect, useMemo, useState } from "react";
import { Fretboard, type EditorCell, type Orientation } from "fretboard-ui";
import type { Barre, ChordShape } from "tonal-guitar";
import { autoFingering } from "tonal-guitar";
import type { DraftShape } from "shape-catalog";
import { FretboardEditor } from "fretboard-ui";
import { useWorkbenchDispatch, useWorkbenchState } from "../StoreProvider";
import { navigateToRoute } from "../useRoute";
import type { WorkbenchState } from "../store";
import { ToolPalette, type LabelDisplayMode } from "../editor/ToolPalette";
import { BarreEditor } from "../editor/BarreEditor";
import { ChordTable } from "../editor/ChordTable";
import { ChecksCard } from "../editor/ChecksCard";
import { OutputPreview } from "../editor/OutputPreview";
import { PropertiesForm } from "../editor/PropertiesForm";
import { IdentifyRow, AtOtherRoots } from "../editor/IdentifyAndRoots";
import { buildShapeFromCells, seedCellsFromShape } from "../editor/deriveShape";
import { applyCellsChange, type ActiveFinger, type EditorTool } from "../editor/toolInteractions";
import { computeSaveDraft } from "../editor/saveDraft";
import "../editor/editor.css";

export interface EditorScreenProps {
  slotKey: string;
}

function isDraftInChangeset(state: WorkbenchState, name: string): boolean {
  return state.changes.some((change) => (change.op === "add" ? change.shape.name === name : change.name === name));
}

/** Whether a `"gap"`-origin draft's shape has already been fully authored
 * elsewhere (`onDuplicateToPosition` seeds from an existing shape) — in
 * that case the auto-fingering seed (spec §5.4/tasks.md 26.6) must not run,
 * since it would clobber the fingers/barres already carried over. */
function shapeIsBlank(shape: ChordShape): boolean {
  return (
    shape.strings.every((s) => s === null) && shape.fingers.every((f) => f === null) && shape.barres.length === 0
  );
}

function fingerLabelMarkers(cells: EditorCell[]) {
  return cells.map((c) => ({
    string: c.string,
    fret: c.fret,
    label: c.muted ? "x" : c.finger != null ? String(c.finger) : "",
    role: (c.isRoot ? "root" : undefined) as "root" | undefined,
  }));
}

function EditorInner({ slotKey, draft }: { slotKey: string; draft: DraftShape }) {
  const state = useWorkbenchState();
  const dispatch = useWorkbenchDispatch();
  const shape = draft.shape as ChordShape;
  const tuning = state.tuning;

  const seed = useMemo(() => {
    if (shapeIsBlank(shape)) return { cells: [] as EditorCell[], barres: [] as Barre[] };
    return seedCellsFromShape(shape, tuning, state.authorRoot);
    // Computed once at mount (EditorInner is remounted per slotKey via the
    // `key` prop in EditorScreen below) — intentionally keyed on `slotKey`
    // alone, NOT re-run when authorRoot changes later, so switching
    // "Author at root" re-anchors the SAME grip's interval frame rather
    // than re-seeding from scratch.
  }, [slotKey]);

  const [cells, setCells] = useState<EditorCell[]>(seed.cells);
  const [barres, setBarres] = useState<Barre[]>(seed.barres);
  const [tool, setTool] = useState<EditorTool>("select");
  const [activeFinger, setActiveFinger] = useState<ActiveFinger>(1);
  const [labelMode, setLabelMode] = useState<LabelDisplayMode>("intervals");
  const [fretRange, setFretRange] = useState<[number, number]>([0, 12]);
  const [autoSeeded, setAutoSeeded] = useState(false);
  const [file, setFile] = useState<string | undefined>(draft.origin === "gap" ? draft.file : undefined);
  const [ident, setIdent] = useState<string | undefined>(draft.origin === "gap" ? draft.ident : undefined);
  const [saveMessage, setSaveMessage] = useState<string | undefined>(undefined);

  function handleCellsChange(next: EditorCell[]) {
    setCells((prev) => applyCellsChange(prev, next, tool, activeFinger));
  }

  function handleShapeFieldChange(patch: Partial<ChordShape>) {
    const nextShape: ChordShape = { ...shape, ...patch };
    dispatch({ type: "SET_DRAFT", key: slotKey, draft: { ...draft, shape: nextShape } });
  }

  const derivedShape = buildShapeFromCells(shape, cells, barres, tuning, state.authorRoot);
  // Fallback for display (Checks/Table/Output preview) while no root is
  // marked yet — never used for save, which always refuses on `undefined`.
  const displayShape = derivedShape ?? shape;

  // Seed fingers/barres from `autoFingering` the first time the draft has a
  // valid (rooted) geometry, for a brand-new blank draft only (tasks.md
  // 26.6). Runs once; the author may freely override afterwards.
  useEffect(() => {
    if (autoSeeded) return;
    if (draft.origin !== "gap" || !shapeIsBlank(shape)) {
      setAutoSeeded(true);
      return;
    }
    if (derivedShape === undefined) return;

    const auto = autoFingering(
      { ...shape, strings: derivedShape.strings, rootString: derivedShape.rootString },
      state.authorRoot,
      tuning,
    );
    setBarres(auto.barres);
    setCells((prev) => prev.map((c) => (c.muted ? c : { ...c, finger: auto.fingers[c.string] ?? c.finger })));
    setAutoSeeded(true);
    // Intentionally keyed on `derivedShape`/`autoSeeded` alone — `shape`,
    // `draft.origin`, `state.authorRoot`, and `tuning` are read once to
    // decide/compute the one-time seed and must not retrigger this effect
    // on every subsequent edit (that would re-run auto-fingering forever).
  }, [derivedShape, autoSeeded]);

  function persistDraft(nextShape: ChordShape) {
    const nextDraft: DraftShape = {
      ...draft,
      shape: nextShape,
      ...(draft.origin === "gap" ? { file, ident } : {}),
    };
    dispatch({ type: "SET_DRAFT", key: slotKey, draft: nextDraft });
    return nextDraft;
  }

  function handleRunChecks() {
    if (derivedShape === undefined) {
      setSaveMessage(
        'Mark a root (interval "1P") before checks can run against the real shape — showing checks against the empty draft for now.',
      );
      return;
    }
    persistDraft(derivedShape);
    setSaveMessage(undefined);
  }

  function handleDiscard() {
    dispatch({ type: "REMOVE_DRAFT", key: slotKey });
    navigateToRoute({ type: "board" });
  }

  function handleSave() {
    const draftForSave: DraftShape = draft.origin === "gap" ? { ...draft, file, ident } : draft;
    const result = computeSaveDraft(draftForSave, cells, barres, tuning, state.authorRoot);
    if (!result.ok) {
      setSaveMessage(result.error);
      return;
    }
    dispatch({ type: "SET_DRAFT", key: slotKey, draft: result.draft });
    dispatch({ type: "ADD_CHANGE", change: result.change });
    navigateToRoute({ type: "board" });
  }

  const inChangeset = isDraftInChangeset(state, shape.name);
  const draftStatus = inChangeset ? "in changeset" : "draft · not in changeset";

  return (
    <section data-testid="editor-screen">
      <div className="tg-board-header-bar">
        <h1>Shape Workbench — Editor</h1>
        <nav aria-label="Breadcrumb" className="tg-muted">
          <a href="#/board">Board</a> / {shape.name || "Untitled"}
        </nav>
        <span className="tg-tag" data-testid="draft-status">
          {draftStatus}
        </span>
        <button type="button" onClick={handleDiscard}>
          Discard
        </button>
        <button type="button" onClick={handleRunChecks}>
          Run checks
        </button>
        <button type="button" data-testid="save-button" onClick={handleSave}>
          Save to changeset
        </button>
      </div>

      {saveMessage !== undefined && (
        <p role="alert" data-testid="save-message">
          {saveMessage}
        </p>
      )}

      <div className="tg-editor-layout">
        <div className="tg-editor-left">
          <ToolPalette
            tool={tool}
            onToolChange={setTool}
            activeFinger={activeFinger}
            onActiveFingerChange={setActiveFinger}
            authorRoot={state.authorRoot}
            onAuthorRootChange={(root) => dispatch({ type: "SET_AUTHOR_ROOT", root })}
            labelMode={labelMode}
            onLabelModeChange={setLabelMode}
            fretRange={fretRange}
            onFretRangeChange={setFretRange}
            orientation={state.orientation}
            onOrientationChange={(orientation: Orientation) => dispatch({ type: "SET_ORIENTATION", orientation })}
          />

          {tool === "barre" && (
            <BarreEditor barres={barres} onChange={setBarres} stringCount={tuning.length} />
          )}

          {labelMode === "fingers" ? (
            <div data-testid="fingers-preview">
              <p className="tg-muted">Finger labels are read-only — switch to Intervals or Notes to edit.</p>
              <Fretboard
                tuning={tuning}
                markers={fingerLabelMarkers(cells)}
                fretRange={fretRange}
                labelMode="custom"
                layout={{ orientation: state.orientation }}
              />
            </div>
          ) : (
            <FretboardEditor
              tuning={tuning}
              cells={cells}
              onChange={handleCellsChange}
              rootPitchClass={state.authorRoot}
              fretRange={fretRange}
              layout={{ orientation: state.orientation }}
              labelMode={labelMode}
              tool={tool}
              activeFinger={activeFinger}
              barres={barres}
              onBarresChange={setBarres}
            />
          )}

          <ChordTable shape={displayShape} root={state.authorRoot} tuning={tuning} />
        </div>

        <div className="tg-editor-right">
          <IdentifyRow shape={displayShape} root={state.authorRoot} tuning={tuning} />
          <AtOtherRoots shape={displayShape} tuning={tuning} />
          <OutputPreview draft={{ ...draft, shape: displayShape, ...(draft.origin === "gap" ? { file, ident } : {}) }} />
          <PropertiesForm
            draft={draft.origin === "gap" ? { ...draft, file, ident } : draft}
            shape={shape}
            onShapeChange={handleShapeFieldChange}
            onFileChange={setFile}
            onIdentChange={setIdent}
          />
          <ChecksCard
            shape={displayShape}
            root={state.authorRoot}
            tuning={tuning}
            existingEdit={draft.origin === "existing"}
          />
        </div>
      </div>
    </section>
  );
}

export function EditorScreen({ slotKey }: EditorScreenProps) {
  const state = useWorkbenchState();
  const draft = state.drafts[slotKey];

  if (!draft) {
    return (
      <section data-testid="editor-screen">
        <h1>Shape Workbench — Editor</h1>
        <p>slot: {slotKey}</p>
        <p>No draft yet.</p>
      </section>
    );
  }

  // The tool palette / cellsToChordShape / Fingering machinery below is
  // chord-shape-specific (spec §5.4's Editor requirements, tasks.md Group
  // 26, closes #66's chord fingering/barre gap). Scale/arpeggio drafts can
  // still be created and reach a slot key (`onCreateShape`/`draftForSlot`,
  // Group 24) but authoring their multi-interval-per-string geometry is out
  // of this group's scope — this placeholder keeps that explicit rather
  // than mis-rendering a chord-only UI against a `ScaleShape`.
  if (draft.kind !== "chord") {
    return (
      <section data-testid="editor-screen">
        <h1>Shape Workbench — Editor</h1>
        <p data-testid="editor-unsupported-kind">
          Editing "{draft.kind}" shapes isn't implemented yet — this editor covers chord shapes
          only.
        </p>
      </section>
    );
  }

  return <EditorInner key={slotKey} slotKey={slotKey} draft={draft} />;
}
