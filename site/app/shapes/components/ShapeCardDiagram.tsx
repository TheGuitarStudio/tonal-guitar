"use client";

import { Fretboard, type FretMarker } from "fretboard-ui";
import type { ShapeCatalogEntry } from "./shapeLibraryUtils";

// Kept in sync with the legend used by
// `site/app/experiments/components/FretboardDiagram.tsx` — rendered ONCE at
// page level by the `ShapeLibrary` container, not per-card.
export const LEGEND = [
  { color: "#ef4444", label: "Root" },
  { color: "#3b82f6", label: "3rd" },
  { color: "#22c55e", label: "5th" },
  { color: "#f59e0b", label: "4th" },
  { color: "#ec4899", label: "7th" },
];

interface ShapeCardDiagramProps {
  entry: ShapeCatalogEntry;
}

// Per-string fret summary for the diagram's `aria-label` — e.g. "muted, 3,
// 2, 0, 1, 0" for a 6-string chord. `builtFrets` is already one
// representative fret per string (or `null` for muted), so this just needs
// stringifying; no fretboard-specific data beyond what `ShapeCardDiagram`
// already receives via `entry`.
function fretSummary(builtFrets: (number | null)[]): string {
  return builtFrets.map((f) => (f === null ? "muted" : String(f))).join(", ");
}

/**
 * Trimmed, controls-less adapter over `<Fretboard>` for the shape library's
 * 159-card grid. Unlike `FretboardDiagram` (which carries per-instance
 * `useState` for label mode / orientation / handedness / view mode), this
 * component renders with fixed settings — no local state — so mounting it
 * once per card doesn't multiply state across the whole grid.
 */
export function ShapeCardDiagram({ entry }: ShapeCardDiagramProps) {
  const { frettedScale, renderRoot, name, builtFrets } = entry;

  if (frettedScale.notes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-center text-sm text-fd-muted-foreground">
        Failed to build at {renderRoot}
      </div>
    );
  }

  const minNoteFret = Math.min(...frettedScale.notes.map((n) => n.fret));
  const maxNoteFret = Math.max(...frettedScale.notes.map((n) => n.fret));
  const fretRange: [number, number] = [
    Math.max(0, minNoteFret - 1),
    maxNoteFret + 1,
  ];

  const markers: FretMarker[] = frettedScale.notes.map((n) => ({
    string: n.string,
    fret: n.fret,
    pc: n.pc,
    interval: n.interval,
    intervalNumber: n.intervalNumber,
  }));

  // `role="img"` collapses the SVG's internals (text, paths, etc.) into a
  // single presentational unit for assistive tech, replaced by this label —
  // this is also what stops the fret-number table further down the card
  // (rendered for chords) from being duplicated as an unstructured
  // character-by-character read-out of the SVG.
  const diagramLabel = `${name} at ${renderRoot}, frets low to high: ${fretSummary(builtFrets)}`;

  return (
    <div
      role="img"
      aria-label={diagramLabel}
      className="overflow-x-auto text-fd-foreground"
    >
      <Fretboard
        tuning={frettedScale.tuning}
        markers={markers}
        fretRange={fretRange}
        labelMode="intervals"
        layout={{ orientation: "horizontal" }}
        className="font-mono"
      />
    </div>
  );
}
