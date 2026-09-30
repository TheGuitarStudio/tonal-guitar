/**
 * Toggle between `fretboard-ui`'s `Orientation` values ("horizontal" |
 * "vertical") — used by the workbench's Board screen and Editor tool palette
 * to set the Editor's diagram orientation (spec §5.3, §5.4). Read-only,
 * capability-independent: never emits `data-tg-edit`.
 */
import type { Orientation } from "fretboard-ui";
import { ToggleGroup, type ToggleGroupOption } from "./ToggleGroup";

export interface DiagramOrientationToggleProps {
  value: Orientation;
  onChange: (orientation: Orientation) => void;
  className?: string;
}

const OPTIONS: ToggleGroupOption<Orientation>[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

export function DiagramOrientationToggle({ value, onChange, className }: DiagramOrientationToggleProps) {
  return (
    <ToggleGroup options={OPTIONS} value={value} onChange={onChange} label="Diagram orientation" className={className} />
  );
}
