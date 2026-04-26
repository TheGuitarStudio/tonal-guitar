"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { pitchClass } from "@tonaljs/note";
import {
  autoFretRange,
  cellAtPoint,
  cellCenter,
  clientToSvg,
  computeSvgDimensions,
  fretLineEndpoints,
  fretNumberPosition,
  gridFromRange,
  inlayCenters,
  inlayKindFor,
  stringLabelPosition,
  stringLineEndpoints,
} from "./geometry";
import { defaultLayout, defaultTheme } from "./theme";
import type {
  FretMarker,
  FretboardLayout,
  FretboardTheme,
  LabelMode,
} from "./types";

export interface FretboardHandle {
  /** The underlying SVG element. */
  svg: SVGSVGElement | null;
}

export interface FretboardProps {
  tuning: string[];
  markers?: FretMarker[];
  fretRange?: [number, number];
  layout?: Partial<FretboardLayout>;
  theme?: Partial<FretboardTheme>;
  labelMode?: LabelMode;
  className?: string;
  style?: CSSProperties;
  onCellClick?: (string: number, fret: number, e: ReactMouseEvent) => void;
  onCellDoubleClick?: (string: number, fret: number, e: ReactMouseEvent) => void;
  onMarkerClick?: (marker: FretMarker, e: ReactMouseEvent) => void;
  onMarkerDoubleClick?: (marker: FretMarker, e: ReactMouseEvent) => void;
}

function resolveLabel(marker: FretMarker, mode: LabelMode): string {
  switch (mode) {
    case "none":
      return "";
    case "custom":
      return marker.label ?? "";
    case "numbers":
      return marker.intervalNumber != null
        ? String(marker.intervalNumber)
        : (marker.label ?? "");
    case "intervals":
      if (marker.interval === "1P") return "R";
      return marker.interval ?? marker.label ?? "";
    case "notes":
    default:
      return marker.pc ?? marker.label ?? "";
  }
}

function resolveColor(marker: FretMarker, theme: FretboardTheme): string {
  if (marker.color) return marker.color;
  if (marker.role === "root") return theme.rootMarker;
  if (marker.role === "ghost") return theme.ghostMarker;
  if (marker.role === "highlight") return theme.highlightMarker;
  if (marker.interval && theme.intervalColors[marker.interval]) {
    return theme.intervalColors[marker.interval];
  }
  return theme.defaultMarker;
}

export const Fretboard = forwardRef<FretboardHandle, FretboardProps>(
  function Fretboard(props, ref) {
    const {
      tuning,
      markers = [],
      fretRange,
      layout: layoutOverride,
      theme: themeOverride,
      labelMode = "notes",
      className,
      style,
      onCellClick,
      onCellDoubleClick,
      onMarkerClick,
      onMarkerDoubleClick,
    } = props;

    const layout: FretboardLayout = useMemo(
      () => ({ ...defaultLayout, ...layoutOverride }),
      [layoutOverride],
    );
    const theme: FretboardTheme = useMemo(
      () => ({
        ...defaultTheme,
        ...themeOverride,
        intervalColors: {
          ...defaultTheme.intervalColors,
          ...(themeOverride?.intervalColors ?? {}),
        },
      }),
      [themeOverride],
    );

    const range = useMemo(
      () => fretRange ?? autoFretRange(markers, 1),
      [fretRange, markers],
    );
    const grid = useMemo(
      () => gridFromRange(range, tuning.length),
      [range, tuning.length],
    );
    const svgDims = useMemo(
      () => computeSvgDimensions(grid, layout),
      [grid, layout],
    );

    const stringLabels = useMemo(() => {
      const labels = tuning.map((n) => pitchClass(n).charAt(0));
      labels[labels.length - 1] = labels[labels.length - 1].toLowerCase();
      return labels;
    }, [tuning]);

    const svgRef = useRef<SVGSVGElement | null>(null);
    useImperativeHandle(ref, () => ({ svg: svgRef.current }), []);

    function cellFromEvent(
      e: ReactMouseEvent,
    ): { string: number; fret: number } | null {
      if (!svgRef.current) return null;
      const { x, y } = clientToSvg(e.clientX, e.clientY, svgRef.current);
      return cellAtPoint(x, y, grid, layout, svgDims);
    }

    function handleClick(e: ReactMouseEvent) {
      if (!onCellClick) return;
      const cell = cellFromEvent(e);
      if (cell) onCellClick(cell.string, cell.fret, e);
    }

    function handleDoubleClick(e: ReactMouseEvent) {
      if (!onCellDoubleClick) return;
      const cell = cellFromEvent(e);
      if (cell) onCellDoubleClick(cell.string, cell.fret, e);
    }

    return (
      <svg
        ref={svgRef}
        className={className}
        style={{
          background: theme.background,
          ...style,
        }}
        width={svgDims.width}
        height={svgDims.height}
        viewBox={`0 0 ${svgDims.width} ${svgDims.height}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Inlays */}
        {layout.showInlays &&
          Array.from({ length: grid.fretCount }, (_, i) => {
            const fret = grid.minFret + i;
            const kind = inlayKindFor(fret, layout);
            if (!kind) return null;
            const centers = inlayCenters(fret, grid, layout, svgDims, kind);
            return centers.map((c, idx) => (
              <circle
                key={`inlay-${fret}-${idx}`}
                cx={c.cx}
                cy={c.cy}
                r={4}
                fill={theme.inlay}
                opacity={0.08}
              />
            ));
          })}

        {/* Fret numbers — fret 0 is the nut (not a fretted position), so skip it. */}
        {layout.showFretNumbers &&
          Array.from({ length: grid.fretCount }, (_, i) => {
            const fret = grid.minFret + i;
            if (fret === 0) return null;
            const pos = fretNumberPosition(fret, grid, layout, svgDims);
            return (
              <text
                key={`fretnum-${fret}`}
                x={pos.x}
                y={pos.y}
                textAnchor={pos.anchor}
                fontSize={10}
                fill={theme.fretNumber}
                opacity={0.6}
              >
                {fret}
              </text>
            );
          })}

        {/* Strings */}
        {Array.from({ length: grid.stringCount }, (_, s) => {
          const e = stringLineEndpoints(s, grid, layout, svgDims);
          return (
            <line
              key={`string-${s}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={theme.string}
              strokeWidth={1}
              opacity={0.25}
            />
          );
        })}

        {/* String labels */}
        {layout.showStringLabels &&
          Array.from({ length: grid.stringCount }, (_, s) => {
            const pos = stringLabelPosition(s, grid, layout, svgDims);
            return (
              <text
                key={`stringlabel-${s}`}
                x={pos.x}
                y={pos.y}
                textAnchor={pos.anchor}
                fontSize={12}
                fontWeight="bold"
                fill={theme.stringLabel}
                opacity={0.7}
              >
                {stringLabels[s]}
              </text>
            );
          })}

        {/* Fret lines */}
        {Array.from({ length: grid.fretCount + 1 }, (_, i) => {
          const e = fretLineEndpoints(i, grid, layout, svgDims);
          const isNut = i === 0 && grid.minFret === 0;
          return (
            <line
              key={`fretline-${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={isNut ? theme.nut : theme.fret}
              strokeWidth={isNut ? 3 : 1}
              opacity={isNut ? 0.7 : 0.18}
            />
          );
        })}

        {/* Markers */}
        {markers.map((m, i) => {
          const { cx, cy } = cellCenter(m.string, m.fret, grid, layout, svgDims);
          const color = resolveColor(m, theme);
          const label = resolveLabel(m, labelMode);
          const interactive = !!(onMarkerClick || onMarkerDoubleClick);
          return (
            <g
              key={`marker-${i}`}
              style={{ cursor: interactive ? "pointer" : "default" }}
              onClick={(e) => {
                if (onMarkerClick) {
                  e.stopPropagation();
                  onMarkerClick(m, e);
                }
              }}
              onDoubleClick={(e) => {
                if (onMarkerDoubleClick) {
                  e.stopPropagation();
                  onMarkerDoubleClick(m, e);
                }
              }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={layout.markerRadius}
                fill={color}
                opacity={m.role === "ghost" ? 0.45 : 0.92}
              />
              {label && (
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight="bold"
                  fill={theme.markerLabel}
                  pointerEvents="none"
                >
                  {label}
                </text>
              )}
              <title>
                {m.pc ?? ""} {m.interval ? `(${m.interval})` : ""} — string{" "}
                {m.string}, fret {m.fret}
              </title>
            </g>
          );
        })}
      </svg>
    );
  },
);
