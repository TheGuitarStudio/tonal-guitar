import { FrettedNote } from "../shape";
import { STANDARD } from "../tuning";
import { pitchClass } from "@tonaljs/note";

export interface AlphaTexOptions {
  title?: string;
  tempo?: number;
  duration?: number;           // default note duration: 4, 8, 16
  tuning?: string[];
  notesPerBar?: number;
  key?: string;
  timeSignature?: [number, number];
  noteDurations?: number[];    // per-note duration override
  rhythmPattern?: number[];    // repeating duration pattern
}

export function toAlphaTeX(notes: FrettedNote[], options?: AlphaTexOptions): string {
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

  // Determine notesPerBar
  const notesPerBar = options?.notesPerBar ?? (duration === 4 ? 4 : 8);

  // Determine the duration to use for each note
  const getDuration = (index: number): number => {
    if (noteDurations) {
      return noteDurations[index] ?? duration;
    }
    if (rhythmPattern && rhythmPattern.length > 0) {
      return rhythmPattern[index % rhythmPattern.length];
    }
    return duration;
  };

  // Build bars
  const barLines: string[] = [];
  let currentBar: string[] = [];
  let prevDuration: number | null = null;

  const hasVariableDurations = !!(noteDurations || rhythmPattern);
  let barCount = 0;

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const atString = stringCount - n.string; // 0→6, 5→1
    const dur = getDuration(i);

    let noteStr: string;
    if (hasVariableDurations) {
      if (prevDuration === null || dur !== prevDuration) {
        noteStr = `:${dur} ${n.fret}.${atString}`;
        prevDuration = dur;
      } else {
        noteStr = `${n.fret}.${atString}`;
      }
    } else {
      noteStr = `${n.fret}.${atString}`;
    }

    currentBar.push(noteStr);

    if (currentBar.length === notesPerBar || i === notes.length - 1) {
      const isFirst = barCount === 0;
      if (isFirst && !hasVariableDurations) {
        barLines.push(`| :${duration} ${currentBar.join(" ")} `);
      } else if (isFirst && hasVariableDurations) {
        barLines.push(`| ${currentBar.join(" ")} `);
      } else {
        barLines.push(`  ${currentBar.join(" ")} |`);
      }
      currentBar = [];
      barCount++;
    }
  }

  return [...lines, ...barLines].join("\n");
}
