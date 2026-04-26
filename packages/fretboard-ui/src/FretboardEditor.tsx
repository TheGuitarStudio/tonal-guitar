"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { midi as toMidi, fromMidiSharps, chroma } from "@tonaljs/note";
import type { FrettedNote } from "tonal-guitar";
import { Fretboard, type FretboardProps } from "./Fretboard";
import type { FretMarker, FretboardLayout, FretboardTheme, LabelMode } from "./types";

/**
 * Editor cell — like FretMarker but with required identity for diffing
 * and an editor-only flag indicating which cell is the chosen root.
 */
export interface EditorCell {
  string: number;
  fret: number;
  isRoot?: boolean;
}

export interface FretboardEditorProps {
  tuning: string[];
  cells: EditorCell[];
  onChange: (cells: EditorCell[]) => void;
  /** Root pitch class (e.g. "A"). If omitted and a cell isRoot, the editor
   * derives intervals from that cell. If both omitted, intervals are blank. */
  rootPitchClass?: string;
  fretRange?: [number, number];
  layout?: Partial<FretboardLayout>;
  theme?: Partial<FretboardTheme>;
  labelMode?: LabelMode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Major-scale chromatic interval map: index = semitones from root.
 */
const SEMI_TO_INTERVAL = [
  "1P",
  "2m",
  "2M",
  "3m",
  "3M",
  "4P",
  "5d",
  "5P",
  "6m",
  "6M",
  "7m",
  "7M",
];

/**
 * Compute pitch class at (string, fret) for a tuning.
 * Always returns sharp spelling (e.g. "F#" not "Gb"). Display-only;
 * intervals are computed independently via chroma so spelling never
 * affects interval results.
 */
function pcAt(tuning: string[], string: number, fret: number): string {
  const open = tuning[string];
  const openMidi = toMidi(open);
  if (openMidi == null) return "";
  const note = fromMidiSharps(openMidi + fret);
  return note.replace(/[0-9-]+$/, "");
}

/**
 * Interval from rootPc to otherPc, computed via chroma so spelling is
 * irrelevant. Always returns a standard major-scale interval per semitone
 * (1P, 2m, 2M, 3m, 3M, 4P, 5d, 5P, 6m, 6M, 7m, 7M).
 */
function intervalFromTo(rootPc: string, otherPc: string): string {
  const r = chroma(rootPc);
  const o = chroma(otherPc);
  if (r == null || o == null || isNaN(r) || isNaN(o)) return "";
  const semis = ((o - r) % 12 + 12) % 12;
  return SEMI_TO_INTERVAL[semis];
}

/**
 * Map a chromatic interval to a major-scale degree number, when applicable.
 * Returns undefined if the interval is non-diatonic to a major scale.
 * 1P->1, 2M->2, 3M->3, 4P->4, 5P->5, 6M->6, 7M->7. Minors get the same number too.
 */
function intervalToDegreeNumber(interval: string): number | undefined {
  if (!interval) return undefined;
  const match = interval.match(/(\d+)/);
  if (!match) return undefined;
  let n = parseInt(match[1], 10);
  while (n > 7) n -= 7;
  return n;
}

export function FretboardEditor(props: FretboardEditorProps) {
  const {
    tuning,
    cells,
    onChange,
    rootPitchClass,
    fretRange,
    layout,
    theme,
    labelMode = "intervals",
    className,
    style,
  } = props;

  const [rootMode, setRootMode] = useState(false);

  // Determine effective root pitch class.
  const rootPc = useMemo(() => {
    if (rootPitchClass) return rootPitchClass;
    const rootCell = cells.find((c) => c.isRoot);
    if (rootCell) return pcAt(tuning, rootCell.string, rootCell.fret);
    return "";
  }, [rootPitchClass, cells, tuning]);

  const markers: FretMarker[] = useMemo(() => {
    return cells.map((c) => {
      const pc = pcAt(tuning, c.string, c.fret);
      const interval = rootPc ? intervalFromTo(rootPc, pc) : "";
      const intervalNumber = intervalToDegreeNumber(interval);
      return {
        string: c.string,
        fret: c.fret,
        pc,
        interval,
        intervalNumber,
        role: c.isRoot ? "root" : interval === "1P" ? "root" : undefined,
      };
    });
  }, [cells, tuning, rootPc]);

  const cellKey = (s: number, f: number) => `${s}:${f}`;
  const cellIndex = useMemo(() => {
    const m = new Map<string, number>();
    cells.forEach((c, i) => m.set(cellKey(c.string, c.fret), i));
    return m;
  }, [cells]);

  const addCell = useCallback(
    (string: number, fret: number) => {
      const next = [...cells, { string, fret }];
      onChange(next);
    },
    [cells, onChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      const next = cells.filter((_, i) => i !== index);
      onChange(next);
    },
    [cells, onChange],
  );

  const setRoot = useCallback(
    (string: number, fret: number) => {
      const next = cells.map((c) => ({
        ...c,
        isRoot: c.string === string && c.fret === fret,
      }));
      onChange(next);
    },
    [cells, onChange],
  );

  const handleCellDoubleClick: FretboardProps["onCellDoubleClick"] = (
    string,
    fret,
  ) => {
    const idx = cellIndex.get(cellKey(string, fret));
    if (idx != null) {
      removeAt(idx);
    } else {
      addCell(string, fret);
    }
  };

  const handleMarkerClick: FretboardProps["onMarkerClick"] = (m) => {
    if (rootMode) {
      setRoot(m.string, m.fret);
      setRootMode(false);
    }
  };

  const handleMarkerDoubleClick: FretboardProps["onMarkerDoubleClick"] = (m) => {
    const idx = cellIndex.get(cellKey(m.string, m.fret));
    if (idx != null) removeAt(idx);
  };

  const handleClear = () => onChange([]);

  return (
    <div className={className} style={style}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setRootMode((v) => !v)}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid currentColor",
            background: rootMode ? "#ef4444" : "transparent",
            color: rootMode ? "white" : "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {rootMode ? "Click a note to set root" : "Set root"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={cells.length === 0}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid currentColor",
            background: "transparent",
            fontSize: 12,
            cursor: cells.length === 0 ? "not-allowed" : "pointer",
            opacity: cells.length === 0 ? 0.4 : 1,
          }}
        >
          Clear
        </button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Double-click empty cell to add, double-click note to remove. Root:{" "}
          {rootPc || "—"}
        </span>
      </div>
      <Fretboard
        tuning={tuning}
        markers={markers}
        fretRange={fretRange}
        layout={layout}
        theme={theme}
        labelMode={labelMode}
        onCellDoubleClick={handleCellDoubleClick}
        onMarkerClick={handleMarkerClick}
        onMarkerDoubleClick={handleMarkerDoubleClick}
      />
    </div>
  );
}

/**
 * Convert editor cells into a tonal-guitar `ScaleShape`-style intervals-per-string array.
 * Returns `null` if no root cell is set (and no rootPitchClass override is provided).
 */
export function cellsToScaleShapeStrings(
  cells: EditorCell[],
  tuning: string[],
  rootPitchClass?: string,
): { strings: (string[] | null)[]; rootString: number } | null {
  const rootCell = cells.find((c) => c.isRoot);
  const rootPc =
    rootPitchClass ??
    (rootCell ? pcAt(tuning, rootCell.string, rootCell.fret) : null);
  if (!rootPc) return null;

  const byString: (string[] | null)[] = tuning.map(() => null);
  const sorted = [...cells].sort((a, b) => a.string - b.string || a.fret - b.fret);
  for (const c of sorted) {
    const pc = pcAt(tuning, c.string, c.fret);
    const ivl = intervalFromTo(rootPc, pc);
    if (!ivl) continue;
    const list = byString[c.string] ?? [];
    list.push(ivl);
    byString[c.string] = list;
  }
  return { strings: byString, rootString: rootCell?.string ?? 0 };
}

/**
 * Extract editor cells from an existing tonal-guitar `FrettedScale`'s notes
 * (e.g. for editing/correcting an existing shape).
 */
export function frettedNotesToCells(notes: FrettedNote[]): EditorCell[] {
  return notes.map((n) => ({
    string: n.string,
    fret: n.fret,
    isRoot: n.interval === "1P",
  }));
}
