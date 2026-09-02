"use client";

// Small shared presentational primitives used by both `ShapeCard.tsx` (the
// grid card) and `ShapeDetailPanel.tsx` (the detail slide-over). Neither of
// these depends on `ShapeDetailPanel.tsx` — the panel is code-split out of
// the initial `/shapes` chunk (see `ShapeLibrary.tsx`'s `next/dynamic` import),
// so shared pieces live here rather than being imported from the panel.
import type { ShapeAuditIssue } from "tonal-guitar";
import { badgeClassFor, severityRank } from "shape-catalog";

/** Sorted, badge-styled list of a shape's audit issues — `null` when there
 * are none. Shared by the grid card and the detail panel so severity
 * ranking/styling can't drift between the two. */
export function IssueBadges({ issues }: { issues: ShapeAuditIssue[] }) {
  const sorted = [...issues].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );
  if (sorted.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((issue, i) => (
        <span
          key={`${issue.id}-${i}`}
          title={issue.message}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${badgeClassFor(issue.severity)}`}
        >
          {issue.id}
        </span>
      ))}
    </div>
  );
}

/** The ★ "featured shape" marker — shared by the grid card and the detail panel. */
export function FeaturedMark() {
  return (
    <span aria-label="Featured" title="Featured shape" className="text-amber-500">
      ★
    </span>
  );
}
