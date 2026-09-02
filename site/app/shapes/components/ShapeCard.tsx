"use client";

import { memo } from "react";
import type { ShapeCatalogEntry } from "shape-catalog";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { FeaturedMark, IssueBadges } from "./IssueBadges";

interface ShapeCardProps {
  entry: ShapeCatalogEntry;
  /** Invoked with the full entry when the card is clicked/activated. */
  onSelect: (entry: ShapeCatalogEntry) => void;
  /** Whether this card is the currently selected/open entry. */
  isSelected: boolean;
}

// Approximate rendered height of a card, used as the `contain-intrinsic-size`
// fallback for `content-visibility: auto` below — lets the browser skip
// layout/paint work for off-screen cards in the 159-card grid without the
// scroll container's total height collapsing before cards are measured.
// Trimmed down from the pre-panel card's estimate now that the metadata
// table, chord table, and report link no longer render here (see
// `docs`/spec's "Compact card anatomy").
const CARD_INTRINSIC_SIZE = "auto 220px";

/**
 * Compact, monochrome, clickable shape card — chord symbol/display name,
 * voicing-family (or `quality`, for scales) tag, `fr N` tag, audit id
 * badge(s), and the diagram. Everything else (metadata table, chord table,
 * report-a-problem link) has moved into `ShapeDetailPanel.tsx`, which this
 * card's `onSelect` opens.
 */
export const ShapeCard = memo(function ShapeCard({
  entry,
  onSelect,
  isSelected,
}: ShapeCardProps) {
  const { name, shape, issues } = entry;
  const chordShape = entry.kind === "chord" ? entry.shape : undefined;
  const scaleShape = entry.kind === "scale" ? entry.shape : undefined;

  const familyOrQualityTag = chordShape?.voicingFamily ?? scaleShape?.quality;
  const baseFret = chordShape?.baseFret;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      aria-pressed={isSelected}
      aria-current={isSelected ? "true" : undefined}
      style={{ contentVisibility: "auto", containIntrinsicSize: CARD_INTRINSIC_SIZE }}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        isSelected
          ? "border-fd-primary ring-1 ring-fd-primary"
          : "border-fd-border hover:border-fd-primary/50"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <h3 className="font-medium text-fd-foreground">{name}</h3>
        {shape.featured && <FeaturedMark />}
        {familyOrQualityTag && (
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
            {familyOrQualityTag}
          </span>
        )}
        {baseFret !== undefined && (
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] font-mono text-fd-muted-foreground">
            fr {baseFret}
          </span>
        )}
      </div>

      <ShapeCardDiagram entry={entry} />

      {issues.length > 0 && (
        <div className="mt-2">
          <IssueBadges issues={issues} />
        </div>
      )}
    </button>
  );
});
