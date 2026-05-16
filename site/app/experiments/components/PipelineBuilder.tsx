"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StepCard } from "./StepCard";
import { TuningStep } from "./TuningStep";
import { ShapeStep } from "./ShapeStep";
import { RootStep } from "./RootStep";
import { BuildResult } from "./BuildResult";
import { SequenceStep } from "./SequenceStep";
import { OutputStep } from "./OutputStep";
import { FretboardDiagram } from "./FretboardDiagram";
import { ModeStep } from "./ModeStep";
import { CodePreview } from "./CodePreview";
import { ChainSection, type ChainEntry } from "./ChainSection";
import { PresetLoader, type Preset } from "./PresetLoader";
import type { PipelineRecipe } from "./codeGen";
import {
  effectiveModeForSystem,
  isModeCompatibleWithSystem,
  parentRoot,
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
  walkPattern,
  walkShapeMotif,
  toAlphaTeX,
  toAsciiTab,
} from "tonal-guitar";
import type { FrettedNote, FrettedScale } from "tonal-guitar";

const TUNINGS: Record<string, string[]> = {
  Standard: STANDARD,
  "Drop D": DROP_D,
  DADGAD: DADGAD,
  "Open G": OPEN_G,
  "7-String": STANDARD_7,
  "8-String": STANDARD_8,
};

const TUNING_CONST: Record<string, string> = {
  Standard: "STANDARD",
  "Drop D": "DROP_D",
  DADGAD: "DADGAD",
  "Open G": "OPEN_G",
  "7-String": "STANDARD_7",
  "8-String": "STANDARD_8",
};

/**
 * A unified motif is just a small array of scale degrees. Library helpers
 * walkShapeMotif / walkPattern handle the application.
 */
const MOTIFS: Record<string, number[]> = {
  None: [],
  "Linear (1)": [1],
  "Thirds (1,3)": [1, 3],
  "Fourths (1,4)": [1, 4],
  "Sixths (1,6)": [1, 6],
  "Triads (1,3,5)": [1, 3, 5],
  "Sevenths (1,3,5,7)": [1, 3, 5, 7],
  "1-2-3-4 group": [1, 2, 3, 4],
  "1-2-3-5": [1, 2, 3, 5],
  "Up-Down (1,2,3,4,3,2)": [1, 2, 3, 4, 3, 2],
  "Triad climb (1,3,5,3)": [1, 3, 5, 3],
  Custom: [],
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

/**
 * What's currently driving the Output section at the bottom.
 *   - "current": the unsaved pipeline above
 *   - chain entry N: just one entry of the chain
 *   - "chain": all chain entries played back-to-back
 */
type Selection =
  | { kind: "current" }
  | { kind: "chainEntry"; index: number }
  | { kind: "chain" };

export function PipelineBuilder() {
  // Step 1: Tuning
  const [tuningName, setTuningName] = useState("Standard");
  // Step 2: Shape
  const [shapeName, setShapeName] = useState("E Shape");
  // Step 3: Root + Mode
  const [root, setRoot] = useState("A");
  const [modeId, setModeId] = useState("ionian");
  const [showOpenStrings, setShowOpenStrings] = useState(true);
  // Step 4: Sequence
  const [motifName, setMotifName] = useState<string>("Thirds (1,3)");
  const [customMotif, setCustomMotif] = useState("1,3,5");
  const [walkFullShape, setWalkFullShape] = useState(true);
  const [direction, setDirection] = useState<"ascending" | "descending">(
    "ascending",
  );
  // Output formatting
  const [outputFormat, setOutputFormat] = useState<"ascii" | "alphatex" | "json">(
    "alphatex",
  );
  const [tempo, setTempo] = useState(120);
  const [duration, setDuration] = useState<4 | 8 | 16>(8);

  // Chain of queued sequences.
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [selection, setSelection] = useState<Selection>({ kind: "current" });

  // Derived
  const tuning = TUNINGS[tuningName] ?? STANDARD;
  const shape = get(shapeName);
  const shapeSystem = shape?.system ?? "";
  const compatible = isModeCompatibleWithSystem(modeId, shapeSystem);
  const effectiveMode =
    effectiveModeForSystem(modeId, shapeSystem) ?? modeId;
  const buildRoot = useMemo(
    () => (compatible ? parentRoot(root, effectiveMode) ?? root : root),
    [root, effectiveMode, compatible],
  );
  const modalRootPc =
    !compatible || effectiveMode === "ionian" || effectiveMode === "major-pent"
      ? undefined
      : root;

  const scale: FrettedScale | null = useMemo(() => {
    if (!shape) return null;
    const result = buildFrettedScale(shape, buildRoot, tuning, {
      allowOpenStrings: showOpenStrings,
    });
    return result.empty ? null : result;
  }, [shape, buildRoot, tuning, showOpenStrings]);

  const motif: number[] = useMemo(() => {
    if (motifName === "Custom") {
      return customMotif
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }
    return MOTIFS[motifName] ?? [];
  }, [motifName, customMotif]);

  // Currently-edited pipeline output (the "preview").
  const currentNotes: FrettedNote[] | null = useMemo(() => {
    if (!scale) return null;
    if (motif.length === 0) {
      return direction === "descending"
        ? [...scale.notes].sort((a, b) => b.midi - a.midi)
        : scale.notes;
    }
    let notes: FrettedNote[];
    if (walkFullShape) {
      notes = walkShapeMotif(scale, motif, { direction });
    } else {
      const m = direction === "descending" ? [...motif].reverse() : motif;
      notes = walkPattern(scale, m);
    }
    return notes.length > 0 ? notes : scale.notes;
  }, [scale, motif, walkFullShape, direction]);

  // Snap selection back to "current" whenever the user tweaks an input.
  // (They almost certainly want to see what they're editing.)
  useEffect(() => {
    setSelection({ kind: "current" });
  }, [
    tuningName,
    shapeName,
    root,
    modeId,
    motifName,
    customMotif,
    walkFullShape,
    direction,
    showOpenStrings,
  ]);

  // When the chain becomes empty, selection has to fall back to "current".
  // When a selected chain entry gets removed, clamp the index.
  useEffect(() => {
    if (selection.kind === "chainEntry" && selection.index >= chain.length) {
      setSelection(chain.length > 0 ? { kind: "chain" } : { kind: "current" });
    } else if (selection.kind === "chain" && chain.length === 0) {
      setSelection({ kind: "current" });
    }
  }, [chain, selection]);

  // What the Output section actually renders.
  const selectedNotes: FrettedNote[] | null = useMemo(() => {
    if (selection.kind === "current") return currentNotes;
    if (selection.kind === "chainEntry") return chain[selection.index]?.notes ?? null;
    return chain.flatMap((e) => e.notes);
  }, [selection, currentNotes, chain]);

  const selectedLabel = useMemo(() => {
    if (selection.kind === "current") return "Current (unsaved)";
    if (selection.kind === "chainEntry") {
      return `Chain · ${chain[selection.index]?.label ?? "?"}`;
    }
    return chain.length > 0
      ? `Whole chain · ${chain.length} entr${chain.length === 1 ? "y" : "ies"}`
      : "Empty chain";
  }, [selection, chain]);

  const output: string = useMemo(() => {
    if (!selectedNotes || selectedNotes.length === 0) return "";
    if (outputFormat === "ascii") {
      return toAsciiTab(selectedNotes, { tuning });
    }
    if (outputFormat === "alphatex") {
      return toAlphaTeX(selectedNotes, {
        title: selectedLabel,
        tempo,
        duration,
        tuning,
        key: root,
      });
    }
    return JSON.stringify(selectedNotes, null, 2);
  }, [selectedNotes, outputFormat, tuning, root, tempo, duration, selectedLabel]);

  const loadPreset = useCallback((preset: Preset) => {
    setTuningName(preset.tuning);
    setShapeName(preset.shape);
    setRoot(preset.root);
    if (preset.motif) setMotifName(preset.motif);
    if (preset.customMotif) setCustomMotif(preset.customMotif);
    if (typeof preset.walkFullShape === "boolean") {
      setWalkFullShape(preset.walkFullShape);
    }
    setOutputFormat(preset.outputFormat ?? "alphatex");
  }, []);

  // Snapshot of the live pipeline inputs — used both by the code preview
  // (when "current" is selected) and when freezing the recipe into the chain.
  const currentRecipe: PipelineRecipe = useMemo(
    () => ({
      tuningName,
      tuningConst: TUNING_CONST[tuningName] ?? "STANDARD",
      shapeName,
      shapeSystem,
      root,
      modeId,
      showOpenStrings,
      motif,
      motifName,
      walkFullShape,
      direction,
    }),
    [
      tuningName,
      shapeName,
      shapeSystem,
      root,
      modeId,
      showOpenStrings,
      motif,
      motifName,
      walkFullShape,
      direction,
    ],
  );

  // Chain handlers.
  const chainLabel = `${root} ${shapeName} · ${motifName}${
    direction === "descending" ? " ↓" : " ↑"
  }${walkFullShape ? " · full shape" : ""}`;
  const addToChain = useCallback(() => {
    if (!currentNotes || currentNotes.length === 0) return;
    setChain((prev) => [
      ...prev,
      { label: chainLabel, notes: currentNotes, recipe: currentRecipe },
    ]);
    setSelection({ kind: "chain" });
  }, [currentNotes, chainLabel, currentRecipe]);
  const removeFromChain = useCallback(
    (i: number) => setChain((prev) => prev.filter((_, j) => j !== i)),
    [],
  );
  const moveChain = useCallback((from: number, to: number) => {
    setChain((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }, []);

  return (
    <div className="space-y-4">
      <PresetLoader onLoad={loadPreset} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column — inputs */}
        <div className="space-y-4">
          <StepCard title="1. Tuning" subtitle={tuning.join(" ")}>
            <TuningStep
              tuningName={tuningName}
              tuningNames={Object.keys(TUNINGS)}
              onChange={setTuningName}
            />
          </StepCard>

          <StepCard title="2. Shape" subtitle={shapeName}>
            <ShapeStep
              shapeName={shapeName}
              shapeNames={names()}
              onChange={setShapeName}
            />
          </StepCard>

          <StepCard title="3. Root Note" subtitle={root}>
            <RootStep root={root} roots={ROOTS} onChange={setRoot} />
          </StepCard>

          <StepCard
            title="3a. Mode"
            subtitle={modeId === "ionian" ? "Major (Ionian)" : modeId}
          >
            <ModeStep
              modeId={modeId}
              onChange={setModeId}
              shapeSystem={shapeSystem}
            />
          </StepCard>
        </div>

        {/* Right column — fretboard + sequence + chain */}
        <div className="space-y-4">
          <StepCard
            title="4. Fretted Scale"
            subtitle={
              scale
                ? `${scale.notes.length} notes, frets ${Math.min(...scale.notes.map((n) => n.fret))}–${Math.max(...scale.notes.map((n) => n.fret))}`
                : "No result"
            }
          >
            {scale ? (
              <>
                <FretboardDiagram
                  scale={scale}
                  tuning={tuning}
                  modalRootPc={modalRootPc}
                  showOpenStrings={showOpenStrings}
                  onShowOpenStringsChange={setShowOpenStrings}
                />
                <BuildResult scale={scale} />
              </>
            ) : (
              <p className="text-sm text-fd-muted-foreground">
                {shape
                  ? "Could not build scale — check root note and tuning."
                  : "Select a valid shape above."}
              </p>
            )}
          </StepCard>

          <StepCard
            title="5. Sequence"
            subtitle={`${motifName}${walkFullShape ? " · full shape" : ""} · ${
              direction === "descending" ? "↓" : "↑"
            }`}
          >
            <SequenceStep
              motifName={motifName}
              motifNames={Object.keys(MOTIFS)}
              customMotif={customMotif}
              walkFullShape={walkFullShape}
              direction={direction}
              onMotifChange={setMotifName}
              onCustomChange={setCustomMotif}
              onWalkFullShapeChange={setWalkFullShape}
              onDirectionChange={setDirection}
            />
            {currentNotes && motif.length > 0 && (
              <p className="mt-2 text-xs text-fd-muted-foreground">
                {currentNotes.length} notes in this sequence
              </p>
            )}
          </StepCard>

          <StepCard
            title="6. Chain"
            subtitle={
              chain.length === 0
                ? "queue sequences to play back-to-back"
                : `${chain.length} entr${chain.length === 1 ? "y" : "ies"}`
            }
          >
            <ChainSection
              entries={chain}
              selection={selection}
              canAdd={(currentNotes?.length ?? 0) > 0}
              onAdd={addToChain}
              onRemove={removeFromChain}
              onMoveUp={(i) => moveChain(i, i - 1)}
              onMoveDown={(i) => moveChain(i, i + 1)}
              onClear={() => setChain([])}
              onSelectCurrent={() => setSelection({ kind: "current" })}
              onSelectChain={() => setSelection({ kind: "chain" })}
              onSelectEntry={(i) =>
                setSelection({ kind: "chainEntry", index: i })
              }
            />
          </StepCard>
        </div>
      </div>

      {/* Full-width output below, driven by `selection`. */}
      <StepCard
        title="7. Output"
        subtitle={`${selectedLabel} · ${outputFormat.toUpperCase()} · ${selectedNotes?.length ?? 0} notes`}
      >
        <OutputStep
          format={outputFormat}
          tempo={tempo}
          duration={duration}
          output={output}
          onFormatChange={setOutputFormat}
          onTempoChange={setTempo}
          onDurationChange={setDuration}
        />
      </StepCard>

      <StepCard
        title="8. Code preview"
        subtitle={
          selection.kind === "chain"
            ? `library calls for the whole chain · ${chain.length} entr${chain.length === 1 ? "y" : "ies"}`
            : selection.kind === "chainEntry"
              ? `library calls for chain entry ${selection.index + 1}`
              : "library calls for the current pipeline"
        }
      >
        <CodePreview
          selection={selection}
          current={currentRecipe}
          chain={chain.map((e) => ({ label: e.label, recipe: e.recipe }))}
          outputFormat={outputFormat}
          tempo={tempo}
          duration={duration}
        />
      </StepCard>
    </div>
  );
}
