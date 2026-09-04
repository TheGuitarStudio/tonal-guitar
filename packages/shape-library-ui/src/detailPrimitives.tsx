/**
 * Shared presentational primitives used by `ShapeDetailPanel` and its two
 * kind-specific views (`ChordDetailView`/`ScaleDetailView`).
 *
 * Extracted out of `ShapeDetailPanel.tsx` (CR-035): the panel imports
 * `ChordDetailView`/`ScaleDetailView`, which in turn imported these
 * primitives back from the panel module, forming a cycle. Moving them here
 * makes the import graph a DAG: `ShapeDetailPanel`, `ChordDetailView`, and
 * `ScaleDetailView` all depend on this module, never on each other.
 */
import type { ReactNode } from "react";
import type { ShapeCatalogEntry, SiblingStepperInfo } from "shape-catalog";
import { useLibraryCapabilities } from "./capabilities";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tg-section">
      <h3 className="tg-section-title">{title}</h3>
      {children}
    </section>
  );
}

export function SiblingStepper({
  index,
  total,
  itemLabel,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  itemLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= 1) return null;
  const position = index === -1 ? "?" : index + 1;
  return (
    <div className="tg-stepper">
      <button type="button" onClick={onPrev} disabled={index <= 0} aria-label={`Previous ${itemLabel}`} className="tg-chip">
        &#8592;
      </button>
      <span>
        {itemLabel} {position} of {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={index === -1 || index >= total - 1}
        aria-label={`Next ${itemLabel}`}
        className="tg-chip"
      >
        &#8594;
      </button>
    </div>
  );
}

/**
 * Bounds-checked target index for a Prev/Next sibling-stepper step:
 * `stepper.index + offset`, or `undefined` when the stepper has no current
 * position (`index === -1`) or the target would fall outside `[0, total)`.
 */
export function siblingIndexAt(stepper: SiblingStepperInfo, offset: number, total: number): number | undefined {
  if (stepper.index === -1) return undefined;
  const targetIndex = stepper.index + offset;
  if (targetIndex < 0 || targetIndex >= total) return undefined;
  return targetIndex;
}

/** "Report a problem" link — reads `reportIssueUrl` from `LibraryCapabilities`
 * (not `EditCapabilities`: both the read-only site and the workbench may
 * want it). Renders nothing when no such capability is injected. */
export function ReportProblemLink({ entry }: { entry: ShapeCatalogEntry }) {
  const capabilities = useLibraryCapabilities();
  const reportUrl = capabilities.reportIssueUrl?.(entry);
  if (!reportUrl) return null;
  return (
    <p className="tg-report-link">
      <a href={reportUrl} target="_blank" rel="noreferrer" className="tg-link">
        Report a problem with this shape
      </a>
    </p>
  );
}
