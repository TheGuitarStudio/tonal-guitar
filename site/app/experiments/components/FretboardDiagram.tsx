"use client";

import { useState } from "react";
import type { FrettedScale } from "tonal-guitar";
import {
  Fretboard,
  intervalFromTo,
  intervalToDegreeNumber,
  type FretMarker,
  type Handedness,
  type LabelMode,
  type Orientation,
} from "fretboard-ui";

interface FretboardDiagramProps {
  scale: FrettedScale;
  tuning: string[];
  /**
   * If set, intervals are recomputed relative to this pitch class so the
   * same physical shape can be relabeled across modes (e.g. an A-major
   * shape viewed as B Dorian).
   */
  modalRootPc?: string;
  /** Whether the open-string column (fret 0) is rendered. */
  showOpenStrings?: boolean;
  /** Callback when the user toggles the open-strings checkbox. */
  onShowOpenStringsChange?: (show: boolean) => void;
}

const LEGEND = [
  { color: "#ef4444", label: "Root" },
  { color: "#3b82f6", label: "3rd" },
  { color: "#22c55e", label: "5th" },
  { color: "#f59e0b", label: "4th" },
  { color: "#ec4899", label: "7th" },
];

export function FretboardDiagram({
  scale,
  tuning,
  modalRootPc,
  showOpenStrings = true,
  onShowOpenStringsChange,
}: FretboardDiagramProps) {
  const [labelMode, setLabelMode] = useState<LabelMode>("notes");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [handedness, setHandedness] = useState<Handedness>("right");

  if (scale.notes.length === 0) return null;

  // Auto fret-range based on the actual notes; clamp the lower bound to 1
  // when open strings are hidden so the fret-0 column doesn't render.
  const minNoteFret = Math.min(...scale.notes.map((n) => n.fret));
  const maxNoteFret = Math.max(...scale.notes.map((n) => n.fret));
  const lower = showOpenStrings
    ? Math.max(0, minNoteFret - 1)
    : Math.max(1, minNoteFret - 1);
  const fretRange: [number, number] = [lower, maxNoteFret + 1];

  const markers: FretMarker[] = scale.notes.map((n) => {
    if (modalRootPc) {
      const interval = intervalFromTo(modalRootPc, n.pc);
      return {
        string: n.string,
        fret: n.fret,
        pc: n.pc,
        interval,
        intervalNumber: intervalToDegreeNumber(interval),
        role: interval === "1P" ? "root" : undefined,
      };
    }
    return {
      string: n.string,
      fret: n.fret,
      pc: n.pc,
      interval: n.interval,
      intervalNumber: n.intervalNumber,
    };
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <ToggleGroup
          options={[
            { value: "notes", label: "Notes" },
            { value: "numbers", label: "Numbers" },
            { value: "intervals", label: "Intervals" },
          ]}
          value={labelMode}
          onChange={(v) => setLabelMode(v as LabelMode)}
        />
        <ToggleGroup
          options={[
            { value: "horizontal", label: "↔" },
            { value: "vertical", label: "↕" },
          ]}
          value={orientation}
          onChange={(v) => setOrientation(v as Orientation)}
        />
        {orientation === "vertical" && (
          <ToggleGroup
            options={[
              { value: "right", label: "Standard" },
              { value: "left", label: "Lefty" },
            ]}
            value={handedness}
            onChange={(v) => setHandedness(v as Handedness)}
          />
        )}
        {onShowOpenStringsChange && (
          <label className="inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1 text-xs">
            <input
              type="checkbox"
              checked={showOpenStrings}
              onChange={(e) => onShowOpenStringsChange(e.target.checked)}
              className="accent-fd-primary"
            />
            Open strings
          </label>
        )}
      </div>
      <div className="overflow-x-auto text-fd-foreground">
        <Fretboard
          tuning={tuning}
          markers={markers}
          fretRange={fretRange}
          labelMode={labelMode}
          layout={{ orientation, handedness }}
          className="font-mono"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-fd-muted-foreground">
        {LEGEND.map(({ color, label }) => (
          <span key={label}>
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ToggleGroupProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

function ToggleGroup({ options, value, onChange }: ToggleGroupProps) {
  return (
    <div className="inline-flex rounded-md border border-fd-border text-xs">
      {options.map((opt, i) => {
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        const radius = isFirst
          ? "rounded-l-md"
          : isLast
            ? "rounded-r-md"
            : "";
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${radius} px-3 py-1 transition-colors ${
              active
                ? "bg-fd-primary text-fd-primary-foreground"
                : "hover:bg-fd-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
