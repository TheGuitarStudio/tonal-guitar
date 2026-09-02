/**
 * Ported from `site/app/shapes/components/ShapeCard.tsx`. Compact,
 * monochrome, clickable shape card — chord symbol/display name,
 * voicing-family (or `quality`, for scales) tag, `fr N` tag, tags, audit id
 * badge(s), and the diagram. Everything else (metadata table, chord table,
 * report-a-problem link) lives in `ShapeDetailPanel`, which this card's
 * `onSelect` opens.
 *
 * Capability-gated: an "Edit" affordance (`data-tg-edit`) renders only when
 * `capabilities.edit.onEditShape` is provided (spec §5.3 D-002 invariant).
 * It is a sibling of the card's own `<button>`, never nested inside it —
 * interactive elements cannot nest in valid HTML.
 */
import { memo, type MouseEvent } from "react";
import type { ShapeCatalogEntry } from "shape-catalog";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { FeaturedMark, IssueBadges } from "./IssueBadges";
import { useLibraryCapabilities } from "./capabilities";

export interface ShapeCardProps {
  entry: ShapeCatalogEntry;
  /** Invoked with the full entry when the card is clicked/activated. */
  onSelect: (entry: ShapeCatalogEntry) => void;
  /** Whether this card is the currently selected/open entry. */
  isSelected: boolean;
}

/**
 * Compact, monochrome, clickable shape card.
 */
export const ShapeCard = memo(function ShapeCard({ entry, onSelect, isSelected }: ShapeCardProps) {
  const { name, shape, issues } = entry;
  const capabilities = useLibraryCapabilities();
  const chordShape = entry.kind === "chord" ? entry.shape : undefined;
  const scaleShape = entry.kind === "scale" ? entry.shape : undefined;

  const familyOrQualityTag = chordShape?.voicingFamily ?? scaleShape?.quality;
  const baseFret = chordShape?.baseFret;
  const tags = shape.tags ?? [];

  function handleEditClick(e: MouseEvent) {
    e.stopPropagation();
    capabilities.edit?.onEditShape?.(entry);
  }

  return (
    <div className="tg-card-wrapper">
      <button type="button" onClick={() => onSelect(entry)} aria-pressed={isSelected} aria-current={isSelected ? "true" : undefined} className="tg-card">
        <div className="tg-card-header">
          <h3 className="tg-card-title">{name}</h3>
          {shape.featured && <FeaturedMark />}
          {familyOrQualityTag && <span className="tg-tag">{familyOrQualityTag}</span>}
          {baseFret !== undefined && <span className="tg-tag tg-tag-mono">fr {baseFret}</span>}
          {tags.map((tag) => (
            <span key={tag} className="tg-tag">
              {tag}
            </span>
          ))}
        </div>

        <ShapeCardDiagram entry={entry} />

        {issues.length > 0 && (
          <div className="tg-card-issues">
            <IssueBadges issues={issues} />
          </div>
        )}
      </button>

      {capabilities.edit?.onEditShape && (
        <button
          type="button"
          data-tg-edit
          onClick={handleEditClick}
          className="tg-card-edit-btn"
          aria-label={`Edit ${name}`}
        >
          Edit
        </button>
      )}
    </div>
  );
});
