"use client";

import type { FrettedScale } from "tonal-guitar";
import { pitchClass } from "@tonaljs/note";

interface FretboardDiagramProps {
  scale: FrettedScale;
  tuning: string[];
}

const INTERVAL_COLORS: Record<string, string> = {
  "1P": "#ef4444", // red — root
  "2M": "#a855f7", // purple
  "2m": "#a855f7",
  "3M": "#3b82f6", // blue
  "3m": "#3b82f6",
  "4P": "#f59e0b", // amber
  "4A": "#f59e0b",
  "5P": "#22c55e", // green
  "5d": "#22c55e",
  "6M": "#06b6d4", // cyan
  "6m": "#06b6d4",
  "7M": "#ec4899", // pink
  "7m": "#ec4899",
};

export function FretboardDiagram({ scale, tuning }: FretboardDiagramProps) {
  const notes = scale.notes;
  if (notes.length === 0) return null;

  const minFret = Math.max(0, Math.min(...notes.map((n) => n.fret)) - 1);
  const maxFret = Math.max(...notes.map((n) => n.fret)) + 1;
  const stringCount = tuning.length;

  const fretCount = maxFret - minFret + 1;
  const cellW = 40;
  const cellH = 24;
  const labelW = 28;
  const headerH = 20;
  const svgW = labelW + fretCount * cellW + 10;
  const svgH = headerH + stringCount * cellH + 10;

  // String labels (high to low for display, but internal is low to high)
  const labels = tuning.map((n) => {
    const pc = pitchClass(n);
    return pc.charAt(0);
  });
  labels[stringCount - 1] = labels[stringCount - 1].toLowerCase();

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="font-mono"
      >
        {/* Fret numbers */}
        {Array.from({ length: fretCount }, (_, i) => {
          const fret = minFret + i;
          return (
            <text
              key={`fret-${fret}`}
              x={labelW + i * cellW + cellW / 2}
              y={headerH - 4}
              textAnchor="middle"
              className="fill-fd-muted-foreground"
              fontSize={10}
            >
              {fret}
            </text>
          );
        })}

        {/* Strings (display: high string at top) */}
        {Array.from({ length: stringCount }, (_, display) => {
          const s = stringCount - 1 - display;
          const y = headerH + display * cellH + cellH / 2;
          return (
            <g key={`string-${s}`}>
              {/* Label */}
              <text
                x={labelW - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-fd-muted-foreground"
                fontSize={12}
                fontWeight="bold"
              >
                {labels[s]}
              </text>
              {/* String line */}
              <line
                x1={labelW}
                y1={y}
                x2={labelW + fretCount * cellW}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.2}
              />
            </g>
          );
        })}

        {/* Fret lines */}
        {Array.from({ length: fretCount + 1 }, (_, i) => {
          const x = labelW + i * cellW;
          return (
            <line
              key={`fretline-${i}`}
              x1={x}
              y1={headerH}
              x2={x}
              y2={headerH + stringCount * cellH}
              stroke="currentColor"
              strokeWidth={i === 0 && minFret === 0 ? 3 : 1}
              opacity={i === 0 && minFret === 0 ? 0.6 : 0.15}
            />
          );
        })}

        {/* Note dots */}
        {notes.map((n, i) => {
          const display = stringCount - 1 - n.string;
          const fretOffset = n.fret - minFret;
          const cx = labelW + fretOffset * cellW + cellW / 2;
          const cy = headerH + display * cellH + cellH / 2;
          const color = INTERVAL_COLORS[n.interval] ?? "#6b7280";

          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.9} />
              <text
                x={cx}
                y={cy + 3.5}
                textAnchor="middle"
                fill="white"
                fontSize={8}
                fontWeight="bold"
              >
                {n.interval === "1P" ? "R" : n.pc}
              </text>
              <title>
                {n.note} ({n.interval}) — string {n.string}, fret {n.fret}
              </title>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-fd-muted-foreground">
        <span>
          <span
            className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#ef4444" }}
          />
          Root
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#3b82f6" }}
          />
          3rd
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#22c55e" }}
          />
          5th
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#f59e0b" }}
          />
          4th
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#ec4899" }}
          />
          7th
        </span>
      </div>
    </div>
  );
}
