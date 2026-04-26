/**
 * String index. 0 = lowest pitched string. Tunings array is also low-to-high.
 */
export type StringIndex = number;

export type Fret = number;

export type Orientation = "horizontal" | "vertical";

/**
 * Player handedness. Affects vertical-orientation rendering only:
 * - "right": low E on the left (standard chord-diagram orientation)
 * - "left": low E on the right (mirrored)
 *
 * Horizontal orientation always shows high E at the top per ASCII-tab
 * convention regardless of handedness.
 */
export type Handedness = "right" | "left";

/**
 * What text appears inside a marker dot.
 * - "notes": pitch class (C#, A, etc.)
 * - "numbers": scale degree number (1, 3, 5, ...)
 * - "intervals": interval shorthand (R, M3, P5, b7, ...)
 * - "none": no label
 * - "custom": use marker.label verbatim
 */
export type LabelMode = "notes" | "numbers" | "intervals" | "none" | "custom";

/**
 * Semantic role drives default coloring.
 */
export type MarkerRole = "root" | "tone" | "ghost" | "highlight";

export interface FretMarker {
  string: StringIndex;
  fret: Fret;
  /** Override label text. Used when labelMode is "custom". */
  label?: string;
  /** Override fill color. */
  color?: string;
  /** Optional semantic role for default coloring. */
  role?: MarkerRole;
  /** Optional interval (e.g. "1P", "3M"). Drives "intervals" labelMode and color fallback. */
  interval?: string;
  /** Optional pitch class (e.g. "C", "F#"). Drives "notes" labelMode. */
  pc?: string;
  /** Optional 1-based scale degree. Drives "numbers" labelMode. */
  intervalNumber?: number;
  /** Free-form metadata (passed through; ignored by renderer). */
  meta?: Record<string, unknown>;
}

export interface FretboardTheme {
  background: string;
  string: string;
  fret: string;
  nut: string;
  inlay: string;
  fretNumber: string;
  stringLabel: string;
  defaultMarker: string;
  rootMarker: string;
  ghostMarker: string;
  highlightMarker: string;
  markerLabel: string;
  /** Color by interval shorthand. Falls back to defaultMarker. */
  intervalColors: Record<string, string>;
}

export interface FretboardLayout {
  orientation: Orientation;
  handedness: Handedness;
  cellWidth: number;
  cellHeight: number;
  /** Width of the string-label column (or height in vertical mode). */
  labelGutter: number;
  /** Height of the fret-number row (or width in vertical mode). */
  headerGutter: number;
  showFretNumbers: boolean;
  showStringLabels: boolean;
  showInlays: boolean;
  /** Frets that get inlay dots. */
  inlayFrets: number[];
  /** Frets that get a double inlay (typically 12, 24). */
  doubleInlayFrets: number[];
  markerRadius: number;
}
