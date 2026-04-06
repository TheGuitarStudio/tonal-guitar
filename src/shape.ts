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
}

export interface ChordShape {
  name: string;
  system: string;
  strings: (string | null)[]; // one interval per string
  fingers: (number | null)[];
  barres: Barre[];
  rootString: number;
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
let index: Record<string, ScaleShape> = {};

export function get(name: string): ScaleShape | undefined {
  return index[name];
}

export function all(): ScaleShape[] {
  return dictionary.slice();
}

export function names(): string[] {
  return dictionary.map((s) => s.name);
}

export function add(shape: ScaleShape): ScaleShape {
  dictionary.push(shape);
  index[shape.name] = shape;
  return shape;
}

export function removeAll(): void {
  dictionary = [];
  index = {};
}

// ============================================================
// Chord shape registry
// ============================================================

let chordDictionary: ChordShape[] = [];
let chordIndex: Record<string, ChordShape> = {};

export const chordShapes = {
  get(name: string): ChordShape | undefined {
    return chordIndex[name];
  },
  all(): ChordShape[] {
    return chordDictionary.slice();
  },
  names(): string[] {
    return chordDictionary.map((s) => s.name);
  },
  add(shape: ChordShape): ChordShape {
    chordDictionary.push(shape);
    chordIndex[shape.name] = shape;
    return shape;
  },
  removeAll(): void {
    chordDictionary = [];
    chordIndex = {};
  },
};
