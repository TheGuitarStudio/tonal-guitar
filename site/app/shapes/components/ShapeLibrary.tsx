"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { auditAllShapes } from "tonal-guitar";
import {
  ANY_ROOT,
  buildCatalog,
  buildReportUrl,
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
} from "shape-catalog";
import { FilterBar, FILTER_ALL, ShapeCard, ShapeLibraryProvider, type ChordSortOption } from "shape-library-ui";
import { REPO_SLUG } from "@/lib/repo";
import { ShapeBoardView } from "./ShapeBoardView";

// The panel's own Tonal-derivation logic and its `scalesContainingChord`
// call sites are only exercised once a card is opened — code-splitting it
// via `next/dynamic({ ssr: false })` keeps that weight out of the initial
// `/shapes` bundle (spec §7 step 4 / acceptance criteria). Pulled from
// `shape-library-ui` rather than a local file now that the panel (and
// `ChordDetailView`/`ScaleDetailView`) are fully shared components.
const ShapeDetailPanel = dynamic(
  () => import("shape-library-ui").then((mod) => mod.ShapeDetailPanel),
  { ssr: false },
);

// Cards at this index or earlier mount immediately rather than waiting on
// the IntersectionObserver `ShapeCard`'s `lazy` prop drives internally —
// roughly the first screenful of the 3-column (`xl:grid-cols-3`) layout, so
// there's real content on screen (and in the statically-exported HTML)
// before any scrolling or hydration-dependent observer work happens.
// Applied within the grouped grid's flattened visible-entry order; the
// pinned "Needs attention" section (below) always mounts eagerly since it's
// the audit's primary above-the-fold signal.
const EAGER_CARD_COUNT = 9;

/** Below this viewport width the detail panel renders as a full-height
 * bottom sheet instead of a docked sidebar (spec's mobile variant) — mirrors
 * Tailwind's default `md` breakpoint (768px), which the shared
 * `ShapeBoardView`'s single-column collapse also uses. `ShapeDetailPanel`
 * itself never touches `window` (spec §9.5's SSR-safety requirement), so
 * this component computes the boolean via `matchMedia` and passes it in as
 * `renderAsBottomSheet` rather than the panel switching on CSS breakpoints
 * itself. */
const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
}

/** Grid vs. Board (spec §7's read-only Board view, columns toggle +
 * diagram orientation toggle). */
type LibraryView = "grid" | "board";

/**
 * Thin Next adapter (spec §7 step 5) over `shape-library-ui`'s shared
 * components: owns URL state (`parseShapesUrlState`/`serializeShapesUrlState`),
 * the mobile-breakpoint media query, the code-split dynamic import of
 * `ShapeDetailPanel`, and the page-level filter/selection/focus state that
 * has no other home in a framework-neutral package. Every piece of
 * rendering — the filter bar, the cards (lazily mounted via `ShapeCard`'s
 * own `lazy` prop), the board grid, and the detail panel — is `shape-
 * library-ui` markup; this file only wires state to it. Diagrams render
 * monochrome in v1 (no page-level interval legend); the legend returns
 * alongside the deferred interval-color/label toggle.
 */
export function ShapeLibrary() {
  // Runs exactly once — `auditAllShapes()` walks the full scale/chord
  // registries and is not cheap to repeat on every render.
  const auditResult = useMemo(() => auditAllShapes(), []);
  const catalog = useMemo(() => buildCatalog(auditResult), [auditResult]);

  // Read-only capability injection (D-002): `/shapes` never passes
  // `capabilities.edit`, so every shared component below emits zero
  // `data-tg-edit` markup (spec §7, §5.3 invariant). `reportIssueUrl` is the
  // one read-only capability the site DOES supply — `ReportProblemLink`
  // (inside the shared `ShapeDetailPanel`) renders nothing without it.
  const capabilities = useMemo(
    () => ({
      reportIssueUrl: (entry: ShapeCatalogEntry) => buildReportUrl(entry, { repoSlug: REPO_SLUG }),
    }),
    [],
  );

  // Default view: chord shapes, no filters, failures pinned above the grid —
  // this is where the live #96 defects are, so it's the most useful landing
  // state.
  const [kind, setKind] = useState<ShapeKind>("chord");
  const [nameQuery, setNameQuery] = useState("");
  const [failingOnly, setFailingOnly] = useState(false);
  const [view, setView] = useState<LibraryView>("grid");

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

  // Bumped whenever the panel should pull keyboard focus into itself
  // (CR-026): grid card clicks (`handleGridSelectEntry`, below) and the
  // deep-link mount-time open both originate OUTSIDE the panel, so the
  // standard non-modal-disclosure pattern says focus should move in rather
  // than leaving keyboard users to tab through the whole grid to reach it.
  // Swaps that originate from INSIDE the panel (sibling stepper, alternate-
  // fingering thumbnails, inversion/related/compatible-shape links) go
  // through `handleSelectEntry` directly and never touch this key, so focus
  // correctly stays put. `ShapeDetailPanel` receives it as `focusOnOpenKey`
  // and only acts when it changes away from its initial `0` (no deep link,
  // no click yet) — see its own effect for the other half of this contract.
  const [focusPanelKey, setFocusPanelKey] = useState(0);

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
    if (parsed.qualityGroup) setQualityGroup(parsed.qualityGroup);
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
      if (match) {
        setSelectedEntry(match);
        // The deep-linked panel is the page's subject (CR-026b) — focus it
        // on mount exactly as a grid-originated open would.
        setFocusPanelKey((k) => k + 1);
      }
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

  // Mobile-breakpoint media query (spec §7 step 5) — the one piece of
  // "is this a small viewport" logic this adapter owns, since the shared
  // `ShapeDetailPanel`/`ShapeBoardView` never touch `window` themselves.
  // Only ever set inside an effect (post-mount), so the first render always
  // matches the parameter-free server HTML.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    setIsMobile(mql.matches);
    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // ------------------------------------------------------------
  // Selection: card click -> open/swap panel, Esc/close -> return focus to
  // the triggering card, hardware back (mobile) -> close the sheet.
  // ------------------------------------------------------------

  // The DOM node of whichever card most recently opened/swapped the panel —
  // captured generically (see `handleGridClickCapture` below) so this works
  // for cards rendered in either the pinned section or any grouped section
  // (or a board cell) without threading a ref through `ShapeCard`. Closing
  // the panel returns focus here per the non-modal keyboard model (TG13's
  // contract: the panel owns none of the triggering card's DOM, the parent
  // hands focus back).
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // Stable fallback focus target for `handleClosePanel` (CR-023): when the
  // panel was opened via a deep-linked `?shape=` URL, no card was ever
  // clicked, so `lastTriggerRef.current` is null — without this, closing
  // would drop focus to `<body>`. The results heading is `sr-only` (a
  // heading, not a control, has no business being visible), but
  // `focus:not-sr-only` below makes it visible on programmatic focus too,
  // the same reveal-on-focus pattern used for skip links, so sighted
  // keyboard users get a visible landing spot as well as screen-reader users.
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);

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
  // the component's whole lifetime) so it can be passed down into the
  // `memo()`-wrapped `ShapeCard` without defeating that memoization — a
  // plain function declaration here would be recreated on every
  // `ShapeLibrary` render (e.g. every time a different card's selection
  // flips `isSelected`), which would give every one of the ~159 cards a new
  // `onSelect` reference and force them all to re-render. Reads
  // `selectedEntryRef.current` (kept in sync by the effect above) rather
  // than the reactive `selectedEntry` state directly, since a closure
  // created once at mount can't otherwise see later state.
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

  // Grid-originated selection (CR-026): identical to `handleSelectEntry`,
  // plus bumping `focusPanelKey` so the panel pulls focus in — this is the
  // callback wired to every card's `onSelect` (grid and board alike), never
  // to `ShapeDetailPanel`'s internal `onSelectEntry` (which stays
  // `handleSelectEntry` unmodified so in-panel navigation never steals
  // focus back to the panel root it's already inside).
  const handleGridSelectEntry = useCallback(
    (entry: ShapeCatalogEntry) => {
      handleSelectEntry(entry);
      setFocusPanelKey((k) => k + 1);
    },
    [handleSelectEntry],
  );

  // Delegated click capture on the whole results region: fires in the
  // capture phase, before any card's own `onClick` (which runs in the
  // bubble phase), so it reliably captures the actual clicked `<button>`
  // regardless of whether the browser also moved focus there (Safari/
  // Firefox don't focus buttons on mouse click by default, so relying on
  // `document.activeElement` in `onSelect` itself would be unreliable) and
  // regardless of whether the card lives in the pinned section, a grouped
  // section, or a board cell.
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
    } else {
      // No trigger captured — deep-linked open (CR-023). Fall back to the
      // stable results heading instead of letting focus fall through to
      // `<body>`.
      resultsHeadingRef.current?.focus();
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
  // cards are always eager — see the `ShapeCard eager` usage below — so this
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
    // Capabilities omitted `edit` (D-002 read-only default): `/shapes` never
    // passes `capabilities.edit`, so every shared component it renders below
    // emits zero `data-tg-edit` markup (spec §7, §5.3 invariant) and every
    // Board gap cell renders as an inert `<div data-tg-gap>`.
    <ShapeLibraryProvider capabilities={capabilities}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-end">
            <div className="tg-toggle-group" role="group" aria-label="Library view">
              <button
                type="button"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
              <button
                type="button"
                aria-pressed={view === "board"}
                onClick={() => setView("board")}
              >
                Board
              </button>
            </div>
          </div>

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
            shownCount={view === "grid" ? matchedEntries.length : totalCount}
            totalCount={totalCount}
          />

          <h2
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-fd-background focus:px-2 focus:py-1 focus:text-sm focus:font-semibold focus:text-fd-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-fd-primary"
          >
            Shape results
          </h2>

          {view === "board" ? (
            <div onClickCapture={handleResultsClickCapture}>
              <ShapeBoardView
                catalog={catalog}
                kind={kind}
                nameQuery={nameQuery}
                onSelectEntry={handleGridSelectEntry}
                collapseToSingleColumn={isMobile}
              />
            </div>
          ) : (
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
                      <ShapeCard
                        key={`pinned-${entry.kind}-${entry.name}`}
                        entry={entry}
                        lazy
                        eager
                        onSelect={handleGridSelectEntry}
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
                      onSelectEntry={handleGridSelectEntry}
                      onToggleExpanded={() => handleToggleGroupExpanded(group.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <ShapeDetailPanel
          entry={selectedEntry}
          catalog={catalog}
          onClose={handleClosePanel}
          onSelectEntry={handleSelectEntry}
          focusOnOpenKey={focusPanelKey}
          renderAsBottomSheet={isMobile}
        />
      </div>
    </ShapeLibraryProvider>
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
          <ShapeCard
            key={`${entry.kind}-${entry.name}`}
            entry={entry}
            lazy
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
