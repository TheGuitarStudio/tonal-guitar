"use client";

import { memo } from "react";
import type { AuditSeverity, ShapeAuditIssue } from "tonal-guitar";
import { buildReportUrl, type ShapeCatalogEntry } from "./shapeLibraryUtils";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { ShapeCardChordTable } from "./ShapeCardChordTable";

interface ShapeCardProps {
  entry: ShapeCatalogEntry;
}

// Approximate rendered height of a card, used as the `contain-intrinsic-size`
// fallback for `content-visibility: auto` below — lets the browser skip
// layout/paint work for off-screen cards in the 159-card grid without the
// scroll container's total height collapsing before cards are measured.
const CARD_INTRINSIC_SIZE = "auto 480px";

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

export const ShapeCard = memo(function ShapeCard({ entry }: ShapeCardProps) {
  const { kind, name, shape, renderRoot, issues, builtFrets } = entry;
  const chordShape = entry.kind === "chord" ? entry.shape : undefined;
  const scaleShape = entry.kind === "scale" ? entry.shape : undefined;
  const sourceFrets = entry.kind === "chord" ? entry.sourceFrets : undefined;
  const gripRoot = entry.kind === "chord" ? entry.gripRoot : undefined;

  const sortedIssues = sortIssues(issues);

  const propertyPairs: [string, string | undefined][] = [
    ["system", shape.system],
    ["voicingFamily", chordShape?.voicingFamily],
    ["quality", scaleShape?.quality],
    ["chordType", chordShape?.chordType],
    [
      "inversion",
      chordShape?.inversion !== undefined ? String(chordShape.inversion) : undefined,
    ],
    ["canonicalRoot", chordShape?.canonicalRoot],
    ["baseFret", chordShape?.baseFret !== undefined ? String(chordShape.baseFret) : undefined],
    ["rootString", String(shape.rootString)],
    ["stringSet", chordShape?.stringSet?.join(", ")],
    ["parentShape", scaleShape?.parentShape],
  ];

  const properties = propertyPairs.filter(
    (pair): pair is [string, string] => pair[1] !== undefined,
  );

  return (
    <div
      className="rounded-lg border border-fd-border p-4"
      style={{ contentVisibility: "auto", containIntrinsicSize: CARD_INTRINSIC_SIZE }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-fd-foreground">{name}</h3>
        <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
          {kind}
        </span>
        <span className="text-xs text-fd-muted-foreground">{shape.system}</span>
      </div>

      <ShapeCardDiagram entry={entry} />
      <p className="mt-1 text-xs text-fd-muted-foreground">Rendered at {renderRoot}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {sortedIssues.length === 0 ? (
          <span className="text-xs text-fd-muted-foreground">OK</span>
        ) : (
          sortedIssues.map((issue, i) => (
            <span
              key={`${issue.id}-${i}`}
              title={issue.message}
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${badgeClassFor(issue.severity)}`}
            >
              {issue.id}
            </span>
          ))
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {properties.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fd-muted-foreground">{label}</dt>
            <dd className="font-mono text-fd-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {chordShape && (
        <ShapeCardChordTable
          chordShape={chordShape}
          builtFrets={builtFrets}
          sourceFrets={sourceFrets}
          gripRoot={gripRoot}
          renderRoot={renderRoot}
          issues={issues}
        />
      )}

      <a
        href={buildReportUrl(entry)}
        target="_blank"
        rel="noopener"
        className="mt-3 inline-block text-xs text-fd-primary hover:underline"
      >
        Report a problem
      </a>
    </div>
  );
});
