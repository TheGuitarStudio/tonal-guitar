// Pure helpers — no React imports, no "use client". Imports only from
// "tonal-guitar" (the published library, consumed here via its `file:..`
// dependency), this module's own types, and pure local `site/lib` constants.
// In particular this file must NOT import "@tonaljs/*" directly: those
// packages are `tonal-guitar`'s peer deps, not a declared dependency of
// `site/`, so a direct import would only happen to resolve locally (via
// node_modules hoisting up to the repo root) and could break in any
// environment that installs `site/` on its own.
import {
  all,
  chordShapes,
  applyChordShape,
  buildFrettedScale,
  displayRootFor,
  STANDARD,
  VERSION,
} from "tonal-guitar";
import type {
  ScaleShape,
  ChordShape,
  FrettedScale,
  FrettedNote,
  ShapeAuditIssue,
  AuditSeverity,
  auditAllShapes,
} from "tonal-guitar";
import { REPO_SLUG } from "@/lib/repo";

export type ShapeKind = "scale" | "chord";

interface ShapeCatalogEntryBase {
  name: string;
  index: number;
  renderRoot: string;
  frettedScale: FrettedScale;
  builtFrets: (number | null)[];
  issues: ShapeAuditIssue[];
}

export type ShapeCatalogEntry =
  | (ShapeCatalogEntryBase & {
      kind: "scale";
      shape: ScaleShape;
    })
  | (ShapeCatalogEntryBase & {
      kind: "chord";
      shape: ChordShape;
      /**
       * Only populated for chord shapes with a `baseFret` AND a resolvable grip
       * root — mirrors `auditAllShapes`'s per-shape `geometry.sourceFrets`
       * (see `src/audit.ts`'s `chordShapeGeometry`): the source diagram's
       * per-string frets, reconstructed independently of the build engine's
       * own anchor logic.
       */
      sourceFrets?: (number | null)[];
      /**
       * The root the source diagram (`sourceFrets`) was authored against. Set
       * alongside `sourceFrets`. May differ from `renderRoot` — e.g. a shape
       * without `canonicalRoot` renders at `displayRootFor`'s "C" fallback while
       * its source grip is authored against the root parsed from its name.
       */
      gripRoot?: string;
    });

export interface ShapeCatalogFilters {
  kind?: ShapeKind;
  system?: string;
  /** Chord-only. Ignored for scale entries (they never match). */
  voicingFamily?: string;
  /** Scale-only. Ignored for chord entries (they never match). */
  quality?: string;
  /** Case-insensitive substring match against `entry.name`. */
  nameQuery?: string;
  /** When true, only entries with `issues.length > 0` are kept. */
  failingOnly?: boolean;
}

// ============================================================
// Chord fingering → FrettedScale adapter
// ============================================================

export function chordFingeringToFrettedScale(
  shape: ChordShape,
  root: string,
  tuning: string[] = STANDARD,
): FrettedScale {
  const { positions } = applyChordShape(shape, root, tuning);
  return {
    empty: positions.length === 0,
    root,
    scaleType: "",
    scaleName: "",
    shapeName: shape.name,
    tuning,
    notes: positions,
  };
}

// Converts a set of FrettedNotes to a per-string frets array the same way
// `applyChordShape` derives its own `frets` array from `result.notes`
// (`frets[note.string] = note.fret`, last write wins). Scale shapes can
// place more than one note on a string; this keeps one representative fret
// per string so every catalog entry — scale or chord — has a `builtFrets`
// value with a stable, documented meaning.
function fretsFromNotes(notes: FrettedNote[], tuning: string[]): (number | null)[] {
  const frets: (number | null)[] = tuning.map(() => null);
  for (const n of notes) {
    frets[n.string] = n.fret;
  }
  return frets;
}

// ============================================================
// Catalog construction
// ============================================================

export function buildCatalog(
  auditResult: ReturnType<typeof auditAllShapes>,
): ShapeCatalogEntry[] {
  const entries: ShapeCatalogEntry[] = [];

  all().forEach((shape, index) => {
    // ScaleShape has no canonicalRoot field, so displayRootFor always
    // resolves scale shapes to its "C" fallback.
    const renderRoot = displayRootFor({});
    const frettedScale = buildFrettedScale(shape, renderRoot, STANDARD);
    const builtFrets = fretsFromNotes(frettedScale.notes, STANDARD);

    entries.push({
      kind: "scale",
      name: shape.name,
      shape,
      index,
      renderRoot,
      frettedScale,
      builtFrets,
      issues: auditResult.scale.get(shape.name) ?? [],
    });
  });

  chordShapes.all().forEach((shape, index) => {
    const renderRoot = displayRootFor(shape);
    const frettedScale = chordFingeringToFrettedScale(shape, renderRoot, STANDARD);
    const builtFrets = applyChordShape(shape, renderRoot, STANDARD).frets;

    // `auditAllShapes` already computes gripRoot/sourceFrets (as
    // `geometry`) for every resolvable `baseFret` shape, not just the ones
    // `CHECK_GEOMETRY_MISMATCH` flags — no need to re-derive it here.
    const chordResult = auditResult.chord.get(shape.name);

    entries.push({
      kind: "chord",
      name: shape.name,
      shape,
      index,
      renderRoot,
      frettedScale,
      builtFrets,
      sourceFrets: chordResult?.geometry?.sourceFrets,
      gripRoot: chordResult?.geometry?.gripRoot,
      issues: chordResult?.issues ?? [],
    });
  });

  return entries;
}

// ============================================================
// Filtering / sorting / facets
// ============================================================

export function filterCatalog(
  entries: ShapeCatalogEntry[],
  filters: ShapeCatalogFilters,
): ShapeCatalogEntry[] {
  return entries.filter((entry) => {
    if (filters.kind !== undefined && entry.kind !== filters.kind) return false;

    if (filters.system !== undefined && entry.shape.system !== filters.system) {
      return false;
    }

    if (filters.voicingFamily !== undefined) {
      if (entry.kind !== "chord") return false;
      if (entry.shape.voicingFamily !== filters.voicingFamily) {
        return false;
      }
    }

    if (filters.quality !== undefined) {
      if (entry.kind !== "scale") return false;
      if (entry.shape.quality !== filters.quality) return false;
    }

    if (filters.nameQuery) {
      if (!entry.name.toLowerCase().includes(filters.nameQuery.toLowerCase())) {
        return false;
      }
    }

    if (filters.failingOnly && entry.issues.length === 0) return false;

    return true;
  });
}

function hasSeverity(issues: ShapeAuditIssue[], severity: AuditSeverity): boolean {
  return issues.some((issue) => issue.severity === severity);
}

function rankOf(entry: ShapeCatalogEntry): number {
  if (hasSeverity(entry.issues, "error")) return 0;
  if (hasSeverity(entry.issues, "warning")) return 1;
  return 2;
}

export function sortFailuresFirst(entries: ShapeCatalogEntry[]): ShapeCatalogEntry[] {
  return [...entries].sort((a, b) => {
    const rankDiff = rankOf(a) - rankOf(b);
    if (rankDiff !== 0) return rankDiff;
    return a.index - b.index;
  });
}

export function distinctSystems(entries: ShapeCatalogEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.shape.system))).sort();
}

/**
 * Generic distinct-value extractor: narrows `entries` to the given `kind`,
 * maps each entry through `extractor`, drops `undefined`, then dedupes and
 * sorts. Shared by `distinctVoicingFamilies` (chord/voicingFamily) and
 * `distinctQualities` (scale/quality).
 */
function distinctValuesForKind<K extends ShapeCatalogEntry["kind"]>(
  entries: ShapeCatalogEntry[],
  kind: K,
  extractor: (entry: Extract<ShapeCatalogEntry, { kind: K }>) => string | undefined,
): string[] {
  const values = entries
    .filter((e): e is Extract<ShapeCatalogEntry, { kind: K }> => e.kind === kind)
    .map(extractor)
    .filter((v): v is NonNullable<typeof v> => v !== undefined);
  return Array.from(new Set(values)).sort();
}

export function distinctVoicingFamilies(entries: ShapeCatalogEntry[]): string[] {
  return distinctValuesForKind(entries, "chord", (e) => e.shape.voicingFamily);
}

export function distinctQualities(entries: ShapeCatalogEntry[]): string[] {
  return distinctValuesForKind(entries, "scale", (e) => e.shape.quality);
}

// ============================================================
// URL state (deep-linkable filters)
// ============================================================

/**
 * Filter state as it round-trips through the URL query string. Every field
 * is optional: absent means "default" (chord kind, no filter). Values are
 * NOT validated against the catalog — an unknown system/family simply
 * filters to zero results, which is honest for a stale shared link.
 */
export interface ShapesUrlState {
  kind?: ShapeKind;
  system?: string;
  familyOrQuality?: string;
  nameQuery?: string;
  failingOnly?: boolean;
}

/** Query params: `kind`, `system`, `family`, `q`, `failing=1`. */
export function parseShapesUrlState(search: string): ShapesUrlState {
  const params = new URLSearchParams(search);
  const state: ShapesUrlState = {};

  const kind = params.get("kind");
  if (kind === "scale" || kind === "chord") state.kind = kind;

  const system = params.get("system");
  if (system) state.system = system;

  const family = params.get("family");
  if (family) state.familyOrQuality = family;

  const q = params.get("q");
  if (q) state.nameQuery = q;

  if (params.get("failing") === "1") state.failingOnly = true;

  return state;
}

/**
 * Inverse of `parseShapesUrlState`. Default values are omitted so the
 * unfiltered landing view keeps a bare `/shapes` URL. Returns either "" or
 * a string starting with "?".
 */
export function serializeShapesUrlState(state: ShapesUrlState): string {
  const params = new URLSearchParams();
  if (state.kind && state.kind !== "chord") params.set("kind", state.kind);
  if (state.system) params.set("system", state.system);
  if (state.familyOrQuality) params.set("family", state.familyOrQuality);
  if (state.nameQuery) params.set("q", state.nameQuery);
  if (state.failingOnly) params.set("failing", "1");

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ============================================================
// Report-problem flow
// ============================================================

// Cheap placeholder for the "Report a problem" link's initial `href` — keeps
// the anchor a real, focusable link (correct role, valid destination) before
// `buildReportUrl` has run. `buildReportUrl` JSON-stringifies the shape and
// all frets, which is wasteful to do for every one of the ~159 cards up
// front when almost none of the links are ever clicked; callers should swap
// in the full `buildReportUrl(entry)` href lazily, on interaction.
export const REPORT_ISSUE_BASE_URL = `https://github.com/${REPO_SLUG}/issues/new?labels=bug`;

function metadataLines(entry: ShapeCatalogEntry): string[] {
  const chordShape = entry.kind === "chord" ? entry.shape : undefined;
  const scaleShape = entry.kind === "scale" ? entry.shape : undefined;

  const pairs: [string, unknown][] = [
    ["system", entry.shape.system],
    ["voicingFamily", chordShape?.voicingFamily],
    ["quality", scaleShape?.quality],
    ["chordType", chordShape?.chordType],
    ["inversion", chordShape?.inversion],
    ["canonicalRoot", chordShape?.canonicalRoot],
    ["baseFret", chordShape?.baseFret],
    ["parentShape", scaleShape?.parentShape],
    ["stringSet", chordShape?.stringSet],
    ["omittedIntervals", chordShape?.omittedIntervals],
  ];

  return pairs
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`);
}

function fencedJson(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

function failingChecksSection(issues: ShapeAuditIssue[]): string {
  if (issues.length === 0) return "None.";
  return issues
    .map(
      (issue) =>
        `- ${issue.id} (${issue.severity}): ${issue.message}\n${fencedJson(issue.details ?? {})}`,
    )
    .join("\n");
}

export function buildReportUrl(entry: ShapeCatalogEntry): string {
  const failingIds = Array.from(new Set(entry.issues.map((issue) => issue.id)));
  const title =
    `[shape-audit] ${entry.kind}: ${entry.name}` +
    (failingIds.length ? ` — ${failingIds.join(", ")}` : "");

  const chordShape = entry.kind === "chord" ? entry.shape : undefined;

  const sections: string[] = [
    `## Shape\n- kind: ${entry.kind}\n- name: ${entry.name}`,
    `## Metadata\n${metadataLines(entry).join("\n") || "- (none)"}`,
    `## Render context\n- renderRoot: ${entry.renderRoot}\n- tuning: ${entry.frettedScale.tuning.join(", ")}`,
    `## Built frets\n${fencedJson(entry.builtFrets)}`,
  ];

  if (entry.kind === "chord" && entry.sourceFrets) {
    sections.push(
      `## Source frets\n- gripRoot: ${entry.gripRoot ?? "n/a"}\n${fencedJson(entry.sourceFrets)}`,
    );
  }

  if (chordShape) {
    sections.push(
      `## Raw shape data\n${fencedJson({
        strings: chordShape.strings,
        fingers: chordShape.fingers,
        barres: chordShape.barres,
      })}`,
    );
  }

  sections.push(`## Failing checks\n${failingChecksSection(entry.issues)}`);
  sections.push(`## Library version\n${VERSION}`);
  sections.push(`## What's wrong\n\n`);

  const body = sections.join("\n\n");

  return (
    REPORT_ISSUE_BASE_URL +
    `&title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}`
  );
}
