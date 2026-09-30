/**
 * Field-level shape diffing for the Export screen's per-change diff (spec
 * §5.4 "per-change diff (TS diff / JSON / before-after) from `diffShape`")
 * and, internally, for `changeset.ts`'s `draftToChange` (an "existing"-
 * origin draft's `UpdateChange.patch` is exactly this diff's added+changed
 * fields).
 *
 * Zero React/DOM imports. Imports only types from "tonal-guitar".
 */
import type { ArpeggioShape, ChordShape, ScaleShape } from "tonal-guitar";

export type DiffableShape = ChordShape | ScaleShape | ArpeggioShape;

export interface ShapeFieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ShapeDiff {
  /** Fields present on `after` but not (or `undefined`) on `before`. */
  added: string[];
  /** Fields present on `before` but not (or `undefined`) on `after`. */
  removed: string[];
  /** Fields present on both with a deep-unequal value, sorted by `field`. */
  changed: ShapeFieldChange[];
  /** `true` when any of `added`/`removed`/`changed` touches a geometry
   * field (`strings`, `fingers`, `barres`, `rootString`, `baseFret`,
   * `span`) rather than pure metadata (`tags`, `cagedPosition`,
   * `chordType`, ...). Drives the Export screen's "geometry unchanged"
   * badge for metadata-only edits — e.g. the §4.4 CAGED-major backfill,
   * which only ever touches `chordType`/`voicingFamily`/`cagedPosition`. */
  geometryChanged: boolean;
}

/** Fields whose change constitutes a geometry change, not a metadata-only
 * edit. Shared across `ChordShape`/`ScaleShape`/`ArpeggioShape` — every
 * field here means something different per kind (`span` is scale-only,
 * `fingers`/`barres`/`baseFret` are chord-only) but no kind defines two of
 * these fields with different meanings, so one flat list is safe. */
const GEOMETRY_FIELDS: ReadonlySet<string> = new Set([
  "strings",
  "fingers",
  "barres",
  "rootString",
  "baseFret",
  "span",
]);

function definedKeys(record: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(record).filter((key) => record[key] !== undefined));
}

/** Structural deep-equal, insensitive to object key order. Like the
 * `JSON.stringify` comparison it replaces, an `undefined`-valued key counts
 * as absent. */
function fieldsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => fieldsEqual(item, b[i]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = definedKeys(aRecord);
  const bKeys = definedKeys(bRecord);
  if (aKeys.size !== bKeys.size) return false;
  for (const key of aKeys) {
    if (!bKeys.has(key) || !fieldsEqual(aRecord[key], bRecord[key])) return false;
  }
  return true;
}

/**
 * Field-level diff between two shape objects of the same `kind`. `before`
 * is `undefined` for a brand-new (`AddChange`) shape's diff view — every
 * defined field on `after` reports as `added` in that case.
 */
export function diffShape(before: DiffableShape | undefined, after: DiffableShape): ShapeDiff {
  const beforeRecord = (before ?? {}) as unknown as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;

  const beforeKeys = definedKeys(beforeRecord);
  const afterKeys = definedKeys(afterRecord);

  const added: string[] = [];
  const changed: ShapeFieldChange[] = [];
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      added.push(key);
    } else if (!fieldsEqual(beforeRecord[key], afterRecord[key])) {
      changed.push({ field: key, before: beforeRecord[key], after: afterRecord[key] });
    }
  }

  const removed: string[] = [];
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) removed.push(key);
  }

  added.sort();
  removed.sort();
  changed.sort((a, b) => a.field.localeCompare(b.field));

  const geometryChanged =
    added.some((field) => GEOMETRY_FIELDS.has(field)) ||
    removed.some((field) => GEOMETRY_FIELDS.has(field)) ||
    changed.some((change) => GEOMETRY_FIELDS.has(change.field));

  return { added, removed, changed, geometryChanged };
}
