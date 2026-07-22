# Specification: Shape Library Detail Side Panel

## Goal
Turn the `/shapes` audit grid into a browsable, chord-entity-first catalog where clicking any card opens a non-modal slide-over panel with Tonal-powered context (identified chord, scales containing it, alternate fingerings, inversions — or related scales / modal context for scale shapes), while preserving the failures-first audit surface as primary. Add one new tested library function, `scalesContainingChord`, in `src/integration.ts` so the panel's musical claims come from trusted, documented library math. All displayed data is sourced from `tonal-guitar` / Tonal.js — no site-side curated musical data.

## User Stories
- As a **library maintainer auditing shapes**, I want failing shapes pinned in a top "Needs attention" section with badges regardless of grouping, and a report-problem flow reachable from each shape, so the audit workflow (failures-first, D-004) survives the reorganization.
- As a **guitarist browsing chords**, I want to filter by quality/type/voicing-family/root and click a chord to see what it is, what scales I can play over it, and every other way to finger it, so I can learn and use the shape.
- As a **guitarist studying scales**, I want scale shapes to be first-class on the same page with system/quality facets and a panel showing related modes, compatible shapes, and parent-shape lineage.
- As a **professional reviewer verifying correctness**, I want the identified chord, scale-containment, and inversion data to be derived from the library (not hardcoded) and deep-linkable via URL, so I can review a specific shape and trust the surrounding claims.
- As a **developer evaluating tonal-guitar**, I want the page to visibly exercise real library functions (`identifyChord`, `scalesContainingChord`, `relatedScales`, `modeShapes`, `chordShapes.query`) so I can judge the API by watching it work.

## Specific Requirements

### Library (`src/`)

**New public function `scalesContainingChord` (`src/integration.ts`)** — resolves Codex review item (1) in full.

Signature:
```ts
export const DEFAULT_SCALE_CORPUS: readonly string[]; // fixed corpus, see below

export interface ContainingScale {
  root: string;        // scale tonic pitch class (Tonal spelling)
  scaleType: string;   // e.g. "major", "dorian", "harmonic minor"
  name: string;        // full "C major"
  extraTones: number;  // scale PCs not in the chord (fit tightness; lower = tighter)
  omittedTones: string[]; // chord tones absent from this scale (empty unless tolerateMissing>0)
}
export interface ScalesContainingChordResult {
  chord: string; // resolved chord name actually swept
  root: string;  // chord root pitch class
  rootAnchored: ContainingScale[];
  otherRoots: ContainingScale[];
}
export function scalesContainingChord(
  chord: string,
  options?: { corpus?: readonly string[]; tolerateMissing?: number; limitPerGroup?: number },
): ScalesContainingChordResult;
```

- **Input:** a chord name (e.g. `"Cmaj7"`). Panel passes the first `identifyChord` result, falling back to `` `${renderRoot}${chordType}` ``. Chord tones resolved via `@tonaljs/chord` `get(chord)` → `.notes`/`.intervals`; chord root chroma from its tonic.
- **Corpus (candidate universe):** sweep **12 chromatic roots × `DEFAULT_SCALE_CORPUS`**, where the corpus is a fixed, deduped array of scale-*type* names: `major, dorian, phrygian, lydian, mixolydian, aeolian, locrian, harmonic minor, melodic minor, major pentatonic, minor pentatonic`. Each candidate resolved via `@tonaljs/scale` `` get(`${root} ${type}`) ``; its chroma set computed with the existing `chromaOf` helper (already imported in `integration.ts`).
- **Containment (root semantics resolved by D-001):** keep a candidate iff the chord's chroma set ⊆ the scale's chroma set (strict, `tolerateMissing: 0`). Partition into `rootAnchored` (scale tonic chroma === chord root chroma) and `otherRoots` (all other roots). No scale appears in both groups.
- **Ranking (deterministic):** within each group sort by `extraTones` ascending (tightest fit first), then `DEFAULT_SCALE_CORPUS` index, then root chroma distance from chord root, then `name`. `limitPerGroup` caps each group after ranking; default uncapped.
- **Omitted-tone handling:** `tolerateMissing: N` (default 0) admits scales missing up to N chord tones, recording them in `omittedTones` — this covers guitar voicings/altered chords whose tones no common scale fully contains. In strict mode `omittedTones` is always `[]`.
- **Empty results / never throws:** unresolvable/empty chord, or no matches → `{ chord, root, rootAnchored: [], otherRoots: [] }`.
- **Registration:** export the function + types + `DEFAULT_SCALE_CORPUS` from the "Tonal integration" block of `src/index.ts` (alongside `relatedScales`/`identifyChord`).
- **Docs:** new `## scalesContainingChord` section in `docs/api/integration.md` with worked `Cmaj7` / `Cm7` examples and the corpus listed.
- **Test expectations (`src/integration.test.ts`):** `scalesContainingChord("Cmaj7").rootAnchored` includes `C major` and `C lydian`, excludes `C mixolydian` (Bb) and `C dorian`; `.otherRoots` includes `G major`, `E phrygian`, `A aeolian`; `scalesContainingChord("Cm7").rootAnchored` includes `C dorian`/`C aeolian`/`C phrygian`, excludes `C major`; unknown chord → both groups empty; every returned scale's chroma set is a strict superset of the chord's; groups are disjoint; output is stable across calls; `tolerateMissing:1` populates `omittedTones`.
- **Peer-dep boundary (CLAUDE.md — MUST respect):** `scalesContainingChord` belongs **only** in `integration.ts` (optional `@tonaljs/scale` + `@tonaljs/chord` tier). It MUST NOT be added to or imported by `audit.ts` or `transform.ts`, and MUST NOT be called at any `data/*` import time.

**`featured` metadata field (`src/shape.ts`)** — makes the spotlight/★ tier library-sourced (D-006 amendment 3).
- Add optional `featured?: boolean` to both `ScaleShape` and `ChordShape`.
- **Initial flagging principle (library data, curated in registry files):** flag the *canonical* shape per common chord type — the open-position voicing if one exists, else the lowest-`baseFret` movable form — targeting 1–2 per `chordType`. For triads flag the five open CAGED majors/minors; for scales flag one representative shape per `(system, quality)` (e.g. the CAGED "E Shape" per quality, pentatonic box 1). Enumeration of exact entries is left to planning; the rule is the contract.
- **Audit interaction:** `featured` is optional/curated — `checkChordMetadataCompleteness` / `checkScaleMetadataCompleteness` MUST NOT require or flag it. A failing shape that is also `featured` still sorts into the pinned failing section (failure rank wins over spotlight tier).

### Site — catalog / facets

Facet bar (`FilterBar.tsx` rework + `shapeLibraryUtils.ts` facet helpers) implementing experiment 04 for both kinds. All counts derived at render time from the catalog using the "count ignoring this facet" pattern in `04-faceted-chips.html`; never hardcoded.

**Chord facets:**
- **Quality-group chips (single-select) → type chips (multi-select).** Groups derived by tokenizing distinct `chordType` values: Triads (maj/min/dim/aug), Sevenths (maj7/7/m7/m7b5/dim7/mMaj7), Extended (9/11/13/add), Sus/Add. Ambiguous symbols get dual labels ("m7b5 (ø7)"). Type chips default all-on within the selected group; toggling all-on == no narrowing.
- **Voicing-family multi-select chips with live counts**, all on by default, zero-count chips greyed (opacity, kept visible) not hidden. Families from `distinctVoicingFamilies`.
- **Root strip:** `Any` + 12 chromatic buttons (sharps on buttons, flats honored in diagrams via Tonal). Semantics: for **open/fixed shapes** (have `canonicalRoot`) root is a true filter (`canonicalRoot`/`renderRoot` match); for **movable shapes** selecting a root re-renders (transposes) the diagram as a preview and does not exclude — state both behaviors in the chip's title/aria.
- **Sort:** default base fret ascending (`chordShape.baseFret`), alternative by name/type order.
- **Alias-aware search:** map `ø`/`half-dim`/`halfdim`→`m7b5`, `Δ`→`maj7`, `dom`→`7`; match against the display symbol (`root`+chord type) and `entry.name`.

**Scale facets:** system (`distinctSystems`) and quality (`distinctQualities`), same chip treatment; sort by name. The existing kind toggle stays.

**Grouping / spotlight / Show-all:** chord grid grouped by `chordType` with a heading + per-group count badge; within a group, `featured` shapes render first (spotlight tier), then base-fret ascending; groups longer than a collapse threshold (≈5) show only spotlight+first rows behind a "Show all N ▾" toggle (expanded-group state is URL-persisted). Scale grid grouped by system (or quality).

**Failing-pinned section:** a top "⚠ Needs attention" `<section>` renders all entries with `issues.length > 0` (error/warning) across every group, using the existing severity badges — pinned regardless of active grouping/facets so D-004 stays intact. This replaces reliance on `sortFailuresFirst` alone but must produce the same visibility.

**Compact card anatomy (monochrome):** trim the card to chord symbol (display name) + voicing-family tag + `fr N` tag + audit id badge(s) + diagram. Move the metadata `<dl>`, the chord table, and the report link **into the panel**. Diagram dots are **monochrome** in v1 (override `Fretboard` theme so all markers use `defaultMarker`/foreground; no interval colors) — remove the page-level interval `LEGEND` for now (reintroduced by the later interval-label toggle). Card becomes a real `<button>` (`onSelect`), highlighted border + `aria-pressed`/`aria-current` when it is the selected entry.

### Site — detail panel

New `ShapeDetailPanel.tsx` + pure `shapeDetailUtils.ts` + `CompactFretboard.tsx` (a reduced-`layout` adapter parallel to `ShapeCardDiagram`; no new `fretboard-ui` component). Non-modal per D-005: no backdrop, no focus trap; page shifts left (desktop) and stays interactive; clicking another card swaps content in place; `role="complementary"`, `aria-live="polite"` announces swaps; Esc / ✕ close, focus returns to the triggering card. All Tonal work runs in a `useMemo` keyed on the selected entry (the `ensureReportUrl` deferred-computation idiom) — never for all 159 cards.

**Chord entries:**
- Header: display symbol + voicing-family tag + ★ (if `featured`) + base fret / root + failing indicator; sibling-voicing **stepper** (Prev/Next through `chordShapes.query({ chordType })`, "voicing i of n").
- Big monochrome diagram.
- **Identified chord:** `identifyChord(entry.builtFrets, tuning)` → primary bold + alternates; enharmonic spelling shown as Tonal returns it; empty → "Could not identify these notes" empty state.
- **Scales over {chord}:** `scalesContainingChord(chordName)` — `rootAnchored` as the primary list, `otherRoots` behind an expandable `<details>` "Other parent scales (any root) — N" (D-001). Each row: scale name + a "why" caption (chord tones). `chordName` = first `identifyChord` result, else `` `${renderRoot}${chordType}` ``; skip the section if neither resolves.
- **Alternate fingerings:** `chordShapes.query({ chordType })` minus the current entry (by `name`); `CompactFretboard` thumbnails with hover-to-enlarge (experiment 01). Thumbnails are **selectable** (Codex #2): clicking one makes it the active selected shape (swaps the panel + updates URL/highlight). Graceful empty state with a report/suggest link when the registry has none (e.g. no minor-triad CAGED).
- **Inversions:** group the same query by `ChordShape.inversion`; label current inversion; list root/1st/2nd/3rd, linking registered siblings and marking unregistered ones. Degrade to voicing-family grouping when `chordType`/`inversion` are absent (base CAGED majors).
- Report-a-problem link (`buildReportUrl`, deferred) moved here from the card.

**Scale entries:**
- Header: shape name + system + quality + `parentShape` lineage (linking the source shape when set); sibling-shape stepper across same `(system, quality)`.
- Big monochrome diagram.
- **Related scales/modes:** derive a scale name from `quality` seeded at `renderRoot` (`major`→"C major", `minor`→"C minor", `minor-pentatonic`→"C minor pentatonic"), call `buildFromScale(shape, scaleName)` then `relatedScales(builtScale)` (the catalog's `buildFrettedScale` leaves `scaleType:""`, so the panel does its own `buildFromScale`).
- **Compatible-shape context:** `modeShapes(scaleName)` / `isShapeCompatible` list of other registered compatible shapes. Q4 caveat: do **not** assert that 3NPS registry modal names equal Tonal-derived names; add a footnote rather than a mismatch claim.

**URL state extension (`shapeLibraryUtils.ts`):** extend `ShapesUrlState` + `parseShapesUrlState`/`serializeShapesUrlState` with a `shape` param (selected entry `name`, encoded) plus the new facets (quality group, active type set, active voicing families, root, sort, expanded groups). On load, resolve `shape` by matching `name` in the catalog and open the panel; unknown name → no panel (honest stale link). Keep the existing hydration-safe pattern (read after mount behind `urlStateLoaded`, mirror via `history.replaceState`).

**Keyboard/a11y model:** cards are buttons; the panel is a non-modal complementary landmark with no focus trap; Esc closes and restores focus to the selected card; `aria-live` announces the newly shown shape; the moved report link keeps its own semantics (no longer conflicts with card click).

**Mobile behavior (proposed, Codex #2):** below the `md` breakpoint the slide-over becomes a **full-height sheet** (`inset-0`, `translateY(100%)→0`) that overlays the single-column grid (the page cannot shift left on a phone); the sheet has a top ✕/drag-handle, retains body scroll, and closes via ✕ / Esc / hardware back / tap-on-handle. No focus trap; navigation between shapes on mobile uses the panel's own stepper and alternate-fingering thumbnails since underlying cards are covered. The root strip becomes horizontally scrollable.

### Infrastructure (Codex #3)
- **Explicit deps** in `site/package.json` `dependencies`: `@tonaljs/scale ^4.13.0`, `@tonaljs/chord ^6.1.0`, `@tonaljs/key ^4.11.0`, `@tonaljs/note ^4.12.0`, `@tonaljs/interval ^5.1.0` (matching root peer ranges), since this is the first feature to intentionally rely on integration-tier calls at runtime rather than incidental monorepo hoisting. `shapeLibraryUtils.ts` MUST keep importing only from `"tonal-guitar"` (no direct `@tonaljs/*`); site code reaches `scalesContainingChord` through the `tonal-guitar` re-export.
- **Static-export verification (manual — no site test infra):** `npm run build` and `DEPLOY=true npm run build` in `site/`; confirm `out/shapes` exports, first render matches the parameter-free server HTML, panel opens/swaps/deep-links, no server routes, URL parsing stays hydration-safe.
- **Bundle check:** inspect Next build output for `/shapes` First Load JS before/after; **code-split the panel** via `next/dynamic` (`ssr:false`) so panel + detail-derivation logic (and `scalesContainingChord` call sites) stay out of the initial `/shapes` chunk. Compute-on-open (`useMemo` keyed on entry) keeps runtime cost proportional to opened entries.

## Visual Design
Interaction reference is experiments `01-slide-over.html` (non-modal slide-over, page shift-left, compact cards, hover-to-enlarge thumbnails, Esc/✕, failing-pinned section) and `04-faceted-chips.html` (quality-group→type chips, voicing-family multi-select with live greyed-at-zero counts, root strip, sort select, alias search, spotlight-first grouped sections with "Show all N", sibling stepper). Style with existing `fd-*` semantic tokens (not the experiments' raw hex). **Dots are monochrome** in v1. Density target: `grid-template-columns: repeat(auto-fill, minmax(148px, 1fr))` equivalent (denser than the current `md:grid-cols-2 xl:grid-cols-3`), cards trimmed to name + tags + diagram so more shapes fit at a glance (D-005).

## Existing Code to Leverage
- `site/app/shapes/components/shapeLibraryUtils.ts` — `ShapeCatalogEntry` (panel input contract, already carries `builtFrets`/`sourceFrets`/`gripRoot`/`issues`), `buildCatalog`, `filterCatalog`, `distinctSystems/VoicingFamilies/Qualities`, URL parse/serialize, `buildReportUrl`.
- `site/app/shapes/components/ShapeLibrary.tsx` — URL-state + `useMemo` audit/catalog wiring to extend with `selectedEntry` + facet state.
- `site/app/shapes/components/ShapeCard.tsx` — `ensureReportUrl` deferred-computation idiom; `memo` pattern.
- `site/app/shapes/components/ShapeCardDiagram.tsx` + `packages/fretboard-ui` `<Fretboard layout/theme>` — thumbnails via reduced `layout`; monochrome via theme override.
- `site/app/shapes/components/FilterBar.tsx` — hand-rolled `ToggleGroup`; extend to chips.
- `src/shape.ts` `chordShapes.query`, `all()`, `get()`; `src/integration.ts` `identifyChord`/`buildFromScale`/`relatedScales`/`modeShapes`/`isShapeCompatible` and `chromaOf`/`getChord`/`getScale` for the new helper.

## Out of Scope
- **Edit layer** (edits captured to a file fed back into library data) — anticipated; the panel's report-problem flow and library-sourced data are the seam, and this design must not preclude it, but no edit UI/persistence here.
- Audio / click-to-play (#67); multi-shape overlay (#65); dev ShapeEditor (#66); `inferChordShape` (#36); voice-leading (#33); registry data fixes (#56–58 — panel shows graceful empty states instead); `analyzeInKey` key-context UI (no key picker); site test infrastructure (verification stays manual); interval-color/interval-label toggle (later slice — v1 is monochrome).
- **Left-handed flip** — noted as a candidate follow-up (recurring in the filter survey), not v1.

## Quality Criteria
- `scalesContainingChord` fully specified: signature, corpus, root partition (D-001), ranking, strict-subset containment, omitted-tone option, empty-result behavior, index.ts registration, docs entry, and enumerated `src/integration.test.ts` expectations.
- Every UI requirement maps to an existing component/pattern with a path; counts and groupings are derived at render time, never hardcoded (matches the audit-library "derived, never hardcoded" rule).
- Peer-dep boundaries explicit: helper only in `integration.ts`; `shapeLibraryUtils.ts` stays `@tonaljs`-free; site declares `@tonaljs/*` deps.
- Edge cases identified with defined behavior: missing `chordType`/`inversion` (base CAGED majors → degrade grouping / skip inversion section), empty registry query (graceful empty + report link), empty `identifyChord` (empty state), unresolvable scale name for scale entries (skip related-scales), unknown `?shape=` (no panel), 3NPS modal-name mismatch Q4 (footnote, no assertion), enharmonic display (use Tonal spelling), movable-vs-open root semantics, and failing+featured precedence (pinned wins).
- Interaction model locked: URL `shape` param yes, non-modal desktop slide-over with defined keyboard/focus, selectable alternate thumbnails, and a concrete full-height mobile sheet.
- Static-export + `DEPLOY=true` build and a `/shapes` bundle-size/code-split check are acceptance steps.
