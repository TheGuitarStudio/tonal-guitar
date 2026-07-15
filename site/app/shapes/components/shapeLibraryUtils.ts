// Pure helpers — no React imports, no "use client". Imports only from
// "tonal-guitar" (the published library, consumed here via its `file:..`
// dependency) and this module's own types. In particular this file must NOT
// import "@tonaljs/*" directly: those packages are `tonal-guitar`'s peer
// deps, not a declared dependency of `site/`, so a direct import would only
// happen to resolve locally (via node_modules hoisting up to the repo root)
// and could break in any environment that installs `site/` on its own.
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

export function distinctVoicingFamilies(entries: ShapeCatalogEntry[]): string[] {
  const values = entries
    .filter((e): e is Extract<ShapeCatalogEntry, { kind: "chord" }> => e.kind === "chord")
    .map((e) => e.shape.voicingFamily)
    .filter((v): v is NonNullable<typeof v> => v !== undefined);
  return Array.from(new Set(values)).sort();
}

export function distinctQualities(entries: ShapeCatalogEntry[]): string[] {
  const values = entries
    .filter((e): e is Extract<ShapeCatalogEntry, { kind: "scale" }> => e.kind === "scale")
    .map((e) => e.shape.quality)
    .filter((v): v is NonNullable<typeof v> => v !== undefined);
  return Array.from(new Set(values)).sort();
}

// ============================================================
// Report-problem flow
// ============================================================

const REPO = "TheGuitarStudio/tonal-guitar";

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
    `https://github.com/${REPO}/issues/new?labels=bug` +
    `&title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}`
  );
}
