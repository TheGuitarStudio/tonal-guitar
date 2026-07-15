"use client";

import { useMemo } from "react";
import type { ShapeCatalogEntry, ShapeKind } from "./shapeLibraryUtils";
import {
  distinctQualities,
  distinctSystems,
  distinctVoicingFamilies,
} from "./shapeLibraryUtils";

/** Sentinel used for every "no filter applied" dropdown option. */
export const FILTER_ALL = "all";

/** Kind toggle options for the `ToggleGroup` below — hoisted so it isn't
 * recreated on every render (mirrors `LEGEND` in ShapeCardDiagram.tsx). */
const KIND_TOGGLE_OPTIONS: { value: ShapeKind; label: string }[] = [
  { value: "scale", label: "Scale" },
  { value: "chord", label: "Chord" },
];

export interface FilterBarProps {
  /**
   * The full, unfiltered catalog. Used only to derive dropdown option lists
   * (`distinctSystems`/`distinctVoicingFamilies`/`distinctQualities`) — not
   * filtered by this component itself. The parent owns filtering.
   */
  entries: ShapeCatalogEntry[];

  /** Strict binary per spec — the scale and chord registries are separate. */
  kind: ShapeKind;
  onKindChange: (kind: ShapeKind) => void;

  system: string;
  onSystemChange: (system: string) => void;

  /** Chord shapes: voicingFamily. Scale shapes: quality. Meaning tracks `kind`. */
  familyOrQuality: string;
  onFamilyOrQualityChange: (value: string) => void;

  nameQuery: string;
  onNameQueryChange: (nameQuery: string) => void;

  failingOnly: boolean;
  onFailingOnlyChange: (failingOnly: boolean) => void;

  /** Live "Showing N of M" counts — computed by the parent from filterCatalog(). */
  shownCount: number;
  totalCount: number;
}

export function FilterBar({
  entries,
  kind,
  onKindChange,
  system,
  onSystemChange,
  familyOrQuality,
  onFamilyOrQualityChange,
  nameQuery,
  onNameQueryChange,
  failingOnly,
  onFailingOnlyChange,
  shownCount,
  totalCount,
}: FilterBarProps) {
  // Option lists are always scoped to the current kind — chord and scale
  // shapes use disjoint system value sets in the data.
  const kindEntries = useMemo(
    () => entries.filter((e) => e.kind === kind),
    [entries, kind],
  );
  const systemOptions = useMemo(() => distinctSystems(kindEntries), [kindEntries]);
  const familyOrQualityOptions = useMemo(() => {
    if (kind === "chord") return distinctVoicingFamilies(kindEntries);
    return distinctQualities(kindEntries);
  }, [kindEntries, kind]);
  const familyOrQualityLabel = kind === "scale" ? "Quality" : "Voicing family";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <ToggleGroup options={KIND_TOGGLE_OPTIONS} value={kind} onChange={onKindChange} />

      <select
        value={system}
        onChange={(e) => onSystemChange(e.target.value)}
        className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
        aria-label="Filter by system"
      >
        <option value={FILTER_ALL}>All systems</option>
        {systemOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={familyOrQuality}
        onChange={(e) => onFamilyOrQualityChange(e.target.value)}
        className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
        aria-label={`Filter by ${familyOrQualityLabel.toLowerCase()}`}
      >
        <option value={FILTER_ALL}>All {familyOrQualityLabel.toLowerCase()}</option>
        {familyOrQualityOptions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={nameQuery}
        onChange={(e) => onNameQueryChange(e.target.value)}
        placeholder="Search by name…"
        className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
        aria-label="Search shapes by name"
      />

      <label className="inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm">
        <input
          type="checkbox"
          checked={failingOnly}
          onChange={(e) => onFailingOnlyChange(e.target.checked)}
          className="accent-fd-primary"
        />
        Failing only
      </label>

      <span className="text-sm text-fd-muted-foreground" aria-live="polite">
        Showing {shownCount} of {totalCount}
      </span>
    </div>
  );
}

interface ToggleGroupProps<V extends string> {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}

// Adapted from
// `site/app/experiments/components/FretboardDiagram.tsx`'s (non-exported)
// `ToggleGroup` helper — made generic over its value type so callers (e.g.
// `KIND_TOGGLE_OPTIONS`'s `ShapeKind` values) don't need to cast in
// `onChange`.
function ToggleGroup<V extends string>({ options, value, onChange }: ToggleGroupProps<V>) {
  return (
    <div className="inline-flex rounded-md border border-fd-border text-xs">
      {options.map((opt, i) => {
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        let radius = "";
        if (isFirst) {
          radius = "rounded-l-md";
        } else if (isLast) {
          radius = "rounded-r-md";
        }
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`${radius} px-3 py-1 transition-colors ${
              active
                ? "bg-fd-primary text-fd-primary-foreground"
                : "hover:bg-fd-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
