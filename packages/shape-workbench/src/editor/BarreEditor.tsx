/**
 * Barre authoring form, shown while the "Barre" tool is active (spec §5.4:
 * "Barre (drag across strings)"). `fretboard-ui`'s `FretboardEditor` has no
 * drag-gesture support for barres, so barre spans are authored here as an
 * explicit from/to/offset/finger form instead of a fretboard gesture.
 * `barre.fret` is always the D-010 grip-base *offset*, never an absolute
 * fret — the same convention every stored `Barre` uses.
 */
import { useState } from "react";
import type { Barre } from "tonal-guitar";
import type { ActiveFinger } from "./toolInteractions";

export interface BarreEditorProps {
  barres: Barre[];
  onChange: (barres: Barre[]) => void;
  stringCount: number;
}

export function BarreEditor({ barres, onChange, stringCount }: BarreEditorProps) {
  const [fromString, setFromString] = useState(0);
  const [toString, setToString] = useState(Math.max(0, stringCount - 1));
  const [fret, setFret] = useState(0);
  const [finger, setFinger] = useState<ActiveFinger>(1);

  function addBarre() {
    if (fromString >= toString) return;
    onChange([...barres, { fromString, toString, fret, finger }]);
  }

  function removeBarre(index: number) {
    onChange(barres.filter((_, i) => i !== index));
  }

  return (
    <div className="tg-section" data-testid="barre-editor">
      <h3 className="tg-section-title">Barres</h3>
      <ul className="tg-scale-list">
        {barres.map((barre, i) => (
          <li key={i}>
            finger {barre.finger}: strings {barre.fromString}–{barre.toString} @ offset {barre.fret}{" "}
            <button type="button" onClick={() => removeBarre(i)} aria-label={`Remove barre ${i}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="tg-edit-controls-row">
        <label>
          From string
          <input
            className="tg-input"
            type="number"
            min={0}
            max={stringCount - 1}
            value={fromString}
            onChange={(e) => setFromString(Number(e.target.value))}
          />
        </label>
        <label>
          To string
          <input
            className="tg-input"
            type="number"
            min={0}
            max={stringCount - 1}
            value={toString}
            onChange={(e) => setToString(Number(e.target.value))}
          />
        </label>
        <label>
          Offset
          <input className="tg-input" type="number" min={0} value={fret} onChange={(e) => setFret(Number(e.target.value))} />
        </label>
        <label>
          Finger
          <select className="tg-select" value={finger} onChange={(e) => setFinger(Number(e.target.value) as ActiveFinger)}>
            {[1, 2, 3, 4].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addBarre}>
          Add barre
        </button>
      </div>
    </div>
  );
}
