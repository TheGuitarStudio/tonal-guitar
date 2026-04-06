import { FrettedNote } from "../shape";
import { STANDARD } from "../tuning";
import { pitchClass } from "@tonaljs/note";

export interface AsciiTabOptions {
  tuning?: string[];
}

export function toAsciiTab(notes: FrettedNote[], options?: AsciiTabOptions): string {
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

  const lines: string[] = [];

  // Display high string first (standard tab convention):
  // displayIndex 0 = highest string = stringCount - 1
  for (let display = 0; display < stringCount; display++) {
    const s = stringCount - 1 - display; // actual string index (0=low)
    const label = labels[s];

    const parts: string[] = [];
    for (const n of notes) {
      const fretStr = String(n.fret);
      const width = fretStr.length;
      if (n.string === s) {
        parts.push(fretStr);
      } else {
        parts.push("-".repeat(width));
      }
    }

    lines.push(`${label}|${parts.join("-")}|`);
  }

  return lines.join("\n");
}
