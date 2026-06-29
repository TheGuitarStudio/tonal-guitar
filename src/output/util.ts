import type { FrettedNote } from "../shape";

/**
 * Normalize flat FrettedNote[] or grouped FrettedNote[][] to grouped form
 * (singleton groups for flat input). Empty array → flat path → [].
 */
export function normalizeGroups(notes: FrettedNote[] | FrettedNote[][]): FrettedNote[][] {
  return Array.isArray(notes[0]) ? (notes as FrettedNote[][]) : (notes as FrettedNote[]).map((n) => [n]);
}
