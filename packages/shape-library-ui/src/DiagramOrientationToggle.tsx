/**
 * Toggle between `fretboard-ui`'s `Orientation` values ("horizontal" |
 * "vertical") — drives `ShapeDiagram`'s `orientation` prop from the Board
 * view / detail panel (spec §5.3, §7 "columns toggle + diagram orientation
 * toggle"). Read-only, capability-independent: never emits `data-tg-edit`.
 */
import type { Orientation } from "fretboard-ui";

export interface DiagramOrientationToggleProps {
  value: Orientation;
  onChange: (orientation: Orientation) => void;
  className?: string;
}

const OPTIONS: { value: Orientation; label: string }[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

export function DiagramOrientationToggle({ value, onChange, className }: DiagramOrientationToggleProps) {
  return (
    <div className={["tg-toggle-group", className].filter(Boolean).join(" ")} role="group" aria-label="Diagram orientation">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
