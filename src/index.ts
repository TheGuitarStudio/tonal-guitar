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
  VoicingFamily,
  VoicingPatternDictionary,
  CagedPosition,
  ArpeggioShape,
  ArpeggioSlot,
  ArpeggioTier,
  ArpeggioResolution,
} from "./shape";

// Shape registry
export {
  get,
  all,
  names,
  add,
  remove,
  removeAll,
  chordShapes,
  arpeggioShapes,
  NoFrettedScale,
  isMovable,
  playedStringSet,
  impliedStringSet,
  gripBaseFret,
  absoluteBarreFret,
  sourceGripBaseFret,
  exportIdentifierFor,
  arpeggioSlotKey,
  slotForChordShape,
  resolveArpeggioForSlot,
  visibleArpeggios,
} from "./shape";

// Chord-scale rule (v1)
export {
  CHORD_SCALE_RULE,
  CHORD_SCALE_RULE_VERSION,
  scaleTypeForChordType,
} from "./chord-scale";
export type { ChordScaleEntry } from "./chord-scale";

// Changeset schema (tonal-guitar/changeset@1)
export type {
  Changeset,
  ChangesetKind,
  ChangesetChange,
  AddChange,
  UpdateChange,
  RemoveChange,
} from "./changeset";

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
export { buildFrettedScale, applyChordShape, autoFingering } from "./build";
export type { Fingering } from "./build";

// Version
export { VERSION } from "./version";

// Shape audit
export {
  auditChordShape,
  auditScaleShape,
  auditArpeggioShape,
  auditAllShapes,
  displayRootFor,
  checkFretSpan,
  checkFingerZeroOnMovable,
  checkRepeatedFingerNoBarre,
  checkChordBuildLoss,
  checkScaleBuildLoss,
  checkChordMetadataCompleteness,
  checkScaleMetadataCompleteness,
  checkGeometryMismatch,
  chordShapeGeometry,
  checkStringsetMismatch,
  checkTuningMismatch,
  checkBarreFretOrigin,
  checkNameUnique,
  checkPositionSpan,
  checkFingeringComplete,
  checkOverridesTarget,
  CHECK_FRET_SPAN,
  CHECK_FINGER_ZERO_ON_MOVABLE,
  CHECK_REPEATED_FINGER_NO_BARRE,
  CHECK_BUILD_LOSS,
  CHECK_METADATA_COMPLETENESS,
  CHECK_GEOMETRY_MISMATCH,
  CHECK_STRINGSET_MISMATCH,
  CHECK_TUNING_MISMATCH,
  CHECK_BARRE_FRET_ORIGIN,
  CHECK_NAME_UNIQUE,
  CHECK_POSITION_SPAN,
  CHECK_FINGERING_COMPLETE,
  CHECK_OVERRIDES_TARGET,
} from "./audit";
export type {
  AuditSeverity,
  ShapeAuditIssue,
  ShapeAuditOptions,
  ChordGeometryDetails,
  ChordShapeAuditResult,
} from "./audit";

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

// Connector algorithm
export { connectSequences } from "./connect";
export type {
  ChainDirection,
  ConnectSequencesInput,
  ConnectorOptions,
  ConnectorStrategy,
  ConnectSequencesResult,
} from "./connect";

// Notation
export {
  parseChordFrets,
  formatChordFrets,
  parseScalePattern,
} from "./notation";

// Output formatters
export { toAlphaTeX, toAsciiTab } from "./output";
export type { AlphaTexOptions, AsciiTabOptions } from "./output";

// Arpeggio (pure tier — zero Tonal peer deps)
export { filterChordTones, scoreShapeMatch } from "./arpeggio";
export type { InferenceProbe, ScoreBreakdown } from "./arpeggio";

// Shape relabeling (pure tier)
export { relabelShape } from "./transform";
export type { RelabelOptions } from "./transform";

// Tonal integration
export {
  buildFromScale,
  relabelShapeToScale,
  relatedScales,
  identifyChord,
  analyzeInKey,
  isShapeCompatible,
  modeShapes,
  arpeggioFromScale,
  arpeggioFromShape,
  inferShapeContext,
  scalesContainingChord,
  parentBoxForChordShape,
  arpeggioFor,
  DEFAULT_SCALE_CORPUS,
} from "./integration";
export type {
  KeyAnalysis,
  InferenceInput,
  InferenceOptions,
  InferenceCandidate,
  ContainingScale,
  ScalesContainingChordResult,
  ScalesContainingChordOptions,
} from "./integration";

// Optional-tier audit (Tonal chord/note integration)
export {
  auditChordShapeIntegration,
  auditArpeggioShapeIntegration,
  auditAllShapesIntegration,
  auditChordShapeFull,
  checkIdentifyMismatch,
  checkChordTonesOnly,
  checkCoversChord,
  checkContainsChordGrip,
  CHECK_IDENTIFY_MISMATCH,
  CHECK_CHORD_TONES_ONLY,
  CHECK_COVERS_CHORD,
  CHECK_CONTAINS_CHORD_GRIP,
} from "./audit-integration";

// Built-in shape data (import to register shapes)
// shapes-merge:begin data-imports
import "./data/caged-scales";
import "./data/caged-scales-minor";
import "./data/caged-chords";
import "./data/caged-chords-minor";
import "./data/three-nps";
import "./data/pentatonic";
import "./data/pentatonic-minor";
import "./data/caged-chords-7th";
import "./data/open-chords";
import "./data/jazz-shells";
import "./data/extended-chords";
// shapes-merge:end data-imports

// Jazz shell voicing dictionary (public API)
export { SHELL_DICTIONARY } from "./data/jazz-shells";

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
