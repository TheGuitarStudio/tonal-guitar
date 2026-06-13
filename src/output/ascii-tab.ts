import { FrettedNote } from "../shape";
import { STANDARD } from "../tuning";
import { pitchClass } from "@tonaljs/note";
import { normalizeGroups } from "./util";

export interface AsciiTabOptions {
  tuning?: string[];
}

/**
 * Render a sequence of fretted notes as an ASCII tablature string.
 *
 * **Input forms:**
 * - `FrettedNote[]` — flat sequential notes (original behaviour, unchanged).
 * - `FrettedNote[][]` — grouped notes where each inner array is one simultaneous
 *   beat (chord/strum). Detection: `Array.isArray(notes[0])` → grouped path.
 *   An empty outer array (`[]`) takes the flat path and produces the same
 *   empty-ish output as before (R-5.2).
 *
 * **Column model for grouped input (R-5.4):**
 * Each beat occupies ONE column across all string rows. Column width is
 * `Math.max(1, max fretStr.length in the group)`. A played string shows its
 * fret number left-padded to `colWidth`; an unplayed string shows
 * `'-'.repeat(colWidth)`. Columns are joined with a `-` separator between them.
 * An empty group emits all `-` cells of width 1.
 *
 * **Backward compat:** flat input is normalised to singleton beats; for
 * all-single-digit fret data this reproduces current output byte-for-byte (R-5.2).
 */
export function toAsciiTab(notes: FrettedNote[] | FrettedNote[][], options?: AsciiTabOptions): string {
  const tuning = options?.tuning ?? STANDARD;
  const stringCount = tuning.length;

  // Derive string labels from tuning (low to high).
  // The highest string label gets lowercased (standard tab convention).
  const labels: string[] = tuning.map((n) => {
    const pc = pitchClass(n);
    // Use just the letter (drop accidentals) for a clean single-char label
    return pc.charAt(0);
  });
  // Lowercase the highest string (last in low-to-high array)
  labels[stringCount - 1] = labels[stringCount - 1].toLowerCase();

  // Normalise input: flat FrettedNote[] → FrettedNote[][] of singletons so the
  // column loop runs once for both paths. Grouped detection: Array.isArray of
  // the first element. An empty outer array produces [] groups → flat path.
  const groups: FrettedNote[][] = normalizeGroups(notes);

  // Build per-string row arrays. Display high string first (standard tab convention):
  // displayIndex 0 = highest string = stringCount - 1
  const rowParts: string[][] = Array.from({ length: stringCount }, () => []);

  for (const group of groups) {
    // Compute column width for this beat
    const colWidth = group.length === 0
      ? 1
      : Math.max(1, ...group.map((n) => String(n.fret).length));

    // Build a map from string index → fret string for this beat
    const fretMap = new Map<number, string>();
    for (const n of group) {
      fretMap.set(n.string, String(n.fret));
    }

    // Fill each display row (high string first)
    for (let display = 0; display < stringCount; display++) {
      const s = stringCount - 1 - display; // actual string index (0=low)
      const fretStr = fretMap.get(s);
      if (fretStr !== undefined) {
        // Left-pad fret number to colWidth
        rowParts[display].push(fretStr.padStart(colWidth, " "));
      } else {
        rowParts[display].push("-".repeat(colWidth));
      }
    }
  }

  const lines: string[] = [];
  for (let display = 0; display < stringCount; display++) {
    const s = stringCount - 1 - display; // actual string index (0=low)
    const label = labels[s];
    lines.push(`${label}|${rowParts[display].join("-")}|`);
  }

  return lines.join("\n");
}
