/**
 * Small shared presentational primitives used by both `ShapeCard.tsx` (the
 * grid card) and `ShapeDetailPanel.tsx` (the detail slide-over). Ported from
 * `site/app/shapes/components/IssueBadges.tsx` — Tailwind/Fumadocs classes
 * replaced with `tg-`-prefixed classes from `./styles.css`; behavior
 * unchanged. Read-only: never emits `data-tg-edit`.
 */
import type { ShapeAuditIssue } from "tonal-guitar";
import { severityRank } from "shape-catalog";

// `shape-catalog`'s own `badgeClassFor` returns Tailwind utility classes for
// the site's direct consumption (spec §5.2) — this package has no Tailwind
// dependency (spec §5.3 hard constraint), so severity maps to a `tg-`
// class here instead. `severityRank` (imported above) still drives sort
// order so severity handling can't drift between packages.
const SEVERITY_CLASS: Record<string, string> = {
  error: "tg-badge tg-badge-error",
  warning: "tg-badge tg-badge-warning",
};

function badgeClassName(severity: ShapeAuditIssue["severity"]): string {
  return SEVERITY_CLASS[severity] ?? "tg-badge";
}

/** Sorted, badge-styled list of a shape's audit issues — `null` when there
 * are none. Shared by the grid card and the detail panel so severity
 * ranking/styling can't drift between the two. */
export function IssueBadges({ issues }: { issues: ShapeAuditIssue[] }) {
  const sorted = [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  if (sorted.length === 0) return null;
  return (
    <div className="tg-issues">
      {sorted.map((issue, i) => (
        <span key={`${issue.id}-${i}`} title={issue.message} className={badgeClassName(issue.severity)}>
          {issue.id}
        </span>
      ))}
    </div>
  );
}

/** The star "featured shape" marker — shared by the grid card and the detail panel. */
export function FeaturedMark() {
  return (
    <span aria-label="Featured" title="Featured shape" className="tg-star">
      &#9733;
    </span>
  );
}
