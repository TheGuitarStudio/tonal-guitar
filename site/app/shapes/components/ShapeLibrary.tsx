"use client";

import { useEffect, useMemo, useState } from "react";
import { auditAllShapes } from "tonal-guitar";
import {
  ANY_ROOT,
  buildCatalog,
  chordEntryMatchesSelection,
  parseShapesUrlState,
  scaleEntryMatchesSelection,
  serializeShapesUrlState,
  sortChordEntries,
  sortScaleEntries,
  type ChordCatalogEntry,
  type ChordFacetSelection,
  type ChordQualityGroup,
  type ScaleCatalogEntry,
  type ScaleFacetSelection,
  type ShapeCatalogEntry,
  type ShapeKind,
} from "./shapeLibraryUtils";
import { FilterBar, FILTER_ALL, type ChordSortOption } from "./FilterBar";
import { LazyShapeCard } from "./LazyShapeCard";

// Cards at this index or earlier mount immediately rather than waiting on
// the IntersectionObserver — roughly the first screenful of the 3-column
// (`xl:grid-cols-3`) layout, so there's real content on screen (and in the
// statically-exported HTML) before any scrolling or hydration-dependent
// observer work happens.
const EAGER_CARD_COUNT = 9;

/** Failure-severity rank for the default failures-first ordering (D-004) —
 * mirrors `shapeLibraryUtils`'s own (private) `rankOf`, kept local here since
 * it's only needed as a stable-sort tiebreaker on top of the user's chosen
 * facet sort (`sortFailuresFirst` itself hardcodes a registry-index
 * tiebreak, which would silently override the new sort-by control). */
function issueRank(entry: ShapeCatalogEntry): number {
  if (entry.issues.some((issue) => issue.severity === "error")) return 0;
  if (entry.issues.some((issue) => issue.severity === "warning")) return 1;
  return 2;
}

/** Stable sort: failures bubble to the top, ties preserve whatever order
 * `entries` already came in (i.e. the active facet sort). */
function withFailuresFirst<T extends ShapeCatalogEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => issueRank(a) - issueRank(b));
}

/**
 * Owns all filter state for the shape library. Renders the faceted filter
 * bar and the failures-first grid of `<ShapeCard>`s — lazily mounted via
 * `LazyShapeCard` so the up to ~159 filtered cards aren't all mounted and
 * reconciled up front. Diagrams render monochrome in v1 (no page-level
 * interval legend); the legend returns alongside the deferred
 * interval-color/label toggle.
 *
 * Grouped grid sections, the pinned "Needs attention" section, and the
 * detail panel are later task groups' work — this component still renders a
 * single flat, failures-first grid, just driven by the richer faceted
 * filters below instead of the old plain dropdowns.
 */
export function ShapeLibrary() {
  // Runs exactly once — `auditAllShapes()` walks the full scale/chord
  // registries and is not cheap to repeat on every render.
  const auditResult = useMemo(() => auditAllShapes(), []);
  const catalog = useMemo(() => buildCatalog(auditResult), [auditResult]);

  // Default view: chord shapes, no filters, failures sorted first — this is
  // where the live #96 defects are, so it's the most useful landing state.
  const [kind, setKind] = useState<ShapeKind>("chord");
  const [nameQuery, setNameQuery] = useState("");
  const [failingOnly, setFailingOnly] = useState(false);

  // Scale-mode facets: single-select system/quality chips, replacing the old
  // dropdowns' semantics 1:1 (still `FILTER_ALL` = no narrowing) but
  // rendered as the same live-count chip treatment chord facets use.
  const [system, setSystem] = useState(FILTER_ALL);
  const [quality, setQuality] = useState(FILTER_ALL);

  // Chord-mode facets (spec 9.1-9.5).
  const [qualityGroup, setQualityGroup] = useState<ChordQualityGroup | undefined>(undefined);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [activeVoicingFamilies, setActiveVoicingFamilies] = useState<string[]>([]);
  const [root, setRoot] = useState(ANY_ROOT);
  const [chordSort, setChordSort] = useState<ChordSortOption>("baseFret");

  // Deep-linkable filters. The page is statically exported, so the first
  // (hydration) render must match the parameter-free server HTML — the URL
  // is only read after mount, then mirrored back via replaceState. The
  // `urlStateLoaded` flag keeps the mirror effect from clearing the query
  // string on the initial default-state render.
  const [urlStateLoaded, setUrlStateLoaded] = useState(false);

  useEffect(() => {
    const parsed = parseShapesUrlState(window.location.search);
    if (parsed.kind) setKind(parsed.kind);
    if (parsed.system) setSystem(parsed.system);
    if (parsed.familyOrQuality) setQuality(parsed.familyOrQuality);
    if (parsed.nameQuery) setNameQuery(parsed.nameQuery);
    if (parsed.failingOnly) setFailingOnly(true);
    if (parsed.qualityGroup) setQualityGroup(parsed.qualityGroup as ChordQualityGroup);
    if (parsed.activeTypes) setActiveTypes(parsed.activeTypes);
    if (parsed.activeVoicingFamilies) setActiveVoicingFamilies(parsed.activeVoicingFamilies);
    if (parsed.root) setRoot(parsed.root);
    if (parsed.sort) setChordSort(parsed.sort);
    setUrlStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!urlStateLoaded) return;
    const qs = serializeShapesUrlState({
      kind,
      system: kind === "scale" && system !== FILTER_ALL ? system : undefined,
      familyOrQuality: kind === "scale" && quality !== FILTER_ALL ? quality : undefined,
      nameQuery: nameQuery || undefined,
      failingOnly,
      qualityGroup: kind === "chord" ? qualityGroup : undefined,
      activeTypes: kind === "chord" && activeTypes.length > 0 ? activeTypes : undefined,
      activeVoicingFamilies:
        kind === "chord" && activeVoicingFamilies.length > 0 ? activeVoicingFamilies : undefined,
      root: kind === "chord" && root !== ANY_ROOT ? root : undefined,
      sort: kind === "chord" && chordSort !== "baseFret" ? chordSort : undefined,
    });
    window.history.replaceState(
      null,
      "",
      window.location.pathname + qs + window.location.hash,
    );
  }, [
    urlStateLoaded,
    kind,
    system,
    quality,
    nameQuery,
    failingOnly,
    qualityGroup,
    activeTypes,
    activeVoicingFamilies,
    root,
    chordSort,
  ]);

  function handleKindChange(nextKind: ShapeKind) {
    setKind(nextKind);
    // Scale and chord shapes use disjoint facet dimensions, so any
    // previously selected filter is meaningless (or invalid) after a kind
    // switch — reset every facet back to "no filter".
    setSystem(FILTER_ALL);
    setQuality(FILTER_ALL);
    setQualityGroup(undefined);
    setActiveTypes([]);
    setActiveVoicingFamilies([]);
    setRoot(ANY_ROOT);
    setChordSort("baseFret");
  }

  const chordSelection: ChordFacetSelection = useMemo(
    () => ({
      qualityGroup,
      activeTypes: activeTypes.length > 0 ? activeTypes : undefined,
      activeVoicingFamilies:
        activeVoicingFamilies.length > 0 ? activeVoicingFamilies : undefined,
      root: root === ANY_ROOT ? undefined : root,
      nameQuery: nameQuery || undefined,
    }),
    [qualityGroup, activeTypes, activeVoicingFamilies, root, nameQuery],
  );

  const scaleSelection: ScaleFacetSelection = useMemo(
    () => ({
      activeSystems: system !== FILTER_ALL ? [system] : undefined,
      activeQualities: quality !== FILTER_ALL ? [quality] : undefined,
      nameQuery: nameQuery || undefined,
    }),
    [system, quality, nameQuery],
  );

  // Faceted filtering (Task Group 8's selection-matching helpers) + failures-
  // first ordering on top of whichever sort the facet bar has active.
  // Grouped sections / the pinned failing section are a later task group —
  // this stays a single flat list.
  const shownEntries = useMemo(() => {
    if (kind === "chord") {
      const chordEntries = catalog.filter(
        (e): e is ChordCatalogEntry => e.kind === "chord",
      );
      const matched = chordEntries.filter(
        (e) =>
          chordEntryMatchesSelection(e, chordSelection) &&
          (!failingOnly || e.issues.length > 0),
      );
      return withFailuresFirst(sortChordEntries(matched, chordSort));
    }

    const scaleEntries = catalog.filter(
      (e): e is ScaleCatalogEntry => e.kind === "scale",
    );
    const matched = scaleEntries.filter(
      (e) =>
        scaleEntryMatchesSelection(e, scaleSelection) &&
        (!failingOnly || e.issues.length > 0),
    );
    return withFailuresFirst(sortScaleEntries(matched));
  }, [catalog, kind, chordSelection, scaleSelection, chordSort, failingOnly]);

  const totalCount = useMemo(
    () => catalog.filter((e) => e.kind === kind).length,
    [catalog, kind],
  );

  return (
    <div>
      <FilterBar
        entries={catalog}
        kind={kind}
        onKindChange={handleKindChange}
        chordSelection={chordSelection}
        onQualityGroupChange={setQualityGroup}
        onActiveTypesChange={setActiveTypes}
        onActiveVoicingFamiliesChange={setActiveVoicingFamilies}
        onRootChange={setRoot}
        chordSort={chordSort}
        onChordSortChange={setChordSort}
        scaleSelection={scaleSelection}
        system={system}
        onSystemChange={setSystem}
        quality={quality}
        onQualityChange={setQuality}
        nameQuery={nameQuery}
        onNameQueryChange={setNameQuery}
        failingOnly={failingOnly}
        onFailingOnlyChange={setFailingOnly}
        shownCount={shownEntries.length}
        totalCount={totalCount}
      />

      <h2 className="sr-only">Shape results</h2>

      {shownEntries.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No shapes match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shownEntries.map((entry, i) => (
            <LazyShapeCard
              key={`${entry.kind}-${entry.name}`}
              entry={entry}
              eager={i < EAGER_CARD_COUNT}
            />
          ))}
        </div>
      )}
    </div>
  );
}
