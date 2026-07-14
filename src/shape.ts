/**
 * Types and registries for guitar shapes (scales and chords).
 * Follows the ScaleType/ChordType registry pattern from Tonal.js.
 */

// ============================================================
// Shared types
// ============================================================

export interface FrettedNote {
  string: number; // 0 = lowest string
  fret: number;
  note: string; // "A2" — full note with octave
  pc: string; // "A" — pitch class
  interval: string; // "1P", "3M" — from root
  scaleIndex: number; // 0-based position in scale (FIX #1)
  degree: number; // 1-based = scaleIndex + 1 (FIX #1)
  intervalNumber: number; // Interval.num(ivl) — e.g. 3 for "3M" (FIX #1)
  midi: number;
}

export interface ScaleShape {
  name: string;
  system: string; // "caged" | "3nps" | "pentatonic" | "custom"
  strings: (string[] | null)[]; // per-string intervals, low to high
  rootString: number; // which string has the root
  span?: number; // optional fret span hint
  quality?: string; // interval-frame quality tag, e.g. "major" | "minor" | "minor-pentatonic"
  parentShape?: string; // name of the source shape a relabeled entry was derived from, e.g. "G Shape"
}

export type VoicingFamily =
  | "caged"
  | "extended"
  | "shell"
  | "open"
  | "barre"
  | "drop2"
  | "drop3"
  | "drop2+4"
  | "sweep";

export type VoicingPatternDictionary = Record<string, string[]>;

export interface ChordShape {
  name: string;
  system: string;
  strings: (string | null)[]; // one interval per string
  fingers: (number | null)[];
  barres: Barre[];
  rootString: number;
  // --- optional harmonic metadata (R-1.1) ---
  chordType?: string;
  inversion?: number;
  voicingFamily?: VoicingFamily;
  stringSet?: number[];
  omittedIntervals?: string[];
  canonicalRoot?: string;
  baseFret?: number;
}

export interface Barre {
  fret: number;
  fromString: number;
  toString: number;
  finger: number;
}

export interface FrettedScale {
  empty: boolean;
  root: string;
  scaleType: string;
  scaleName: string;
  shapeName: string;
  tuning: string[];
  notes: FrettedNote[];
  // Set only by buildFromScale (src/integration.ts): `true` when the input
  // shape was successfully relabeled into the requested scale's interval
  // frame via `relabelShape`, `false` when relabelShape returned `undefined`
  // (not rotation-compatible) and the original, unrelabeled shape was built
  // at the scale's tonic as a fallback — in that case `scaleName`/`scaleType`
  // still reflect the *requested* scale, but the notes' intervals/pitch
  // classes may not actually belong to it. Left `undefined` everywhere else
  // (the distinction doesn't apply).
  relabeled?: boolean;
}

// Sentinel value for invalid/empty results
export const NoFrettedScale: FrettedScale = {
  empty: true,
  root: "",
  scaleType: "",
  scaleName: "",
  shapeName: "",
  tuning: [],
  notes: [],
};

// ============================================================
// Scale shape registry
// ============================================================

let dictionary: ScaleShape[] = [];
let index: Map<string, ScaleShape> = new Map();

export function get(name: string): ScaleShape | undefined {
  return index.get(name);
}

export function all(): ScaleShape[] {
  return dictionary.slice();
}

export function names(): string[] {
  return dictionary.map((s) => s.name);
}

export function add(shape: ScaleShape): ScaleShape {
  dictionary.push(shape);
  index.set(shape.name, shape);
  return shape;
}

export function removeAll(): void {
  dictionary = [];
  index = new Map();
}

// ============================================================
// Chord shape registry
// ============================================================

let chordDictionary: ChordShape[] = [];
let chordIndex: Map<string, ChordShape> = new Map();

export const chordShapes = {
  get(name: string): ChordShape | undefined {
    return chordIndex.get(name);
  },
  all(): ChordShape[] {
    return chordDictionary.slice();
  },
  names(): string[] {
    return chordDictionary.map((s) => s.name);
  },
  add(shape: ChordShape): ChordShape {
    chordDictionary.push(shape);
    chordIndex.set(shape.name, shape);
    return shape;
  },
  removeAll(): void {
    chordDictionary = [];
    chordIndex = new Map();
  },
  query(filter: {
    chordType?: string;
    system?: string;
    voicingFamily?: VoicingFamily;
    stringSet?: number[];
  }): ChordShape[] {
    return chordDictionary.filter((shape) => {
      if (filter.chordType !== undefined && shape.chordType !== filter.chordType) {
        return false;
      }
      if (filter.system !== undefined && shape.system !== filter.system) {
        return false;
      }
      if (filter.voicingFamily !== undefined && shape.voicingFamily !== filter.voicingFamily) {
        return false;
      }
      if (filter.stringSet !== undefined) {
        if (JSON.stringify(shape.stringSet) !== JSON.stringify(filter.stringSet)) {
          return false;
        }
      }
      return true;
    });
  },
};
