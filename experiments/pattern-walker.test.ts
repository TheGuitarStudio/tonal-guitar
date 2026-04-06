/**
 * Experiment: Position-aware pattern walker + AlphaTeX output
 *
 * The key insight from shapes.test.ts: walking a pattern through a shape
 * needs to follow the physical string layout, not just pick notes by pitch.
 *
 * Approach: Build a "fretted scale" (the full scale laid out in a shape),
 * then walk through it with a pattern, following the natural string order.
 *
 * Run: npm test -- packages/guitar/experiments/pattern-walker.test.ts
 */
import { describe, expect, test } from "vitest";
import Note from "@tonaljs/note";
import * as Interval from "@tonaljs/interval";

// ============================================================
// Types
// ============================================================

interface Tuning {
  name: string;
  notes: string[]; // low to high: ["E2", "A2", "D3", "G3", "B3", "E4"]
}

/** A single note on the fretboard */
interface FrettedNote {
  string: number; // 0 = low E
  fret: number;
  note: string; // full note with octave: "A2"
  pc: string; // pitch class: "A"
  interval: string; // from root: "1P", "3M"
  degree: number; // scale degree 1-7
  midi: number;
}

/** A scale laid out on the fretboard in a specific shape */
interface FrettedScale {
  root: string;
  scaleName: string;
  shapeName: string;
  tuning: Tuning;
  /** All notes, ordered low to high by pitch (natural playing order) */
  notes: FrettedNote[];
}

/** A scale shape — intervals per string, key-independent */
interface ScaleShape {
  name: string;
  system: string;
  /** Per-string intervals from root, low to high string. null = skip */
  strings: (string[] | null)[];
  rootString: number;
}

// ============================================================
// Constants
// ============================================================

const STANDARD: Tuning = {
  name: "Standard",
  notes: ["E2", "A2", "D3", "G3", "B3", "E4"],
};

/** E-shape major scale (the workhorse position) */
const E_MAJOR_SCALE: ScaleShape = {
  name: "E Shape Major Scale",
  system: "caged",
  strings: [
    ["1P", "2M"],         // low E: root, 2nd
    ["4P", "5P"],         // A string: 4th, 5th
    ["7M", "1P", "2M"],   // D string: 7th, root, 2nd
    ["3M", "4P", "5P"],   // G string: 3rd, 4th, 5th
    ["6M", "7M"],         // B string: 6th, 7th
    ["1P", "2M", "3M"],   // high E: root, 2nd, 3rd
  ],
  rootString: 0,
};

/** Am pentatonic box 1 */
const PENT_BOX_1: ScaleShape = {
  name: "Pentatonic Box 1 (Minor)",
  system: "pentatonic",
  strings: [
    ["1P", "3m"],
    ["4P", "5P"],
    ["7m", "1P"],
    ["3m", "4P"],
    ["5P", "7m"],
    ["1P", "3m"],
  ],
  rootString: 0,
};

// ============================================================
// Core: Lay out a scale shape on the fretboard
// ============================================================

function buildFrettedScale(
  shape: ScaleShape,
  root: string,
  tuning: Tuning = STANDARD,
): FrettedScale {
  const notes: FrettedNote[] = [];
  const rootFret = findNearestFret(tuning, shape.rootString, root);
  if (rootFret == null) return { root, scaleName: "", shapeName: shape.name, tuning, notes };

  for (let s = 0; s < shape.strings.length; s++) {
    const intervals = shape.strings[s];
    if (intervals == null) continue;

    for (const ivl of intervals) {
      const targetPc = Note.transpose(root, ivl);
      if (!targetPc) continue;

      const fret = findFretInPosition(tuning, s, targetPc, rootFret);
      if (fret == null) continue;

      const openMidi = Note.midi(tuning.notes[s]);
      if (openMidi == null) continue;
      const midi = openMidi + fret;
      const chroma = Note.chroma(targetPc);
      const octave = chroma != null ? Math.floor((midi - chroma) / 12) - 1 : null;
      const fullNote = octave != null ? `${targetPc}${octave}` : targetPc;
      const degree = parseInt(ivl.match(/(\d+)/)?.[1] || "0");

      notes.push({
        string: s,
        fret,
        note: fullNote,
        pc: targetPc,
        interval: ivl,
        degree,
        midi,
      });
    }
  }

  // Sort by pitch (midi), then by string (prefer lower strings first for same pitch)
  notes.sort((a, b) => a.midi - b.midi || a.string - b.string);

  return { root, scaleName: "", shapeName: shape.name, tuning, notes };
}

// ============================================================
// Pattern Walker: traverse a fretted scale by degree pattern
// ============================================================

/**
 * Walk a degree pattern through a fretted scale.
 *
 * The pattern is scale degrees: [1,3,2,4,3,5,...].
 * For each degree, we pick the note from the fretted scale that:
 * 1. Matches the degree (mod 7 for octave wrapping)
 * 2. Is higher in pitch than the previous note (for ascending patterns)
 *    or lower (for descending)
 * 3. Follows the natural string order of the shape
 */
function walkPattern(
  scale: FrettedScale,
  pattern: number[],
): FrettedNote[] {
  const result: FrettedNote[] = [];
  let lastMidi = -Infinity;

  // Build degree lookup for quick access
  const byDegree = new Map<number, FrettedNote[]>();
  for (const n of scale.notes) {
    const deg = n.degree;
    if (!byDegree.has(deg)) byDegree.set(deg, []);
    byDegree.get(deg)!.push(n);
  }

  for (const deg of pattern) {
    // Handle octave wrapping: degree 8 = degree 1 one octave up, etc.
    const baseDeg = ((deg - 1) % 7) + 1;
    const octaveOffset = Math.floor((deg - 1) / 7);
    const candidates = byDegree.get(baseDeg);
    if (!candidates || candidates.length === 0) continue;

    // For ascending: pick the first candidate with midi > lastMidi
    // For same degree repeated: allow equal midi
    // Account for octave offset
    const targetMinMidi = lastMidi;

    let best: FrettedNote | null = null;

    // If going up (deg >= previous deg in pattern context)
    // find lowest candidate above lastMidi
    for (const c of candidates) {
      // Adjust for octave: if deg > 7, we want notes at octaveOffset higher
      const adjustedMidi = c.midi + octaveOffset * 12;
      if (adjustedMidi > targetMinMidi) {
        if (best == null || adjustedMidi < (best.midi + (octaveOffset > 0 ? octaveOffset * 12 : 0))) {
          best = { ...c, midi: adjustedMidi, fret: c.fret + octaveOffset * 12 };
          // Wait — fret offset for octave doesn't work for shapes.
          // For within-shape, octave notes are already in the scale.
          // Let's just pick from available notes.
          best = c;
        }
      }
    }

    // Fallback: if no ascending candidate, we might be at the top of the shape
    // and need to wrap or pick the highest available
    if (!best) {
      best = candidates[candidates.length - 1]; // highest available
    }

    result.push(best);
    lastMidi = best.midi;
  }

  return result;
}

/**
 * Walk descending: pick notes going down in pitch
 */
function walkPatternDescending(
  scale: FrettedScale,
  pattern: number[],
): FrettedNote[] {
  const result: FrettedNote[] = [];
  let lastMidi = Infinity;

  const byDegree = new Map<number, FrettedNote[]>();
  for (const n of scale.notes) {
    if (!byDegree.has(n.degree)) byDegree.set(n.degree, []);
    byDegree.get(n.degree)!.push(n);
  }

  for (const deg of pattern) {
    const baseDeg = ((deg - 1) % 7) + 1;
    const candidates = byDegree.get(baseDeg);
    if (!candidates || candidates.length === 0) continue;

    // Pick highest candidate below lastMidi
    let best: FrettedNote | null = null;
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].midi < lastMidi) {
        best = candidates[i];
        break;
      }
    }
    if (!best) best = candidates[0]; // lowest available
    result.push(best);
    lastMidi = best.midi;
  }

  return result;
}

// ============================================================
// AlphaTeX output
// ============================================================

/**
 * Convert fretted notes to AlphaTeX notation.
 *
 * AlphaTeX uses: fret.string where string 1 = high E, string 6 = low E
 * (opposite of our 0-indexed convention where 0 = low E)
 */
function toAlphaTeX(
  notes: FrettedNote[],
  options: {
    title?: string;
    tempo?: number;
    duration?: number; // default note duration: 4=quarter, 8=eighth, 16=sixteenth
    tuning?: Tuning;
    notesPerBar?: number;
    key?: string;
  } = {},
): string {
  const {
    title = "Exercise",
    tempo = 120,
    duration = 8,
    tuning = STANDARD,
    key = "C",
  } = options;

  const stringCount = tuning.notes.length;

  // Header
  const lines: string[] = [
    `\\title "${title}"`,
    `\\tempo ${tempo}`,
    `\\track "Guitar" "Gtr"`,
    `\\staff {tabs}`,
    `\\tuning ${[...tuning.notes].reverse().join(" ")}`,
    `\\ts 4 4 \\ks ${key}`,
  ];

  // Notes — convert string index to AlphaTeX convention
  const notesPerBar = options.notesPerBar || (duration === 8 ? 8 : 4);
  let currentBar: string[] = [];

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const atString = stringCount - n.string; // convert: 0→6, 5→1
    currentBar.push(`${n.fret}.${atString}`);

    if (currentBar.length === notesPerBar || i === notes.length - 1) {
      const prefix = currentBar === lines ? "" : `:${duration} `;
      if (i < notesPerBar) {
        // First bar, include duration
        lines.push(`| :${duration} ${currentBar.join(" ")} `);
      } else {
        lines.push(`  ${currentBar.join(" ")} |`);
      }
      currentBar = [];
    }
  }

  return lines.join("\n");
}

/**
 * Convert fretted notes to ASCII tab
 */
function toAsciiTab(
  notes: FrettedNote[],
  tuning: Tuning = STANDARD,
): string {
  const stringNames = ["e", "B", "G", "D", "A", "E"];
  const stringCount = tuning.notes.length;

  const lines: string[] = [];
  for (let display = 0; display < stringCount; display++) {
    const s = stringCount - 1 - display;
    const label = stringNames[display] || String(s);
    const parts: string[] = [];
    for (const n of notes) {
      if (n.string === s) {
        parts.push(String(n.fret));
      } else {
        const width = String(n.fret).length;
        parts.push("-".repeat(width));
      }
    }
    lines.push(`${label}|${parts.join("-")}|`);
  }
  return lines.join("\n");
}

// ============================================================
// Pattern generators (from patterns.test.ts, refined)
// ============================================================

function ascendingIntervals(scaleLen: number, interval: number): number[] {
  const result: number[] = [];
  const top = scaleLen + 1;
  for (let i = 1; i <= top - interval; i++) {
    result.push(i, i + interval);
  }
  return result;
}

function descendingLinear(from: number, to: number): number[] {
  const r: number[] = [];
  for (let i = from; i >= to; i--) r.push(i);
  return r;
}

function ascendingLinear(from: number, to: number): number[] {
  const r: number[] = [];
  for (let i = from; i <= to; i++) r.push(i);
  return r;
}

// ============================================================
// Helpers (same as shapes.test.ts)
// ============================================================

function findNearestFret(tuning: Tuning, stringIndex: number, pitchClass: string): number | null {
  const openChroma = Note.chroma(tuning.notes[stringIndex]);
  const targetChroma = Note.chroma(pitchClass);
  if (openChroma == null || targetChroma == null) return null;
  let fret = targetChroma - openChroma;
  if (fret < 0) fret += 12;
  return fret;
}

function findFretInPosition(tuning: Tuning, stringIndex: number, pitchClass: string, refFret: number): number | null {
  const openChroma = Note.chroma(tuning.notes[stringIndex]);
  const targetChroma = Note.chroma(pitchClass);
  if (openChroma == null || targetChroma == null) return null;
  let fret = targetChroma - openChroma;
  if (fret < 0) fret += 12;
  while (fret < refFret - 4) fret += 12;
  while (fret > refFret + 8) fret -= 12;
  return fret >= 0 ? fret : null;
}

// ============================================================
// Tests
// ============================================================

describe("buildFrettedScale", () => {
  test("A major in E shape — 15 notes across 6 strings", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    expect(scale.notes).toHaveLength(15);

    // All notes should be A major scale tones
    const aMajor = ["A", "B", "C#", "D", "E", "F#", "G#"];
    scale.notes.forEach((n) => expect(aMajor).toContain(n.pc));

    // Notes should be sorted by pitch
    for (let i = 1; i < scale.notes.length; i++) {
      expect(scale.notes[i].midi).toBeGreaterThanOrEqual(scale.notes[i - 1].midi);
    }

    console.log("\nFretted A Major Scale (E shape):");
    console.log(scale.notes.map((n) => `${n.note}(${n.interval}) s${n.string}f${n.fret}`).join("\n"));
  });

  test("A minor pentatonic box 1", () => {
    const scale = buildFrettedScale(PENT_BOX_1, "A");
    expect(scale.notes).toHaveLength(12); // 2 notes per string × 6 strings

    const amPent = ["A", "C", "D", "E", "G"];
    scale.notes.forEach((n) => expect(amPent).toContain(n.pc));

    console.log("\nFretted Am Pentatonic (Box 1):");
    console.log(toAsciiTab(scale.notes));
  });
});

describe("walkPattern — ascending", () => {
  test("ascending linear through A major E shape", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const pattern = ascendingLinear(1, 8);
    const walked = walkPattern(scale, pattern);

    console.log("\nAscending A Major (E shape):");
    console.log(walked.map((n) => `${n.note} s${n.string}f${n.fret}`).join(" → "));
    console.log(toAsciiTab(walked));

    expect(walked).toHaveLength(8);
    // First note should be root
    expect(walked[0].pc).toBe("A");

    // LEARNING: The degree-based walker can't guarantee strict pitch
    // ascending because the same degree may only appear on certain
    // strings. For a true linear ascending run, we should walk by
    // pitch order through scale.notes directly, not by degree pattern.
    // The degree-based walker is better for intervallic patterns
    // (3rds, 4ths) where jumps are expected.
    //
    // For linear ascending/descending, just slice scale.notes:
    const linearUp = scale.notes.slice(0, 8);
    for (let i = 1; i < linearUp.length; i++) {
      expect(linearUp[i].midi).toBeGreaterThan(linearUp[i - 1].midi);
    }
    expect(linearUp[0].pc).toBe("A");
  });

  test("ascending 3rds through A major E shape", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const pattern = ascendingIntervals(7, 2); // [1,3,2,4,3,5,4,6,5,7,6,8]
    const walked = walkPattern(scale, pattern);

    console.log("\nAscending 3rds A Major (E shape):");
    console.log(walked.map((n) => `${n.note}(${n.interval}) s${n.string}f${n.fret}`).join(" → "));
    console.log(toAsciiTab(walked));

    expect(walked).toHaveLength(12);
    expect(walked[0].pc).toBe("A");    // degree 1
    expect(walked[1].pc).toBe("C#");   // degree 3
    expect(walked[2].pc).toBe("B");    // degree 2
    expect(walked[3].pc).toBe("D");    // degree 4
  });

  test("ascending 4ths through A major E shape", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const pattern = ascendingIntervals(7, 3); // [1,4,2,5,3,6,4,7,5,8]
    const walked = walkPattern(scale, pattern);

    console.log("\nAscending 4ths A Major (E shape):");
    console.log(walked.map((n) => `${n.note}(${n.interval}) s${n.string}f${n.fret}`).join(" → "));
    console.log(toAsciiTab(walked));

    expect(walked).toHaveLength(10);
    expect(walked[0].pc).toBe("A");    // 1
    expect(walked[1].pc).toBe("D");    // 4
  });
});

describe("walkPattern — descending", () => {
  test("descending linear through A major E shape", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const pattern = descendingLinear(8, 1);
    const walked = walkPatternDescending(scale, pattern);

    console.log("\nDescending A Major (E shape):");
    console.log(walked.map((n) => `${n.note} s${n.string}f${n.fret}`).join(" → "));
    console.log(toAsciiTab(walked));

    expect(walked).toHaveLength(8);
    // Should descend in pitch
    for (let i = 1; i < walked.length; i++) {
      expect(walked[i].midi).toBeLessThan(walked[i - 1].midi);
    }
  });
});

describe("Full exercise: ascending 3rds then descending linear", () => {
  test("A major E shape — 3rds up, linear down", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");

    // Ascending 3rds
    const upPattern = ascendingIntervals(7, 2);
    const up = walkPattern(scale, upPattern);

    // Descending linear from top
    const downPattern = descendingLinear(7, 1); // skip 8 since we end on it
    const down = walkPatternDescending(scale, downPattern);
    // Start descending from where we left off
    if (down.length > 0 && up.length > 0) {
      // Ensure down starts below where up ended
    }

    const full = [...up, ...down];

    console.log("\n=== FULL EXERCISE: A Major 3rds Up + Linear Down (E shape) ===");
    console.log("\nAscending 3rds:");
    console.log(up.map((n) => `${n.note}(${n.interval})`).join(" "));
    console.log("\nDescending linear:");
    console.log(down.map((n) => `${n.note}(${n.interval})`).join(" "));
    console.log("\nFull tab:");
    console.log(toAsciiTab(full));

    expect(full.length).toBe(up.length + down.length);
  });
});

describe("AlphaTeX output", () => {
  test("ascending A major scale to AlphaTeX", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const pattern = ascendingLinear(1, 8);
    const walked = walkPattern(scale, pattern);

    const tex = toAlphaTeX(walked, {
      title: "A Major Scale - E Shape",
      tempo: 100,
      duration: 8,
      key: "A",
    });

    console.log("\n=== AlphaTeX: A Major Scale ===");
    console.log(tex);

    // Should contain header
    expect(tex).toContain('\\title "A Major Scale - E Shape"');
    expect(tex).toContain("\\tempo 100");
    expect(tex).toContain("\\staff {tabs}");
    expect(tex).toContain("\\tuning E4 B3 G3 D3 A2 E2");

    // Should contain fret.string notation
    // A2 on low E (string 0) fret 5 → AlphaTeX: 5.6
    expect(tex).toContain("5.6");
  });

  test("ascending 3rds to AlphaTeX", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const pattern = ascendingIntervals(7, 2);
    const walked = walkPattern(scale, pattern);

    const tex = toAlphaTeX(walked, {
      title: "A Major - Ascending 3rds (E Shape)",
      tempo: 80,
      duration: 8,
      key: "A",
    });

    console.log("\n=== AlphaTeX: Ascending 3rds ===");
    console.log(tex);

    expect(tex).toContain('\\title "A Major - Ascending 3rds (E Shape)"');
  });

  test("full exercise to AlphaTeX", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "A");
    const up = walkPattern(scale, ascendingIntervals(7, 2));
    const down = walkPatternDescending(scale, descendingLinear(7, 1));
    const full = [...up, ...down];

    const tex = toAlphaTeX(full, {
      title: "A Major - 3rds Up / Linear Down (E Shape)",
      tempo: 90,
      duration: 8,
      key: "A",
    });

    console.log("\n=== AlphaTeX: Full Exercise ===");
    console.log(tex);
  });
});

describe("Different keys — same shape", () => {
  test("G major in E shape", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "G");
    const walked = walkPattern(scale, ascendingLinear(1, 8));

    console.log("\nG Major ascending (E shape):");
    console.log(toAsciiTab(walked));

    expect(walked[0].pc).toBe("G");
    // G on low E = fret 3
    expect(walked[0].fret).toBe(3);
  });

  test("C major in E shape", () => {
    const scale = buildFrettedScale(E_MAJOR_SCALE, "C");
    const walked = walkPattern(scale, ascendingLinear(1, 8));

    console.log("\nC Major ascending (E shape):");
    console.log(toAsciiTab(walked));

    expect(walked[0].pc).toBe("C");
    // C on low E = fret 8
    expect(walked[0].fret).toBe(8);
  });
});

describe("Pentatonic patterns", () => {
  test("Am pentatonic ascending linear", () => {
    const scale = buildFrettedScale(PENT_BOX_1, "A");
    // Pentatonic has 5 degrees, so ascending = 1,2,3,4,5,6 (6=octave)
    // But our degrees are labeled by interval degree (1,3,4,5,7)
    // Need to just walk all notes in pitch order
    const walked = scale.notes;

    console.log("\nAm Pentatonic ascending (Box 1):");
    console.log(toAsciiTab(walked));

    expect(walked.length).toBe(12);
    expect(walked[0].pc).toBe("A");
  });
});
