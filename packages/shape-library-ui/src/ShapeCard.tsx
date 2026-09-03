/**
 * Ported from `site/app/shapes/components/ShapeCard.tsx`. Compact,
 * monochrome, clickable shape card — chord symbol/display name,
 * voicing-family (or `quality`, for scales) tag, `fr N` tag, tags, audit id
 * badge(s), and the diagram. Everything else (metadata table, chord table,
 * report-a-problem link) lives in `ShapeDetailPanel`, which this card's
 * `onSelectEntry` opens.
 *
 * Capability-gated: an "Edit" affordance (`data-tg-edit`) renders only when
 * `capabilities.edit.onEditShape` is provided (spec §5.3 D-002 invariant).
 * It is a sibling of the card's own `<button>`, never nested inside it —
 * interactive elements cannot nest in valid HTML.
 *
 * `lazy` (spec §7 step 5) folds the site's former standalone
 * `LazyShapeCard.tsx` wrapper in here, behind a prop, so callers (the site's
 * grid, ~159 cards) don't have to reach for a second component: when
 * `lazy` is true, the real card defers mounting (and therefore embedding a
 * full `Fretboard` SVG subtree) until an `IntersectionObserver` reports it's
 * near the viewport, rendering an inert placeholder `<div>` until then.
 * `eager` overrides that for cards that should mount immediately regardless
 * (roughly the first screenful) — once a card has mounted under `lazy` it
 * stays mounted, mirroring the original component's behavior. Both `window`
 * and `IntersectionObserver` are only ever touched inside `useEffect`, never
 * during render, so the non-lazy (default) path stays safe under
 * `renderToString`/SSR prerender, and the lazy path degrades to an eager
 * mount if `IntersectionObserver` is unavailable.
 */
import { memo, useEffect, useRef, useState, type MouseEvent } from "react";
import type { ShapeCatalogEntry } from "shape-catalog";
import { ShapeCardDiagram } from "./ShapeCardDiagram";
import { FeaturedMark, IssueBadges } from "./IssueBadges";
import { useLibraryCapabilities } from "./capabilities";

export interface ShapeCardProps {
  entry: ShapeCatalogEntry;
  /** Invoked with the full entry when the card is clicked/activated. */
  onSelectEntry?: (entry: ShapeCatalogEntry) => void;
  /** Whether this card is the currently selected/open entry. */
  isSelected: boolean;
  /**
   * Defer mounting the real card behind an `IntersectionObserver` until it's
   * near the viewport, rendering a fixed-height placeholder until then.
   * Defaults to `false` (mount immediately, the original always-eager
   * behavior) so existing callers (e.g. the workbench's Board/Editor
   * screens) are unaffected.
   */
  lazy?: boolean;
  /**
   * Only meaningful with `lazy`: mount immediately rather than waiting on
   * the observer — for roughly the first screenful of a grid, so there's
   * real content on screen (and in statically-exported HTML) before any
   * scrolling or hydration-dependent observer work happens.
   */
  eager?: boolean;
}

// Mirrors the card's own intrinsic-size estimate — reserves roughly a
// card's real height so the page doesn't jump around as placeholders swap
// in real content while the user scrolls.
const PLACEHOLDER_HEIGHT = "480px";

// Cards start mounting once they're within this margin of the viewport, so
// the placeholder-to-content swap happens ahead of the user actually
// scrolling into it rather than popping in late.
const ROOT_MARGIN = "600px 0px";

/**
 * Compact, monochrome, clickable shape card.
 */
export const ShapeCard = memo(function ShapeCard({
  entry,
  onSelectEntry,
  isSelected,
  lazy = false,
  eager = false,
}: ShapeCardProps) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  // One-way latch: once the observer (or a fail-open path) has mounted the
  // real card, it never unmounts again. `visible` itself is computed during
  // render rather than synced via a separate effect+state pair — so a
  // filter change that flips a previously-deferred entry into the eager
  // range (e.g. it now sorts to the top of a failures-first list) is
  // reflected immediately, with no effect required (CR-041).
  const [mounted, setMounted] = useState(false);
  const visible = !lazy || eager || mounted;

  useEffect(() => {
    if (!lazy || visible) return;
    const node = placeholderRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer support (unexpected in any target browser, but fail
      // open rather than leaving the card permanently unmounted).
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, visible]);

  if (lazy && !visible) {
    // Unmounted placeholder: no focusable content and `aria-hidden`, so it
    // can't trap keyboard focus or announce itself to assistive tech while
    // waiting to mount.
    return (
      <div
        ref={placeholderRef}
        aria-hidden="true"
        className="tg-card-placeholder"
        style={{ height: PLACEHOLDER_HEIGHT }}
      />
    );
  }

  return <ShapeCardContent entry={entry} onSelectEntry={onSelectEntry} isSelected={isSelected} />;
});

function ShapeCardContent({ entry, onSelectEntry, isSelected }: Omit<ShapeCardProps, "lazy" | "eager">) {
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
      <button type="button" onClick={() => onSelectEntry?.(entry)} aria-pressed={isSelected} aria-current={isSelected ? "true" : undefined} className="tg-card">
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
}
