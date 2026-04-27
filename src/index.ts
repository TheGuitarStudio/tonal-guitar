// Tuning constants
export {
  STANDARD,
  DROP_D,
  DADGAD,
  OPEN_G,
  STANDARD_7,
  STANDARD_8,
} from "./tuning";

// Types
export type {
  FrettedNote,
  ScaleShape,
  ChordShape,
  Barre,
  FrettedScale,
} from "./shape";

// Shape registry
export {
  get,
  all,
  names,
  add,
  removeAll,
  chordShapes,
  NoFrettedScale,
} from "./shape";

// Fretboard math
export {
  noteAt,
  fretFor,
  findNearestFret,
  findFretInPosition,
  findNote,
  fretboard,
} from "./fretboard";
export type { FretboardPosition } from "./fretboard";

// Build engine
export { buildFrettedScale, applyChordShape } from "./build";
export type { Fingering } from "./build";

// Pattern generators
export {
  ascendingIntervals,
  descendingIntervals,
  ascendingLinear,
  descendingLinear,
  grouping,
  thirds,
  fourths,
  sixths,
} from "./pattern";

// Pattern walker + shape walker
export {
  walkPattern,
  walkShape,
  walkShapeIntervals,
  walkShapeMotif,
} from "./walker";
export type { WalkOptions, WalkShapeOptions } from "./walker";

// Sequence engine
export { applySequence, flattenSequence } from "./sequence";
export type { SequenceOptions } from "./sequence";

// Notation
export {
  parseChordFrets,
  formatChordFrets,
  parseScalePattern,
} from "./notation";

// Output formatters
export { toAlphaTeX, toAsciiTab } from "./output";
export type { AlphaTexOptions, AsciiTabOptions } from "./output";

// Tonal integration
export {
  buildFromScale,
  relatedScales,
  identifyChord,
  analyzeInKey,
  isShapeCompatible,
  modeShapes,
} from "./integration";
export type { KeyAnalysis } from "./integration";

// Built-in shape data (import to register shapes)
import "./data/caged-scales";
import "./data/caged-chords";
import "./data/three-nps";
import "./data/pentatonic";

// Built-in sequences
export {
  ASCENDING_THIRDS,
  DESCENDING_THIRDS,
  SEQ_1235,
  SEQ_1234_GROUP,
  SEQ_UP_DOWN,
  SEQ_TRIAD_CLIMB,
  SEQ_1357_DESC,
} from "./data/sequences";
