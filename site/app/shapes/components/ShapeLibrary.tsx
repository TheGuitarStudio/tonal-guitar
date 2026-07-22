"use client";

import { useEffect, useMemo, useState } from "react";
import { auditAllShapes } from "tonal-guitar";
import {
  buildCatalog,
  filterCatalog,
  parseShapesUrlState,
  serializeShapesUrlState,
  sortFailuresFirst,
  type ShapeCatalogFilters,
  type ShapeKind,
} from "./shapeLibraryUtils";
import { FilterBar, FILTER_ALL } from "./FilterBar";
import { LEGEND } from "./ShapeCardDiagram";
import { LazyShapeCard } from "./LazyShapeCard";

// Cards at this index or earlier mount immediately rather than waiting on
// the IntersectionObserver — roughly the first screenful of the 3-column
// (`xl:grid-cols-3`) layout, so there's real content on screen (and in the
// statically-exported HTML) before any scrolling or hydration-dependent
// observer work happens.
const EAGER_CARD_COUNT = 9;

/**
 * Owns all filter state for the shape library. Renders the filter controls,
 * a single page-level interval legend (shared across every card in the
 * grid, not duplicated per-card), and the failures-first grid of
 * `<ShapeCard>`s — lazily mounted via `LazyShapeCard` so the up to ~159
 * filtered cards aren't all mounted and reconciled up front.
 */
export function ShapeLibrary() {
  // Runs exactly once — `auditAllShapes()` walks the full scale/chord
  // registries and is not cheap to repeat on every render.
  const auditResult = useMemo(() => auditAllShapes(), []);
  const catalog = useMemo(() => buildCatalog(auditResult), [auditResult]);

  // Default view: chord shapes, no filters, failures sorted first — this is
  // where the live #96 defects are, so it's the most useful landing state.
  const [kind, setKind] = useState<ShapeKind>("chord");
  const [system, setSystem] = useState(FILTER_ALL);
  const [familyOrQuality, setFamilyOrQuality] = useState(FILTER_ALL);
  const [nameQuery, setNameQuery] = useState("");
  const [failingOnly, setFailingOnly] = useState(false);

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
    if (parsed.familyOrQuality) setFamilyOrQuality(parsed.familyOrQuality);
    if (parsed.nameQuery) setNameQuery(parsed.nameQuery);
    if (parsed.failingOnly) setFailingOnly(true);
    setUrlStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!urlStateLoaded) return;
    const qs = serializeShapesUrlState({
      kind,
      system: system === FILTER_ALL ? undefined : system,
      familyOrQuality: familyOrQuality === FILTER_ALL ? undefined : familyOrQuality,
      nameQuery: nameQuery || undefined,
      failingOnly,
    });
    window.history.replaceState(
      null,
      "",
      window.location.pathname + qs + window.location.hash,
    );
  }, [urlStateLoaded, kind, system, familyOrQuality, nameQuery, failingOnly]);

  function handleKindChange(nextKind: ShapeKind) {
    setKind(nextKind);
    // Scale and chord shapes use disjoint system/family value sets, so any
    // previously selected filter is meaningless (or invalid) after a kind
    // switch — reset both back to "no filter".
    setSystem(FILTER_ALL);
    setFamilyOrQuality(FILTER_ALL);
  }

  const filters: ShapeCatalogFilters = useMemo(() => {
    const f: ShapeCatalogFilters = { kind };
    if (system !== FILTER_ALL) f.system = system;
    if (familyOrQuality !== FILTER_ALL) {
      if (kind === "chord") f.voicingFamily = familyOrQuality;
      else f.quality = familyOrQuality;
    }
    if (nameQuery) f.nameQuery = nameQuery;
    if (failingOnly) f.failingOnly = true;
    return f;
  }, [kind, system, familyOrQuality, nameQuery, failingOnly]);

  // Failures-first sort is the default and is always applied after
  // filtering — it's not a user-toggleable option.
  const shownEntries = useMemo(
    () => sortFailuresFirst(filterCatalog(catalog, filters)),
    [catalog, filters],
  );

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
        system={system}
        onSystemChange={setSystem}
        familyOrQuality={familyOrQuality}
        onFamilyOrQualityChange={setFamilyOrQuality}
        nameQuery={nameQuery}
        onNameQueryChange={setNameQuery}
        failingOnly={failingOnly}
        onFailingOnlyChange={setFailingOnly}
        shownCount={shownEntries.length}
        totalCount={totalCount}
      />

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-fd-muted-foreground">
        {LEGEND.map(({ color, label }) => (
          <span key={label}>
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </div>

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
