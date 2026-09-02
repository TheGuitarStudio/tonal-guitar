/**
 * Ported from `site/app/shapes/components/FilterBar.tsx`. Tailwind/Fumadocs
 * classes replaced with `tg-`-prefixed classes from `./styles.css`; all
 * filtering/faceting logic and behavior is unchanged (still delegates to
 * `shape-catalog`'s facet helpers; never filters `entries` itself). Purely
 * read-only: never emits `data-tg-edit`.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ChordFacetSelection,
  ChordQualityGroup,
  FacetCount,
  ScaleFacetSelection,
  ShapeCatalogEntry,
  ShapeKind,
} from "shape-catalog";
import {
  ANY_ROOT,
  chordQualityGroupFacets,
  chordRootCounts,
  chordTypeLabel,
  distinctVoicingFamilies,
  scaleQualityCounts,
  scaleSystemCounts,
  voicingFamilyCounts,
} from "shape-catalog";

/** Sentinel used for the "no filter applied" scale system/quality chips. */
export const FILTER_ALL = "all";

/** Chord grid sort options: base-fret ascending (default) or name/type order. */
export type ChordSortOption = "baseFret" | "name";

const KIND_TOGGLE_OPTIONS: { value: ShapeKind; label: string }[] = [
  { value: "scale", label: "Scale" },
  { value: "chord", label: "Chord" },
];

export interface FilterBarProps {
  /**
   * The full, unfiltered catalog. Used to derive every facet's option list
   * and live counts — this component never filters `entries` itself, the
   * parent owns filtering/sorting the shown grid.
   */
  entries: ShapeCatalogEntry[];

  kind: ShapeKind;
  onKindChange: (kind: ShapeKind) => void;

  chordSelection: ChordFacetSelection;
  onQualityGroupChange: (group: ChordQualityGroup | undefined) => void;
  onActiveTypesChange: (types: string[]) => void;
  onActiveVoicingFamiliesChange: (families: string[]) => void;
  onRootChange: (root: string) => void;
  chordSort: ChordSortOption;
  onChordSortChange: (sort: ChordSortOption) => void;

  scaleSelection: ScaleFacetSelection;
  system: string;
  onSystemChange: (system: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;

  nameQuery: string;
  onNameQueryChange: (nameQuery: string) => void;

  failingOnly: boolean;
  onFailingOnlyChange: (failingOnly: boolean) => void;

  /** Live "Showing N of M" counts — computed by the parent from the faceted filter. */
  shownCount: number;
  totalCount: number;
}

export function FilterBar({
  entries,
  kind,
  onKindChange,
  chordSelection,
  onQualityGroupChange,
  onActiveTypesChange,
  onActiveVoicingFamiliesChange,
  onRootChange,
  chordSort,
  onChordSortChange,
  scaleSelection,
  system,
  onSystemChange,
  quality,
  onQualityChange,
  nameQuery,
  onNameQueryChange,
  failingOnly,
  onFailingOnlyChange,
  shownCount,
  totalCount,
}: FilterBarProps) {
  // The visible "Showing N of M" text updates instantly, but re-announcing
  // it via `aria-live` on every search keystroke spams screen readers.
  // Debounce ONLY the announcement — a separate visually-hidden live
  // region, ~500ms behind the visible count.
  const [announced, setAnnounced] = useState({ shownCount, totalCount });
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced({ shownCount, totalCount }), 500);
    return () => clearTimeout(timer);
  }, [shownCount, totalCount]);

  return (
    <div className="tg-filterbar">
      <div className="tg-filterbar-row">
        <ToggleGroup options={KIND_TOGGLE_OPTIONS} value={kind} onChange={onKindChange} />

        <input
          type="text"
          value={nameQuery}
          onChange={(e) => onNameQueryChange(e.target.value)}
          placeholder="Search (m7b5, ø, half-dim…)"
          className="tg-input"
          aria-label="Search shapes by name"
        />

        <label className="tg-checkbox-label">
          <input type="checkbox" checked={failingOnly} onChange={(e) => onFailingOnlyChange(e.target.checked)} />
          Failing only
        </label>

        {kind === "chord" && (
          <select
            value={chordSort}
            onChange={(e) => onChordSortChange(e.target.value as ChordSortOption)}
            className="tg-select"
            aria-label="Sort chord shapes"
          >
            <option value="baseFret">Sort: base fret ↑</option>
            <option value="name">Sort: name</option>
          </select>
        )}

        <span className="tg-count">
          Showing {shownCount} of {totalCount}
        </span>
        <span aria-live="polite" className="tg-sr-only">
          Showing {announced.shownCount} of {announced.totalCount}
        </span>
      </div>

      {kind === "chord" ? (
        <ChordFacets
          entries={entries}
          selection={chordSelection}
          onQualityGroupChange={onQualityGroupChange}
          onActiveTypesChange={onActiveTypesChange}
          onActiveVoicingFamiliesChange={onActiveVoicingFamiliesChange}
          onRootChange={onRootChange}
        />
      ) : (
        <ScaleFacets
          entries={entries}
          selection={scaleSelection}
          system={system}
          onSystemChange={onSystemChange}
          quality={quality}
          onQualityChange={onQualityChange}
        />
      )}
    </div>
  );
}

// ============================================================
// Chord facets — quality-group -> type chips, voicing-family chips, root strip
// ============================================================

interface ChordFacetsProps {
  entries: ShapeCatalogEntry[];
  selection: ChordFacetSelection;
  onQualityGroupChange: (group: ChordQualityGroup | undefined) => void;
  onActiveTypesChange: (types: string[]) => void;
  onActiveVoicingFamiliesChange: (families: string[]) => void;
  onRootChange: (root: string) => void;
}

function ChordFacets({
  entries,
  selection,
  onQualityGroupChange,
  onActiveTypesChange,
  onActiveVoicingFamiliesChange,
  onRootChange,
}: ChordFacetsProps) {
  const groupFacets = useMemo(() => chordQualityGroupFacets(entries), [entries]);
  const selectedGroupFacet = groupFacets.find((g) => g.group === selection.qualityGroup);

  const allVoicingFamilies = useMemo(() => distinctVoicingFamilies(entries), [entries]);
  const familyCounts = useMemo(() => voicingFamilyCounts(entries, selection), [entries, selection]);
  const rootCounts = useMemo(() => chordRootCounts(entries, selection), [entries, selection]);

  function handleGroupClick(group: ChordQualityGroup | undefined) {
    onQualityGroupChange(group);
    onActiveTypesChange([]);
  }

  function handleTypeClick(type: string) {
    if (!selectedGroupFacet) return;
    onActiveTypesChange(toggleInAllOnSet(selection.activeTypes ?? [], selectedGroupFacet.types, type));
  }

  function handleFamilyClick(family: string) {
    onActiveVoicingFamiliesChange(
      toggleInAllOnSet(selection.activeVoicingFamilies ?? [], allVoicingFamilies, family),
    );
  }

  return (
    <div className="tg-filterbar">
      <FacetRow label="Quality">
        <Chip active={selection.qualityGroup === undefined} onClick={() => handleGroupClick(undefined)}>
          All
        </Chip>
        {groupFacets.map(({ group }) => (
          <Chip key={group} active={selection.qualityGroup === group} onClick={() => handleGroupClick(group)}>
            {group}
          </Chip>
        ))}
        {selectedGroupFacet && (
          <span className="tg-facet-row">
            {selectedGroupFacet.types.map((type) => (
              <Chip
                key={type}
                active={(selection.activeTypes?.length ?? 0) === 0 || (selection.activeTypes ?? []).includes(type)}
                onClick={() => handleTypeClick(type)}
              >
                {chordTypeLabel(type)}
              </Chip>
            ))}
          </span>
        )}
      </FacetRow>

      <FacetRow label="Voicing">
        {familyCounts.map(({ value, count, isZero }: FacetCount) => (
          <Chip
            key={value}
            active={
              (selection.activeVoicingFamilies?.length ?? 0) === 0 ||
              (selection.activeVoicingFamilies ?? []).includes(value)
            }
            isZero={isZero}
            onClick={() => handleFamilyClick(value)}
            title={`${value} — ${count} matching shape${count === 1 ? "" : "s"}`}
          >
            {value} <span className="tg-muted">{count}</span>
          </Chip>
        ))}
      </FacetRow>

      <FacetRow label="Root">
        <Chip
          active={!selection.root || selection.root === ANY_ROOT}
          onClick={() => onRootChange(ANY_ROOT)}
          title="Show every root — clears the root filter/preview"
          ariaLabel="Any root"
        >
          {ANY_ROOT}
        </Chip>
        {rootCounts.map(({ value, count, isZero }: FacetCount) => (
          <Chip
            key={value}
            active={selection.root === value}
            isZero={isZero}
            onClick={() => onRootChange(value)}
            title={rootChipTitle(value, count)}
            ariaLabel={rootChipTitle(value, count)}
          >
            {value} <span className="tg-muted">{count}</span>
          </Chip>
        ))}
      </FacetRow>
    </div>
  );
}

/** Root chip copy stating TG8's dual filter/preview semantics: open/fixed-root
 * shapes are truly filtered by root; movable shapes are transposed as a
 * preview and never excluded. */
function rootChipTitle(root: string, count: number): string {
  return (
    `${root} — filters open/fixed-root shapes to root ${root} ` +
    `(${count} matching); movable shapes are transposed to preview ${root} ` +
    `instead of being excluded`
  );
}

// ============================================================
// Scale facets — system + quality chips (single-select, live counts)
// ============================================================

interface ScaleFacetsProps {
  entries: ShapeCatalogEntry[];
  selection: ScaleFacetSelection;
  system: string;
  onSystemChange: (system: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;
}

function ScaleFacets({ entries, selection, system, onSystemChange, quality, onQualityChange }: ScaleFacetsProps) {
  const systemCounts = useMemo(() => scaleSystemCounts(entries, selection), [entries, selection]);
  const qualityCounts = useMemo(() => scaleQualityCounts(entries, selection), [entries, selection]);

  return (
    <div className="tg-filterbar">
      <FacetRow label="System">
        <Chip active={system === FILTER_ALL} onClick={() => onSystemChange(FILTER_ALL)}>
          All
        </Chip>
        {systemCounts.map(({ value, count, isZero }: FacetCount) => (
          <Chip
            key={value}
            active={system === value}
            isZero={isZero}
            onClick={() => onSystemChange(value)}
            title={`${value} — ${count} matching shape${count === 1 ? "" : "s"}`}
          >
            {value} <span className="tg-muted">{count}</span>
          </Chip>
        ))}
      </FacetRow>

      <FacetRow label="Quality">
        <Chip active={quality === FILTER_ALL} onClick={() => onQualityChange(FILTER_ALL)}>
          All
        </Chip>
        {qualityCounts.map(({ value, count, isZero }: FacetCount) => (
          <Chip
            key={value}
            active={quality === value}
            isZero={isZero}
            onClick={() => onQualityChange(value)}
            title={`${value} — ${count} matching shape${count === 1 ? "" : "s"}`}
          >
            {value} <span className="tg-muted">{count}</span>
          </Chip>
        ))}
      </FacetRow>
    </div>
  );
}

// ============================================================
// Shared chip primitives
// ============================================================

/**
 * Toggles `value` within a multi-select facet whose "unset" (empty array)
 * state means "every option in `all` is on". The first toggle away from
 * that implicit all-on state materializes it as an explicit set built from
 * `all`; toggling back up to cover every option in `all` collapses back to
 * `[]` so "all on" and "no narrowing" stay the same state.
 */
function toggleInAllOnSet(active: readonly string[], all: readonly string[], value: string): string[] {
  const base = active.length > 0 ? active : all;
  const next = new Set(base);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  if (next.size === all.length) return [];
  return [...next];
}

interface FacetRowProps {
  label: string;
  children: ReactNode;
}

function FacetRow({ label, children }: FacetRowProps) {
  return (
    <div className="tg-facet-row">
      <span className="tg-facet-label">{label}</span>
      {children}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  isZero?: boolean;
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/** Pill-shaped facet toggle. Zero-count facets stay clickable but render
 * greyed via opacity — never hidden. */
function Chip({ active, isZero, onClick, title, ariaLabel, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={["tg-chip", isZero ? "tg-chip-zero" : ""].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

interface ToggleGroupProps<V extends string> {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}

function ToggleGroup<V extends string>({ options, value, onChange }: ToggleGroupProps<V>) {
  return (
    <div className="tg-toggle-group">
      {options.map((opt) => (
        <button key={opt.value} type="button" aria-pressed={value === opt.value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
