"use client";

// ============================================================
// Scale-entry content (spec §Site "Scale entries")
// ============================================================
//
// Split out of `ShapeDetailPanel.tsx` (CR-021) — the root panel, the shared
// presentational primitives, and `buildDetail` (which produces the
// `ScaleDetail` this view renders) all live there.
import type {
  ScaleCatalogEntry,
  ShapeCatalogEntry,
} from "./shapeLibraryUtils";
import type { CompatibleShapesResult } from "./shapeDetailUtils";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { FeaturedMark, IssueBadges } from "./IssueBadges";
import {
  ReportProblemLink,
  Section,
  SiblingStepper,
  siblingIndexAt,
  type ScaleDetail,
} from "./ShapeDetailPanel";

export function ScaleDetailView({
  detail,
  scaleCatalogByName,
  onSelectEntry,
}: {
  detail: ScaleDetail;
  scaleCatalogByName: Map<string, ScaleCatalogEntry>;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  const { entry, siblings, stepper } = detail;

  function siblingAt(offset: number): ScaleCatalogEntry | undefined {
    const targetIndex = siblingIndexAt(stepper, offset, siblings.length);
    return targetIndex === undefined ? undefined : siblings[targetIndex];
  }

  const prevEntry = siblingAt(-1);
  const nextEntry = siblingAt(1);
  const parentEntry = entry.shape.parentShape
    ? scaleCatalogByName.get(entry.shape.parentShape)
    : undefined;

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-lg font-semibold text-fd-foreground">{entry.name}</h2>
          {entry.shape.featured && <FeaturedMark />}
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
            {entry.shape.system}
          </span>
          {entry.shape.quality && (
            <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
              {entry.shape.quality}
            </span>
          )}
        </div>
        {entry.shape.parentShape && (
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Derived from{" "}
            {parentEntry ? (
              <button
                type="button"
                onClick={() => onSelectEntry(parentEntry)}
                className="underline decoration-dotted hover:text-fd-primary"
              >
                {entry.shape.parentShape}
              </button>
            ) : (
              <span>{entry.shape.parentShape}</span>
            )}
          </p>
        )}
        <div className="mt-2">
          <IssueBadges issues={entry.issues} />
        </div>
        <div className="mt-2">
          <SiblingStepper
            index={stepper.index}
            total={stepper.total}
            itemLabel="Shape"
            onPrev={() => prevEntry && onSelectEntry(prevEntry)}
            onNext={() => nextEntry && onSelectEntry(nextEntry)}
          />
        </div>
      </div>

      <ShapeCardDiagram entry={entry} />

      <RelatedScalesSection related={detail.related} />
      <CompatibleShapesSection
        compatible={detail.compatible}
        scaleCatalogByName={scaleCatalogByName}
        onSelectEntry={onSelectEntry}
      />

      <ReportProblemLink reportUrl={detail.reportUrl} />
    </div>
  );
}

function RelatedScalesSection({
  related,
}: {
  related: Array<{ root: string; scale: string }>;
}) {
  return (
    <Section title="Related scales / modes">
      {related.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No related scale/mode data available for this shape's quality.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {related.map(({ root, scale }) => (
            <li key={`${root}-${scale}`}>
              {root} {scale}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function CompatibleShapesSection({
  compatible,
  scaleCatalogByName,
  onSelectEntry,
}: {
  compatible: CompatibleShapesResult;
  scaleCatalogByName: Map<string, ScaleCatalogEntry>;
  onSelectEntry: (entry: ShapeCatalogEntry) => void;
}) {
  return (
    <Section title="Compatible shapes">
      {compatible.shapes.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No other registered shapes are compatible with this scale.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {compatible.shapes.map((shape) => {
            const shapeEntry = scaleCatalogByName.get(shape.name);
            return (
              <li key={shape.name}>
                {shapeEntry ? (
                  <button
                    type="button"
                    onClick={() => onSelectEntry(shapeEntry)}
                    className="rounded-full border border-fd-border px-2.5 py-1 text-xs hover:border-fd-primary/50"
                  >
                    {shape.name}
                  </button>
                ) : (
                  <span className="rounded-full border border-fd-border px-2.5 py-1 text-xs text-fd-muted-foreground">
                    {shape.name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {compatible.q4Footnote && (
        <p className="mt-2 text-xs text-fd-muted-foreground">
          Note (Q4): 3-notes-per-string shapes carry traditional modal names
          in the registry that this Tonal-derived compatibility check does
          not corroborate — it is not an assertion that the names match.
        </p>
      )}
    </Section>
  );
}
