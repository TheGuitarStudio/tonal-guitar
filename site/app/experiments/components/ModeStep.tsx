"use client";

import {
  MODES,
  effectiveModeForSystem,
  getMode,
  isModeCompatibleWithSystem,
} from "fretboard-ui";

interface ModeStepProps {
  modeId: string;
  onChange: (id: string) => void;
  /** Optional shape system (e.g. "caged", "pentatonic"). Drives compatibility hints. */
  shapeSystem?: string;
}

export function ModeStep({ modeId, onChange, shapeSystem }: ModeStepProps) {
  const isPent = shapeSystem === "pentatonic";
  const compatible = shapeSystem
    ? isModeCompatibleWithSystem(modeId, shapeSystem)
    : true;
  const effective = shapeSystem
    ? effectiveModeForSystem(modeId, shapeSystem)
    : modeId;
  const effectiveMode = effective ? getMode(effective) : undefined;

  return (
    <div>
      <select
        value={modeId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm"
      >
        {MODES.map((m) => {
          const disabled = isPent && m.pentatonicEquivalent == null;
          return (
            <option key={m.id} value={m.id} disabled={disabled}>
              {m.name}
              {disabled ? " — n/a for pentatonic" : ""}
            </option>
          );
        })}
      </select>
      {!compatible && (
        <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
          Locrian has no clean pentatonic equivalent (its diminished 5th
          breaks both major and minor pent). Pick another mode or switch to a
          diatonic shape.
        </p>
      )}
      {compatible && isPent && effectiveMode && effectiveMode.id !== modeId && (
        <p className="mt-2 text-xs text-fd-muted-foreground">
          Pentatonic shape: rendering as <strong>{effectiveMode.name}</strong>
          {" "}(major modes share major pent; minor modes share minor pent).
        </p>
      )}
      {compatible && !isPent && (
        <p className="mt-2 text-xs text-fd-muted-foreground">
          Same shape, relabeled from your modal root. (e.g. “B Dorian” + “D
          Shape” builds D Shape at A major and shows B as 1P.)
        </p>
      )}
    </div>
  );
}
