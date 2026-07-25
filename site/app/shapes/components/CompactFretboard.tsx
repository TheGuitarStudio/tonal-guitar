"use client";

import { useState } from "react";
import { Fretboard } from "fretboard-ui";
import type { FrettedScale } from "tonal-guitar";
import { buildFretMarkers, fretRangeFor, fretSummary, MONOCHROME_THEME } from "./ShapeCardDiagram";

/**
 * Minimal shape `CompactFretboard` needs to render a thumbnail — the full
 * `ShapeCatalogEntry` (see `shapeLibraryUtils.ts`) satisfies this
 * structurally, so callers can pass an alternate-fingering catalog entry
 * directly without adapting it.
 */
export interface CompactFretboardEntry {
  frettedScale: FrettedScale;
  renderRoot: string;
  name: string;
}

export interface CompactFretboardProps {
  entry: CompactFretboardEntry;
  /** Makes the thumbnail clickable; omit to render a non-interactive diagram. */
  onSelect?: () => void;
  /** Highlights this thumbnail as the panel's currently active fingering. */
  selected?: boolean;
  className?: string;
}

// Reduced footprint vs. `ShapeCardDiagram`'s grid-card diagrams (which use
// `fretboard-ui`'s `defaultLayout`: cellWidth 44 / cellHeight 26 /
// markerRadius 10) — sized for a row of alternate-fingering thumbnails
// rather than a single per-card diagram.
const THUMBNAIL_LAYOUT = {
  cellWidth: 16,
  cellHeight: 12,
  markerRadius: 4,
  showFretNumbers: false,
  showStringLabels: false,
};

// The hover/focus overlay reuses `ShapeCardDiagram`'s full-size layout so
// the enlarged preview reads the same as the grid diagrams elsewhere on the
// page.
const ENLARGED_LAYOUT = { orientation: "horizontal" as const };

// Monochrome theme override, and the fret-marker/fret-range/fret-summary
// helpers below — canonical versions all live in `ShapeCardDiagram.tsx`
// (imported above), shared rather than duplicated here.

/**
 * Trimmed, thumbnail-scale adapter over `<Fretboard>` for alternate-fingering
 * lists in the shape detail panel — parallel to `ShapeCardDiagram` (the
 * grid-card-scale adapter) rather than a new `fretboard-ui` component.
 *
 * Renders a small monochrome diagram plus name label. On hover/focus it
 * shows a larger preview as an absolutely-positioned overlay anchored to
 * the thumbnail, so nothing else on the page shifts. When `onSelect` is
 * provided the thumbnail is a real button so callers can make alternate
 * fingerings clickable and reflect a `selected` state.
 */
export function CompactFretboard({
  entry,
  onSelect,
  selected = false,
  className,
}: CompactFretboardProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const enlarged = hovered || focused;

  const { frettedScale, renderRoot, name } = entry;

  if (frettedScale.notes.length === 0) {
    return (
      <div className="flex h-10 w-14 items-center justify-center rounded-md border border-dashed border-fd-border text-center text-[10px] text-fd-muted-foreground">
        No diagram
      </div>
    );
  }

  const markers = buildFretMarkers(entry);
  const fretRange = fretRangeFor(entry);
  const label = `${name} at ${renderRoot}, frets low to high: ${fretSummary(entry)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={selected ? `${label} (selected)` : label}
      aria-pressed={onSelect ? selected : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={[
        "relative inline-flex flex-col items-center gap-0.5 rounded-md border p-1 text-fd-foreground transition-colors",
        selected ? "border-fd-primary" : "border-fd-border hover:border-fd-primary/50",
        onSelect ? "cursor-pointer" : "cursor-default",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div aria-hidden="true">
        <Fretboard
          tuning={frettedScale.tuning}
          markers={markers}
          fretRange={fretRange}
          labelMode="none"
          layout={THUMBNAIL_LAYOUT}
          theme={MONOCHROME_THEME}
        />
      </div>
      <span className="max-w-[64px] truncate text-[10px] text-fd-muted-foreground">
        {name}
      </span>

      {enlarged && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-fd-border bg-fd-background p-3 text-left shadow-xl"
        >
          <Fretboard
            tuning={frettedScale.tuning}
            markers={markers}
            fretRange={fretRange}
            labelMode="intervals"
            layout={ENLARGED_LAYOUT}
            theme={MONOCHROME_THEME}
            className="font-mono"
          />
          <p className="mt-1 text-center text-xs text-fd-muted-foreground">{name}</p>
        </div>
      )}
    </button>
  );
}
