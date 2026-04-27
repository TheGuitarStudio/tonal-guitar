"use client";

import { useMemo, useState } from "react";
import {
  FretboardEditor,
  MODES,
  effectiveModeForSystem,
  isModeCompatibleWithSystem,
  parentRoot,
  cellsToScaleShapeStrings,
  frettedNotesToCells,
  type EditorCell,
  type Handedness,
  type LabelMode,
  type Orientation,
} from "fretboard-ui";
import {
  STANDARD,
  DROP_D,
  DADGAD,
  OPEN_G,
  STANDARD_7,
  STANDARD_8,
  get,
  names,
  buildFrettedScale,
} from "tonal-guitar";

const TUNINGS: Record<string, string[]> = {
  Standard: STANDARD,
  "Drop D": DROP_D,
  DADGAD,
  "Open G": OPEN_G,
  "7-String": STANDARD_7,
  "8-String": STANDARD_8,
};

const ROOTS = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

type Mode = "scale" | "chord";

export function ShapeEditor() {
  const [tuningName, setTuningName] = useState("Standard");
  const tuning = TUNINGS[tuningName] ?? STANDARD;

  const [shapeName, setShapeName] = useState("New Shape");
  const [system, setSystem] = useState("custom");
  const [mode, setMode] = useState<Mode>("scale");
  const [labelMode, setLabelMode] = useState<LabelMode>("intervals");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [showOpenStrings, setShowOpenStrings] = useState(true);
  const [fretMin, setFretMin] = useState(0);
  const [fretMax, setFretMax] = useState(12);

  // For loading an existing shape into the editor.
  const [loadShapeName, setLoadShapeName] = useState("");
  const [loadRoot, setLoadRoot] = useState("A");
  const [loadMode, setLoadMode] = useState("ionian");

  const [cells, setCells] = useState<EditorCell[]>([]);
  const [modalRootPc, setModalRootPc] = useState<string | undefined>(undefined);

  // Re-keying lets us reset the editor when we load a new shape.
  const [editorKey, setEditorKey] = useState(0);

  const exportData = useMemo(() => {
    const strings = cellsToScaleShapeStrings(cells, tuning);
    if (!strings) {
      return {
        empty: true,
        message:
          "No root set. Click “Set root” then click a note to mark it as the root.",
      };
    }
    return {
      empty: false,
      shape: {
        name: shapeName,
        system,
        strings: strings.strings,
        rootString: strings.rootString,
      },
    };
  }, [cells, tuning, shapeName, system]);

  const exportTs = useMemo(() => {
    if (exportData.empty) return "";
    const s = exportData.shape!;
    const stringsLit = s.strings
      .map((row) =>
        row === null ? "    null," : `    [${row.map((i) => `"${i}"`).join(", ")}],`,
      )
      .join("\n");
    const ident = s.name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    return `export const ${ident}: ScaleShape = {
  name: "${s.name}",
  system: "${s.system}",
  strings: [
${stringsLit}
  ],
  rootString: ${s.rootString},
};`;
  }, [exportData]);

  function handleLoadShape() {
    const shape = get(loadShapeName);
    if (!shape) return;
    // Pentatonic shapes only fit major or minor pent — diatonic modes get
    // auto-translated to their pentatonic equivalent (Dorian -> minor pent
    // etc.). Locrian + pent is rejected because there's no clean pent.
    if (!isModeCompatibleWithSystem(loadMode, shape.system)) return;
    const effective = effectiveModeForSystem(loadMode, shape.system) ?? loadMode;
    const buildRoot = parentRoot(loadRoot, effective) ?? loadRoot;
    const built = buildFrettedScale(shape, buildRoot, tuning, {
      allowOpenStrings: showOpenStrings,
    });
    if (built.empty) return;
    const loaded = frettedNotesToCells(built.notes);
    setCells(loaded);
    setShapeName(shape.name);
    setSystem(shape.system);
    setModalRootPc(loadRoot);
    const fretsList = loaded.map((c) => c.fret);
    setFretMin(Math.max(0, Math.min(...fretsList) - 1));
    setFretMax(Math.max(...fretsList) + 1);
    setEditorKey((k) => k + 1);
  }

  function handleNewShape() {
    setCells([]);
    setShapeName("New Shape");
    setSystem("custom");
    setModalRootPc(undefined);
    setEditorKey((k) => k + 1);
  }

  function handleCopyExport() {
    if (!exportTs) return;
    navigator.clipboard.writeText(exportTs);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-lg border border-fd-border p-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-fd-muted-foreground">
            Editor settings
          </h2>
          <div className="space-y-2 text-sm">
            <Field label="Tuning">
              <select
                value={tuningName}
                onChange={(e) => setTuningName(e.target.value)}
                className="rounded border border-fd-border bg-fd-background px-2 py-1"
              >
                {Object.keys(TUNINGS).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mode">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="rounded border border-fd-border bg-fd-background px-2 py-1"
              >
                <option value="scale">Scale shape</option>
                <option value="chord">Chord shape</option>
              </select>
            </Field>
            <Field label="System">
              <input
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1"
                placeholder="caged | 3nps | pentatonic | custom"
              />
            </Field>
            <Field label="Shape name">
              <input
                value={shapeName}
                onChange={(e) => setShapeName(e.target.value)}
                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1"
              />
            </Field>
            <Field label="Fret range">
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={fretMin}
                  onChange={(e) => setFretMin(parseInt(e.target.value, 10) || 0)}
                  className="w-16 rounded border border-fd-border bg-fd-background px-2 py-1"
                />
                <span className="text-fd-muted-foreground">→</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={fretMax}
                  onChange={(e) => setFretMax(parseInt(e.target.value, 10) || 0)}
                  className="w-16 rounded border border-fd-border bg-fd-background px-2 py-1"
                />
              </span>
            </Field>
            <Field label="Display">
              <span className="flex gap-2">
                <select
                  value={labelMode}
                  onChange={(e) => setLabelMode(e.target.value as LabelMode)}
                  className="rounded border border-fd-border bg-fd-background px-2 py-1"
                >
                  <option value="intervals">Intervals</option>
                  <option value="notes">Notes</option>
                  <option value="numbers">Numbers</option>
                  <option value="none">None</option>
                </select>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as Orientation)}
                  className="rounded border border-fd-border bg-fd-background px-2 py-1"
                >
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
                {orientation === "vertical" && (
                  <select
                    value={handedness}
                    onChange={(e) =>
                      setHandedness(e.target.value as Handedness)
                    }
                    className="rounded border border-fd-border bg-fd-background px-2 py-1"
                  >
                    <option value="right">Standard</option>
                    <option value="left">Lefty</option>
                  </select>
                )}
                <label className="ml-1 inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={showOpenStrings}
                    onChange={(e) => setShowOpenStrings(e.target.checked)}
                    className="accent-fd-primary"
                  />
                  Open strings
                </label>
              </span>
            </Field>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-fd-muted-foreground">
            Load existing shape
          </h2>
          <div className="space-y-2 text-sm">
            <Field label="Shape">
              <select
                value={loadShapeName}
                onChange={(e) => setLoadShapeName(e.target.value)}
                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1"
              >
                <option value="">— pick a shape —</option>
                {names().map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mode">
              <select
                value={loadMode}
                onChange={(e) => setLoadMode(e.target.value)}
                className="rounded border border-fd-border bg-fd-background px-2 py-1"
              >
                {MODES.map((m) => {
                  const loadShape = loadShapeName ? get(loadShapeName) : null;
                  const disabled =
                    loadShape?.system === "pentatonic" &&
                    m.pentatonicEquivalent == null;
                  return (
                    <option key={m.id} value={m.id} disabled={disabled}>
                      {m.name}
                      {disabled ? " — n/a for pentatonic" : ""}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="At root">
              <select
                value={loadRoot}
                onChange={(e) => setLoadRoot(e.target.value)}
                className="rounded border border-fd-border bg-fd-background px-2 py-1"
              >
                {ROOTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleLoadShape}
                disabled={!loadShapeName}
                className="rounded border border-fd-border px-3 py-1 transition-colors hover:bg-fd-muted disabled:opacity-50"
              >
                Load
              </button>
              <button
                type="button"
                onClick={handleNewShape}
                className="rounded border border-fd-border px-3 py-1 transition-colors hover:bg-fd-muted"
              >
                New
              </button>
            </div>
            <p className="pt-2 text-xs text-fd-muted-foreground">
              Loading converts the shape’s notes (at the chosen root) into
              editable cells. Editing them then re-exports as intervals.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-fd-border p-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-fd-muted-foreground">
          Fretboard
        </h2>
        <div className="overflow-x-auto text-fd-foreground">
          <FretboardEditor
            key={editorKey}
            tuning={tuning}
            cells={cells}
            onChange={setCells}
            rootPitchClass={modalRootPc}
            fretRange={[
              Math.max(showOpenStrings ? 0 : 1, Math.min(fretMin, fretMax)),
              Math.max(fretMin, fretMax),
            ]}
            layout={{ orientation, handedness }}
            labelMode={labelMode}
          />
        </div>
        <p className="mt-2 text-xs text-fd-muted-foreground">
          {cells.length} cell{cells.length === 1 ? "" : "s"}
          {cells.find((c) => c.isRoot)
            ? " — root set"
            : " — no root yet (click “Set root”)"}
        </p>
      </section>

      <section className="rounded-lg border border-fd-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-fd-muted-foreground">
            Export
          </h2>
          <button
            type="button"
            onClick={handleCopyExport}
            disabled={exportData.empty}
            className="rounded border border-fd-border px-3 py-1 text-xs transition-colors hover:bg-fd-muted disabled:opacity-50"
          >
            Copy TS
          </button>
        </div>
        {exportData.empty ? (
          <p className="text-sm text-fd-muted-foreground">
            {exportData.message}
          </p>
        ) : (
          <pre className="overflow-x-auto rounded bg-fd-muted p-3 text-xs">
            {exportTs}
          </pre>
        )}
        {!exportData.empty && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-fd-muted-foreground">
              JSON
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-fd-muted p-3 text-xs">
              {JSON.stringify(exportData.shape, null, 2)}
            </pre>
          </details>
        )}
        {mode === "chord" && (
          <p className="mt-2 text-xs text-fd-muted-foreground">
            Note: chord-shape export (with fingerings/barres) is not yet
            implemented. Currently exports as ScaleShape.
          </p>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 text-xs text-fd-muted-foreground">{label}</span>
      <span className="flex-1">{children}</span>
    </label>
  );
}
