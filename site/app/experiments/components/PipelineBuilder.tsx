"use client";

import { useState, useMemo, useCallback } from "react";
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
import { PresetLoader, type Preset } from "./PresetLoader";
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
 * A unified motif is just a small array of scale degrees. "Patterns" like
 * thirds and "sequences" like 1235 collapse to the same idea — a base
 * motif applied across the scale. walkShapeMotif or walkPattern handles
 * the actual application.
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

export function PipelineBuilder() {
  // Step 1: Tuning
  const [tuningName, setTuningName] = useState("Standard");

  // Step 2: Shape
  const [shapeName, setShapeName] = useState("CAGED E Shape");

  // Step 3: Root
  const [root, setRoot] = useState("A");
  const [modeId, setModeId] = useState("ionian");
  const [showOpenStrings, setShowOpenStrings] = useState(true);

  // Step 4: Sequence (unified motif + walk behaviour)
  const [motifName, setMotifName] = useState<string>("Thirds (1,3)");
  const [customMotif, setCustomMotif] = useState("1,3,5");
  const [walkFullShape, setWalkFullShape] = useState(true);

  // Step 5: Output
  const [outputFormat, setOutputFormat] = useState<"ascii" | "alphatex" | "json">("ascii");
  const [tempo, setTempo] = useState(120);
  const [duration, setDuration] = useState<4 | 8 | 16>(8);

  // Derived state
  const tuning = TUNINGS[tuningName] ?? STANDARD;
  const shape = get(shapeName);

  // For modal rendering: build the shape at the parent root that matches
  // the shape's data, then render with `modalRootPc` so intervals get
  // relabeled from the modal root. Pentatonic shapes auto-translate any
  // diatonic mode to its pentatonic equivalent (Dorian -> minor pent etc.)
  // — see effectiveModeForSystem.
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

  // Resolve the active motif (a small array of scale degrees).
  const motif: number[] = useMemo(() => {
    if (motifName === "Custom") {
      return customMotif
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }
    return MOTIFS[motifName] ?? [];
  }, [motifName, customMotif]);

  // Apply the motif. "Walk full shape" uses walkShapeMotif (visit every
  // position in the shape, end on the highest). Otherwise walkPattern
  // plays the motif once at the scale's lowest occurrence of degree 1.
  const outputNotes: FrettedNote[] | null = useMemo(() => {
    if (!scale) return null;
    if (motif.length === 0) {
      return scale.notes;
    }
    const notes = walkFullShape
      ? walkShapeMotif(scale, motif)
      : walkPattern(scale, motif);
    return notes.length > 0 ? notes : scale.notes;
  }, [scale, motif, walkFullShape]);

  const output: string = useMemo(() => {
    if (!outputNotes || outputNotes.length === 0) return "";
    if (outputFormat === "ascii") {
      return toAsciiTab(outputNotes, { tuning });
    }
    if (outputFormat === "alphatex") {
      return toAlphaTeX(outputNotes, {
        title: `${root} ${shapeName}`,
        tempo,
        duration,
        tuning,
        key: root,
      });
    }
    return JSON.stringify(outputNotes, null, 2);
  }, [outputNotes, outputFormat, tuning, root, shapeName, tempo, duration]);

  const loadPreset = useCallback((preset: Preset) => {
    setTuningName(preset.tuning);
    setShapeName(preset.shape);
    setRoot(preset.root);
    if (preset.motif) setMotifName(preset.motif);
    if (preset.customMotif) setCustomMotif(preset.customMotif);
    if (typeof preset.walkFullShape === "boolean") {
      setWalkFullShape(preset.walkFullShape);
    }
    setOutputFormat(preset.outputFormat ?? "ascii");
  }, []);

  return (
    <div className="space-y-4">
      <PresetLoader onLoad={loadPreset} />

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

      <StepCard
        title="4. Fretted Scale"
        subtitle={
          scale
            ? `${scale.notes.length} notes, frets ${Math.min(...scale.notes.map((n) => n.fret))}-${Math.max(...scale.notes.map((n) => n.fret))}`
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
        subtitle={`${motifName}${walkFullShape ? " · full shape" : ""}`}
      >
        <SequenceStep
          motifName={motifName}
          motifNames={Object.keys(MOTIFS)}
          customMotif={customMotif}
          walkFullShape={walkFullShape}
          onMotifChange={setMotifName}
          onCustomChange={setCustomMotif}
          onWalkFullShapeChange={setWalkFullShape}
        />
        {outputNotes && motif.length > 0 && (
          <p className="mt-2 text-xs text-fd-muted-foreground">
            {outputNotes.length} notes
          </p>
        )}
      </StepCard>

      <StepCard
        title="6. Output"
        subtitle={`${outputFormat.toUpperCase()} — ${outputNotes?.length ?? 0} notes`}
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

      <StepCard title="7. Code preview" subtitle="library calls for this pipeline">
        <CodePreview
          tuningName={tuningName}
          tuningConst={TUNING_CONST[tuningName] ?? "STANDARD"}
          shapeName={shapeName}
          shapeSystem={shapeSystem}
          root={root}
          modeId={modeId}
          showOpenStrings={showOpenStrings}
          motif={motif}
          motifName={motifName}
          walkFullShape={walkFullShape}
          outputFormat={outputFormat}
          tempo={tempo}
          duration={duration}
        />
      </StepCard>
    </div>
  );
}
