"use client";

import { MODES } from "fretboard-ui";

interface ModeStepProps {
  modeId: string;
  onChange: (id: string) => void;
}

export function ModeStep({ modeId, onChange }: ModeStepProps) {
  return (
    <div>
      <select
        value={modeId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm"
      >
        {MODES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-fd-muted-foreground">
        Picking a non-Ionian mode keeps the same shape but rebuilds it at
        the parent root and relabels intervals from your modal root. (e.g.
        “B Dorian” + “D Shape” = D Shape at A major, displayed with B as 1P.)
      </p>
    </div>
  );
}
