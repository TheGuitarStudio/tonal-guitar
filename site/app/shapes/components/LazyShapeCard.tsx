"use client";

import { useEffect, useRef, useState } from "react";
import type { ShapeCatalogEntry } from "./shapeLibraryUtils";
import { ShapeCard } from "./ShapeCard";

interface LazyShapeCardProps {
  entry: ShapeCatalogEntry;
  /**
   * Mount the real `<ShapeCard>` immediately, without waiting on the
   * IntersectionObserver. Set for roughly the first screenful of the grid
   * so the statically-exported HTML has real content before hydration, and
   * so there's nothing for server/client rendering to disagree about.
   */
  eager: boolean;
}

// Mirrors `ShapeCard`'s own `CARD_INTRINSIC_SIZE` estimate — reserves
// roughly a card's real height so the page doesn't jump around as
// placeholders swap in real content while the user scrolls.
const PLACEHOLDER_HEIGHT = "480px";

// Cards start mounting their real `<ShapeCard>` once they're within this
// margin of the viewport, so the placeholder-to-content swap happens ahead
// of the user actually scrolling into it rather than popping in late.
const ROOT_MARGIN = "600px 0px";

/**
 * Defers mounting a `<ShapeCard>` — which embeds a full `Fretboard` SVG
 * subtree — until it's near the viewport. The shape library grid renders
 * up to ~159 filtered cards; mounting every one up front means React
 * builds and reconciles every subtree even though the card's own
 * `content-visibility: auto` already defers off-screen *paint*. This
 * component keeps the up-front mount/reconcile cost proportional to what's
 * actually near the viewport.
 *
 * Once a card has mounted it stays mounted for the lifetime of this
 * component instance: re-hiding an off-screen card would drop it from
 * in-page find (Cmd/Ctrl+F) and could read as content vanishing on
 * scroll-back. `ShapeLibrary` keys each `LazyShapeCard` by the entry's
 * identity (`${kind}-${name}`), so changing filters naturally unmounts
 * entries that drop out of the result set and mounts fresh
 * `LazyShapeCard` instances (with their own fresh mount decision) for any
 * that are newly shown — no manual reset needed here.
 */
export function LazyShapeCard({ entry, eager }: LazyShapeCardProps) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    // Filters can flip a previously-deferred entry into the eager range
    // (e.g. it now sorts to the top of the failures-first list) — honor
    // that without waiting on the observer to catch up.
    if (eager) setVisible(true);
  }, [eager]);

  useEffect(() => {
    if (visible) return;
    const node = placeholderRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer support (unexpected in any target browser, but fail
      // open rather than leaving the card permanently unmounted).
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  if (visible) {
    return <ShapeCard entry={entry} />;
  }

  // Unmounted placeholder: no focusable content and `aria-hidden`, so it
  // can't trap keyboard focus or announce itself to assistive tech while
  // waiting to mount.
  return (
    <div
      ref={placeholderRef}
      aria-hidden="true"
      className="rounded-lg border border-fd-border"
      style={{ height: PLACEHOLDER_HEIGHT }}
    />
  );
}
