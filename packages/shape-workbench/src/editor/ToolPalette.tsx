/**
 * Left-hand editor controls (spec §5.4 Editor requirements): the tool
 * palette (Select · Note · Root · Finger 1-4 · Barre · Mute), Author-at-root
 * selector, Labels toggle (intervals/notes/fingers), fret window (0–12),
 * Open-strings toggle (present but disabled in MVP), diagram orientation
 * toggle, and legend.
 *
 * The diagram orientation toggle reuses `shape-library-ui`'s
 * `DiagramOrientationToggle` rather than a second implementation; the
 * legend reuses `fretboard-ui`'s own `defaultTheme.intervalColors` so its
 * swatches can never drift from what the diagram actually renders.
 */
import { defaultTheme, type Orientation } from "fretboard-ui";
import { DiagramOrientationToggle } from "shape-library-ui";
import type { ActiveFinger, EditorTool } from "./toolInteractions";

const TOOLS: { value: EditorTool; label: string }[] = [
  { value: "select", label: "Select" },
  { value: "note", label: "Note" },
  { value: "root", label: "Root" },
  { value: "finger", label: "Finger" },
  { value: "barre", label: "Barre" },
  { value: "mute", label: "Mute" },
];

const FINGERS: ActiveFinger[] = [1, 2, 3, 4];

export type LabelDisplayMode = "intervals" | "notes" | "fingers";

const LABEL_MODES: { value: LabelDisplayMode; label: string }[] = [
  { value: "intervals", label: "Intervals" },
  { value: "notes", label: "Notes" },
  { value: "fingers", label: "Fingers" },
];

const LEGEND_ENTRIES: { interval: string; label: string }[] = [
  { interval: "1P", label: "Root" },
  { interval: "3M", label: "3rd" },
  { interval: "5P", label: "5th" },
  { interval: "7M", label: "7th" },
];

const ROOT_PITCH_CLASSES = ["C", "D", "E", "F", "G", "A", "B"];

export interface ToolPaletteProps {
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  activeFinger: ActiveFinger;
  onActiveFingerChange: (finger: ActiveFinger) => void;
  authorRoot: string;
  onAuthorRootChange: (root: string) => void;
  labelMode: LabelDisplayMode;
  onLabelModeChange: (mode: LabelDisplayMode) => void;
  fretRange: [number, number];
  onFretRangeChange: (range: [number, number]) => void;
  orientation: Orientation;
  onOrientationChange: (orientation: Orientation) => void;
}

export function ToolPalette({
  tool,
  onToolChange,
  activeFinger,
  onActiveFingerChange,
  authorRoot,
  onAuthorRootChange,
  labelMode,
  onLabelModeChange,
  fretRange,
  onFretRangeChange,
  orientation,
  onOrientationChange,
}: ToolPaletteProps) {
  return (
    <div className="tg-section" data-testid="tool-palette">
      <div className="tg-toggle-group" role="group" aria-label="Editing tool">
        {TOOLS.map((t) => (
          <button key={t.value} type="button" aria-pressed={tool === t.value} onClick={() => onToolChange(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tool === "finger" && (
        <div className="tg-toggle-group" role="group" aria-label="Active finger">
          {FINGERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={activeFinger === f}
              onClick={() => onActiveFingerChange(f)}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <label className="tg-facet-row">
        <span className="tg-facet-label">Author at root</span>
        <select
          className="tg-select"
          aria-label="Author at root"
          value={authorRoot}
          onChange={(e) => onAuthorRootChange(e.target.value)}
        >
          {ROOT_PITCH_CLASSES.map((pc) => (
            <option key={pc} value={pc}>
              {pc}
            </option>
          ))}
        </select>
      </label>

      <div className="tg-toggle-group" role="group" aria-label="Labels">
        {LABEL_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={labelMode === m.value}
            onClick={() => onLabelModeChange(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label className="tg-facet-row">
        <span className="tg-facet-label">Frets</span>
        <input
          className="tg-input"
          type="number"
          aria-label="Fret window start"
          min={0}
          max={12}
          value={fretRange[0]}
          onChange={(e) => onFretRangeChange([Number(e.target.value), fretRange[1]])}
        />
        <span>–</span>
        <input
          className="tg-input"
          type="number"
          aria-label="Fret window end"
          min={0}
          max={12}
          value={fretRange[1]}
          onChange={(e) => onFretRangeChange([fretRange[0], Number(e.target.value)])}
        />
      </label>

      <label className="tg-checkbox-label">
        <input type="checkbox" checked={false} disabled aria-label="Open strings (disabled in MVP)" />
        Open strings (disabled in MVP)
      </label>

      <DiagramOrientationToggle value={orientation} onChange={onOrientationChange} />

      <ul className="tg-chip-list" aria-label="Interval legend" data-testid="legend">
        {LEGEND_ENTRIES.map((entry) => (
          <li key={entry.interval} className="tg-chip">
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: defaultTheme.intervalColors[entry.interval] ?? defaultTheme.defaultMarker,
                marginRight: 4,
              }}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
