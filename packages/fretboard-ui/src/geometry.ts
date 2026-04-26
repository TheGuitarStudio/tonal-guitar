import type { FretboardLayout } from "./types";

export interface GridDimensions {
  fretCount: number;
  stringCount: number;
  minFret: number;
}

export interface SvgDimensions {
  width: number;
  height: number;
  /** Origin of the playable grid (top-left of fret minFret, lowest displayed-string row). */
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Internal coordinate system: each cell has an "alongFret" axis and an "alongString" axis.
 * Horizontal: alongFret -> X, alongString -> Y.
 * Vertical:   alongFret -> Y, alongString -> X.
 */
function alongFret(
  fret: number,
  grid: GridDimensions,
  layout: FretboardLayout,
): number {
  return (fret - grid.minFret) * layout.cellWidth + layout.cellWidth / 2;
}

/**
 * Map a string index (0 = lowest pitched) to its display index along the
 * string axis. For horizontal we keep the ASCII-tab convention (high E on
 * top) regardless of handedness. For vertical, right-handed players see
 * low E on the left; left-handed players see it mirrored on the right.
 */
function stringDisplayIndex(
  stringIndex: number,
  grid: GridDimensions,
  layout: FretboardLayout,
): number {
  if (layout.orientation === "horizontal") {
    return grid.stringCount - 1 - stringIndex;
  }
  return layout.handedness === "left"
    ? grid.stringCount - 1 - stringIndex
    : stringIndex;
}

function alongString(
  stringIndex: number,
  grid: GridDimensions,
  layout: FretboardLayout,
): number {
  const display = stringDisplayIndex(stringIndex, grid, layout);
  return display * layout.cellHeight + layout.cellHeight / 2;
}

function project(
  alongFretPx: number,
  alongStringPx: number,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { x: number; y: number } {
  if (layout.orientation === "horizontal") {
    return { x: svg.gridX + alongFretPx, y: svg.gridY + alongStringPx };
  }
  return { x: svg.gridX + alongStringPx, y: svg.gridY + alongFretPx };
}

export function computeSvgDimensions(
  grid: GridDimensions,
  layout: FretboardLayout,
): SvgDimensions {
  const fretSpan = grid.fretCount * layout.cellWidth;
  const stringSpan = grid.stringCount * layout.cellHeight;

  if (layout.orientation === "horizontal") {
    return {
      width: layout.labelGutter + fretSpan + 12,
      height: layout.headerGutter + stringSpan + 12,
      gridX: layout.labelGutter,
      gridY: layout.headerGutter,
      gridWidth: fretSpan,
      gridHeight: stringSpan,
    };
  }
  return {
    width: layout.labelGutter + stringSpan + 12,
    height: layout.headerGutter + fretSpan + 12,
    gridX: layout.labelGutter,
    gridY: layout.headerGutter,
    gridWidth: stringSpan,
    gridHeight: fretSpan,
  };
}

export function cellCenter(
  stringIndex: number,
  fret: number,
  grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { cx: number; cy: number } {
  const f = alongFret(fret, grid, layout);
  const s = alongString(stringIndex, grid, layout);
  const { x, y } = project(f, s, layout, svg);
  return { cx: x, cy: y };
}

export function cellAtPoint(
  px: number,
  py: number,
  grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { string: number; fret: number } | null {
  const fretAxisPx =
    layout.orientation === "horizontal" ? px - svg.gridX : py - svg.gridY;
  const stringAxisPx =
    layout.orientation === "horizontal" ? py - svg.gridY : px - svg.gridX;

  const fretSpan = grid.fretCount * layout.cellWidth;
  const stringSpan = grid.stringCount * layout.cellHeight;
  if (fretAxisPx < 0 || fretAxisPx > fretSpan) return null;
  if (stringAxisPx < 0 || stringAxisPx > stringSpan) return null;

  const fretOffset = Math.floor(fretAxisPx / layout.cellWidth);
  const display = Math.floor(stringAxisPx / layout.cellHeight);
  // Inverse of stringDisplayIndex: same shape because both mappings are
  // involutions (display -> string flips/identity matches string -> display).
  let stringIndex: number;
  if (layout.orientation === "horizontal") {
    stringIndex = grid.stringCount - 1 - display;
  } else {
    stringIndex =
      layout.handedness === "left" ? grid.stringCount - 1 - display : display;
  }
  return { string: stringIndex, fret: grid.minFret + fretOffset };
}

/**
 * Endpoints for a vertical line between fret cells (the "fret wire").
 * `index` is 0..fretCount; index 0 is the nut/leftmost edge.
 */
export function fretLineEndpoints(
  index: number,
  _grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { x1: number; y1: number; x2: number; y2: number } {
  const fretEdge = index * layout.cellWidth;
  if (layout.orientation === "horizontal") {
    const x = svg.gridX + fretEdge;
    return { x1: x, y1: svg.gridY, x2: x, y2: svg.gridY + svg.gridHeight };
  }
  const y = svg.gridY + fretEdge;
  return { x1: svg.gridX, y1: y, x2: svg.gridX + svg.gridWidth, y2: y };
}

export function stringLineEndpoints(
  stringIndex: number,
  grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { x1: number; y1: number; x2: number; y2: number } {
  const s = alongString(stringIndex, grid, layout);
  if (layout.orientation === "horizontal") {
    return {
      x1: svg.gridX,
      y1: svg.gridY + s,
      x2: svg.gridX + svg.gridWidth,
      y2: svg.gridY + s,
    };
  }
  return {
    x1: svg.gridX + s,
    y1: svg.gridY,
    x2: svg.gridX + s,
    y2: svg.gridY + svg.gridHeight,
  };
}

export function fretNumberPosition(
  fret: number,
  grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { x: number; y: number; anchor: "middle" | "end" } {
  const f = alongFret(fret, grid, layout);
  if (layout.orientation === "horizontal") {
    return { x: svg.gridX + f, y: svg.gridY - 6, anchor: "middle" };
  }
  return { x: svg.gridX - 6, y: svg.gridY + f + 4, anchor: "end" };
}

export function stringLabelPosition(
  stringIndex: number,
  grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const s = alongString(stringIndex, grid, layout);
  if (layout.orientation === "horizontal") {
    return { x: svg.gridX - 6, y: svg.gridY + s + 4, anchor: "end" };
  }
  return { x: svg.gridX + s, y: svg.gridY - 6, anchor: "middle" };
}

export function inlayKindFor(
  fret: number,
  layout: FretboardLayout,
): "single" | "double" | null {
  if (fret <= 0) return null;
  if (layout.doubleInlayFrets.includes(fret)) return "double";
  if (layout.inlayFrets.includes(fret)) return "single";
  return null;
}

export function inlayCenters(
  fret: number,
  grid: GridDimensions,
  layout: FretboardLayout,
  svg: SvgDimensions,
  kind: "single" | "double",
): Array<{ cx: number; cy: number }> {
  const f = alongFret(fret, grid, layout);
  const stringSpanPx = grid.stringCount * layout.cellHeight;
  if (kind === "single") {
    const { x, y } = project(f, stringSpanPx / 2, layout, svg);
    return [{ cx: x, cy: y }];
  }
  const a = stringSpanPx * (1 / 3);
  const b = stringSpanPx * (2 / 3);
  const p1 = project(f, a, layout, svg);
  const p2 = project(f, b, layout, svg);
  return [
    { cx: p1.x, cy: p1.y },
    { cx: p2.x, cy: p2.y },
  ];
}

export function autoFretRange(
  markers: Array<{ fret: number }>,
  pad = 1,
): [number, number] {
  if (markers.length === 0) return [0, 5];
  const min = Math.min(...markers.map((m) => m.fret));
  const max = Math.max(...markers.map((m) => m.fret));
  return [Math.max(0, min - pad), max + pad];
}

export function gridFromRange(
  fretRange: [number, number],
  stringCount: number,
): GridDimensions {
  return {
    minFret: fretRange[0],
    fretCount: fretRange[1] - fretRange[0] + 1,
    stringCount,
  };
}

export function clientToSvg(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
): { x: number; y: number } {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const inv = ctm.inverse();
  const transformed = pt.matrixTransform(inv);
  return { x: transformed.x, y: transformed.y };
}
