/**
 * Ported from `site/app/shapes/components/ScaleDetailView.tsx`. The root
 * panel (`ShapeDetailPanel.tsx`, including `buildDetail`, which produces
 * the `ScaleDetail` this view renders) is a sibling module, not an
 * ancestor: the shared presentational primitives and the `ScaleDetail`
 * type live in `./detailPrimitives`/`./detailTypes` so this view doesn't
 * import back from the panel (CR-035 — keeps the import graph a DAG).
 * Read-only: never emits `data-tg-edit`.
 */
import type { CompatibleShapesResult, ScaleCatalogEntry, ShapeCatalogEntry } from "shape-catalog";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { FeaturedMark, IssueBadges } from "./IssueBadges";
import { ReportProblemLink, Section, SiblingStepper, siblingIndexAt } from "./detailPrimitives";
import type { ScaleDetail } from "./detailTypes";

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
  const parentEntry = entry.shape.parentShape ? scaleCatalogByName.get(entry.shape.parentShape) : undefined;

  return (
    <div>
      <div className="tg-detail-header">
        <div className="tg-card-header">
          <h2 className="tg-detail-title">{entry.name}</h2>
          {entry.shape.featured && <FeaturedMark />}
          <span className="tg-tag">{entry.shape.system}</span>
          {entry.shape.quality && <span className="tg-tag">{entry.shape.quality}</span>}
        </div>
        {entry.shape.parentShape && (
          <p className="tg-muted tg-detail-subtitle">
            Derived from{" "}
            {parentEntry ? (
              <button type="button" onClick={() => onSelectEntry(parentEntry)} className="tg-link">
                {entry.shape.parentShape}
              </button>
            ) : (
              <span>{entry.shape.parentShape}</span>
            )}
          </p>
        )}
        <div className="tg-detail-issues">
          <IssueBadges issues={entry.issues} />
        </div>
        <div className="tg-detail-stepper">
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
      <CompatibleShapesSection compatible={detail.compatible} scaleCatalogByName={scaleCatalogByName} onSelectEntry={onSelectEntry} />

      <ReportProblemLink entry={entry} />
    </div>
  );
}

function RelatedScalesSection({ related }: { related: Array<{ root: string; scale: string }> }) {
  return (
    <Section title="Related scales / modes">
      {related.length === 0 ? (
        <p className="tg-muted">No related scale/mode data available for this shape's quality.</p>
      ) : (
        <ul className="tg-link-list-block">
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
        <p className="tg-muted">No other registered shapes are compatible with this scale.</p>
      ) : (
        <ul className="tg-chip-list">
          {compatible.shapes.map((shape) => {
            const shapeEntry = scaleCatalogByName.get(shape.name);
            return (
              <li key={shape.name}>
                {shapeEntry ? (
                  <button type="button" onClick={() => onSelectEntry(shapeEntry)} className="tg-chip">
                    {shape.name}
                  </button>
                ) : (
                  <span className="tg-chip tg-muted">{shape.name}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {compatible.q4Footnote && (
        <p className="tg-muted tg-detail-footnote">
          Note (Q4): 3-notes-per-string shapes carry traditional modal names in the registry that this Tonal-derived
          compatibility check does not corroborate — it is not an assertion that the names match.
        </p>
      )}
    </Section>
  );
}
