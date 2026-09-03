/**
 * Pure board-grid model for the Shape Workbench's Board screen (spec §5.2,
 * §5.4). Turns a flat shape catalog into a 2D grid of cells keyed by a
 * (row, column) pair — e.g. chord-type rows × CAGED-position columns — so
 * the UI can render "filled" (a registered shape exists), "gap" (nothing
 * registered), or "draft" (a workbench draft exists but nothing is
 * registered yet) cells, without touching the registries or any UI
 * framework.
 *
 * Zero React/DOM imports. Imports only from "tonal-guitar" and this
 * package's own `./catalog`.
 */
import type { ArpeggioSlot, CagedPosition } from "tonal-guitar";
import { CHORD_SCALE_RULE, impliedStringSet } from "tonal-guitar";
import {
  classifyChordQualityGroup,
  chordTypeLabel,
  matchesAliasAwareSearch,
} from "./catalog";
import type { ChordQualityGroup, ShapeCatalogEntry } from "./catalog";

export type BoardKind = "chord" | "scale" | "arpeggio";
export type BoardAxis = "cagedPosition" | "stringSet" | "inversion";
export type BoardRowGrouping = "chordType" | "stringSet";

/**
 * Structural slot for a chord/scale board cell — identifies a (row, column)
 * position on the grid before any shape has been authored for it. This is
 * distinct from `ArpeggioSlot` (which additionally pins a `rootString`,
 * since arpeggio resolution is grip-specific, spec §1.7) — a chord/scale
 * cell gets a `ChordSlot`; an arpeggio cell gets a real `ArpeggioSlot` (see
 * `arpeggioSlotFor`). `BoardCell.slot` is `ArpeggioSlot | ChordSlot` per
 * spec §5.2.
 */
export interface ChordSlot {
  kind: "chord" | "scale";
  rowGrouping: BoardRowGrouping;
  rowKey: string;
  axis: BoardAxis;
  columnKey: string;
  chordType?: string;
  cagedPosition?: CagedPosition;
  stringSet?: number[];
}

/** Union accepted by `EditCapabilities.onCreateShape` (spec §5.3) and
 * produced by every `BoardCell.slot`. */
export type BoardSlot = ArpeggioSlot | ChordSlot;

export interface BoardColumn {
  key: string;
  label: string;
}

export interface BoardRow {
  key: string;
  label: string;
}

export type BoardCellState = "filled" | "gap" | "draft";

/**
 * Draft presence/status for one board slot — the subset of the workbench's
 * `DraftShape` state (spec §5.4) `boardModel` needs to color a gap cell as
 * a draft instead of empty. Keyed identically to the `BoardCell.key` of the
 * slot the draft targets.
 */
export interface DraftBadge {
  label: string;
  status: "draft" | "in-changeset";
}

export interface BoardCell {
  key: string;
  rowKey: string;
  columnKey: string;
  state: BoardCellState;
  entry?: ShapeCatalogEntry;
  slot: BoardSlot;
}

export interface BoardModelOptions {
  kind: BoardKind;
  axis: BoardAxis;
  rowGrouping: BoardRowGrouping;
  /**
   * Restricts `rowGrouping: "chordType"` rows to chord types in these
   * quality groups (via `classifyChordQualityGroup`). No effect on
   * `rowGrouping: "stringSet"` (no quality-group concept there).
   * Undefined/empty means "every row".
   */
  typeFilter?: ChordQualityGroup[];
  /** Alias-aware name/symbol search (`matchesAliasAwareSearch`) — narrows
   * which catalog entries can fill a cell; never removes a row/column. */
  search?: string;
  /** Draft badges for slots with no registered entry yet, keyed by the same
   * string `BoardCell.key` computes for that slot. */
  drafts?: Map<string, DraftBadge>;
}

export interface BoardCounts {
  /** Cells in `state: "filled"`, i.e. matching the current `kind`/`search`. */
  shown: number;
  /** Total cells in the grid (`rows.length * columns.length`). */
  total: number;
  /** Cells in `state: "gap"` (no entry, no draft). */
  gaps: number;
}

export interface BoardModelResult {
  columns: BoardColumn[];
  rows: BoardRow[];
  cells: Map<string, BoardCell>;
  counts: BoardCounts;
}

const CAGED_COLUMN_ORDER: readonly CagedPosition[] = ["C", "A", "G", "E", "D"];
const INVERSION_COLUMN_ORDER: readonly string[] = ["0", "1", "2", "3"];
const INVERSION_LABELS: Readonly<Record<string, string>> = {
  "0": "Root position",
  "1": "1st inversion",
  "2": "2nd inversion",
  "3": "3rd inversion",
};

/** Canonical `BoardCell.key` format — exported so consumers (e.g.
 * shape-library-ui's `ShapeBoard`) look up board cells without re-deriving
 * this format themselves (CR-038: format drift there renders the board
 * silently empty). */
export function cellKey(rowKey: string, columnKey: string): string {
  return `${rowKey}::${columnKey}`;
}

// ============================================================
// Row/column value extraction from a catalog entry
// ============================================================

function chordTypeOf(entry: ShapeCatalogEntry): string | undefined {
  return entry.shape.chordType;
}

function stringSetOf(entry: ShapeCatalogEntry): number[] | undefined {
  return entry.kind === "chord" ? impliedStringSet(entry.shape) : undefined;
}

function cagedPositionOf(entry: ShapeCatalogEntry): CagedPosition | undefined {
  return entry.shape.cagedPosition;
}

function inversionOf(entry: ShapeCatalogEntry): number | undefined {
  return entry.kind === "chord" ? entry.shape.inversion : undefined;
}

function rowValueOf(entry: ShapeCatalogEntry, rowGrouping: BoardRowGrouping): string | undefined {
  if (rowGrouping === "chordType") return chordTypeOf(entry);
  const stringSet = stringSetOf(entry);
  return stringSet ? JSON.stringify(stringSet) : undefined;
}

function columnValueOf(entry: ShapeCatalogEntry, axis: BoardAxis): string | undefined {
  if (axis === "cagedPosition") return cagedPositionOf(entry);
  if (axis === "inversion") {
    const inversion = inversionOf(entry);
    return inversion === undefined ? undefined : String(inversion);
  }
  const stringSet = stringSetOf(entry);
  return stringSet ? JSON.stringify(stringSet) : undefined;
}

// ============================================================
// Row/column derivation
// ============================================================

function deriveRows(entries: readonly ShapeCatalogEntry[], options: BoardModelOptions): BoardRow[] {
  const values = new Set<string>();
  for (const entry of entries) {
    const value = rowValueOf(entry, options.rowGrouping);
    if (value !== undefined) values.add(value);
  }

  // Arpeggio boards ship with no seeded catalog entries yet (spec §1.6's
  // "arpeggioShapes ships empty") — fall back to the known chord-scale-rule
  // chord types (spec §1.10) so a "chordType" row grouping still has
  // something to draft against instead of rendering an empty grid.
  if (options.kind === "arpeggio" && options.rowGrouping === "chordType" && values.size === 0) {
    for (const chordType of Object.keys(CHORD_SCALE_RULE)) values.add(chordType);
  }

  let keys = [...values].sort((a, b) => a.localeCompare(b));

  if (options.rowGrouping === "chordType" && options.typeFilter && options.typeFilter.length > 0) {
    const allowed = new Set(options.typeFilter);
    keys = keys.filter((key) => allowed.has(classifyChordQualityGroup(key)));
  }

  return keys.map((key) => ({
    key,
    label: options.rowGrouping === "chordType" ? chordTypeLabel(key) : `String set ${key}`,
  }));
}

function deriveColumns(entries: readonly ShapeCatalogEntry[], options: BoardModelOptions): BoardColumn[] {
  if (options.axis === "cagedPosition") {
    return CAGED_COLUMN_ORDER.map((position) => ({ key: position, label: position }));
  }
  if (options.axis === "inversion") {
    return INVERSION_COLUMN_ORDER.map((key) => ({
      key,
      label: INVERSION_LABELS[key] ?? `${key}th inversion`,
    }));
  }

  const values = new Set<string>();
  for (const entry of entries) {
    const value = columnValueOf(entry, options.axis);
    if (value !== undefined) values.add(value);
  }
  return [...values]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, label: `String set ${key}` }));
}

// ============================================================
// Slot construction
// ============================================================

function chordSlotFor(
  kind: "chord" | "scale",
  options: BoardModelOptions,
  row: BoardRow,
  column: BoardColumn,
): ChordSlot {
  const slot: ChordSlot = {
    kind,
    rowGrouping: options.rowGrouping,
    rowKey: row.key,
    axis: options.axis,
    columnKey: column.key,
  };

  if (options.rowGrouping === "chordType") {
    slot.chordType = row.key;
  } else {
    slot.stringSet = JSON.parse(row.key) as number[];
  }

  if (options.axis === "cagedPosition") {
    slot.cagedPosition = column.key as CagedPosition;
  } else if (options.axis === "stringSet") {
    slot.stringSet = JSON.parse(column.key) as number[];
  }
  // "inversion" axis has no dedicated `ChordSlot` field beyond `columnKey`
  // — the numeric inversion is already fully captured there.

  return slot;
}

/**
 * Sentinel `rootString` for an arpeggio board cell that isn't yet bound to
 * a specific chord grip. A real `ArpeggioSlot` always names a concrete
 * `rootString` (spec §1.7), but a board cell exists structurally before any
 * grip has been authored for it — `-1` never collides with a real (0-based)
 * string index, so it can never accidentally resolve to a registered
 * arpeggio via `resolveArpeggioForSlot`.
 */
const UNBOUND_ROOT_STRING = -1;

function arpeggioSlotFor(options: BoardModelOptions, row: BoardRow, column: BoardColumn): ArpeggioSlot {
  const slot: ArpeggioSlot = {
    chordType: options.rowGrouping === "chordType" ? row.key : "",
    rootString: UNBOUND_ROOT_STRING,
  };
  if (options.axis === "cagedPosition") {
    slot.cagedPosition = column.key as CagedPosition;
  }
  return slot;
}

// ============================================================
// Public API
// ============================================================

export function boardModel(
  catalog: readonly ShapeCatalogEntry[],
  options: BoardModelOptions,
): BoardModelResult {
  const kind = options.kind;
  const kindEntries = catalog.filter((entry) => entry.kind === kind);

  const rows = deriveRows(kindEntries, options);
  const columns = deriveColumns(kindEntries, options);

  const searchTerm = options.search?.trim();
  const matching =
    searchTerm && searchTerm.length > 0
      ? kindEntries.filter((entry) => matchesAliasAwareSearch(entry, searchTerm))
      : kindEntries;

  const cells = new Map<string, BoardCell>();
  let shown = 0;
  let gaps = 0;

  for (const row of rows) {
    for (const column of columns) {
      const key = cellKey(row.key, column.key);
      const entry = matching.find(
        (candidate) =>
          rowValueOf(candidate, options.rowGrouping) === row.key &&
          columnValueOf(candidate, options.axis) === column.key,
      );

      const slot: BoardSlot =
        kind === "arpeggio" ? arpeggioSlotFor(options, row, column) : chordSlotFor(kind, options, row, column);

      let state: BoardCellState;
      if (entry) {
        state = "filled";
        shown += 1;
      } else if (options.drafts?.has(key)) {
        state = "draft";
      } else {
        state = "gap";
        gaps += 1;
      }

      cells.set(key, { key, rowKey: row.key, columnKey: column.key, state, entry, slot });
    }
  }

  return {
    columns,
    rows,
    cells,
    counts: { shown, total: rows.length * columns.length, gaps },
  };
}
