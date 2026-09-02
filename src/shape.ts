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

// Board/graph column key shared by ScaleShape, ChordShape and ArpeggioShape
// (shape-workbench, spec §1.1). Today the letter only exists in the name
// prefix under two conventions ("E Shape …" vs "E Form … Barre"); this field
// gives it a first-class, queryable home.
export type CagedPosition = "C" | "A" | "G" | "E" | "D";

export interface ScaleShape {
  name: string;
  system: string; // "caged" | "3nps" | "pentatonic" | "custom"
  strings: (string[] | null)[]; // per-string intervals, low to high
  rootString: number; // which string has the root
  span?: number; // optional fret span hint
  quality?: string; // interval-frame quality tag, e.g. "major" | "minor" | "minor-pentatonic"
  parentShape?: string; // name of the source shape a relabeled entry was derived from, e.g. "G Shape"
  // Optional/curated spotlight-tier flag (site "Shape Detail Panel" feature,
  // D-006 amendment 3): marks the canonical representative shape per
  // (system, quality) group for catalog display purposes only. Not required,
  // has no default, and is intentionally NOT referenced by
  // checkScaleMetadataCompleteness — see audit.ts's dependency-layer note.
  featured?: boolean;
  // --- shape-workbench additive metadata (spec §1.3) ---
  cagedPosition?: CagedPosition; // board/graph column key, see CagedPosition
  // Chord symbol this scale is associated with (e.g. box-per-chord-type
  // systems). When present, always the `Chord.get(...).symbol` suffix
  // (e.g. "m7") — never `detect()` output. Same contract as
  // ChordShape.chordType.
  chordType?: string;
  tags?: string[]; // free-form curation vocabulary, never part of `name`
  tuning?: string[]; // absent => STANDARD; recorded by the editor at save time
  overrides?: string; // name of the core entry this shape replaces (teacher-override mechanism)
  notes?: string; // authoring notes that survive to runtime
}

export type VoicingFamily =
  | "caged"
  | "extended"
  | "triad"
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
  // Optional/curated spotlight-tier flag (site "Shape Detail Panel" feature,
  // D-006 amendment 3): marks the canonical representative shape per
  // chordType for catalog display purposes only (e.g. the open-position
  // voicing, or lowest-baseFret movable form). Not required, has no
  // default, and is intentionally NOT referenced by
  // checkChordMetadataCompleteness — see audit.ts's dependency-layer note.
  featured?: boolean;
  // --- shape-workbench additive metadata (spec §1.2) ---
  cagedPosition?: CagedPosition; // board/graph column key, see CagedPosition
  // Explicit "can this shape be transposed to any root" flag. Default when
  // unset is `canonicalRoot === undefined` (see `isMovable` helper) — never
  // written for existing shapes; this field only overrides that default.
  movable?: boolean;
  // Name of the shape this was derived from (e.g. "E Shape Minor" ← "E Shape
  // Major"). One-way, same semantics as ScaleShape.parentShape.
  parentShape?: string;
  tags?: string[]; // free-form curation vocabulary, never part of `name`
  tuning?: string[]; // absent => STANDARD; recorded by the editor at save time
  overrides?: string; // name of the core entry this shape replaces (teacher-override mechanism)
  notes?: string; // authoring notes that survive to runtime
}

export interface Barre {
  fret: number;
  fromString: number;
  toString: number;
  finger: number;
}

/**
 * An arpeggio shape: the notes of a chord laid out across the fretboard as a
 * scale-like run rather than a single grip. Structurally an `ArpeggioShape`
 * IS a `ScaleShape` (it only narrows `chordType` to required and adds a few
 * arpeggio-specific fields), so `buildFrettedScale`, `walkShape`,
 * `inferShapeContext` and `checkScaleBuildLoss` all work unchanged on it
 * with no code changes in this feature. No seed data ships for this
 * interface yet — see the `arpeggioShapes` registry (later group) for where
 * it starts getting populated.
 */
export interface ArpeggioShape extends ScaleShape {
  // REQUIRED here (unlike the optional ScaleShape.chordType) — an arpeggio
  // always outlines a chord. Always the `Chord.get(...).symbol` suffix.
  chordType: string;
  fingers?: (number | null)[][]; // per-string, parallel to strings[]
  chordShape?: string; // the grip this arpeggio belongs to, e.g. "E Shape m7"
  cagedPosition?: CagedPosition;
  overrides?: string; // core entry replaced by this (teacher) version
}

export interface FrettedScale {
  empty: boolean;
  root: string;
  scaleType: string;
  scaleName: string;
  shapeName: string;
  tuning: string[];
  notes: FrettedNote[];
  /**
   * Build-engine anchor fret (see `findShapeAnchorFret` in build.ts): the
   * fret of the FIRST interval in `shape.strings[shape.rootString]`, as
   * computed by `buildFrettedScale`. Optional/additive — only populated by
   * `buildFrettedScale`; other constructors (e.g. `filterChordTones`,
   * `arpeggioFromScale`) leave it unset. Exposing it here lets callers
   * (e.g. `inferShapeContext`) reuse the anchor already computed during the
   * build instead of recomputing it via a second `findShapeAnchorFret` call.
   */
  anchorFret?: number;
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

/**
 * Registries (below, and `chordShapes`/`arpeggioShapes`) are the project's
 * one sanctioned mutation seam: shapes are registered via side-effect
 * `add()` calls at module import time (see registry pattern note at the top
 * of this file), and later phases add `remove()` and replace-on-same-name
 * `add()` semantics to support teacher overrides and live editing. That
 * in-place mutation of the registry's internal dictionary/index does NOT
 * violate the "pure functions only, no mutation" design convention — the
 * convention governs the shape/build/audit computation functions
 * (`buildFrettedScale`, `walkShape`, etc.), which remain pure and
 * side-effect-free; the registries are deliberately the one place state
 * lives, analogous to Tonal.js's own ScaleType/ChordType registries.
 */
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
  const existing = index.get(shape.name);
  if (existing !== undefined) {
    const position = dictionary.indexOf(existing);
    if (position !== -1) {
      dictionary[position] = shape;
    } else {
      dictionary.push(shape);
    }
  } else {
    dictionary.push(shape);
  }
  index.set(shape.name, shape);
  return shape;
}

export function remove(name: string): boolean {
  const existing = index.get(name);
  if (existing === undefined) {
    return false;
  }
  const position = dictionary.indexOf(existing);
  if (position !== -1) {
    dictionary.splice(position, 1);
  }
  index.delete(name);
  return true;
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
    const existing = chordIndex.get(shape.name);
    if (existing !== undefined) {
      const position = chordDictionary.indexOf(existing);
      if (position !== -1) {
        chordDictionary[position] = shape;
      } else {
        chordDictionary.push(shape);
      }
    } else {
      chordDictionary.push(shape);
    }
    chordIndex.set(shape.name, shape);
    return shape;
  },
  remove(name: string): boolean {
    const existing = chordIndex.get(name);
    if (existing === undefined) {
      return false;
    }
    const position = chordDictionary.indexOf(existing);
    if (position !== -1) {
      chordDictionary.splice(position, 1);
    }
    chordIndex.delete(name);
    return true;
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
    cagedPosition?: CagedPosition;
    tags?: string[];
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
      if (filter.cagedPosition !== undefined && shape.cagedPosition !== filter.cagedPosition) {
        return false;
      }
      if (filter.tags !== undefined) {
        const shapeTags = shape.tags ?? [];
        if (!filter.tags.every((tag) => shapeTags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  },
};

// ============================================================
// Arpeggio shape registry
// ============================================================
// Mirrors chordShapes exactly (get/all/names/add/remove/removeAll/query).
// Ships with zero seeded data — see `data/*` for a later phase.

let arpeggioDictionary: ArpeggioShape[] = [];
let arpeggioIndex: Map<string, ArpeggioShape> = new Map();

export const arpeggioShapes = {
  get(name: string): ArpeggioShape | undefined {
    return arpeggioIndex.get(name);
  },
  all(): ArpeggioShape[] {
    return arpeggioDictionary.slice();
  },
  names(): string[] {
    return arpeggioDictionary.map((s) => s.name);
  },
  add(shape: ArpeggioShape): ArpeggioShape {
    const existing = arpeggioIndex.get(shape.name);
    if (existing !== undefined) {
      const position = arpeggioDictionary.indexOf(existing);
      if (position !== -1) {
        arpeggioDictionary[position] = shape;
      } else {
        arpeggioDictionary.push(shape);
      }
    } else {
      arpeggioDictionary.push(shape);
    }
    arpeggioIndex.set(shape.name, shape);
    return shape;
  },
  remove(name: string): boolean {
    const existing = arpeggioIndex.get(name);
    if (existing === undefined) {
      return false;
    }
    const position = arpeggioDictionary.indexOf(existing);
    if (position !== -1) {
      arpeggioDictionary.splice(position, 1);
    }
    arpeggioIndex.delete(name);
    return true;
  },
  removeAll(): void {
    arpeggioDictionary = [];
    arpeggioIndex = new Map();
  },
  query(filter: {
    chordType?: string;
    system?: string;
    cagedPosition?: CagedPosition;
    tags?: string[];
    chordShape?: string;
    overrides?: string;
  }): ArpeggioShape[] {
    return arpeggioDictionary.filter((shape) => {
      if (filter.chordType !== undefined && shape.chordType !== filter.chordType) {
        return false;
      }
      if (filter.system !== undefined && shape.system !== filter.system) {
        return false;
      }
      if (filter.cagedPosition !== undefined && shape.cagedPosition !== filter.cagedPosition) {
        return false;
      }
      if (filter.tags !== undefined) {
        const shapeTags = shape.tags ?? [];
        if (!filter.tags.every((tag) => shapeTags.includes(tag))) {
          return false;
        }
      }
      if (filter.chordShape !== undefined && shape.chordShape !== filter.chordShape) {
        return false;
      }
      if (filter.overrides !== undefined && shape.overrides !== filter.overrides) {
        return false;
      }
      return true;
    });
  },
};
