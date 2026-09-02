/**
 * Chord-to-scale rule table (v1).
 *
 * Maps a chord type (as used in `ChordShape.chordType`) to the scale type that
 * supplies its parent box, plus optional alternate scale choices. Stored explicitly
 * and versioned so the mapping can evolve without changing authored shape data.
 *
 * Zero Tonal deps — this module is pure data plus one lookup function. Name
 * resolution against Tonal.js scale/chord data happens in the integration tier
 * (see `src/integration.ts`), not here.
 */

export const CHORD_SCALE_RULE_VERSION = 1;

export interface ChordScaleEntry {
  scaleType: string;
  alternates?: string[];
}

export const CHORD_SCALE_RULE: Record<string, ChordScaleEntry> = {
  M: { scaleType: "major" },
  maj7: { scaleType: "major" },
  m: { scaleType: "aeolian", alternates: ["dorian", "major"] },
  m7: { scaleType: "aeolian", alternates: ["dorian", "major"] },
  "7": { scaleType: "mixolydian" },
  m7b5: { scaleType: "locrian" },
};

/**
 * Looks up the v1 chord-scale rule entry for a given chord type.
 *
 * Returns `undefined` for chord types with no rule entry (e.g. `dim`, `dim7`,
 * `aug`) — intentionally absent because there is no box system for them yet;
 * callers should derive the parent box from the grip only in that case.
 */
export function scaleTypeForChordType(chordType: string): ChordScaleEntry | undefined {
  return CHORD_SCALE_RULE[chordType];
}
