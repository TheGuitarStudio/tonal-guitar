"use client";

import { memo, useCallback, useState } from "react";
import { CHECK_GEOMETRY_MISMATCH } from "tonal-guitar";
import type { AuditSeverity, ChordShape, ShapeAuditIssue } from "tonal-guitar";
import {
  buildReportUrl,
  REPORT_ISSUE_BASE_URL,
  type ShapeCatalogEntry,
} from "./shapeLibraryUtils";
import { ShapeCardDiagram } from "./ShapeCardDiagram";

interface ShapeCardProps {
  entry: ShapeCatalogEntry;
}

// Approximate rendered height of a card, used as the `contain-intrinsic-size`
// fallback for `content-visibility: auto` below — lets the browser skip
// layout/paint work for off-screen cards in the 159-card grid without the
// scroll container's total height collapsing before cards are measured.
const CARD_INTRINSIC_SIZE = "auto 480px";

function severityRank(severity: AuditSeverity): number {
  if (severity === "error") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function badgeClassFor(severity: AuditSeverity): string {
  if (severity === "error") {
    return "bg-red-500/10 text-red-700 dark:text-red-600 border border-red-500/40";
  }
  if (severity === "warning") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-600 border border-amber-500/40";
  }
  return "border border-fd-border bg-fd-muted text-fd-muted-foreground";
}

function sortIssues(issues: ShapeAuditIssue[]): ShapeAuditIssue[] {
  // Array#sort is a stable sort in every JS engine this targets, so issues
  // sharing a severity keep their original relative order.
  return [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function mismatchedStringsFor(issues: ShapeAuditIssue[]): Set<number> {
  const issue = issues.find((i) => i.id === CHECK_GEOMETRY_MISMATCH);
  const raw = issue?.details?.mismatchedStrings;
  const validated = Array.isArray(raw)
    ? raw.filter((v): v is number => typeof v === "number")
    : [];
  return new Set(validated);
}

function intervalCell(shape: ChordShape, i: number): string {
  const ivl = shape.strings[i];
  return ivl === null ? "x" : ivl;
}

function fingerCell(shape: ChordShape, i: number): string {
  if (shape.strings[i] === null) return "x";
  const finger = shape.fingers[i];
  if (finger === 0) return "0";
  if (finger === null || finger === undefined) return "";
  return String(finger);
}

function fretCell(shape: ChordShape, frets: (number | null)[], i: number): string {
  if (shape.strings[i] === null) return "x";
  const fret = frets[i];
  return fret === null || fret === undefined ? "" : String(fret);
}

function barreLabel(barre: ChordShape["barres"][number]): string {
  return `finger ${barre.finger}: strings ${barre.fromString}–${barre.toString} @ fret ${barre.fret}`;
}

export const ShapeCard = memo(function ShapeCard({ entry }: ShapeCardProps) {
  const { kind, name, shape, renderRoot, issues, builtFrets } = entry;
  const chordShape = entry.kind === "chord" ? entry.shape : undefined;
  const scaleShape = entry.kind === "scale" ? entry.shape : undefined;
  const sourceFrets = entry.kind === "chord" ? entry.sourceFrets : undefined;
  const gripRoot = entry.kind === "chord" ? entry.gripRoot : undefined;

  const sortedIssues = sortIssues(issues);
  const mismatchedStrings = mismatchedStringsFor(issues);

  // `buildReportUrl` JSON-stringifies the raw shape and all frets — deferred
  // until the user shows intent to use the link (hover, focus, or
  // mousedown), rather than computed eagerly for every card at mount. Until
  // then the anchor points at a cheap placeholder so it stays a real,
  // keyboard-focusable link the whole time.
  const [reportUrl, setReportUrl] = useState<string | undefined>(undefined);
  const ensureReportUrl = useCallback(() => {
    setReportUrl((prev) => prev ?? buildReportUrl(entry));
  }, [entry]);

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

  const stringCount = chordShape?.strings.length ?? entry.frettedScale.tuning.length;
  const stringIndexes = Array.from({ length: stringCount }, (_, i) => i);
  const showSourceFrets = chordShape !== undefined && sourceFrets !== undefined;
  const sourceAtDifferentRoot = gripRoot !== undefined && gripRoot !== renderRoot;

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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr>
                <th scope="col" className="pr-2 text-left text-fd-muted-foreground">
                  string
                </th>
                {stringIndexes.map((i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-1 text-center text-fd-muted-foreground"
                  >
                    {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="pr-2 text-left font-normal text-fd-muted-foreground">
                  interval
                </th>
                {stringIndexes.map((i) => (
                  <td key={i} className="px-1 text-center">
                    {intervalCell(chordShape, i)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="pr-2 text-left font-normal text-fd-muted-foreground">
                  finger
                </th>
                {stringIndexes.map((i) => (
                  <td key={i} className="px-1 text-center">
                    {fingerCell(chordShape, i)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="pr-2 text-left font-normal text-fd-muted-foreground">
                  built fret
                </th>
                {stringIndexes.map((i) => (
                  <td key={i} className="px-1 text-center">
                    {fretCell(chordShape, builtFrets, i)}
                  </td>
                ))}
              </tr>
              {showSourceFrets && (
                <tr>
                  <th scope="row" className="pr-2 text-left font-normal text-fd-muted-foreground">
                    source fret{sourceAtDifferentRoot ? ` (source at ${gripRoot})` : ""}
                  </th>
                  {stringIndexes.map((i) => (
                    <td
                      key={i}
                      className={`px-1 text-center ${
                        mismatchedStrings.has(i)
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-600"
                          : ""
                      }`}
                    >
                      {fretCell(chordShape, sourceFrets ?? [], i)}
                      {/* Non-color mismatch cue: the highlight alone is
                          invisible to colorblind and screen-reader users. */}
                      {mismatchedStrings.has(i) && (
                        <>
                          <span aria-hidden="true">*</span>
                          <span className="sr-only"> (mismatch)</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>

          {chordShape.barres.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-fd-muted-foreground">
              {chordShape.barres.map((barre, i) => (
                <li key={i}>{barreLabel(barre)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <a
        href={reportUrl ?? REPORT_ISSUE_BASE_URL}
        onPointerEnter={ensureReportUrl}
        onFocus={ensureReportUrl}
        onMouseDown={ensureReportUrl}
        target="_blank"
        rel="noopener"
        className="mt-3 inline-block text-xs text-fd-primary hover:underline"
      >
        Report a problem
      </a>
    </div>
  );
});
