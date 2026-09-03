/**
 * Orientation-aware wrapper over `fretboard-ui`'s `<Fretboard>` (spec §5.3).
 * Ports the monochrome theme and fret-marker/fret-range/fret-summary helpers
 * that lived in `site/app/shapes/components/ShapeCardDiagram.tsx`, and
 * generalizes the fixed-horizontal diagram there into a component that
 * accepts `orientation`/`labelMode`/`layout` — `ShapeCardDiagram.tsx` in
 * this package is now a thin, fixed-settings wrapper over this component.
 *
 * Read-only, capability-independent: never emits `data-tg-edit`.
 */
import { Fretboard, defaultTheme, type FretboardTheme, type FretMarker, type FretboardLayout, type LabelMode, type Orientation } from "fretboard-ui";
import type { FrettedScale } from "tonal-guitar";

// `<Fretboard theme>` shallow-merges `intervalColors` with
// `defaultTheme.intervalColors`, and `resolveColor` falls through
// marker.color -> marker.role -> theme.intervalColors[interval] ->
// theme.defaultMarker. Markers built here never set `role`, so making
// every dot the same color requires overriding every key already present
// in `defaultTheme.intervalColors`, not just one — plus
// `rootMarker`/`ghostMarker`/`highlightMarker`, which `resolveColor` checks
// before `intervalColors`.
//
// Canonical shared constant: the shape library renders every diagram
// monochrome by default (the interval-color legend is a later toggle).
const MONOCHROME_MARKER_COLOR = defaultTheme.defaultMarker;

export const MONOCHROME_THEME: Partial<FretboardTheme> = {
  defaultMarker: MONOCHROME_MARKER_COLOR,
  rootMarker: MONOCHROME_MARKER_COLOR,
  ghostMarker: MONOCHROME_MARKER_COLOR,
  highlightMarker: MONOCHROME_MARKER_COLOR,
  intervalColors: Object.fromEntries(
    Object.keys(defaultTheme.intervalColors).map((interval) => [interval, MONOCHROME_MARKER_COLOR]),
  ),
};

/**
 * Minimal shape the fret-marker/fret-range/fret-summary helpers below need
 * — just the built `FrettedScale`. `ShapeCatalogEntry` (shape-catalog) and
 * any alternate-fingering entry satisfy this structurally.
 */
export interface FrettedScaleHolder {
  frettedScale: FrettedScale;
}

// Per-string fret summary for a diagram's `aria-label` — e.g. "muted, 3, 2,
// 0, 1, 0" for a 6-string chord, or "3 5 7, 3 5 7, …" for a scale shape that
// places several notes on a string. Built from `frettedScale.notes` (every
// rendered marker) rather than a single representative fret per string, so
// the label describes everything the diagram shows.
export function fretSummary(entry: FrettedScaleHolder): string {
  const perString: number[][] = entry.frettedScale.tuning.map(() => []);
  for (const n of entry.frettedScale.notes) {
    perString[n.string].push(n.fret);
  }
  return perString
    .map((frets) => (frets.length === 0 ? "muted" : [...frets].sort((a, b) => a - b).join(" ")))
    .join(", ");
}

/** `FretMarker[]` for every note in `entry.frettedScale`. */
export function buildFretMarkers(entry: FrettedScaleHolder): FretMarker[] {
  return entry.frettedScale.notes.map((n) => ({
    string: n.string,
    fret: n.fret,
    pc: n.pc,
    interval: n.interval,
    intervalNumber: n.intervalNumber,
  }));
}

/** `[minFret, maxFret]` padded by one fret on each side (floored at 0). */
export function fretRangeFor(entry: FrettedScaleHolder): [number, number] {
  const frets = entry.frettedScale.notes.map((n) => n.fret);
  return [Math.max(0, Math.min(...frets) - 1), Math.max(...frets) + 1];
}

export interface ShapeDiagramEntry extends FrettedScaleHolder {
  renderRoot: string;
  name: string;
}

export interface ShapeDiagramProps {
  entry: ShapeDiagramEntry;
  orientation?: Orientation;
  labelMode?: LabelMode;
  layout?: Partial<FretboardLayout>;
  theme?: Partial<FretboardTheme>;
  className?: string;
}

/**
 * Trimmed, controls-less adapter over `<Fretboard>` — no local state, fixed
 * per-instance settings, safe to mount many at once (e.g. a 159-card grid)
 * without multiplying state across the page.
 */
export function ShapeDiagram({
  entry,
  orientation = "horizontal",
  labelMode = "intervals",
  layout,
  theme = MONOCHROME_THEME,
  className,
}: ShapeDiagramProps) {
  const { frettedScale, renderRoot, name } = entry;

  if (frettedScale.notes.length === 0) {
    return <div className="tg-diagram-empty">Failed to build at {renderRoot}</div>;
  }

  const fretRange = fretRangeFor(entry);
  const markers = buildFretMarkers(entry);

  // `role="img"` collapses the SVG's internals (text, paths, etc.) into a
  // single presentational unit for assistive tech, replaced by this label.
  const diagramLabel = `${name} at ${renderRoot}, frets low to high: ${fretSummary(entry)}`;

  return (
    <div role="img" aria-label={diagramLabel} className={["tg-diagram", className].filter(Boolean).join(" ")}>
      <Fretboard
        tuning={frettedScale.tuning}
        markers={markers}
        fretRange={fretRange}
        labelMode={labelMode}
        layout={{ orientation, ...layout }}
        theme={theme}
        className="tg-mono"
      />
    </div>
  );
}
