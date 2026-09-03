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
  // Offset in frets from the shape's grip base (D-010), NOT an absolute
  // fret: `gripBase` is the lowest *fretted* (non-null, non-zero) fret of
  // the shape as placed — open strings never set it. Resolve to an
  // absolute fret with `absoluteBarreFret(barre, gripBaseFret(frets))` for
  // a built grip, or `absoluteBarreFret(barre, sourceGripBaseFret(shape,
  // chordShapeGeometry(shape).sourceFrets))` for an authored source
  // diagram. Existing `src/data/*` shapes still store the pre-D-010
  // absolute value — see the barre-fret migration task for the conversion.
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

// ============================================================
// Shape identity & geometry helpers (shape-workbench spec §1.8)
// ============================================================

/**
 * Whether a chord shape can be transposed to any root. Explicit `movable`
 * wins when set; otherwise defaults to `canonicalRoot === undefined` (a
 * shape authored against a specific root, e.g. an open-position chord, is
 * not movable unless it says so). This is the single source of truth for
 * that default — callers (e.g. `checkFingerZeroOnMovable` in `audit.ts`)
 * should use this helper instead of open-coding the `canonicalRoot`
 * comparison.
 */
export function isMovable(shape: ChordShape): boolean {
  return shape.movable ?? shape.canonicalRoot === undefined;
}

/** Indices of `shape.strings` that are actually played (non-null). */
export function playedStringSet(shape: ChordShape): number[] {
  return shape.strings
    .map((s, i) => (s != null ? i : null))
    .filter((i): i is number => i != null);
}

/**
 * The string set a shape implies: its explicit `stringSet` when present,
 * else the strings actually played (`playedStringSet`). Use this instead of
 * reading `shape.stringSet` directly when a fallback is needed.
 */
export function impliedStringSet(shape: ChordShape): number[] {
  return shape.stringSet ?? playedStringSet(shape);
}

/**
 * The grip base fret for a set of per-string frets: the minimum *fretted*
 * (non-null, non-zero) fret, or `0` when there are no fretted strings (all
 * open/muted). Open strings (`0`) never set the grip base — see D-010.
 */
export function gripBaseFret(frets: (number | null)[]): number {
  const fretted = frets.filter((f): f is number => f != null && f !== 0);
  return fretted.length === 0 ? 0 : Math.min(...fretted);
}

/**
 * Resolves a `Barre.fret` (an offset from the grip base, D-010) to an
 * absolute fret for a built grip: `gripBase + barre.fret`.
 */
export function absoluteBarreFret(barre: Barre, gripBase: number): number {
  return gripBase + barre.fret;
}

/**
 * The source-diagram analog of `gripBaseFret`: the grip base implied by a
 * shape's authored source diagram rather than a built fingering. `shape` is
 * accepted (unused directly) to mirror `gripBaseFret`'s call shape and keep
 * the two symmetric at call sites; `sourceFrets` is the per-string fret
 * array to reduce — typically `chordShapeGeometry(shape).sourceFrets` from
 * `audit.ts`.
 */
export function sourceGripBaseFret(
  _shape: ChordShape,
  sourceFrets: (number | null)[],
): number {
  return gripBaseFret(sourceFrets);
}

/**
 * Deterministic export identifier for a shape: `<KIND_PREFIX>_<NAME>` with
 * the name upper-cased and non-alphanumeric runs collapsed to underscores.
 * E.g. `("chord", { name: "E Shape Minor" })` → `"CHORD_E_SHAPE_MINOR"`.
 * This is NOT an attempt to derive existing hand-written shorthand (e.g.
 * `CAGED_CHORD_EM`) — those require an explicit `ident` override in the
 * changeset. Collisions between distinct names must be detected by callers
 * (e.g. `checkNameUnique`), never guessed away here.
 */
export function exportIdentifierFor(
  kind: "chord" | "scale" | "arpeggio",
  shape: { name: string },
): string {
  const prefix = kind.toUpperCase();
  const nameSlug = shape.name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${nameSlug}`;
}

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
// Registry mutation counter (CR-107)
// ============================================================
// Monotonically-increasing counter, bumped on every registry mutation
// (add/replace, remove, removeAll) across all three registries (scale,
// chord, arpeggio). Callers that need to detect "did the registry change
// since I last looked" (e.g. audit.ts's identifier-index cache) should key
// off this instead of registry *size* — size alone goes stale on a
// net-zero-size `remove(old); add(renamed)` sequence, since it's unchanged
// before/after. Module-private state, mirroring the registries themselves
// (see the "one sanctioned mutation seam" note above) — exposed only via the
// reader below.
let registryMutationCount = 0;

/** Current value of the registry mutation counter — see CR-107 note above. */
export function registryMutationVersion(): number {
  return registryMutationCount;
}

// ============================================================
// Registry helpers (shared by the scale/chord/arpeggio registries below)
// ============================================================
// Module-private: the three registries share identical
// add-or-replace-by-name / remove-by-name logic over a (dictionary array,
// name→shape index) pair. Parameterizing on that pair keeps each registry's
// own add()/remove() a one-line call while preserving exact prior behavior.

function upsertShape<T extends { name: string }>(
  dict: T[],
  idx: Map<string, T>,
  shape: T,
): T {
  const existing = idx.get(shape.name);
  if (existing !== undefined) {
    const position = dict.indexOf(existing);
    if (position !== -1) {
      dict[position] = shape;
    } else {
      dict.push(shape);
    }
  } else {
    dict.push(shape);
  }
  idx.set(shape.name, shape);
  registryMutationCount++;
  return shape;
}

function removeShapeByName<T>(dict: T[], idx: Map<string, T>, name: string): boolean {
  const existing = idx.get(name);
  if (existing === undefined) {
    return false;
  }
  const position = dict.indexOf(existing);
  if (position !== -1) {
    dict.splice(position, 1);
  }
  idx.delete(name);
  registryMutationCount++;
  return true;
}

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
  return upsertShape(dictionary, index, shape);
}

export function remove(name: string): boolean {
  return removeShapeByName(dictionary, index, name);
}

export function removeAll(): void {
  dictionary = [];
  index = new Map();
  registryMutationCount++;
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
    return upsertShape(chordDictionary, chordIndex, shape);
  },
  remove(name: string): boolean {
    return removeShapeByName(chordDictionary, chordIndex, name);
  },
  removeAll(): void {
    chordDictionary = [];
    chordIndex = new Map();
    registryMutationCount++;
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
    return upsertShape(arpeggioDictionary, arpeggioIndex, shape);
  },
  remove(name: string): boolean {
    return removeShapeByName(arpeggioDictionary, arpeggioIndex, name);
  },
  removeAll(): void {
    arpeggioDictionary = [];
    arpeggioIndex = new Map();
    registryMutationCount++;
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

// ============================================================
// Arpeggio resolver layer (shape-workbench spec §1.7, D-011)
// ============================================================
// Pure, registry-only: resolves "which arpeggio shape should render for this
// slot" with override → core → derived precedence. The *derived* fallback
// itself (deriving a run from a chord shape/scale when no arpeggio is
// registered) lives in the optional tier (integration.ts, spec §2.4) — this
// module only reports that no stored candidate exists (`tier: "derived"`,
// no `shape` set).

/** Identifies a (chordType, position, root) slot an arpeggio can occupy. */
export interface ArpeggioSlot {
  chordType: string;
  cagedPosition?: CagedPosition;
  system?: string;
  rootString: number;
  chordShapeName?: string;
}

export type ArpeggioTier = "override" | "core" | "derived";

export interface ArpeggioResolution {
  tier: ArpeggioTier;
  shape?: ArpeggioShape; // set for "override" | "core"
  core?: ArpeggioShape; // the entry an override replaces, still reachable
  alternatives: ArpeggioShape[]; // other overrides registered for the same slot
  slotKey: string;
}

/**
 * Stable, deterministic key for an `ArpeggioSlot`:
 * `${system ?? "*"}|${chordType}|${cagedPosition ?? "*"}|${rootString}`.
 * `chordShapeName` is descriptive only and never part of the key.
 */
export function arpeggioSlotKey(slot: ArpeggioSlot): string {
  return `${slot.system ?? "*"}|${slot.chordType}|${slot.cagedPosition ?? "*"}|${slot.rootString}`;
}

/** The slot an `ArpeggioSlot` would occupy, given a registered `ArpeggioShape`. */
function slotOfArpeggio(shape: ArpeggioShape): ArpeggioSlot {
  return {
    chordType: shape.chordType,
    cagedPosition: shape.cagedPosition,
    system: shape.system,
    rootString: shape.rootString,
  };
}

/**
 * Derives the `ArpeggioSlot` a chord shape's arpeggio would occupy:
 * `chordType`, `cagedPosition`, `system` and `rootString` come straight from
 * the chord shape, plus `chordShapeName: shape.name` for traceability back
 * to the grip. `chordType` defaults to `""` when the chord shape doesn't
 * carry one (optional there, required on `ArpeggioSlot`).
 */
export function slotForChordShape(shape: ChordShape): ArpeggioSlot {
  return {
    chordType: shape.chordType ?? "",
    cagedPosition: shape.cagedPosition,
    system: shape.system,
    rootString: shape.rootString,
    chordShapeName: shape.name,
  };
}

/**
 * Resolves the arpeggio that should render for a slot, in override → core →
 * derived precedence:
 *
 * - A registered arpeggio is a **candidate** for `slot` when its own slot
 *   (`chordType`/`cagedPosition`/`system`/`rootString`) produces the same
 *   `arpeggioSlotKey`.
 * - A candidate is an **override** iff its `overrides` field names another
 *   registered arpeggio whose slot key also matches. When more than one
 *   override targets the slot, the deterministic pick is the **last
 *   registered** one (registry array order); the rest are returned in
 *   `alternatives`.
 * - Otherwise the **core** candidate is picked from the non-override
 *   candidates: `featured === true` first, else the first registered.
 * - `tier: "derived"` (no `shape` set) when no stored candidate exists at all.
 */
export function resolveArpeggioForSlot(slot: ArpeggioSlot): ArpeggioResolution {
  const slotKey = arpeggioSlotKey(slot);
  const candidates = arpeggioShapes
    .all()
    .filter((shape) => arpeggioSlotKey(slotOfArpeggio(shape)) === slotKey);

  const overrideCandidates: ArpeggioShape[] = [];
  const plainCandidates: ArpeggioShape[] = [];
  for (const shape of candidates) {
    const target = shape.overrides !== undefined ? arpeggioShapes.get(shape.overrides) : undefined;
    const isOverride = target !== undefined && arpeggioSlotKey(slotOfArpeggio(target)) === slotKey;
    if (isOverride) {
      overrideCandidates.push(shape);
    } else {
      plainCandidates.push(shape);
    }
  }

  if (overrideCandidates.length > 0) {
    const chosen = overrideCandidates[overrideCandidates.length - 1];
    const alternatives = overrideCandidates.slice(0, -1);
    const core = chosen.overrides !== undefined ? arpeggioShapes.get(chosen.overrides) : undefined;
    return { tier: "override", shape: chosen, core, alternatives, slotKey };
  }

  if (plainCandidates.length > 0) {
    const featured = plainCandidates.find((shape) => shape.featured === true);
    const chosen = featured ?? plainCandidates[0];
    return { tier: "core", shape: chosen, alternatives: [], slotKey };
  }

  return { tier: "derived", alternatives: [], slotKey };
}

/**
 * All registered arpeggio shapes that should be visible in a listing:
 * excludes every shape that is the `overrides` target of another registered
 * shape (it's still reachable via `resolveArpeggioForSlot`'s `core` field),
 * unless `includeOverridden: true` returns everything unfiltered.
 */
export function visibleArpeggios(options?: { includeOverridden?: boolean }): ArpeggioShape[] {
  const all = arpeggioShapes.all();
  if (options?.includeOverridden) {
    return all;
  }
  const overriddenNames = new Set<string>();
  for (const shape of all) {
    if (shape.overrides !== undefined) {
      overriddenNames.add(shape.overrides);
    }
  }
  return all.filter((shape) => !overriddenNames.has(shape.name));
}
