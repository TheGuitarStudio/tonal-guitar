"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { midi as toMidi, fromMidiSharps } from "@tonaljs/note";
import type { Barre, FrettedNote } from "tonal-guitar";
import { Fretboard, type FretboardProps } from "./Fretboard";
import { intervalFromTo, intervalToDegreeNumber } from "./intervals";
import type { FretMarker, FretboardLayout, FretboardTheme, LabelMode } from "./types";

/**
 * Editor cell — like FretMarker but with required identity for diffing
 * and an editor-only flag indicating which cell is the chosen root.
 */
export interface EditorCell {
  string: number;
  fret: number;
  isRoot?: boolean;
  /** Fingering number (1-4) assigned via the "finger" tool. */
  finger?: number | null;
  /** Marks this string as explicitly muted ("x") via the "mute" tool. */
  muted?: boolean;
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
  /** Active editing tool. Consumers (e.g. the shape-workbench editor) drive
   * cell mutation semantics off this; the base editor doesn't yet branch on it. */
  tool?: "select" | "note" | "root" | "finger" | "barre" | "mute";
  /** Finger number applied by the "finger" tool when placing/labeling a cell. */
  activeFinger?: 1 | 2 | 3 | 4;
  /** Chord barres overlaid on the board (drag-across-strings grouping). */
  barres?: Barre[];
  onBarresChange?: (barres: Barre[]) => void;
  /** Non-interactive reference markers (e.g. "show core as ghost", parent-shape box). */
  ghostMarkers?: FretMarker[];
}

/**
 * Compute pitch class at (string, fret) for a tuning.
 * Always returns sharp spelling (e.g. "F#" not "Gb"). Display-only;
 * intervals are computed independently via chroma so spelling never
 * affects interval results.
 */
export function pcAt(tuning: string[], string: number, fret: number): string {
  const open = tuning[string];
  const openMidi = toMidi(open);
  if (openMidi == null) return "";
  const note = fromMidiSharps(openMidi + fret);
  return note.replace(/[0-9-]+$/, "");
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

  // Determine effective root pitch class. An explicit isRoot cell (set via
  // the "Set root" button) wins so the user can override a passed-in
  // rootPitchClass without changing the prop.
  const rootPc = useMemo(() => {
    const rootCell = cells.find((c) => c.isRoot);
    if (rootCell) return pcAt(tuning, rootCell.string, rootCell.fret);
    if (rootPitchClass) return rootPitchClass;
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
 * Convert editor cells into a tonal-guitar `ChordShape`-style grip: one
 * interval per string (unlike `cellsToScaleShapeStrings`, which allows
 * several notes per string). Companion to `cellsToScaleShapeStrings`.
 *
 * A cell with `muted: true` clears that string (`strings[i] = null`,
 * matching the "muted" convention documented in `src/audit.ts`). When
 * multiple cells target the same string, the last one (by fret, ascending)
 * wins. `barres` is always returned empty — barre grouping is tracked
 * separately via `FretboardEditorProps.barres`/`onBarresChange`, not
 * derived from cells.
 *
 * Returns `null` if no root cell is set (and no `rootPitchClass` override
 * is provided) — a chord shape without a marked root has no interval frame.
 */
export function cellsToChordShape(
  cells: EditorCell[],
  tuning: string[],
  rootPitchClass?: string,
): {
  strings: (string | null)[];
  fingers: (number | null)[];
  barres: Barre[];
  rootString: number;
} | null {
  const rootCell = cells.find((c) => c.isRoot);
  const rootPc =
    rootPitchClass ??
    (rootCell ? pcAt(tuning, rootCell.string, rootCell.fret) : null);
  if (!rootPc) return null;

  const strings: (string | null)[] = tuning.map(() => null);
  const fingers: (number | null)[] = tuning.map(() => null);

  const sorted = [...cells].sort((a, b) => a.string - b.string || a.fret - b.fret);
  for (const c of sorted) {
    if (c.muted) {
      strings[c.string] = null;
      fingers[c.string] = null;
      continue;
    }
    const pc = pcAt(tuning, c.string, c.fret);
    const ivl = intervalFromTo(rootPc, pc);
    if (!ivl) continue;
    strings[c.string] = ivl;
    fingers[c.string] = c.finger ?? (c.fret === 0 ? 0 : null);
  }

  return { strings, fingers, barres: [], rootString: rootCell?.string ?? 0 };
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
