"use client";

import { useState, useMemo, useCallback } from "react";
import { StepCard } from "./StepCard";
import { TuningStep } from "./TuningStep";
import { ShapeStep } from "./ShapeStep";
import { RootStep } from "./RootStep";
import { BuildResult } from "./BuildResult";
import { PatternStep } from "./PatternStep";
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
  applySequence,
  flattenSequence,
  thirds,
  fourths,
  sixths,
  descendingIntervals,
  ascendingLinear,
  descendingLinear,
  grouping,
  toAlphaTeX,
  toAsciiTab,
  ASCENDING_THIRDS,
  DESCENDING_THIRDS,
  SEQ_1235,
  SEQ_1234_GROUP,
  SEQ_UP_DOWN,
  SEQ_TRIAD_CLIMB,
  SEQ_1357_DESC,
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

const PATTERN_TYPES = [
  "None",
  "Ascending Thirds",
  "Ascending Fourths",
  "Ascending Sixths",
  "Descending Thirds",
  "Ascending Linear",
  "Descending Linear",
  "Grouping (4s)",
  "Custom Degrees",
] as const;

const SEQUENCE_TYPES = [
  "None",
  "ASCENDING_THIRDS",
  "DESCENDING_THIRDS",
  "SEQ_1235",
  "SEQ_1234_GROUP",
  "SEQ_UP_DOWN",
  "SEQ_TRIAD_CLIMB",
  "SEQ_1357_DESC",
  "Custom",
] as const;

const SEQUENCE_MAP: Record<string, number[]> = {
  ASCENDING_THIRDS,
  DESCENDING_THIRDS,
  SEQ_1235,
  SEQ_1234_GROUP,
  SEQ_UP_DOWN,
  SEQ_TRIAD_CLIMB,
  SEQ_1357_DESC,
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

  // Step 4: Pattern
  const [patternType, setPatternType] = useState<string>("Ascending Thirds");
  const [customPattern, setCustomPattern] = useState("1,3,5,7,6,5,4,3,2,1");

  // Step 5: Sequence
  const [seqType, setSeqType] = useState<string>("None");
  const [customSeq, setCustomSeq] = useState("1,2,3,5");
  const [incremental, setIncremental] = useState(true);
  const [maxPasses, setMaxPasses] = useState(0); // 0 = unlimited

  // Step 6: Output
  const [outputFormat, setOutputFormat] = useState<"ascii" | "alphatex" | "json">("ascii");
  const [tempo, setTempo] = useState(120);

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

  const scaleLen = useMemo(() => {
    if (!scale) return 7;
    return new Set(scale.notes.map((n) => n.scaleIndex)).size;
  }, [scale]);

  const pattern: number[] | null = useMemo(() => {
    switch (patternType) {
      case "None":
        return null;
      case "Ascending Thirds":
        return thirds(scaleLen);
      case "Ascending Fourths":
        return fourths(scaleLen);
      case "Ascending Sixths":
        return sixths(scaleLen);
      case "Descending Thirds":
        return descendingIntervals(scaleLen, 2);
      case "Ascending Linear":
        return ascendingLinear(1, scaleLen + 1);
      case "Descending Linear":
        return descendingLinear(scaleLen + 1, 1);
      case "Grouping (4s)":
        return grouping(scaleLen, 4);
      case "Custom Degrees":
        return customPattern
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
      default:
        return null;
    }
  }, [patternType, scaleLen, customPattern]);

  const walkedNotes: FrettedNote[] | null = useMemo(() => {
    if (!scale || !pattern) return null;
    const result = walkPattern(scale, pattern);
    return result.length > 0 ? result : null;
  }, [scale, pattern]);

  const sequenceNotes: FrettedNote[] | null = useMemo(() => {
    if (!scale || seqType === "None") return null;
    const seq =
      seqType === "Custom"
        ? customSeq
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        : SEQUENCE_MAP[seqType];
    if (!seq || seq.length === 0) return null;
    const passes = applySequence(scale, seq, {
      incremental,
      boundToShape: true,
      passes: maxPasses > 0 ? maxPasses : undefined,
    });
    return flattenSequence(passes);
  }, [scale, seqType, customSeq, incremental, maxPasses]);

  // The final notes for output: sequence > walked > raw scale
  const outputNotes: FrettedNote[] | null = useMemo(() => {
    if (sequenceNotes && sequenceNotes.length > 0) return sequenceNotes;
    if (walkedNotes && walkedNotes.length > 0) return walkedNotes;
    if (scale) return scale.notes;
    return null;
  }, [sequenceNotes, walkedNotes, scale]);

  const output: string = useMemo(() => {
    if (!outputNotes || outputNotes.length === 0) return "";
    if (outputFormat === "ascii") {
      return toAsciiTab(outputNotes, { tuning });
    }
    if (outputFormat === "alphatex") {
      return toAlphaTeX(outputNotes, {
        title: `${root} ${shapeName}`,
        tempo,
        duration: 8,
        tuning,
        key: root,
      });
    }
    return JSON.stringify(outputNotes, null, 2);
  }, [outputNotes, outputFormat, tuning, root, shapeName, tempo]);

  const loadPreset = useCallback((preset: Preset) => {
    setTuningName(preset.tuning);
    setShapeName(preset.shape);
    setRoot(preset.root);
    setPatternType(preset.pattern);
    if (preset.customPattern) setCustomPattern(preset.customPattern);
    setSeqType(preset.sequence);
    if (preset.customSeq) setCustomSeq(preset.customSeq);
    setIncremental(preset.incremental ?? true);
    setMaxPasses(preset.maxPasses ?? 0);
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
        title="5. Pattern"
        subtitle={patternType}
      >
        <PatternStep
          patternType={patternType}
          patternTypes={PATTERN_TYPES as unknown as string[]}
          customPattern={customPattern}
          onTypeChange={setPatternType}
          onCustomChange={setCustomPattern}
        />
        {walkedNotes && (
          <p className="mt-2 text-xs text-fd-muted-foreground">
            {walkedNotes.length} notes walked
          </p>
        )}
      </StepCard>

      <StepCard
        title="6. Sequence"
        subtitle={seqType}
      >
        <SequenceStep
          seqType={seqType}
          seqTypes={SEQUENCE_TYPES as unknown as string[]}
          customSeq={customSeq}
          incremental={incremental}
          maxPasses={maxPasses}
          onTypeChange={setSeqType}
          onCustomChange={setCustomSeq}
          onIncrementalChange={setIncremental}
          onMaxPassesChange={setMaxPasses}
        />
        {sequenceNotes && (
          <p className="mt-2 text-xs text-fd-muted-foreground">
            {sequenceNotes.length} notes from sequence
          </p>
        )}
      </StepCard>

      <StepCard
        title="7. Output"
        subtitle={`${outputFormat.toUpperCase()} — ${outputNotes?.length ?? 0} notes`}
      >
        <OutputStep
          format={outputFormat}
          tempo={tempo}
          output={output}
          onFormatChange={setOutputFormat}
          onTempoChange={setTempo}
        />
      </StepCard>

      <StepCard title="8. Code preview" subtitle="library calls for this pipeline">
        <CodePreview
          tuningName={tuningName}
          tuningConst={TUNING_CONST[tuningName] ?? "STANDARD"}
          shapeName={shapeName}
          shapeSystem={shapeSystem}
          root={root}
          modeId={modeId}
          showOpenStrings={showOpenStrings}
          patternType={patternType}
          customPattern={customPattern}
          scaleLen={scaleLen}
          seqType={seqType}
          customSeq={customSeq}
          incremental={incremental}
          maxPasses={maxPasses}
          outputFormat={outputFormat}
          tempo={tempo}
        />
      </StepCard>
    </div>
  );
}
