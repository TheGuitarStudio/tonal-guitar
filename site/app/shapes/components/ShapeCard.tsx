"use client";

import { memo } from "react";
import type { AuditSeverity, ShapeAuditIssue } from "tonal-guitar";
import type { ShapeCatalogEntry } from "./shapeLibraryUtils";
import { ShapeCardDiagram } from "./ShapeCardDiagram";

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

function severityRank(severity: AuditSeverity): number {
  return severity === "error" ? 0 : 1;
}

function badgeClassFor(severity: AuditSeverity): string {
  if (severity === "error") {
    return "bg-red-500/10 text-red-700 dark:text-red-600 border border-red-500/40";
  }
  return "bg-amber-500/10 text-amber-700 dark:text-amber-600 border border-amber-500/40";
}

function sortIssues(issues: ShapeAuditIssue[]): ShapeAuditIssue[] {
  // Array#sort is a stable sort in every JS engine this targets, so issues
  // sharing a severity keep their original relative order.
  return [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

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
  const sortedIssues = sortIssues(issues);

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
        {shape.featured && (
          <span aria-label="Featured" title="Featured shape" className="text-amber-500">
            ★
          </span>
        )}
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

      {sortedIssues.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {sortedIssues.map((issue, i) => (
            <span
              key={`${issue.id}-${i}`}
              title={issue.message}
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${badgeClassFor(issue.severity)}`}
            >
              {issue.id}
            </span>
          ))}
        </div>
      )}
    </button>
  );
});
