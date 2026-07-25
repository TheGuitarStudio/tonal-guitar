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
  VoicingFamily,
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

/** Narrowed catalog entry types — convenience aliases over the `kind`
 * discriminant, reused by every chord- or scale-only helper below. */
export type ChordCatalogEntry = Extract<ShapeCatalogEntry, { kind: "chord" }>;
export type ScaleCatalogEntry = Extract<ShapeCatalogEntry, { kind: "scale" }>;

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
// Chord quality-group -> type-chip tokenization (spec 8.1)
// ============================================================

/**
 * The four fixed quality-group chip labels (Requirements: "Quality-group
 * chips (single-select) -> type chips (multi-select)"). The GROUP LABELS are
 * fixed; which `chordType` tokens land in which group is always derived from
 * the catalog via `classifyChordQualityGroup` — never a hardcoded per-type
 * lookup — so a new `chordType` value added to `src/data/*` classifies
 * automatically.
 */
export type ChordQualityGroup = "Triads" | "Sevenths" | "Extended" | "Sus/Add";

export const CHORD_QUALITY_GROUP_ORDER: readonly ChordQualityGroup[] = [
  "Triads",
  "Sevenths",
  "Extended",
  "Sus/Add",
];

/** Bare triad `chordType` tokens used in the registry (see `src/data/*`). */
const BARE_TRIAD_CHORD_TYPES = new Set(["M", "m", "dim", "aug"]);

/**
 * Classifies a `chordType` string (the `@tonaljs/chord` symbol suffix stored
 * on `ChordShape.chordType`, e.g. `"m7b5"`, `"maj9"`, `"7sus4"`) into one of
 * the four quality groups:
 *  - Sus/Add: token mentions "sus" or "add" (sus2, sus4, 7sus4, add9)
 *  - Triads: the four bare triad tokens (M, m, dim, aug)
 *  - Sevenths: highest numeric extension present is 7 (7, m7, maj7, m7b5,
 *    dim7, mMaj7, aug7, 7#5, 7b5 — alterations of the 5th don't raise the
 *    extension past 7)
 *  - Extended: everything else — highest numeric extension is 6, 9, 11, or
 *    13 (6, 6/9, 9, maj9, m9, 13, 7b9, 7#9 — a flat/sharp 9 on a dominant
 *    7 chord is still functionally a 9th-family alteration)
 * Matches the four groups named in the spec's Triads/Sevenths examples
 * exactly (maj7/7/m7/m7b5/dim7/mMaj7 -> Sevenths; maj/min/dim/aug -> Triads).
 */
export function classifyChordQualityGroup(chordType: string): ChordQualityGroup {
  const lower = chordType.toLowerCase();
  if (lower.includes("sus") || lower.includes("add")) return "Sus/Add";
  if (BARE_TRIAD_CHORD_TYPES.has(chordType)) return "Triads";

  const extensionNumbers = chordType.match(/\d+/g)?.map(Number) ?? [];
  const maxExtension = extensionNumbers.length > 0 ? Math.max(...extensionNumbers) : 0;
  if (maxExtension === 7) return "Sevenths";
  if (maxExtension > 0) return "Extended";

  // No digits and not a known bare triad token — treat as a bare triad
  // quality by default rather than silently dropping it from every group.
  return "Triads";
}

/** Dual labels for symbols with a common alternate name (spec: `"m7b5 (ø7)"`). */
const AMBIGUOUS_CHORD_TYPE_LABELS: Readonly<Record<string, string>> = {
  m7b5: "m7b5 (ø7)",
};

/** Display label for a `chordType` type chip — dual-labels ambiguous symbols. */
export function chordTypeLabel(chordType: string): string {
  return AMBIGUOUS_CHORD_TYPE_LABELS[chordType] ?? chordType;
}

export function distinctChordTypes(entries: ShapeCatalogEntry[]): string[] {
  return distinctValuesForKind(entries, "chord", (e) => e.shape.chordType);
}

export interface ChordQualityGroupFacet {
  group: ChordQualityGroup;
  /** Distinct `chordType` tokens in this group present in the given catalog, sorted. */
  types: string[];
}

/**
 * Groups every distinct `chordType` in `entries` under its quality group,
 * in `CHORD_QUALITY_GROUP_ORDER`. Groups with no matching types in the
 * catalog are omitted (nothing to render a chip row for). This is the
 * source for both the quality-group chip row and, once a group is
 * selected, its nested type-chip row.
 */
export function chordQualityGroupFacets(
  entries: ShapeCatalogEntry[],
): ChordQualityGroupFacet[] {
  const byGroup = new Map<ChordQualityGroup, string[]>();
  for (const type of distinctChordTypes(entries)) {
    const group = classifyChordQualityGroup(type);
    const types = byGroup.get(group);
    if (types) types.push(type);
    else byGroup.set(group, [type]);
  }
  return CHORD_QUALITY_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    types: [...byGroup.get(group)!].sort(),
  }));
}

// ============================================================
// Alias-aware search matching (spec 8.3)
// ============================================================

/** Case-insensitive alias -> canonical `chordType` token substitutions. */
const SEARCH_ALIASES: Readonly<Record<string, string>> = {
  "ø": "m7b5",
  "half-dim": "m7b5",
  halfdim: "m7b5",
  δ: "maj7",
  dom: "7",
};

/** Resolves a raw search query through `SEARCH_ALIASES` (whole-query match only). */
export function resolveSearchAlias(query: string): string {
  const key = query.trim().toLowerCase();
  return SEARCH_ALIASES[key] ?? query;
}

/** The chord's display symbol: `root` + `chordType` (e.g. "Cm7b5"). Base CAGED
 * majors with no `chordType` display as just the root. */
export function chordDisplaySymbol(entry: ChordCatalogEntry): string {
  return `${entry.renderRoot}${entry.shape.chordType ?? ""}`;
}

/**
 * Alias-aware substring match against a chord's display symbol and its
 * `entry.name`, or a scale's `entry.name` alone. An empty/whitespace query
 * matches everything (the "no search narrowing" state).
 */
export function matchesAliasAwareSearch(entry: ShapeCatalogEntry, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const needle = resolveSearchAlias(trimmed).toLowerCase();
  if (entry.name.toLowerCase().includes(needle)) return true;

  return entry.kind === "chord" && chordDisplaySymbol(entry).toLowerCase().includes(needle);
}

// ============================================================
// Root-strip filter semantics (spec 8.4)
// ============================================================

/** The 12 chromatic root-strip buttons — sharps on buttons per spec (flats
 * are honored in diagrams via Tonal's own spelling, not here). */
export const CHROMATIC_ROOTS: readonly string[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** Sentinel meaning "no root filter selected" in root-strip state. */
export const ANY_ROOT = "Any";

/**
 * Discriminated result of applying a chosen root to one chord entry:
 *  - `"filter"` — the entry has a `canonicalRoot` (open/fixed shape), so the
 *    root strip is a true filter; `matches` says whether it survives.
 *  - `"preview"` — the entry is movable (no `canonicalRoot`); selecting a
 *    root re-renders it transposed as a preview and never excludes it.
 * Callers use `behavior` to pick the right chip `title`/`aria-label` copy.
 */
export type ChordRootSelectionResult =
  | { behavior: "filter"; matches: boolean }
  | { behavior: "preview" };

export function chordRootSelectionResult(
  entry: ChordCatalogEntry,
  root: string | undefined,
): ChordRootSelectionResult {
  if (entry.shape.canonicalRoot === undefined) {
    return { behavior: "preview" };
  }
  const selected = root && root !== ANY_ROOT ? root : undefined;
  return {
    behavior: "filter",
    matches: selected === undefined || entry.shape.canonicalRoot === selected,
  };
}

/** Boolean collapse of `chordRootSelectionResult` for use as a filter predicate:
 * preview-behavior entries never get excluded by a root selection. */
export function chordMatchesRootFacet(entry: ChordCatalogEntry, root: string | undefined): boolean {
  const result = chordRootSelectionResult(entry, root);
  return result.behavior === "preview" ? true : result.matches;
}

// ============================================================
// Sort comparators (spec 8.5)
// ============================================================

/** Default chord sort: `baseFret` ascending. Entries with no `baseFret` (the
 * 5 base CAGED majors) sort as fret 0 — first, ahead of every fretted form. */
export function compareByBaseFret(a: ChordCatalogEntry, b: ChordCatalogEntry): number {
  const fretA = a.shape.baseFret ?? 0;
  const fretB = b.shape.baseFret ?? 0;
  if (fretA !== fretB) return fretA - fretB;
  return a.name.localeCompare(b.name);
}

/** Alternative chord sort: by `chordType` (undefined sorts first), then name. */
export function compareByChordTypeThenName(a: ChordCatalogEntry, b: ChordCatalogEntry): number {
  const typeA = a.shape.chordType ?? "";
  const typeB = b.shape.chordType ?? "";
  if (typeA !== typeB) return typeA.localeCompare(typeB);
  return a.name.localeCompare(b.name);
}

/** Name-order sort — used as the scale grid's only sort and as the "name"
 * alternative sort's tiebreaker for chords. */
export function compareByName(a: ShapeCatalogEntry, b: ShapeCatalogEntry): number {
  return a.name.localeCompare(b.name);
}

export function sortChordEntries(
  entries: ChordCatalogEntry[],
  sort: "baseFret" | "name" = "baseFret",
): ChordCatalogEntry[] {
  const comparator = sort === "name" ? compareByChordTypeThenName : compareByBaseFret;
  return [...entries].sort(comparator);
}

/** Scale grid sorts by name only (no base-fret concept for scale shapes). */
export function sortScaleEntries(entries: ScaleCatalogEntry[]): ScaleCatalogEntry[] {
  return [...entries].sort(compareByName);
}

// ============================================================
// "Count ignoring this facet" helper (spec 8.2)
// ============================================================

export interface FacetCount {
  value: string;
  count: number;
  /** Convenience flag for the "grey out, don't hide" zero-count chip treatment. */
  isZero: boolean;
}

/**
 * The experiment 04 pattern: for each candidate `value`, count catalog
 * entries that (a) would display that value along this facet dimension
 * (`valueMatches`) and (b) satisfy every OTHER currently-active facet
 * (`matchesOtherFacets`) — i.e. the count as if THIS facet weren't applied.
 * Generic over the entry type and the meaning of "value" so it backs every
 * concrete counter below (voicing family, root, system, quality) without
 * duplicating the "ignore one dimension" loop each time.
 */
export function countEntriesIgnoringFacet<T extends ShapeCatalogEntry>(
  entries: T[],
  values: readonly string[],
  valueMatches: (entry: T, value: string) => boolean,
  matchesOtherFacets: (entry: T) => boolean,
): FacetCount[] {
  return values.map((value) => {
    const count = entries.filter(
      (entry) => valueMatches(entry, value) && matchesOtherFacets(entry),
    ).length;
    return { value, count, isZero: count === 0 };
  });
}

/**
 * Active chord-facet selection, mirroring the relevant subset of
 * `ShapesUrlState`. Every field's "unset" value (`undefined`, empty array,
 * or `ANY_ROOT`) means "no narrowing along this dimension" — matches the
 * URL-state convention of omitting defaults.
 */
export interface ChordFacetSelection {
  qualityGroup?: ChordQualityGroup;
  /** Active `chordType` tokens within `qualityGroup`. Empty/undefined = all-on. */
  activeTypes?: readonly string[];
  /** Active `voicingFamily` values. Empty/undefined = all-on. */
  activeVoicingFamilies?: readonly string[];
  root?: string;
  nameQuery?: string;
}

type ChordFacetDimension = "type" | "voicingFamily" | "root";

function chordEntryMatchesSelection(
  entry: ChordCatalogEntry,
  selection: ChordFacetSelection,
  ignoring?: ChordFacetDimension,
): boolean {
  if (ignoring !== "type") {
    if (selection.qualityGroup !== undefined) {
      if (
        entry.shape.chordType === undefined ||
        classifyChordQualityGroup(entry.shape.chordType) !== selection.qualityGroup
      ) {
        return false;
      }
    }
    if (selection.activeTypes && selection.activeTypes.length > 0) {
      if (!entry.shape.chordType || !selection.activeTypes.includes(entry.shape.chordType)) {
        return false;
      }
    }
  }

  if (ignoring !== "voicingFamily") {
    if (selection.activeVoicingFamilies && selection.activeVoicingFamilies.length > 0) {
      if (
        !entry.shape.voicingFamily ||
        !selection.activeVoicingFamilies.includes(entry.shape.voicingFamily)
      ) {
        return false;
      }
    }
  }

  if (ignoring !== "root") {
    if (!chordMatchesRootFacet(entry, selection.root)) return false;
  }

  if (selection.nameQuery && !matchesAliasAwareSearch(entry, selection.nameQuery)) {
    return false;
  }

  return true;
}

/** Live per-chip counts for the voicing-family multi-select row, counted
 * ignoring the voicing-family facet itself (spec 8.2 / experiment 04). */
export function voicingFamilyCounts(
  entries: ShapeCatalogEntry[],
  selection: ChordFacetSelection,
): FacetCount[] {
  const chordEntries = entries.filter((e): e is ChordCatalogEntry => e.kind === "chord");
  return countEntriesIgnoringFacet<ChordCatalogEntry>(
    chordEntries,
    distinctVoicingFamilies(entries),
    (entry, value) => entry.shape.voicingFamily === (value as VoicingFamily),
    (entry) => chordEntryMatchesSelection(entry, selection, "voicingFamily"),
  );
}

/** Live per-chip counts for the 12 root-strip buttons, counted ignoring the
 * root facet itself. Movable (preview-behavior) entries count toward every
 * root, matching the fact that selecting a root never excludes them. */
export function chordRootCounts(
  entries: ShapeCatalogEntry[],
  selection: ChordFacetSelection,
): FacetCount[] {
  const chordEntries = entries.filter((e): e is ChordCatalogEntry => e.kind === "chord");
  return countEntriesIgnoringFacet<ChordCatalogEntry>(
    chordEntries,
    CHROMATIC_ROOTS,
    (entry, value) => chordMatchesRootFacet(entry, value),
    (entry) => chordEntryMatchesSelection(entry, selection, "root"),
  );
}

/** Active scale-facet selection (system + quality chip rows). */
export interface ScaleFacetSelection {
  /** Active `system` values. Empty/undefined = all-on. */
  activeSystems?: readonly string[];
  /** Active `quality` values. Empty/undefined = all-on. */
  activeQualities?: readonly string[];
  nameQuery?: string;
}

type ScaleFacetDimension = "system" | "quality";

function scaleEntryMatchesSelection(
  entry: ScaleCatalogEntry,
  selection: ScaleFacetSelection,
  ignoring?: ScaleFacetDimension,
): boolean {
  if (ignoring !== "system") {
    if (selection.activeSystems && selection.activeSystems.length > 0) {
      if (!selection.activeSystems.includes(entry.shape.system)) return false;
    }
  }
  if (ignoring !== "quality") {
    if (selection.activeQualities && selection.activeQualities.length > 0) {
      if (!entry.shape.quality || !selection.activeQualities.includes(entry.shape.quality)) {
        return false;
      }
    }
  }
  if (selection.nameQuery && !matchesAliasAwareSearch(entry, selection.nameQuery)) {
    return false;
  }
  return true;
}

export function scaleSystemCounts(
  entries: ShapeCatalogEntry[],
  selection: ScaleFacetSelection,
): FacetCount[] {
  const scaleEntries = entries.filter((e): e is ScaleCatalogEntry => e.kind === "scale");
  return countEntriesIgnoringFacet<ScaleCatalogEntry>(
    scaleEntries,
    distinctSystems(entries),
    (entry, value) => entry.shape.system === value,
    (entry) => scaleEntryMatchesSelection(entry, selection, "system"),
  );
}

export function scaleQualityCounts(
  entries: ShapeCatalogEntry[],
  selection: ScaleFacetSelection,
): FacetCount[] {
  const scaleEntries = entries.filter((e): e is ScaleCatalogEntry => e.kind === "scale");
  return countEntriesIgnoringFacet<ScaleCatalogEntry>(
    scaleEntries,
    distinctQualities(entries),
    (entry, value) => entry.shape.quality === value,
    (entry) => scaleEntryMatchesSelection(entry, selection, "quality"),
  );
}

// ============================================================
// Spotlight / grouping helpers (spec 8.6)
// ============================================================

/** Groups longer than this collapse behind a "Show all N" toggle. */
export const GROUP_COLLAPSE_THRESHOLD = 5;

/** Key for the trailing bucket of entries with no grouping key (e.g. the 5
 * base CAGED majors, which have no `chordType`). */
export const OTHER_GROUP_KEY = "__other__";

export interface ShapeGroup<T extends ShapeCatalogEntry> {
  /** Grouping key — the raw `chordType`/`system`/`quality` value, or `OTHER_GROUP_KEY`. */
  key: string;
  /** Display heading. */
  label: string;
  /** Full group contents: `featured` entries first, then the active sort. */
  entries: T[];
  /** `entries`, sliced to `GROUP_COLLAPSE_THRESHOLD` unless `isExpanded`. */
  visibleEntries: T[];
  totalCount: number;
  isExpanded: boolean;
  /** True when `visibleEntries` is a strict prefix of `entries` (collapsed). */
  hasMore: boolean;
}

function buildGroup<T extends ShapeCatalogEntry>(
  key: string,
  label: string,
  bucket: T[],
  sort: (a: T, b: T) => number,
  isExpanded: boolean,
): ShapeGroup<T> {
  // Spotlight tier first (spec: "within a group, featured shapes render
  // first"), each tier internally ordered by the group's active sort.
  const featured = bucket.filter((e) => e.shape.featured).sort(sort);
  const rest = bucket.filter((e) => !e.shape.featured).sort(sort);
  const entries = [...featured, ...rest];
  const totalCount = entries.length;
  const visibleEntries =
    isExpanded || totalCount <= GROUP_COLLAPSE_THRESHOLD
      ? entries
      : entries.slice(0, GROUP_COLLAPSE_THRESHOLD);
  return {
    key,
    label,
    entries,
    visibleEntries,
    totalCount,
    isExpanded,
    hasMore: visibleEntries.length < totalCount,
  };
}

/** Falls back to a single common value shared by every entry in `bucket` (used
 * for the "Other" group's label); `undefined` when the bucket is mixed. */
function commonValue<T>(bucket: T[], extractor: (item: T) => string | undefined): string | undefined {
  const values = new Set(bucket.map(extractor).filter((v): v is string => v !== undefined));
  return values.size === 1 ? [...values][0] : undefined;
}

function otherChordGroupLabel(bucket: ChordCatalogEntry[]): string {
  const family = commonValue(bucket, (e) => e.shape.voicingFamily);
  if (family) return `Other (${family})`;
  const system = commonValue(bucket, (e) => e.shape.system);
  if (system) return `Other (${system})`;
  return "Other";
}

function otherScaleGroupLabel(bucket: ScaleCatalogEntry[]): string {
  const system = commonValue(bucket, (e) => e.shape.system);
  return system ? `Other (${system})` : "Other";
}

/**
 * Groups chord entries by `chordType` (spec 8.6). Entries with no
 * `chordType` — the 5 base CAGED majors in `src/data/caged-chords.ts` — are
 * NOT dropped: they bucket into a trailing "Other" group, labeled from their
 * shared `voicingFamily`/`system` where available.
 */
export function groupChordEntriesByType(
  entries: ChordCatalogEntry[],
  options: { sort?: "baseFret" | "name"; expandedGroups?: ReadonlySet<string> } = {},
): ShapeGroup<ChordCatalogEntry>[] {
  const comparator = options.sort === "name" ? compareByChordTypeThenName : compareByBaseFret;
  const expanded = options.expandedGroups ?? new Set<string>();

  const buckets = new Map<string, ChordCatalogEntry[]>();
  const other: ChordCatalogEntry[] = [];
  for (const entry of entries) {
    const type = entry.shape.chordType;
    if (type === undefined) {
      other.push(entry);
      continue;
    }
    const bucket = buckets.get(type);
    if (bucket) bucket.push(entry);
    else buckets.set(type, [entry]);
  }

  const groups = [...buckets.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((type) =>
      buildGroup(type, chordTypeLabel(type), buckets.get(type)!, comparator, expanded.has(type)),
    );

  if (other.length > 0) {
    groups.push(
      buildGroup(
        OTHER_GROUP_KEY,
        otherChordGroupLabel(other),
        other,
        comparator,
        expanded.has(OTHER_GROUP_KEY),
      ),
    );
  }

  return groups;
}

/** Groups scale entries by `system` (spec 8.6). Every `ScaleShape.system` is
 * required, so there is no "Other" bucket for this grouping. */
export function groupScaleEntriesBySystem(
  entries: ScaleCatalogEntry[],
  options: { expandedGroups?: ReadonlySet<string> } = {},
): ShapeGroup<ScaleCatalogEntry>[] {
  const expanded = options.expandedGroups ?? new Set<string>();
  const buckets = new Map<string, ScaleCatalogEntry[]>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.shape.system);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.shape.system, [entry]);
  }
  return [...buckets.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((system) =>
      buildGroup(system, system, buckets.get(system)!, compareByName, expanded.has(system)),
    );
}

/**
 * Groups scale entries by `quality` (spec 8.6's "(or quality)" alternative).
 * `quality` is optional, so entries without one bucket into a trailing
 * "Other" group labeled from their shared `system`.
 */
export function groupScaleEntriesByQuality(
  entries: ScaleCatalogEntry[],
  options: { expandedGroups?: ReadonlySet<string> } = {},
): ShapeGroup<ScaleCatalogEntry>[] {
  const expanded = options.expandedGroups ?? new Set<string>();
  const buckets = new Map<string, ScaleCatalogEntry[]>();
  const other: ScaleCatalogEntry[] = [];
  for (const entry of entries) {
    const quality = entry.shape.quality;
    if (quality === undefined) {
      other.push(entry);
      continue;
    }
    const bucket = buckets.get(quality);
    if (bucket) bucket.push(entry);
    else buckets.set(quality, [entry]);
  }

  const groups = [...buckets.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((quality) =>
      buildGroup(quality, quality, buckets.get(quality)!, compareByName, expanded.has(quality)),
    );

  if (other.length > 0) {
    groups.push(
      buildGroup(
        OTHER_GROUP_KEY,
        otherScaleGroupLabel(other),
        other,
        compareByName,
        expanded.has(OTHER_GROUP_KEY),
      ),
    );
  }

  return groups;
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
  /** Selected entry `name` — opens the detail panel on load. Absent: no panel. */
  shape?: string;
  /** Selected chord-facet quality group (e.g. "Triads", "Sevenths"). */
  qualityGroup?: string;
  /** Active `chordType` tokens within the selected quality group. Absent: all-on (no narrowing). */
  activeTypes?: string[];
  /** Active `voicingFamily` values. Absent: all-on (no narrowing). */
  activeVoicingFamilies?: string[];
  /** Selected chromatic root filter. Absent: "Any". */
  root?: string;
  /** Grid sort order. Absent: default (base-fret ascending). */
  sort?: "baseFret" | "name";
  /** Group headings expanded past the "Show all N" collapse threshold. */
  expandedGroups?: string[];
}

/** Comma-joins a multi-value field for the query string, or returns undefined if empty. */
function joinMulti(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

/** Splits a comma-joined multi-value query param, dropping empty entries. */
function splitMulti(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const values = value.split(",").filter((v) => v.length > 0);
  return values.length > 0 ? values : undefined;
}

/**
 * Query params: `kind`, `system`, `family`, `q`, `failing=1`, `shape`,
 * `qualityGroup`, `types` (comma-joined), `families` (comma-joined), `root`,
 * `sort`, `expanded` (comma-joined).
 */
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

  const shape = params.get("shape");
  if (shape) state.shape = shape;

  const qualityGroup = params.get("qualityGroup");
  if (qualityGroup) state.qualityGroup = qualityGroup;

  const activeTypes = splitMulti(params.get("types"));
  if (activeTypes) state.activeTypes = activeTypes;

  const activeVoicingFamilies = splitMulti(params.get("families"));
  if (activeVoicingFamilies) state.activeVoicingFamilies = activeVoicingFamilies;

  const root = params.get("root");
  if (root) state.root = root;

  const sort = params.get("sort");
  if (sort === "baseFret" || sort === "name") state.sort = sort;

  const expandedGroups = splitMulti(params.get("expanded"));
  if (expandedGroups) state.expandedGroups = expandedGroups;

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
  if (state.shape) params.set("shape", state.shape);
  if (state.qualityGroup) params.set("qualityGroup", state.qualityGroup);

  const types = joinMulti(state.activeTypes);
  if (types) params.set("types", types);

  const families = joinMulti(state.activeVoicingFamilies);
  if (families) params.set("families", families);

  if (state.root) params.set("root", state.root);
  if (state.sort && state.sort !== "baseFret") params.set("sort", state.sort);

  const expanded = joinMulti(state.expandedGroups);
  if (expanded) params.set("expanded", expanded);

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
