/**
 * Shared detail-payload types for the shape detail panel and its two
 * kind-specific views (`ChordDetailView`/`ScaleDetailView`).
 *
 * Split out of `ShapeDetailPanel.tsx` (CR-035) so the panel and the two
 * views don't import back from each other: `ShapeDetailPanel` builds these
 * via `buildDetail` and passes them down; the views only need the shapes,
 * not the panel that produces them.
 */
import type { ChordShape, ScalesContainingChordResult } from "tonal-guitar";
import type { ChordCatalogEntry, ScaleCatalogEntry } from "shape-catalog";
import type { CompatibleShapesResult, InversionGroupsResult, SiblingStepperInfo } from "shape-catalog";

export interface ChordDetail {
  kind: "chord";
  entry: ChordCatalogEntry;
  identified: string[];
  chordName: string | undefined;
  scales: ScalesContainingChordResult | undefined;
  siblings: ChordShape[];
  stepper: SiblingStepperInfo;
  alternates: ChordShape[];
  inversions: InversionGroupsResult;
}

export interface ScaleDetail {
  kind: "scale";
  entry: ScaleCatalogEntry;
  siblings: ScaleCatalogEntry[];
  stepper: SiblingStepperInfo;
  related: Array<{ root: string; scale: string }>;
  compatible: CompatibleShapesResult;
}

export type PanelDetail = ChordDetail | ScaleDetail;
