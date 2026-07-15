"use client";

import { CHECK_GEOMETRY_MISMATCH } from "tonal-guitar";
import type { ChordShape, ShapeAuditIssue } from "tonal-guitar";

interface ShapeCardChordTableProps {
  chordShape: ChordShape;
  builtFrets: (number | null)[];
  sourceFrets: (number | null)[] | undefined;
  gripRoot: string | undefined;
  renderRoot: string;
  issues: ShapeAuditIssue[];
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

/**
 * Chord shape's interval/finger/fret table plus barre summary — extracted
 * from `ShapeCard` so its layout/badges container stays focused. Purely
 * presentational: all derived values (string count, mismatch highlighting,
 * source-fret visibility) are recomputed here from the raw props rather than
 * passed down pre-computed.
 */
export function ShapeCardChordTable({
  chordShape,
  builtFrets,
  sourceFrets,
  gripRoot,
  renderRoot,
  issues,
}: ShapeCardChordTableProps) {
  const stringIndexes = Array.from({ length: chordShape.strings.length }, (_, i) => i);
  const showSourceFrets = sourceFrets !== undefined;
  const sourceAtDifferentRoot = gripRoot !== undefined && gripRoot !== renderRoot;
  const mismatchedStrings = mismatchedStringsFor(issues);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr>
            <th scope="col" className="pr-2 text-left text-fd-muted-foreground">
              string
            </th>
            {stringIndexes.map((i) => (
              <th key={i} scope="col" className="px-1 text-center text-fd-muted-foreground">
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
  );
}
