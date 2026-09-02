"use client";

import { Fretboard, defaultTheme, type FretboardTheme, type FretMarker } from "fretboard-ui";
import type { FrettedScale } from "tonal-guitar";
import type { ShapeCatalogEntry } from "shape-catalog";

// --- Monochrome theme -------------------------------------------------
//
// `<Fretboard theme>` shallow-merges `intervalColors` with
// `defaultTheme.intervalColors` (see `Fretboard.tsx`), and `resolveColor`
// falls through marker.color -> marker.role -> theme.intervalColors[interval]
// -> theme.defaultMarker. Markers built here (and in `CompactFretboard.tsx`)
// never set `role`, so making every dot the same color requires overriding
// *every* key already present in `defaultTheme.intervalColors`, not just the
// average/first one — plus `rootMarker`/`ghostMarker`/`highlightMarker`,
// which `resolveColor` checks before `intervalColors`.
//
// Canonical shared constant: v1 of the shape library renders every diagram
// monochrome (the interval-color legend returns later behind a dedicated
// toggle). `CompactFretboard.tsx` imports this rather than duplicating it.
const MONOCHROME_MARKER_COLOR = defaultTheme.defaultMarker;

export const MONOCHROME_THEME: Partial<FretboardTheme> = {
  defaultMarker: MONOCHROME_MARKER_COLOR,
  rootMarker: MONOCHROME_MARKER_COLOR,
  ghostMarker: MONOCHROME_MARKER_COLOR,
  highlightMarker: MONOCHROME_MARKER_COLOR,
  intervalColors: Object.fromEntries(
    Object.keys(defaultTheme.intervalColors).map((interval) => [
      interval,
      MONOCHROME_MARKER_COLOR,
    ]),
  ),
};

interface ShapeCardDiagramProps {
  entry: ShapeCatalogEntry;
}

/**
 * Minimal shape the fret-marker/fret-range/fret-summary helpers below need —
 * just the built `FrettedScale`. Both `ShapeCatalogEntry` (used here) and
 * `CompactFretboard.tsx`'s own smaller `CompactFretboardEntry` satisfy this
 * structurally, so `CompactFretboard.tsx` imports these helpers rather than
 * duplicating them.
 */
export interface FrettedScaleHolder {
  frettedScale: FrettedScale;
}

// Per-string fret summary for a diagram's `aria-label` — e.g. "muted, 3,
// 2, 0, 1, 0" for a 6-string chord, or "3 5 7, 3 5 7, …" for a scale shape
// that places several notes on a string. Built from `frettedScale.notes`
// (every rendered marker) rather than `builtFrets` (one representative fret
// per string), so the label describes everything the diagram shows.
export function fretSummary(entry: FrettedScaleHolder): string {
  const perString: number[][] = entry.frettedScale.tuning.map(() => []);
  for (const n of entry.frettedScale.notes) {
    perString[n.string].push(n.fret);
  }
  return perString
    .map((frets) =>
      frets.length === 0 ? "muted" : [...frets].sort((a, b) => a - b).join(" "),
    )
    .join(", ");
}

/** `FretMarker[]` for every note in `entry.frettedScale` — shared by
 * `ShapeCardDiagram` and `CompactFretboard`'s thumbnail/enlarged diagrams. */
export function buildFretMarkers(entry: FrettedScaleHolder): FretMarker[] {
  return entry.frettedScale.notes.map((n) => ({
    string: n.string,
    fret: n.fret,
    pc: n.pc,
    interval: n.interval,
    intervalNumber: n.intervalNumber,
  }));
}

/** `[minFret, maxFret]` padded by one fret on each side (floored at 0) —
 * shared by `ShapeCardDiagram` and `CompactFretboard`. */
export function fretRangeFor(entry: FrettedScaleHolder): [number, number] {
  const frets = entry.frettedScale.notes.map((n) => n.fret);
  return [Math.max(0, Math.min(...frets) - 1), Math.max(...frets) + 1];
}

/**
 * Trimmed, controls-less adapter over `<Fretboard>` for the shape library's
 * 159-card grid. Unlike `FretboardDiagram` (which carries per-instance
 * `useState` for label mode / orientation / handedness / view mode), this
 * component renders with fixed settings — no local state — so mounting it
 * once per card doesn't multiply state across the whole grid.
 */
export function ShapeCardDiagram({ entry }: ShapeCardDiagramProps) {
  const { frettedScale, renderRoot, name } = entry;

  if (frettedScale.notes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-center text-sm text-fd-muted-foreground">
        Failed to build at {renderRoot}
      </div>
    );
  }

  const fretRange = fretRangeFor(entry);
  const markers = buildFretMarkers(entry);

  // `role="img"` collapses the SVG's internals (text, paths, etc.) into a
  // single presentational unit for assistive tech, replaced by this label —
  // without it the SVG's fret numbers and string letters would surface as an
  // unstructured character-by-character read-out.
  const diagramLabel = `${name} at ${renderRoot}, frets low to high: ${fretSummary(entry)}`;

  return (
    <div
      role="img"
      aria-label={diagramLabel}
      className="overflow-x-auto text-fd-foreground"
    >
      <Fretboard
        tuning={frettedScale.tuning}
        markers={markers}
        fretRange={fretRange}
        labelMode="intervals"
        layout={{ orientation: "horizontal" }}
        theme={MONOCHROME_THEME}
        className="font-mono"
      />
    </div>
  );
}
