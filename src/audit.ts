/**
 * Shape visual/quality audit checks.
 *
 * Dependency tier: required-peer-deps (alongside build.ts). This module
 * imports only ./build, ./shape, and ./tuning — it MUST NOT import
 * ./integration or reference @tonaljs/scale, @tonaljs/chord, or
 * @tonaljs/key. See CLAUDE.md's "Dependency layers" section.
 */

// These imports are unused until the check functions land in Task Groups
// 2-6; they're kept (rather than dropped) to lock the module's import
// surface now, per-line-disabled until consumed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { applyChordShape, buildFrettedScale } from "./build";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ChordShape, ScaleShape } from "./shape";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { STANDARD } from "./tuning";

// ============================================================
// Core types
// ============================================================

export type AuditSeverity = "error" | "warning" | "info";

export interface ShapeAuditIssue {
  id: string; // one of the CHECK_* constants
  severity: AuditSeverity;
  message: string; // human-readable, for tooltips only
  details?: Record<string, unknown>; // structured data (frets, strings, span, etc.)
}

export interface ShapeAuditOptions {
  root?: string; // default: displayRootFor(shape)
  tuning?: string[]; // default: STANDARD
  maxFretSpan?: number; // default: 4
}

// ============================================================
// Check-ID constants
// ============================================================

export const CHECK_FRET_SPAN = "fret-span";
export const CHECK_FINGER_ZERO_ON_MOVABLE = "finger-zero-on-movable";
export const CHECK_REPEATED_FINGER_NO_BARRE = "repeated-finger-no-barre";
export const CHECK_BUILD_LOSS = "build-loss";
export const CHECK_METADATA_COMPLETENESS = "metadata-completeness";
export const CHECK_GEOMETRY_MISMATCH = "geometry-mismatch";

// ============================================================
// Root helper
// ============================================================

export function displayRootFor(shape: { canonicalRoot?: string }): string {
  return shape.canonicalRoot ?? "C";
}

// ============================================================
// Individual checks — implemented in later task groups
// ============================================================

// checkFretSpan — implemented in Task Group 2

// checkFingerZeroOnMovable — implemented in Task Group 3

// checkRepeatedFingerNoBarre — implemented in Task Group 3

// checkBuildLoss — implemented in Task Group 4

// checkMetadataCompleteness — implemented in Task Group 5

// checkGeometryMismatch — implemented in Task Group 5

// ============================================================
// Aggregate functions — implemented in Task Group 6
// ============================================================

// auditChordShape — implemented in Task Group 6

// auditScaleShape — implemented in Task Group 6

// auditAll — implemented in Task Group 6
