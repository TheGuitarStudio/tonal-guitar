/**
 * The Editor's interval/finger/fret/note table plus barre summary line
 * (spec §5.4 Editor requirements / tasks.md 26.4):
 *   `barre · finger 1: strings 0–5 @ offset 0 (fret 5 at A)`
 * built from the exported `absoluteBarreFret`/`gripBaseFret` helpers — never
 * a hand-rolled offset calculation. Distinct from `shape-library-ui`'s
 * read-only `ShapeCardChordTable` (which has no "note" row and no
 * `baseFret`-diagram source-fret row relevant to a freshly-authored,
 * always-intervals-only draft): this table is purpose-built for the editor.
 */
import { absoluteBarreFret, applyChordShape, gripBaseFret } from "tonal-guitar";
import type { ChordShape } from "tonal-guitar";
import { pcAt } from "fretboard-ui";

export interface ChordTableProps {
  shape: ChordShape;
  root: string;
  tuning: string[];
}

function cellText(shape: ChordShape, i: number, value: string): string {
  return shape.strings[i] === null ? "x" : value;
}

export function ChordTable({ shape, root, tuning }: ChordTableProps) {
  const built = applyChordShape(shape, root, tuning, { allowOpenStrings: false });
  const stringIndexes = shape.strings.map((_, i) => i);
  const gripBase = gripBaseFret(built.frets);

  return (
    <div className="tg-table tg-editor-table">
      <table>
        <thead>
          <tr>
            <th scope="col">string</th>
            {stringIndexes.map((i) => (
              <th key={i} scope="col">
                {i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">interval</th>
            {stringIndexes.map((i) => (
              <td key={i}>{cellText(shape, i, shape.strings[i] ?? "")}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">finger</th>
            {stringIndexes.map((i) => {
              const finger = shape.fingers[i];
              const text = finger === 0 ? "0" : finger === null || finger === undefined ? "" : String(finger);
              return <td key={i}>{cellText(shape, i, text)}</td>;
            })}
          </tr>
          <tr>
            <th scope="row">fret @ {root}</th>
            {stringIndexes.map((i) => {
              const fret = built.frets[i];
              return <td key={i}>{cellText(shape, i, fret === null || fret === undefined ? "" : String(fret))}</td>;
            })}
          </tr>
          <tr>
            <th scope="row">note</th>
            {stringIndexes.map((i) => {
              const fret = built.frets[i];
              const note = fret === null || fret === undefined ? "" : pcAt(tuning, i, fret);
              return <td key={i}>{cellText(shape, i, note)}</td>;
            })}
          </tr>
        </tbody>
      </table>

      {shape.barres.length > 0 && (
        <ul className="tg-barres" data-testid="barre-summary">
          {shape.barres.map((barre, i) => (
            <li key={i}>
              barre · finger {barre.finger}: strings {barre.fromString}–{barre.toString} @ offset {barre.fret} (fret{" "}
              {absoluteBarreFret(barre, gripBase)} at {root})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
