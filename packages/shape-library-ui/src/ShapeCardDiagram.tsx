/**
 * Ported from `site/app/shapes/components/ShapeCardDiagram.tsx`. Fixed
 * horizontal/monochrome settings for the grid card — a thin wrapper over the
 * generalized `ShapeDiagram`, which now owns the shared helpers and
 * monochrome theme. Read-only: never emits `data-tg-edit`.
 */
import type { ShapeCatalogEntry } from "shape-catalog";
import { ShapeDiagram } from "./ShapeDiagram";

export interface ShapeCardDiagramProps {
  entry: ShapeCatalogEntry;
}

export function ShapeCardDiagram({ entry }: ShapeCardDiagramProps) {
  return <ShapeDiagram entry={entry} orientation="horizontal" labelMode="intervals" />;
}
