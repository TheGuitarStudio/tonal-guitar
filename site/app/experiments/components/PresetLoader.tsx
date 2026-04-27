"use client";

export interface Preset {
  label: string;
  tuning: string;
  shape: string;
  root: string;
  motif?: string;
  customMotif?: string;
  walkFullShape?: boolean;
  outputFormat?: "ascii" | "alphatex" | "json";
}

const PRESETS: Preset[] = [
  {
    label: "Am Pentatonic Box 1 — full shape",
    tuning: "Standard",
    shape: "Pentatonic Box 1",
    root: "A",
    motif: "Linear (1)",
    walkFullShape: true,
    outputFormat: "ascii",
  },
  {
    label: "A Major CAGED E — Thirds",
    tuning: "Standard",
    shape: "CAGED E Shape",
    root: "A",
    motif: "Thirds (1,3)",
    walkFullShape: true,
    outputFormat: "ascii",
  },
  {
    label: "C Major 3NPS — 1234 group",
    tuning: "Standard",
    shape: "3NPS Pattern 1 (Ionian)",
    root: "C",
    motif: "1-2-3-4 group",
    walkFullShape: true,
    outputFormat: "alphatex",
  },
  {
    label: "G Major CAGED E — Triad climb",
    tuning: "Standard",
    shape: "CAGED E Shape",
    root: "G",
    motif: "Triad climb (1,3,5,3)",
    walkFullShape: true,
    outputFormat: "ascii",
  },
  {
    label: "E Minor Pentatonic — 1235",
    tuning: "Standard",
    shape: "Pentatonic Box 1",
    root: "E",
    motif: "1-2-3-5",
    walkFullShape: true,
    outputFormat: "ascii",
  },
  {
    label: "D Major CAGED A — custom (1,3,5,7,6,5,4,3,2,1)",
    tuning: "Standard",
    shape: "CAGED A Shape",
    root: "D",
    motif: "Custom",
    customMotif: "1,3,5,7,6,5,4,3,2,1",
    walkFullShape: false,
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
