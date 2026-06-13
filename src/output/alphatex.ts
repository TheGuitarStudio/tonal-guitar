import { FrettedNote } from "../shape";
import { STANDARD } from "../tuning";
import { pitchClass } from "@tonaljs/note";

export interface AlphaTexOptions {
  title?: string;
  tempo?: number;
  duration?: number;           // default note duration: 4, 8, 16
  tuning?: string[];
  /**
   * Number of beats (groups) per bar.
   * Under grouped input (`FrettedNote[][]`), this counts beats (groups), not
   * individual notes. Under flat input (`FrettedNote[]`), each note is its own
   * beat (unchanged behaviour — R-5.3).
   */
  notesPerBar?: number;
  key?: string;
  timeSignature?: [number, number];
  /**
   * Per-beat duration override array.
   * Indexed by beat (group) index. Under grouped input, one entry covers the
   * entire simultaneous strum. Under flat input, each note is its own beat
   * (unchanged behaviour — R-5.3).
   */
  noteDurations?: number[];
  /**
   * Repeating duration pattern, indexed by beat (group) index.
   * Under grouped input, one pattern entry applies to the whole strum.
   * Under flat input, each note is its own beat (unchanged behaviour — R-5.3).
   */
  rhythmPattern?: number[];
}

/**
 * Render a sequence of fretted notes as an AlphaTeX string.
 *
 * **Input forms:**
 * - `FrettedNote[]` — flat sequential notes (original behaviour, unchanged).
 * - `FrettedNote[][]` — grouped notes where each inner array is one simultaneous
 *   beat (strum). Detection: `Array.isArray(notes[0])` → grouped path.
 *   An empty outer array (`[]`) takes the flat path and produces the same
 *   empty-ish output as before (R-5.2).
 *
 * **Beat emission (grouped path):**
 * - Group length 1 → `fret.string` (no parentheses, same as sequential).
 * - Group length ≥ 2 → `(fret.string fret.string …)` (AlphaTeX simultaneous-beat
 *   syntax). String numbers use the existing `stringCount - n.string` mapping
 *   (high string = 1).
 * - Empty group → `r` (rest beat).
 *
 * **Option semantics under grouped input (R-5.3):**
 * `notesPerBar`, `noteDurations`, and `rhythmPattern` all index by *beat (group)*,
 * not by individual note. A single `rhythmPattern` entry applies to the whole strum.
 */
export function toAlphaTeX(notes: FrettedNote[] | FrettedNote[][], options?: AlphaTexOptions): string {
  const {
    title = "Exercise",
    tempo = 120,
    duration = 8,
    tuning = STANDARD,
    key = "C",
    timeSignature,
    noteDurations,
    rhythmPattern,
  } = options ?? {};

  const stringCount = tuning.length;
  const [tsNum, tsDen] = timeSignature ?? [4, 4];

  // Derive tuning label: reversed tuning array, using pitch classes
  const reversedTuning = [...tuning].reverse().map((n) => {
    const pc = pitchClass(n);
    // Re-attach octave from original note string
    const octave = n.replace(/[^0-9-]/g, "");
    return pc + octave;
  });

  const lines: string[] = [
    `\\title "${title}"`,
    `\\tempo ${tempo}`,
    `\\track "Guitar" "Gtr"`,
    `\\staff {tabs}`,
    `\\tuning ${reversedTuning.join(" ")}`,
    `\\ts ${tsNum} ${tsDen} \\ks ${key}`,
  ];

  // Normalise input: flat FrettedNote[] → FrettedNote[][] of singletons so the
  // bar/beat loop runs once for both paths. Grouped detection: Array.isArray of
  // the first element. An empty outer array produces [] groups → flat path.
  const groups: FrettedNote[][] = Array.isArray(notes[0])
    ? (notes as FrettedNote[][])
    : (notes as FrettedNote[]).map((n) => [n]);

  // Determine notesPerBar
  const notesPerBar = options?.notesPerBar ?? (duration === 4 ? 4 : 8);

  // Determine the duration to use for each beat (group index)
  const getDuration = (beatIndex: number): number => {
    if (noteDurations) {
      return noteDurations[beatIndex] ?? duration;
    }
    if (rhythmPattern && rhythmPattern.length > 0) {
      return rhythmPattern[beatIndex % rhythmPattern.length];
    }
    return duration;
  };

  // Build bars. AlphaTeX uses `|` as the bar separator — we end every bar with
  // `|` so adjacent bars stay distinct. The default note duration is set once
  // at the start; per-note duration changes are emitted inline when they vary.
  const barLines: string[] = [];
  let currentBar: string[] = [];
  let prevDuration: number | null = null;

  const hasVariableDurations = !!(noteDurations || rhythmPattern);
  let barCount = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const dur = getDuration(i);

    let beatStr: string;
    if (group.length === 0) {
      // Empty group → rest beat
      if (hasVariableDurations) {
        if (prevDuration === null || dur !== prevDuration) {
          beatStr = `:${dur} r`;
          prevDuration = dur;
        } else {
          beatStr = `r`;
        }
      } else {
        beatStr = `r`;
      }
    } else if (group.length === 1) {
      // Single note — no parentheses (same as sequential format)
      const n = group[0];
      const atString = stringCount - n.string;
      if (hasVariableDurations) {
        if (prevDuration === null || dur !== prevDuration) {
          beatStr = `:${dur} ${n.fret}.${atString}`;
          prevDuration = dur;
        } else {
          beatStr = `${n.fret}.${atString}`;
        }
      } else {
        beatStr = `${n.fret}.${atString}`;
      }
    } else {
      // Multiple notes → parenthesised simultaneous-beat syntax
      const noteParts = group.map((n) => {
        const atString = stringCount - n.string;
        return `${n.fret}.${atString}`;
      });
      const chord = `(${noteParts.join(" ")})`;
      if (hasVariableDurations) {
        if (prevDuration === null || dur !== prevDuration) {
          beatStr = `:${dur} ${chord}`;
          prevDuration = dur;
        } else {
          beatStr = chord;
        }
      } else {
        beatStr = chord;
      }
    }

    currentBar.push(beatStr);

    if (currentBar.length === notesPerBar || i === groups.length - 1) {
      const isFirst = barCount === 0;
      const prefix = isFirst && !hasVariableDurations ? `:${duration} ` : "";
      barLines.push(`${prefix}${currentBar.join(" ")} |`);
      currentBar = [];
      barCount++;
    }
  }

  return [...lines, ...barLines].join("\n");
}
