"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { auditAllShapes } from "tonal-guitar";
import {
  ANY_ROOT,
  buildCatalog,
  chordEntryMatchesSelection,
  GROUP_COLLAPSE_THRESHOLD,
  groupChordEntriesByType,
  groupScaleEntriesBySystem,
  parseShapesUrlState,
  scaleEntryMatchesSelection,
  serializeShapesUrlState,
  sortFailuresFirst,
  type ChordCatalogEntry,
  type ChordFacetSelection,
  type ChordQualityGroup,
  type ScaleCatalogEntry,
  type ScaleFacetSelection,
  type ShapeCatalogEntry,
  type ShapeGroup,
  type ShapeKind,
} from "./shapeLibraryUtils";
import { FilterBar, FILTER_ALL, type ChordSortOption } from "./FilterBar";
import { LazyShapeCard } from "./LazyShapeCard";

// The panel's own Tonal-derivation logic (`shapeDetailUtils.ts`) and its
// `scalesContainingChord` call sites are only exercised once a card is
// opened — code-splitting it via `next/dynamic({ ssr: false })` keeps that
// weight out of the initial `/shapes` bundle (spec "Infrastructure" /
// acceptance criteria).
const ShapeDetailPanel = dynamic(
  () => import("./ShapeDetailPanel").then((mod) => mod.ShapeDetailPanel),
  { ssr: false },
);

// Cards at this index or earlier mount immediately rather than waiting on
// the IntersectionObserver — roughly the first screenful of the 3-column
// (`xl:grid-cols-3`) layout, so there's real content on screen (and in the
// statically-exported HTML) before any scrolling or hydration-dependent
// observer work happens. Applied within the grouped grid's flattened
// visible-entry order; the pinned "Needs attention" section (below) always
// mounts eagerly since it's the audit's primary above-the-fold signal.
const EAGER_CARD_COUNT = 9;

/** Below this viewport width the detail panel renders as a full-height
 * bottom sheet instead of a docked sidebar (spec's mobile variant) — mirrors
 * Tailwind's default `md` breakpoint (768px) that `ShapeDetailPanel.tsx`'s
 * own `md:` classes switch on. */
const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
}

/**
 * Owns all filter state for the shape library. Renders the faceted filter
 * bar, the pinned "Needs attention" failing section, the grouped grid of
 * `<ShapeCard>`s (lazily mounted via `LazyShapeCard`), and the code-split
 * `ShapeDetailPanel` slide-over. Diagrams render monochrome in v1 (no
 * page-level interval legend); the legend returns alongside the deferred
 * interval-color/label toggle.
 */
export function ShapeLibrary() {
  // Runs exactly once — `auditAllShapes()` walks the full scale/chord
  // registries and is not cheap to repeat on every render.
  const auditResult = useMemo(() => auditAllShapes(), []);
  const catalog = useMemo(() => buildCatalog(auditResult), [auditResult]);

  // Default view: chord shapes, no filters, failures pinned above the grid —
  // this is where the live #96 defects are, so it's the most useful landing
  // state.
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

  // Group headings expanded past the "Show all N" collapse threshold —
  // namespaced by whichever grouping dimension is currently active (chord
  // `chordType` keys vs. scale `system` keys never coexist since `kind`
  // switches reset this alongside every other facet).
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Selected catalog entry — drives the detail panel, deep-linkable via the
  // `shape` URL param (TG7).
  const [selectedEntry, setSelectedEntry] = useState<ShapeCatalogEntry | undefined>(undefined);

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
    if (parsed.expandedGroups) setExpandedGroups(parsed.expandedGroups);
    // Resolve `shape` against the catalog built above (stable for this
    // component instance) — an unknown name leaves `selectedEntry` unset
    // (honest stale link) rather than erroring.
    if (parsed.shape) {
      const match = catalog.find((entry) => entry.name === parsed.shape);
      if (match) setSelectedEntry(match);
    }
    setUrlStateLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!urlStateLoaded) return;
    const qs = serializeShapesUrlState({
      kind,
      system: kind === "scale" && system !== FILTER_ALL ? system : undefined,
      familyOrQuality: kind === "scale" && quality !== FILTER_ALL ? quality : undefined,
      nameQuery: nameQuery || undefined,
      failingOnly,
      shape: selectedEntry?.name,
      qualityGroup: kind === "chord" ? qualityGroup : undefined,
      activeTypes: kind === "chord" && activeTypes.length > 0 ? activeTypes : undefined,
      activeVoicingFamilies:
        kind === "chord" && activeVoicingFamilies.length > 0 ? activeVoicingFamilies : undefined,
      root: kind === "chord" && root !== ANY_ROOT ? root : undefined,
      sort: kind === "chord" && chordSort !== "baseFret" ? chordSort : undefined,
      expandedGroups: expandedGroups.length > 0 ? expandedGroups : undefined,
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
    selectedEntry,
    qualityGroup,
    activeTypes,
    activeVoicingFamilies,
    root,
    chordSort,
    expandedGroups,
  ]);

  // ------------------------------------------------------------
  // Selection: card click -> open/swap panel, Esc/close -> return focus to
  // the triggering card, hardware back (mobile) -> close the sheet.
  // ------------------------------------------------------------

  // The DOM node of whichever card most recently opened/swapped the panel —
  // captured generically (see `handleGridClickCapture` below) so this works
  // for cards rendered in either the pinned section or any grouped section
  // without threading a ref through `ShapeCard`/`LazyShapeCard`. Closing the
  // panel returns focus here per the non-modal keyboard model (TG13's
  // contract: the panel owns none of the triggering card's DOM, the parent
  // hands focus back).
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // Mirrors `selectedEntry` for use inside the `popstate` listener below,
  // which is registered once and must read current state without
  // re-subscribing on every selection change.
  const selectedEntryRef = useRef(selectedEntry);
  useEffect(() => {
    selectedEntryRef.current = selectedEntry;
  }, [selectedEntry]);

  // Whether the currently-open panel pushed an extra history entry for
  // mobile hardware-back dismissal (see below) — tracked outside React state
  // since it's bookkeeping for the history stack, not something that should
  // trigger a render.
  const mobileSheetPushedRef = useRef(false);

  // Wrapped in `useCallback` with an empty dep array (identity stable for
  // the component's whole lifetime) so it can be passed down through
  // `LazyShapeCard` into the `memo()`-wrapped `ShapeCard` without defeating
  // that memoization — a plain function declaration here would be
  // recreated on every `ShapeLibrary` render (e.g. every time a different
  // card's selection flips `isSelected`), which would give every one of the
  // ~159 cards a new `onSelect` reference and force them all to re-render.
  // Reads `selectedEntryRef.current` (kept in sync by the effect above)
  // rather than the reactive `selectedEntry` state directly, since a
  // closure created once at mount can't otherwise see later state.
  // `mobileSheetPushedRef` and `setSelectedEntry` are already stable
  // (ref/setState identities never change), so nothing else needs to be in
  // the dependency array.
  const handleSelectEntry = useCallback((entry: ShapeCatalogEntry) => {
    // Mobile hardware-back dismissal (see the module doc above): only on the
    // closed -> open transition, and done SYNCHRONOUSLY here, before
    // `setSelectedEntry` schedules a re-render. At this exact point
    // `window.location.href` is still whatever it was before this
    // selection (clean, no `shape` param) — pushing it now duplicates that
    // clean URL onto a new top-of-stack entry. The URL-sync effect (below)
    // then runs against this new top entry, `replaceState`-ing the `shape`
    // param onto IT rather than the clean entry underneath. Doing this
    // inside a separate `useEffect` instead (queued after this handler)
    // would race the URL-sync effect: whichever of the two effects runs
    // first would leave the other reading an already-mutated
    // `window.location.href`, corrupting the "clean" backstop entry — this
    // handler-level push avoids that race entirely by running before any
    // effect does.
    if (
      selectedEntryRef.current === undefined &&
      !mobileSheetPushedRef.current &&
      isMobileViewport()
    ) {
      window.history.pushState({ shapeDetailSheet: true }, "", window.location.href);
      mobileSheetPushedRef.current = true;
    }
    setSelectedEntry(entry);
  }, []);

  // Delegated click capture on the whole results region: fires in the
  // capture phase, before any card's own `onClick` (which runs in the
  // bubble phase), so it reliably captures the actual clicked `<button>`
  // regardless of whether the browser also moved focus there (Safari/
  // Firefox don't focus buttons on mouse click by default, so relying on
  // `document.activeElement` in `onSelect` itself would be unreliable) and
  // regardless of whether the card lives in the pinned section or a grouped
  // section.
  function handleResultsClickCapture(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest("button");
    if (button) lastTriggerRef.current = button;
  }

  function handleClosePanel() {
    if (mobileSheetPushedRef.current) {
      mobileSheetPushedRef.current = false;
      // Pops the extra history entry pushed when the mobile sheet opened
      // (see the effect below) so the back button doesn't leave a stray
      // forward-navigable "sheet open" state once closed via ✕/Esc.
      window.history.back();
    }
    setSelectedEntry(undefined);
    const trigger = lastTriggerRef.current;
    if (trigger && document.contains(trigger)) {
      trigger.focus();
    }
  }

  // Mobile hardware-back dismissal: the spec mirrors selection into the URL
  // via `history.replaceState` (so plain back doesn't pop it on desktop —
  // replaceState never grows the history stack). On mobile, where the panel
  // becomes a full-height sheet, that would mean the hardware back button
  // navigates away from `/shapes` entirely instead of dismissing the sheet.
  // To keep back-button behavior sane there without abandoning the
  // replaceState model for desktop, `handleSelectEntry` above pushes one
  // extra history entry as a "back stop" when the sheet opens on a mobile
  // viewport; a `popstate` while the sheet is open closes it instead of
  // letting the navigation proceed. Trade-off: this only engages for the
  // interactive open path (tapping a card) — a page LOAD that deep-links
  // straight to `?shape=...` on a mobile viewport does not get a backstop
  // pushed (there is no prior "clean" entry on the stack to duplicate
  // without an extra replaceState-then-pushState dance), so hardware back
  // on a freshly-loaded mobile deep link navigates away from `/shapes` as
  // normal rather than merely closing the sheet — arguably the more
  // correct behavior for a true deep link regardless. Desktop selection
  // stays exactly the replaceState-only model TG7 established.
  useEffect(() => {
    function handlePopState() {
      if (selectedEntryRef.current !== undefined) {
        mobileSheetPushedRef.current = false;
        setSelectedEntry(undefined);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleKindChange(nextKind: ShapeKind) {
    setKind(nextKind);
    // Scale and chord shapes use disjoint facet dimensions, so any
    // previously selected filter is meaningless (or invalid) after a kind
    // switch — reset every facet back to "no filter". Expanded-group state
    // is keyed by the active grouping dimension (chordType vs. system), so
    // it resets too.
    setSystem(FILTER_ALL);
    setQuality(FILTER_ALL);
    setQualityGroup(undefined);
    setActiveTypes([]);
    setActiveVoicingFamilies([]);
    setRoot(ANY_ROOT);
    setChordSort("baseFret");
    setExpandedGroups([]);
  }

  function handleToggleGroupExpanded(key: string) {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
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

  // Faceted filtering (Task Group 8's selection-matching helpers). Grouping
  // (below) derives its own internal ordering (spotlight-first, then the
  // active sort) from this matched set; the "Needs attention" section is
  // computed independently, straight off the full per-kind catalog, so it
  // stays pinned regardless of these facets (D-004). Entries with
  // `issues.length > 0` are excluded here whenever `failingOnly` is off —
  // they already render unconditionally in the pinned section above, so
  // including them here too would double-render them (and double-highlight
  // the selected one) with no additional information. When `failingOnly` is
  // explicitly checked, the grouped grid narrows to failing entries only
  // (optionally further narrowed by facets), which pinned's facet-ignorant
  // "Needs attention" view can't do.
  const matchedEntries = useMemo(() => {
    if (kind === "chord") {
      const chordEntries = catalog.filter(
        (e): e is ChordCatalogEntry => e.kind === "chord",
      );
      return chordEntries.filter(
        (e) =>
          chordEntryMatchesSelection(e, chordSelection) &&
          (failingOnly ? e.issues.length > 0 : e.issues.length === 0),
      );
    }

    const scaleEntries = catalog.filter(
      (e): e is ScaleCatalogEntry => e.kind === "scale",
    );
    return scaleEntries.filter(
      (e) =>
        scaleEntryMatchesSelection(e, scaleSelection) &&
        (failingOnly ? e.issues.length > 0 : e.issues.length === 0),
    );
  }, [catalog, kind, chordSelection, scaleSelection, failingOnly]);

  const totalCount = useMemo(
    () => catalog.filter((e) => e.kind === kind).length,
    [catalog, kind],
  );

  // Pinned "Needs attention" section (D-004): every entry with issues,
  // scoped to the active `kind` (scale/chord are disjoint registries and
  // views, not a facet — see `FilterBar`'s own "strict binary" comment) but
  // otherwise ignoring every facet/grouping so a failing shape never gets
  // buried behind a collapsed "Show all" group or an active filter.
  const expandedGroupsSet = useMemo(() => new Set(expandedGroups), [expandedGroups]);

  const failingEntries = useMemo(() => {
    const kindEntries = catalog.filter((e) => e.kind === kind);
    return sortFailuresFirst(kindEntries.filter((e) => e.issues.length > 0));
  }, [catalog, kind]);

  const chordGroups = useMemo<ShapeGroup<ChordCatalogEntry>[]>(() => {
    if (kind !== "chord") return [];
    return groupChordEntriesByType(matchedEntries as ChordCatalogEntry[], {
      sort: chordSort,
      expandedGroups: expandedGroupsSet,
    });
  }, [kind, matchedEntries, chordSort, expandedGroupsSet]);

  const scaleGroups = useMemo<ShapeGroup<ScaleCatalogEntry>[]>(() => {
    if (kind !== "scale") return [];
    return groupScaleEntriesBySystem(matchedEntries as ScaleCatalogEntry[], {
      expandedGroups: expandedGroupsSet,
    });
  }, [kind, matchedEntries, expandedGroupsSet]);

  const groups: ShapeGroup<ShapeCatalogEntry>[] = kind === "chord" ? chordGroups : scaleGroups;

  // Global eager-mount budget for the grouped grid, in the same top-to-
  // bottom / left-to-right order the sections render in (pinned-section
  // cards are always eager — see `LazyShapeCard` usage below — so this
  // budget only covers the grouped grid).
  const eagerNames = useMemo(() => {
    const names = new Set<string>();
    let i = 0;
    for (const group of groups) {
      for (const entry of group.visibleEntries) {
        if (i >= EAGER_CARD_COUNT) return names;
        names.add(`${entry.kind}-${entry.name}`);
        i += 1;
      }
    }
    return names;
  }, [groups]);

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
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
          shownCount={matchedEntries.length}
          totalCount={totalCount}
        />

        <h2 className="sr-only">Shape results</h2>

        <div onClickCapture={handleResultsClickCapture}>
          {failingEntries.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fd-foreground">
                <span aria-hidden="true">⚠</span> Needs attention
                <span className="rounded-full bg-fd-muted px-2 py-0.5 text-xs font-normal text-fd-muted-foreground">
                  {failingEntries.length}
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {failingEntries.map((entry) => (
                  <LazyShapeCard
                    key={`pinned-${entry.kind}-${entry.name}`}
                    entry={entry}
                    eager
                    onSelect={handleSelectEntry}
                    isSelected={selectedEntry?.kind === entry.kind && selectedEntry.name === entry.name}
                  />
                ))}
              </div>
            </section>
          )}

          {matchedEntries.length === 0 ? (
            <p className="text-sm text-fd-muted-foreground">
              No shapes match the current filters.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <GroupSection
                  key={group.key}
                  group={group}
                  selectedEntry={selectedEntry}
                  eagerNames={eagerNames}
                  onSelectEntry={handleSelectEntry}
                  onToggleExpanded={() => handleToggleGroupExpanded(group.key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ShapeDetailPanel
        entry={selectedEntry}
        catalog={catalog}
        onClose={handleClosePanel}
        onSelectEntry={handleSelectEntry}
      />
    </div>
  );
}

// ============================================================
// Grouped section rendering (spec 8.6 / D-004's grid reorganization)
// ============================================================

interface GroupSectionProps {
  group: ShapeGroup<ShapeCatalogEntry>;
  selectedEntry: ShapeCatalogEntry | undefined;
  eagerNames: ReadonlySet<string>;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
  onToggleExpanded: () => void;
}

function GroupSection({
  group,
  selectedEntry,
  eagerNames,
  onSelectEntry,
  onToggleExpanded,
}: GroupSectionProps) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fd-foreground">
        {group.label}
        <span className="rounded-full bg-fd-muted px-2 py-0.5 text-xs font-normal text-fd-muted-foreground">
          {group.totalCount}
        </span>
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {group.visibleEntries.map((entry) => (
          <LazyShapeCard
            key={`${entry.kind}-${entry.name}`}
            entry={entry}
            eager={eagerNames.has(`${entry.kind}-${entry.name}`)}
            onSelect={onSelectEntry}
            isSelected={selectedEntry?.kind === entry.kind && selectedEntry.name === entry.name}
          />
        ))}
      </div>
      {group.totalCount > GROUP_COLLAPSE_THRESHOLD && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-2 text-xs text-fd-muted-foreground underline decoration-dotted hover:text-fd-primary"
        >
          {group.isExpanded ? "Show less ▴" : `Show all ${group.totalCount} ▾`}
        </button>
      )}
    </section>
  );
}
