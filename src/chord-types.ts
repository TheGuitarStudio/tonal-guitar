/**
 * Canonical chord-type table.
 *
 * One row per `chordType` key registered in the chord-shape registry
 * (`src/data/*.ts`), carrying everything a consumer needs to name, display
 * and resolve that quality without reaching into the registry itself.
 *
 * ## Purity contract
 *
 * This module has **no imports** — not from `./shape`, `./data`, `./build` or
 * `./index`, and not from Tonal. Importing it (directly, or through the
 * `tonal-guitar/chord-types` package subpath) registers **zero** shapes and
 * runs no side effects, so a consumer that only wants the vocabulary never
 * pays for the 132-shape registry. `src/chord-types.test.ts` enforces this
 * both statically (reading this file's text) and at runtime.
 *
 * ## Row fields
 *
 * | Field            | Meaning                                                                     |
 * | ---------------- | --------------------------------------------------------------------------- |
 * | `id`             | The registry `chordType` key, verbatim (`"6/9"`, `"mMaj7"`, `"add9"`).      |
 * | `tonalCanonical` | `ChordType.get(id).aliases[0]` — what Tonal canonicalises this quality to.  |
 * | `label`          | Human label for pickers (`"Major 7"`, `"Sus 4"`, `"Six-nine"`).             |
 * | `glyph`          | Lead-sheet suffix (`""`, `"-7"`, `"△7"`, `"ø7"`, `"°7"`).                   |
 * | `intervals`      | `ChordType.get(id).intervals`, in Tonal's compound-interval vocabulary.     |
 *
 * ## Alias divergences (the reason `tonalCanonical` exists)
 *
 * For 22 of the 25 rows `tonalCanonical === id`. Three diverge, and a
 * consumer that canonicalises a chord symbol through Tonal before querying
 * the registry silently finds nothing for them unless it bridges back:
 *
 * | `id`    | `tonalCanonical` |
 * | ------- | ---------------- |
 * | `add9`  | `Madd9`          |
 * | `6/9`   | `6add9`          |
 * | `mMaj7` | `m/ma7`          |
 *
 * ## `aug7` is deliberately absent
 *
 * `aug7` and `7#5` are the same Tonal chord — identical intervals
 * (`1P 3M 5A 7m`) and overlapping `detect` aliases. The registry indexes
 * chord types by exact string with no alias resolution, and registers `7#5`
 * only (see `src/data/extended-chords.ts`'s "Interop divergence catalog"), so
 * `chordShapes.query({ chordType: "aug7" })` returns nothing by design. Giving
 * `aug7` its own row here would break the table's central invariant — every
 * `id` is voiceable and every registered key is in the table — so callers that
 * see `aug7` should map it onto the `7#5` row.
 */

/** One canonical chord type. */
export interface ChordTypeEntry {
  /** Registry `chordType` key, verbatim. */
  readonly id: string;
  /** `ChordType.get(id).aliases[0]` — Tonal's canonical spelling. */
  readonly tonalCanonical: string;
  /** Human label for pickers. */
  readonly label: string;
  /** Lead-sheet suffix glyph. */
  readonly glyph: string;
  /** `ChordType.get(id).intervals`, Tonal compound-interval vocabulary. */
  readonly intervals: readonly string[];
}

/**
 * The 25 registered chord types, in picker order (triads and sevenths first,
 * then suspensions, altered dominants and extensions).
 */
export const CHORD_TYPE_TABLE = [
  {
    id: "M",
    tonalCanonical: "M",
    label: "Major",
    glyph: "",
    intervals: ["1P", "3M", "5P"],
  },
  {
    id: "m",
    tonalCanonical: "m",
    label: "Minor",
    glyph: "-",
    intervals: ["1P", "3m", "5P"],
  },
  {
    id: "7",
    tonalCanonical: "7",
    label: "Dominant 7",
    glyph: "7",
    intervals: ["1P", "3M", "5P", "7m"],
  },
  {
    id: "maj7",
    tonalCanonical: "maj7",
    label: "Major 7",
    glyph: "△7",
    intervals: ["1P", "3M", "5P", "7M"],
  },
  {
    id: "m7",
    tonalCanonical: "m7",
    label: "Minor 7",
    glyph: "-7",
    intervals: ["1P", "3m", "5P", "7m"],
  },
  {
    id: "m7b5",
    tonalCanonical: "m7b5",
    label: "Minor 7b5",
    glyph: "ø7",
    intervals: ["1P", "3m", "5d", "7m"],
  },
  {
    id: "dim",
    tonalCanonical: "dim",
    label: "Diminished",
    glyph: "°",
    intervals: ["1P", "3m", "5d"],
  },
  {
    id: "sus2",
    tonalCanonical: "sus2",
    label: "Sus 2",
    glyph: "sus2",
    intervals: ["1P", "2M", "5P"],
  },
  {
    id: "sus4",
    tonalCanonical: "sus4",
    label: "Sus 4",
    glyph: "sus4",
    intervals: ["1P", "4P", "5P"],
  },
  {
    id: "aug",
    tonalCanonical: "aug",
    label: "Augmented",
    glyph: "+",
    intervals: ["1P", "3M", "5A"],
  },
  {
    id: "7#5",
    tonalCanonical: "7#5",
    label: "Dominant 7#5",
    glyph: "7#5",
    intervals: ["1P", "3M", "5A", "7m"],
  },
  {
    id: "7sus4",
    tonalCanonical: "7sus4",
    label: "Dominant 7 Sus 4",
    glyph: "7sus4",
    intervals: ["1P", "4P", "5P", "7m"],
  },
  {
    id: "7b5",
    tonalCanonical: "7b5",
    label: "Dominant 7b5",
    glyph: "7b5",
    intervals: ["1P", "3M", "5d", "7m"],
  },
  {
    id: "13",
    tonalCanonical: "13",
    label: "Thirteenth",
    glyph: "13",
    intervals: ["1P", "3M", "5P", "7m", "9M", "13M"],
  },
  {
    id: "mMaj7",
    tonalCanonical: "m/ma7",
    label: "Minor Major 7",
    glyph: "-△7",
    intervals: ["1P", "3m", "5P", "7M"],
  },
  {
    id: "maj9",
    tonalCanonical: "maj9",
    label: "Major 9",
    glyph: "△9",
    intervals: ["1P", "3M", "5P", "7M", "9M"],
  },
  {
    id: "m9",
    tonalCanonical: "m9",
    label: "Minor 9",
    glyph: "-9",
    intervals: ["1P", "3m", "5P", "7m", "9M"],
  },
  {
    id: "m6",
    tonalCanonical: "m6",
    label: "Minor 6",
    glyph: "-6",
    intervals: ["1P", "3m", "5P", "6M"],
  },
  {
    id: "dim7",
    tonalCanonical: "dim7",
    label: "Diminished 7",
    glyph: "°7",
    intervals: ["1P", "3m", "5d", "7d"],
  },
  {
    id: "add9",
    tonalCanonical: "Madd9",
    label: "Add 9",
    glyph: "add9",
    intervals: ["1P", "3M", "5P", "9M"],
  },
  {
    id: "9",
    tonalCanonical: "9",
    label: "Dominant 9",
    glyph: "9",
    intervals: ["1P", "3M", "5P", "7m", "9M"],
  },
  {
    id: "7b9",
    tonalCanonical: "7b9",
    label: "Dominant 7b9",
    glyph: "7b9",
    intervals: ["1P", "3M", "5P", "7m", "9m"],
  },
  {
    id: "7#9",
    tonalCanonical: "7#9",
    label: "Dominant 7#9",
    glyph: "7#9",
    intervals: ["1P", "3M", "5P", "7m", "9A"],
  },
  {
    id: "6/9",
    tonalCanonical: "6add9",
    label: "Six-nine",
    glyph: "6/9",
    intervals: ["1P", "3M", "5P", "6M", "9M"],
  },
  {
    id: "6",
    tonalCanonical: "6",
    label: "Major 6",
    glyph: "6",
    intervals: ["1P", "3M", "5P", "6M"],
  },
] as const satisfies readonly ChordTypeEntry[];

/** One row of {@link CHORD_TYPE_TABLE}, with literal field types. */
export type ChordTypeRow = (typeof CHORD_TYPE_TABLE)[number];

/** Literal union of every registered `chordType` key. */
export type ChordTypeKey = ChordTypeRow["id"];

/**
 * Every registered `chordType` key, in {@link CHORD_TYPE_TABLE} order, as a
 * literal tuple (so consumers can feed it to `z.enum` or index a
 * `Record<ChordTypeKey, …>` without widening to `string[]`).
 *
 * Written out rather than derived so it stays a tuple; `chord-types.test.ts`
 * asserts it equals `CHORD_TYPE_TABLE.map((row) => row.id)` element for
 * element, so the two can never drift.
 */
export const CHORD_TYPE_KEYS = [
  "M",
  "m",
  "7",
  "maj7",
  "m7",
  "m7b5",
  "dim",
  "sus2",
  "sus4",
  "aug",
  "7#5",
  "7sus4",
  "7b5",
  "13",
  "mMaj7",
  "maj9",
  "m9",
  "m6",
  "dim7",
  "add9",
  "9",
  "7b9",
  "7#9",
  "6/9",
  "6",
] as const satisfies readonly ChordTypeKey[];
