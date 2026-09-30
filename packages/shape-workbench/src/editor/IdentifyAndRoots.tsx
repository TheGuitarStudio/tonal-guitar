/**
 * Identify row + "At other roots" strip (spec §5.4 Editor requirements):
 *   - "Identify row: Tonal `detect` of the built grip vs declared `chordType`."
 *   - "'At other roots' strip: `applyChordShape` at C/D/E/G/A with open
 *     strings disabled."
 *
 * Reuses `identifyChord` (the library's own `Chord.detect()` wrapper,
 * `tonal-guitar`'s optional tier — already exported for exactly this kind
 * of display use) for the Identify row rather than re-deriving pitch
 * classes by hand, and `shape-library-ui`'s `ShapeDiagram` for each
 * alternate-root card rather than reimplementing fretboard rendering.
 */
import { applyChordShape } from "tonal-guitar";
import { identifyChord } from "tonal-guitar";
import type { ChordShape } from "tonal-guitar";
import { chordFingeringToFrettedScale } from "shape-catalog";
import { ShapeDiagram } from "shape-library-ui";

export interface IdentifyRowProps {
  shape: ChordShape;
  root: string;
  tuning: string[];
}

export function IdentifyRow({ shape, root, tuning }: IdentifyRowProps) {
  const built = applyChordShape(shape, root, tuning, { allowOpenStrings: false });
  const detected = identifyChord(built.frets, tuning);
  const expected = shape.chordType === undefined ? undefined : `${root}${shape.chordType}`;
  const matches = expected !== undefined && detected.includes(expected);

  return (
    <div className="tg-section" data-testid="identify-row">
      <h3 className="tg-section-title">Identify</h3>
      <p>
        Tonal detect: <span data-testid="identify-detected">{detected.join(", ") || "—"}</span>
        {expected !== undefined && (
          <>
            {" "}
            <span data-testid="identify-verdict">
              {matches ? `matches chordType "${shape.chordType}"` : `does not match chordType "${shape.chordType}"`}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

const OTHER_ROOTS = ["C", "D", "E", "G", "A"] as const;

export interface AtOtherRootsProps {
  shape: ChordShape;
  tuning: string[];
}

/** Renders the grip at each of C/D/E/G/A with open strings disabled —
 * including the current Author-at-root, if it is one of the five. */
export function AtOtherRoots({ shape, tuning }: AtOtherRootsProps) {
  return (
    <div className="tg-section" data-testid="at-other-roots">
      <h3 className="tg-section-title">At other roots</h3>
      <div className="tg-thumbnail-row">
        {OTHER_ROOTS.map((root) => {
          const frettedScale = chordFingeringToFrettedScale(shape, root, tuning, { allowOpenStrings: false });
          const startFret = frettedScale.notes.length > 0 ? Math.min(...frettedScale.notes.map((n) => n.fret)) : 0;
          return (
            <div key={root} className="tg-thumbnail" data-testid={`at-other-root-${root}`}>
              <ShapeDiagram entry={{ frettedScale, renderRoot: root, name: shape.name }} />
              <span className="tg-thumbnail-label">
                {root} · fr {startFret}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
