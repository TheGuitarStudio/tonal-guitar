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

export type ShapeKindFilter = ShapeKind | typeof FILTER_ALL;

export interface FilterBarProps {
  /**
   * The full, unfiltered catalog. Used only to derive dropdown option lists
   * (`distinctSystems`/`distinctVoicingFamilies`/`distinctQualities`) — not
   * filtered by this component itself. The parent owns filtering.
   */
  entries: ShapeCatalogEntry[];

  kind: ShapeKindFilter;
  onKindChange: (kind: ShapeKindFilter) => void;

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
  const systemOptions = useMemo(() => distinctSystems(entries), [entries]);
  const familyOrQualityOptions = useMemo(() => {
    if (kind === "chord") return distinctVoicingFamilies(entries);
    if (kind === "scale") return distinctQualities(entries);
    return [];
  }, [entries, kind]);
  const familyOrQualityLabel = kind === "scale" ? "Quality" : "Voicing family";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <ToggleGroup
        options={[
          { value: FILTER_ALL, label: "All" },
          { value: "scale", label: "Scale" },
          { value: "chord", label: "Chord" },
        ]}
        value={kind}
        onChange={(v) => onKindChange(v as ShapeKindFilter)}
      />

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
        disabled={kind === FILTER_ALL}
        className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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

      <span className="text-sm text-fd-muted-foreground">
        Showing {shownCount} of {totalCount}
      </span>
    </div>
  );
}

interface ToggleGroupProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

// Copied verbatim from
// `site/app/experiments/components/FretboardDiagram.tsx`'s (non-exported)
// `ToggleGroup` helper.
function ToggleGroup({ options, value, onChange }: ToggleGroupProps) {
  return (
    <div className="inline-flex rounded-md border border-fd-border text-xs">
      {options.map((opt, i) => {
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        const radius = isFirst
          ? "rounded-l-md"
          : isLast
            ? "rounded-r-md"
            : "";
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
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
