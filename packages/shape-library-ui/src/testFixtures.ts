/**
 * Shared test fixtures — built once from the real `tonal-guitar` registries
 * via `shape-catalog`, so every test in this package exercises the actual
 * catalog/board/detail shapes rather than hand-rolled stand-ins that could
 * drift from the real contracts. Not itself a test file (no `.test.`
 * suffix), so vitest's `include` glob never picks it up directly.
 */
import { auditAllShapes } from "tonal-guitar";
import { boardModel, buildCatalog, chordTypeSiblings, type BoardModelResult, type ChordCatalogEntry, type ScaleCatalogEntry, type ShapeCatalogEntry } from "shape-catalog";

const auditResult = auditAllShapes();
export const catalog: ShapeCatalogEntry[] = buildCatalog(auditResult);

export const chordEntry: ChordCatalogEntry = catalog.find(
  (entry): entry is ChordCatalogEntry => entry.kind === "chord",
)!;

export const scaleEntry: ScaleCatalogEntry = catalog.find(
  (entry): entry is ScaleCatalogEntry => entry.kind === "scale",
)!;

// A chord entry with at least one sibling of the same chord type, so
// alternate-fingering / sibling-stepper code paths have something to render
// beyond the trivial "no siblings" case.
export const chordEntryWithSiblings: ChordCatalogEntry =
  catalog.find(
    (entry): entry is ChordCatalogEntry =>
      entry.kind === "chord" && chordTypeSiblings(entry).length > 1,
  ) ?? chordEntry;

export const chordBoardModel: BoardModelResult = boardModel(catalog, {
  kind: "chord",
  axis: "cagedPosition",
  rowGrouping: "chordType",
});

/**
 * React's SSR output inserts `<!-- -->` comment markers between adjacent
 * text/expression children (e.g. `Showing {a} of {b}` renders as
 * `Showing <!-- -->10<!-- --> of <!-- -->20<!-- -->`) so hydration can tell
 * where one text node ends and the next begins. Strip those before doing
 * plain substring assertions against interpolated text.
 */
export function stripReactComments(html: string): string {
  return html.replace(/<!--\s*-->/g, "");
}
