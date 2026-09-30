"use client";

// Grid view for `/shapes`: the pinned "Needs attention" section plus the
// grouped card grid (spec 8.6 / D-004). The sibling of `ShapeBoardView` —
// `ShapeLibrary` owns the filtering/grouping state and passes the result in.
import { useMemo } from "react";
import { GROUP_COLLAPSE_THRESHOLD, type ShapeCatalogEntry, type ShapeGroup } from "shape-catalog";
// Deep-imported rather than via the `shape-library-ui` barrel (CR-068, see
// `ShapeLibrary.tsx`'s import comment): this file is statically imported by
// `ShapeLibrary.tsx`, so a barrel import here would pull the lazily loaded
// `ShapeDetailPanel` back into the eager `/shapes` chunk.
import { ShapeCard } from "shape-library-ui/src/ShapeCard";

// Cards at this index or earlier mount immediately rather than waiting on
// the IntersectionObserver `ShapeCard`'s `lazy` prop drives internally —
// roughly the first screenful of the 3-column (`xl:grid-cols-3`) layout, so
// there's real content on screen (and in the statically-exported HTML)
// before any scrolling or hydration-dependent observer work happens.
// Applied within the grouped grid's flattened visible-entry order; the
// pinned "Needs attention" section (below) always mounts eagerly since it's
// the audit's primary above-the-fold signal.
const EAGER_CARD_COUNT = 9;

export interface GridViewProps {
  /** Every failing entry of the active kind, pinned above the grid regardless of facets. */
  failingEntries: readonly ShapeCatalogEntry[];
  groups: readonly ShapeGroup<ShapeCatalogEntry>[];
  /** False shows the "no shapes match" empty state instead of `groups`. */
  hasMatches: boolean;
  selectedEntry: ShapeCatalogEntry | undefined;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
  onToggleGroupExpanded: (key: string) => void;
}

export function GridView({
  failingEntries,
  groups,
  hasMatches,
  selectedEntry,
  onSelectEntry,
  onToggleGroupExpanded,
}: GridViewProps) {
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
    <>
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
                onSelectEntry={onSelectEntry}
                isSelected={selectedEntry?.kind === entry.kind && selectedEntry.name === entry.name}
              />
            ))}
          </div>
        </section>
      )}

      {!hasMatches ? (
        <p className="text-sm text-fd-muted-foreground">No shapes match the current filters.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <GroupSection
              key={group.key}
              group={group}
              selectedEntry={selectedEntry}
              eagerNames={eagerNames}
              onSelectEntry={onSelectEntry}
              onToggleExpanded={() => onToggleGroupExpanded(group.key)}
            />
          ))}
        </div>
      )}
    </>
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
            onSelectEntry={onSelectEntry}
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
