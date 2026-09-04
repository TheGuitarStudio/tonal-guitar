/**
 * Framework-neutral React components for browsing (and, when capabilities
 * are injected, editing) the tonal-guitar shape library (spec §5.3).
 *
 * Consumers import `shape-library-ui/src/styles.css` alongside this module
 * and map their own theme onto its `--tg-*` custom properties.
 */
export {
  ShapeLibraryProvider,
  useLibraryCapabilities,
  type EditCapabilities,
  type LibraryCapabilities,
  type DraftBadgeInfo,
  type ShapeLibraryProviderProps,
} from "./capabilities";

export { IssueBadges, FeaturedMark } from "./IssueBadges";

export {
  ShapeDiagram,
  MONOCHROME_THEME,
  fretSummary,
  buildFretMarkers,
  fretRangeFor,
  type FrettedScaleHolder,
  type ShapeDiagramEntry,
  type ShapeDiagramProps,
} from "./ShapeDiagram";

export { ShapeCardDiagram, type ShapeCardDiagramProps } from "./ShapeCardDiagram";
export { ShapeCardChordTable, type ShapeCardChordTableProps } from "./ShapeCardChordTable";
export { ShapeCard, type ShapeCardProps } from "./ShapeCard";
export { FilterBar, FILTER_ALL, type FilterBarProps, type ChordSortOption } from "./FilterBar";

export {
  ShapeDetailPanel,
  Section,
  SiblingStepper,
  siblingIndexAt,
  ReportProblemLink,
  type ShapeDetailPanelProps,
  type ChordDetail,
  type ScaleDetail,
} from "./ShapeDetailPanel";
export { ChordDetailView } from "./ChordDetailView";
export { ScaleDetailView } from "./ScaleDetailView";

export { DiagramOrientationToggle, type DiagramOrientationToggleProps } from "./DiagramOrientationToggle";
export { ColumnsToggle, type ColumnsToggleProps } from "./ColumnsToggle";

export { ShapeBoard, type ShapeBoardProps } from "./ShapeBoard";
export { BoardCellCard, type BoardCellCardProps } from "./BoardCellCard";
