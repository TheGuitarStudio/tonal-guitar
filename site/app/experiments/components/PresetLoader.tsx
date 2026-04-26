"use client";

export interface Preset {
  label: string;
  tuning: string;
  shape: string;
  root: string;
  pattern: string;
  customPattern?: string;
  sequence: string;
  customSeq?: string;
  incremental?: boolean;
  maxPasses?: number;
  outputFormat?: "ascii" | "alphatex" | "json";
}

const PRESETS: Preset[] = [
  {
    label: "Am Pentatonic Box 1",
    tuning: "Standard",
    shape: "Pentatonic Box 1",
    root: "A",
    pattern: "Ascending Linear",
    sequence: "None",
    outputFormat: "ascii",
  },
  {
    label: "A Major CAGED E — Thirds",
    tuning: "Standard",
    shape: "CAGED E Shape",
    root: "A",
    pattern: "Ascending Thirds",
    sequence: "None",
    outputFormat: "ascii",
  },
  {
    label: "C Major 3NPS — Grouping",
    tuning: "Standard",
    shape: "3NPS Pattern 1",
    root: "C",
    pattern: "Grouping (4s)",
    sequence: "None",
    outputFormat: "alphatex",
  },
  {
    label: "G Major CAGED E — Triad Climb",
    tuning: "Standard",
    shape: "CAGED E Shape",
    root: "G",
    pattern: "None",
    sequence: "SEQ_TRIAD_CLIMB",
    incremental: true,
    outputFormat: "ascii",
  },
  {
    label: "E Minor Pentatonic — 1235 Sequence",
    tuning: "Standard",
    shape: "Pentatonic Box 1",
    root: "E",
    pattern: "None",
    sequence: "SEQ_1235",
    incremental: true,
    outputFormat: "ascii",
  },
  {
    label: "D Major CAGED A — Arpeggiated Descent",
    tuning: "Standard",
    shape: "CAGED A Shape",
    root: "D",
    pattern: "Custom Degrees",
    customPattern: "1,3,5,7,6,5,4,3,2,1",
    sequence: "None",
    outputFormat: "alphatex",
  },
];

interface PresetLoaderProps {
  onLoad: (preset: Preset) => void;
}

export function PresetLoader({ onLoad }: PresetLoaderProps) {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-card px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">
        Presets
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="rounded-md border border-fd-border px-3 py-1.5 text-sm transition-colors hover:border-fd-primary/50 hover:bg-fd-accent"
            onClick={() => onLoad(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
