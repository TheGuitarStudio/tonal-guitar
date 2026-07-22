# Task Breakdown: Shape Library Detail Side Panel

## Overview

Total Tasks: 16 Task Groups

This feature adds one new tested library function (`scalesContainingChord` in `src/integration.ts`) plus an optional `featured` metadata field on shape types (`src/shape.ts`), then reorganizes the `/shapes` lab page (`site/app/shapes/components/*`) into a faceted-chip catalog with a non-modal detail slide-over panel. It touches both the library (`src/`) and the site (`site/`). The site has no test infrastructure (confirmed: no `*.test.tsx`/vitest config under `site/`), so all site task groups rely on manual browser verification (`npm run dev` / `npm run build` / `DEPLOY=true npm run build`), matching the existing pattern for `ShapeLibrary.tsx` and friends. Library task groups follow the standard test-first vitest pattern.

## Task List

### Module / Types Layer (`src/`)

#### Task Group 1: `featured` metadata field on shape types

**Dependencies:** None (parallel with Task Group 2)

- [ ] 1.0 Add the optional `featured?: boolean` field to both shape types without disturbing audit invariants
  - [ ] 1.1 Write focused tests
    - `src/shape.test.ts`: `add()`/`chordShapes.add()` accept and round-trip a `featured: true` entry; `get()`/`chordShapes.get()` return it unchanged
    - `src/audit.test.ts`: a chord shape with `featured` set but missing `chordType`/`voicingFamily` still only reports the existing metadata-completeness warning (no new issue for `featured`); a scale shape with `featured` set but no `quality`/`parentShape` passes `checkScaleMetadataCompleteness` cleanly; a **failing + featured** shape still ranks as failing (spot-check `rankOf`/`sortFailuresFirst`-equivalent ordering logic stays untouched — this is really a site-layer invariant, but assert here that `featured` alone never appears in `ShapeAuditIssue[]`)
  - [ ] 1.2 Add `featured?: boolean` to `ScaleShape` and `ChordShape` in `src/shape.ts`
  - [ ] 1.3 Confirm `checkChordMetadataCompleteness` / `checkScaleMetadataCompleteness` in `src/audit.ts` are untouched (they must not reference `featured` at all — spec §Library "Audit interaction")
  - [ ] 1.4 Ensure tests pass: `npx vitest run src/shape.test.ts src/audit.test.ts`

**Acceptance Criteria:**

- `featured?: boolean` exists on both `ScaleShape` and `ChordShape`, optional, no default
- `checkChordMetadataCompleteness`/`checkScaleMetadataCompleteness` never require or flag `featured`
- `npm run build` passes; the tests written in 1.1 pass

---

#### Task Group 2: `scalesContainingChord` — types + stub + registration

**Dependencies:** None (parallel with Task Group 1)

- [ ] 2.0 Scaffold the new public function's contract so downstream groups can implement against a stable shape
  - [ ] 2.1 Write scaffolding tests in `src/integration.test.ts`
    - `scalesContainingChord`, `DEFAULT_SCALE_CORPUS`, and the `ContainingScale`/`ScalesContainingChordResult` types resolve from `./integration` and from `../index` (import smoke)
    - `DEFAULT_SCALE_CORPUS` is a deduped array containing exactly: `major, dorian, phrygian, lydian, mixolydian, aeolian, locrian, harmonic minor, melodic minor, major pentatonic, minor pentatonic` (order matters — it's the ranking tiebreaker in Task Group 3)
  - [ ] 2.2 Add to `src/integration.ts`:
    - `export const DEFAULT_SCALE_CORPUS: readonly string[]` (the 11 scale-type names above, in spec order)
    - `export interface ContainingScale { root, scaleType, name, extraTones, omittedTones }`
    - `export interface ScalesContainingChordResult { chord, root, rootAnchored, otherRoots }`
    - `export function scalesContainingChord(chord, options?)` as a stub that returns the empty sentinel `{ chord: "", root: "", rootAnchored: [], otherRoots: [] }` unconditionally (never throws, per CLAUDE.md error-handling convention — Task Group 4 replaces the body)
  - [ ] 2.3 Wire re-exports in `src/index.ts`: add `scalesContainingChord`, `DEFAULT_SCALE_CORPUS` to the existing "Tonal integration" export block (alongside `relatedScales`/`identifyChord`), and `ContainingScale`/`ScalesContainingChordResult` to the adjacent `export type` block
  - [ ] 2.4 Ensure tests pass: `npx vitest run src/integration.test.ts`

**Acceptance Criteria:**

- `scalesContainingChord`, `DEFAULT_SCALE_CORPUS`, and both types are importable from `src/index` and from `"tonal-guitar"`
- The stub never throws for any input
- `npm run build` passes; the tests written in 2.1 pass

---

### Core Logic Layer (`src/integration.ts`, internal helpers)

#### Task Group 3: Chord→scales chroma sweep, containment, and ranking

**Dependencies:** Task Group 2

- [ ] 3.0 Implement the pure computational core as internal (non-exported) helpers in `src/integration.ts`
  - [ ] 3.1 Write focused tests in `src/integration.test.ts` against the spec's enumerated scenarios (helpers are internal — keep them internal and cover ranking/partition/containment behavior via the public function once Task Group 4 wires it; in this group, write the tests as `describe.todo`/pending or against the spec scenarios in preparation, and pin down behavior that can be asserted without export escape hatches)
    - Corpus sweep: for a resolved chord's chroma set, every one of the 12 roots × 11 corpus types is checked
    - Containment: chord chroma set ⊆ candidate scale chroma set (strict, `tolerateMissing: 0` default) using `chromaOf` from `./transform` (already imported)
    - Partition: `rootAnchored` = candidates whose scale tonic chroma === chord root chroma; `otherRoots` = everything else; no candidate in both
    - Ranking comparator: `extraTones` ascending, then `DEFAULT_SCALE_CORPUS` index ascending, then root-chroma distance from chord root ascending, then `name` ascending
    - `tolerateMissing: N` admits scales missing up to N chord tones, recording them in `omittedTones`; strict mode (`tolerateMissing: 0`, the default) always yields `omittedTones: []`
  - [ ] 3.2 Implement internal helpers in `src/integration.ts`:
    - Chord-tone resolution via `getChord(chord)` → `.notes`/`.intervals`, chord root chroma via `noteChroma` on the tonic
    - `sweepCorpus(chordChromas, chordRootChroma, corpus, tolerateMissing)` → unranked `ContainingScale[]` with `extraTones`/`omittedTones` computed per candidate (built via `getScale(`${root} ${type}`)`, chroma set via `chromaOf`)
    - `partitionByRoot(candidates, chordRootChroma)` → `{ rootAnchored, otherRoots }`
    - `rankContainingScales(candidates, corpus)` → sorted array per the comparator above
  - [ ] 3.3 Ensure tests pass: `npx vitest run src/integration.test.ts`

**Acceptance Criteria:**

- Containment is strict-subset by default; `tolerateMissing` behavior matches spec exactly
- Ranking is fully deterministic (stable across repeated calls, no reliance on `Array#sort` non-determinism)
- Helpers are not exported from `src/index.ts` (internal only)
- The tests written in 3.1 pass

---

#### Task Group 4: Wire `scalesContainingChord` public function + edge cases + docs entry

**Dependencies:** Task Group 3

- [ ] 4.0 Replace the Task Group 2 stub with the real dispatch and lock in every edge case from spec §Library
  - [ ] 4.1 Write focused tests in `src/integration.test.ts` (spec's enumerated expectations, verbatim):
    - `scalesContainingChord("Cmaj7").rootAnchored` includes `C major` and `C lydian`; excludes `C mixolydian` and `C dorian`
    - `.otherRoots` includes `G major`, `E phrygian`, `A aeolian`
    - `scalesContainingChord("Cm7").rootAnchored` includes `C dorian`/`C aeolian`/`C phrygian`; excludes `C major`
    - Unknown/unresolvable chord → `{ chord, root, rootAnchored: [], otherRoots: [] }` (never throws)
    - Every returned scale's chroma set is a strict superset of the chord's chroma set
    - `rootAnchored`/`otherRoots` are disjoint (no scale name+root pair in both)
    - Output is stable across repeated calls with identical input
    - `tolerateMissing: 1` populates `omittedTones` on at least one admitted candidate that strict mode excludes
    - `limitPerGroup` caps each group's length after ranking (default uncapped)
  - [ ] 4.2 Implement `scalesContainingChord(chord, options?)`:
    - Resolve chord via `getChord(chord)`; on empty/unresolvable, short-circuit to the empty sentinel
    - Dispatch to Task Group 3's `sweepCorpus` → `partitionByRoot` → `rankContainingScales` (apply `options.corpus ?? DEFAULT_SCALE_CORPUS`, `options.tolerateMissing ?? 0`, `options.limitPerGroup` after ranking each group independently)
    - Populate `result.chord` with the resolved chord name (as swept), `result.root` with the chord root pitch class
  - [ ] 4.3 Add `## scalesContainingChord` section to `docs/api/integration.md` (mirrors the existing sibling sections' style) with worked `Cmaj7` and `Cm7` examples and the corpus listed verbatim
  - [ ] 4.4 Ensure tests pass + full build: `npx vitest run src/integration.test.ts` then `npm run build`

**Acceptance Criteria:**

- Public function never throws for any input (matches CLAUDE.md error-handling convention)
- Every enumerated spec scenario has an exact assertion
- `scalesContainingChord` is NOT imported by `src/audit.ts` or `src/transform.ts`, and is not called at any `data/*` import time (peer-dep boundary, CLAUDE.md §Dependency layers)
- `docs/api/integration.md` documents signature, corpus, and both worked examples
- The tests written in 4.1 pass; `npm test` shows no regressions

---

#### Task Group 5: Featured shape curation (registry data)

**Dependencies:** Task Group 1

- [ ] 5.0 Flag the canonical/spotlight shape(s) per common chord type and per `(system, quality)` scale grouping across the existing registry data files, per the spec's flagging rule
  - [ ] 5.1 Write focused tests
    - `src/data/data.test.ts` (or a new adjacent test block): sweep `chordShapes.all()` grouped by `chordType`, assert every group with a registered open-position shape has exactly one `featured: true` entry preferring the open voicing, else the lowest-`baseFret` movable form; assert 1–2 featured entries per common `chordType`, never 0 for groups with ≥1 registered shape
    - Sweep `all()` (scale shapes) grouped by `(system, quality)`; assert one representative `featured: true` shape per group (e.g. the CAGED "E Shape" per quality, "Pentatonic Box 1"/"Pentatonic Box 1 Minor")
    - The five open-position CAGED major/minor triads are flagged where they exist in the registry
  - [ ] 5.2 Add `featured: true` to the chosen entries in:
    - `src/data/open-chords.ts` (open-position canonical per `chordType`, e.g. `"C Major Open"`, `"C Dominant 7 Open"`, `"C Major 7 Open"`, `"C m7b5 Open"`, etc.)
    - `src/data/caged-chords.ts` (the five CAGED major triad forms, if no open-position triad exists for a given root/quality pairing in scope)
    - `src/data/caged-chords-7th.ts`, `src/data/jazz-shells.ts`, `src/data/extended-chords.ts` (lowest-`baseFret` movable form per `chordType` where no open shape is registered)
    - `src/data/caged-scales.ts` + `src/data/caged-scales-minor.ts` (one CAGED shape — e.g. "E Shape"/"Em Shape" — per quality)
    - `src/data/pentatonic.ts` + `src/data/pentatonic-minor.ts` ("Pentatonic Box 1" / "Pentatonic Box 1 Minor")
    - `src/data/three-nps.ts` (one representative 3NPS pattern, if in scope per the "1–2 per chordType/quality" target)
  - [ ] 5.3 Ensure tests pass: `npx vitest run src/data/data.test.ts src/shape.test.ts src/audit.test.ts`

**Acceptance Criteria:**

- `featured` flags are curated library data, not derived/computed — matches "library data, curated in registry files" (spec §Library)
- No `chordType` group with ≥1 registered shape is left with zero featured entries; no group has more than 2
- The tests written in 5.1 pass; `npm test` shows no regressions

---

### Docs Layer

#### Task Group 6: API docs + README updates

**Dependencies:** Task Group 1, Task Group 4, Task Group 5

- [ ] 6.0 Document the new public surface and type field
  - [ ] 6.1 Update `docs/api/shapes.md`: add `featured?: boolean` to both the `ScaleShape` and `ChordShape` interface blocks, with a one-line note that it's curated registry data (not audit-derived)
  - [ ] 6.2 Confirm `docs/api/integration.md`'s new `## scalesContainingChord` section (added in Task Group 4.3) is complete and matches the sibling sections' formatting
  - [ ] 6.3 Update `README.md`: add a `scalesContainingChord` subsection under the existing `## API` → Tonal integration section (mirrors `identifyChord`/`relatedScales`/`isShapeCompatible` entries there), with the same worked examples
  - [ ] 6.4 Update `CHANGELOG.md` under the `[Unreleased]` entry: new `scalesContainingChord` function + `DEFAULT_SCALE_CORPUS` + `ContainingScale`/`ScalesContainingChordResult` types, new optional `featured` field on `ScaleShape`/`ChordShape` (match the existing entry style)
  - [ ] 6.5 Confirm docs render: `cd site && npm run dev`, open the Docs section for Integration and Shapes

**Acceptance Criteria:**

- `scalesContainingChord` appears in both `docs/api/integration.md` and `README.md`'s API section
- `featured` appears in `docs/api/shapes.md`'s type blocks
- No other README/docs content is altered

---

### Lab / Site Layer (`site/`)

#### Task Group 7: `shapeLibraryUtils.ts` — URL state extension

**Dependencies:** None

- [ ] 7.0 Extend `ShapesUrlState` + parse/serialize to carry the panel-open shape param and the new facet/sort/group state, preserving the existing hydration-safe pattern
  - [ ] 7.1 Extend `ShapesUrlState` in `site/app/shapes/components/shapeLibraryUtils.ts`: add `shape?: string` (selected entry `name`), `qualityGroup?: string`, `activeTypes?: string[]`, `activeVoicingFamilies?: string[]`, `root?: string`, `sort?: "baseFret" | "name"`, `expandedGroups?: string[]`
  - [ ] 7.2 Extend `parseShapesUrlState(search)` to read the new params (encode multi-value fields — `activeTypes`, `activeVoicingFamilies`, `expandedGroups` — as comma-joined query values, matching the existing single-value param style); unknown/absent values fall back to "default" (all-on for multi-selects, no shape param)
  - [ ] 7.3 Extend `serializeShapesUrlState(state)` symmetrically, continuing to omit default values so the unfiltered landing view keeps a bare `/shapes` URL
  - [ ] 7.4 Ensure `npm run build` in `site/` type-checks cleanly (no test infra to run — this file has no existing `*.test.ts` sibling and none is being introduced, consistent with the rest of `site/`)

**Acceptance Criteria:**

- All new `ShapesUrlState` fields round-trip through `parseShapesUrlState`/`serializeShapesUrlState` without breaking the existing `kind`/`system`/`family`/`q`/`failing` fields
- Default state still serializes to `""` (bare `/shapes`)
- `site` type-checks (`cd site && npm run build`)

---

#### Task Group 8: `shapeLibraryUtils.ts` — facet, grouping, and sort helpers

**Dependencies:** Task Group 1 (needs `featured` on the imported shape types)

- [ ] 8.0 Add the pure facet/grouping/sort logic that `FilterBar.tsx`, `ShapeCard.tsx`, and `ShapeLibrary.tsx` will consume
  - [ ] 8.1 Add quality-group → type-chip tokenization: derive quality groups (Triads / Sevenths / Extended / Sus-Add) from distinct `chordType` values via `distinctVoicingFamilies`-style extraction; dual-label ambiguous symbols (`"m7b5 (ø7)"`)
  - [ ] 8.2 Add the "count ignoring this facet" helper (per experiment `04-faceted-chips.html`'s pattern): given the catalog, active filters, and a facet dimension, compute per-chip counts as if that one facet weren't applied — used to grey out (not hide) zero-count voicing-family chips
  - [ ] 8.3 Add alias-aware search matching: map `ø`/`half-dim`/`halfdim` → `m7b5`, `Δ` → `maj7`, `dom` → `7` before substring-matching against the display symbol (`root` + `chordType`) and `entry.name`
  - [ ] 8.4 Add root-strip filter semantics: for entries with `canonicalRoot` (open/fixed shapes), root is a true filter; for movable shapes, root selection is a preview/transpose signal only (return a discriminated result so the caller knows which behavior applies)
  - [ ] 8.5 Add sort comparators: default `chordShape.baseFret` ascending (entries with `baseFret === undefined` — e.g. the 5 base CAGED majors — sort as fret 0/first), alternative by `chordType`/name order; scale grid sorts by name
  - [ ] 8.6 Add spotlight/grouping helpers: group chord entries by `chordType` (heading + count), scale entries by `system` (or `quality`); within a group, `featured` entries first, then the group's active sort; expose a "first N vs Show all" split (collapse threshold ≈5). Entries with `chordType === undefined` (the 5 base CAGED majors in `src/data/caged-chords.ts`) MUST NOT vanish: bucket them into an explicit trailing "Other" group (fall back to `voicingFamily`/`system` for its label where available)
  - [ ] 8.7 Ensure `npm run build` in `site/` type-checks; manually sanity-check outputs against known catalog values via a throwaway `console.log` in `npm run dev` (no persisted test file — matches existing site convention)

**Acceptance Criteria:**

- All counts/groupings are derived at render time from the catalog — never hardcoded (matches the audit-library "derived, never hardcoded" rule, spec Quality Criteria)
- Zero-count voicing-family chips are identifiable (greyed, not excluded) via the helper's return shape
- `site` type-checks

---

#### Task Group 9: `FilterBar.tsx` rework — faceted chips

**Dependencies:** Task Group 7, Task Group 8

- [ ] 9.0 Replace the current dropdown-based `FilterBar` with the chip-based facet bar from experiment 04
  - [ ] 9.1 Quality-group chips (single-select) that expand to multi-select type chips (Task Group 8.1's tokenization); type chips default all-on within the selected group
  - [ ] 9.2 Voicing-family multi-select chips with live counts (Task Group 8.2's helper); zero-count chips render greyed (opacity), not hidden
  - [ ] 9.3 Root strip: `Any` + 12 chromatic buttons (sharps on buttons); wire Task Group 8.4's dual semantics into each chip's `title`/`aria-label`; below `md`, the root strip becomes horizontally scrollable (spec's mobile requirement — owned here, not by the panel's mobile sheet in Task Group 13.5)
  - [ ] 9.4 Sort `<select>`: base-fret ascending (default) vs name/type order
  - [ ] 9.5 Alias-aware search input using Task Group 8.3's matcher
  - [ ] 9.6 Scale-mode facets: system + quality chips (same chip treatment), sort-by-name; existing kind toggle (`ToggleGroup`) stays
  - [ ] 9.7 Verify in browser: `npm run dev` in `site/`, confirm chip toggling narrows the grid correctly for both chord and scale kinds, and the "Showing N of M" count still updates live

**Acceptance Criteria:**

- Every chip's shown count is computed via Task Group 8's helpers, never hardcoded
- Toggling all type chips on within a group is equivalent to no narrowing (spec invariant)
- Existing `failingOnly` toggle and kind toggle continue to work unchanged
- Manually verified in `npm run dev`

---

#### Task Group 10: `ShapeCard.tsx` + `ShapeCardDiagram.tsx` — compact, monochrome, clickable card

**Dependencies:** Task Group 1

- [ ] 10.0 Trim the card to spec's compact anatomy and make it a real, selectable button
  - [ ] 10.1 `ShapeCard.tsx`: replace the outer `<div>` with a `<button type="button" onClick={onSelect}>`, add `aria-pressed`/`aria-current` + highlighted border when `isSelected`; add an `onSelect: (entry) => void` and `isSelected: boolean` prop
  - [ ] 10.2 Trim card contents to: chord symbol/display name, voicing-family tag (or `quality` for scales), `fr N` tag, audit id badge(s), diagram, and a `★` marker when `entry.shape.featured`
  - [ ] 10.3 Remove the `<dl>` metadata block, `<ShapeCardChordTable>`, and the "Report a problem" link from `ShapeCard.tsx` (all three move into `ShapeDetailPanel.tsx` in Task Group 13) — keep the `ensureReportUrl` deferred-computation idiom intact but relocate it
  - [ ] 10.4 `ShapeCardDiagram.tsx`: override `<Fretboard theme={...}>` so every marker renders in `defaultTheme.defaultMarker`'s color (override `intervalColors` to map every key to that one color, and `rootMarker`/`ghostMarker`/`highlightMarker` to match) — dots become monochrome; export the monochrome theme constant for reuse by `CompactFretboard.tsx` (Task Group 11)
  - [ ] 10.5 Remove the page-level interval `LEGEND` export/usage from `ShapeCardDiagram.tsx`/`ShapeLibrary.tsx` (re-added later by the deferred interval-label toggle, out of scope here)
  - [ ] 10.6 Verify in browser: `npm run dev`, confirm cards are focusable/clickable buttons, keyboard `Enter`/`Space` activates them, dots render monochrome, and the removed elements no longer appear on the card

**Acceptance Criteria:**

- Card is a real `<button>` with correct `aria-pressed`/`aria-current` semantics
- Diagram dots are monochrome (no per-interval color)
- Metadata table, chord table, and report link no longer render on the card
- `★` renders only when `shape.featured` is true
- Manually verified in `npm run dev`

---

#### Task Group 11: `CompactFretboard.tsx` — thumbnail diagram adapter

**Dependencies:** None (parallel with Task Group 10)

- [ ] 11.0 Create a new, reduced-`layout` adapter over `<Fretboard>` for alternate-fingering thumbnails (no new `fretboard-ui` component — matches `ShapeCardDiagram.tsx`'s pattern)
  - [ ] 11.1 Create `site/app/shapes/components/CompactFretboard.tsx`: accepts a `ShapeCatalogEntry`-shaped input (or the minimal subset: `frettedScale`/`renderRoot`/`name`), renders `<Fretboard layout={{ cellWidth, cellHeight, markerRadius, showFretNumbers: false, showStringLabels: false }}>` at a much smaller footprint than `ShapeCardDiagram`
  - [ ] 11.2 Apply the same monochrome theme override as `ShapeCardDiagram` (share the constant if Task Group 10 has landed; otherwise duplicate and note the follow-up to dedupe)
  - [ ] 11.3 Support hover-to-enlarge (experiment 01's pattern): on hover/focus, render a larger overlay/tooltip version of the same diagram
  - [ ] 11.4 Support an optional `onSelect`/`selected` prop so callers (the panel's alternate-fingering thumbnails) can make it clickable and show a selected state
  - [ ] 11.5 Verify in browser via a temporary render inside `ShapeLibrary.tsx` or the experiments page, then remove the temporary wiring once Task Group 13 consumes it directly

**Acceptance Criteria:**

- Renders correctly at thumbnail size for both chord and scale entries
- Hover/focus enlarges the diagram without layout shift elsewhere on the page
- Monochrome dots, consistent with `ShapeCardDiagram`

---

#### Task Group 12: `shapeDetailUtils.ts` — pure detail-derivation logic

**Dependencies:** Task Group 4 (`scalesContainingChord`)

- [ ] 12.0 Create the pure logic module the panel component consumes — all Tonal-touching calls live here, not inline in JSX
  - [ ] 12.1 Create `site/app/shapes/components/shapeDetailUtils.ts` (imports only from `"tonal-guitar"`, matching `shapeLibraryUtils.ts`'s peer-dep boundary — no direct `@tonaljs/*` imports)
  - [ ] 12.2 Chord-entry helpers:
    - `resolveChordName(entry)`: first `identifyChord(entry.builtFrets, STANDARD)` result, else `` `${renderRoot}${chordType}` `` if `chordType` is set, else `undefined`
    - `scalesOverChord(entry)`: calls `scalesContainingChord(resolveChordName(entry))`, returns `undefined` if `resolveChordName` is `undefined`
    - `alternateFingerings(entry)`: `chordShapes.query({ chordType: entry.shape.chordType })` filtered to exclude the current entry by `name`; returns `[]` gracefully when `chordType` is `undefined` (base CAGED majors) or the registry has none
    - `inversionGroups(entry, siblings)`: groups `siblings` by `ChordShape.inversion`; degrades to grouping by `voicingFamily` when `inversion`/`chordType` are absent
    - `siblingStepper(entry, siblings)`: current index + total count ("voicing i of n") for the Prev/Next stepper
  - [ ] 12.3 Scale-entry helpers:
    - `relatedScaleNameFor(shape, renderRoot)`: derive a scale name seeded at `renderRoot` from `shape.quality` (`"major"` → `"C major"`, `"minor"` → `"C minor"`, `"minor-pentatonic"` → `"C minor pentatonic"`); returns `undefined` for unmapped/absent `quality`
    - `relatedScalesForEntry(entry)`: `buildFromScale(shape, relatedScaleNameFor(...))` then `relatedScales(built)`; returns `[]` when the scale name can't be derived or the build fails
    - `compatibleShapesForEntry(entry)`: `modeShapes(scaleName)` / `isShapeCompatible` sweep restricted to registered shapes other than the current entry; includes a Q4 footnote flag (no assertion) when the entry's `system === "3nps"`
    - `siblingScaleStepper(entry, catalog)`: same-`(system, quality)` sibling stepper, mirroring 12.2's chord stepper
  - [ ] 12.4 Move `buildReportUrl`/`ensureReportUrl` usage plumbing here if any shared logic needs relocating from `ShapeCard.tsx` (the function itself stays in `shapeLibraryUtils.ts`; this module just re-exposes what the panel needs)
  - [ ] 12.5 Ensure `npm run build` in `site/` type-checks; manually sanity-check each helper against known catalog entries (e.g. `"E Shape Major"` alternates, `"E Shape"` related scales) via `npm run dev` + temporary console output

**Acceptance Criteria:**

- Module imports only from `"tonal-guitar"` (no `@tonaljs/*`), matching `shapeLibraryUtils.ts`'s documented boundary
- Every helper degrades gracefully (empty array/`undefined`, never throws) for the documented registry gaps: missing `chordType`/`inversion` on base CAGED majors, empty alternate-fingering query, unresolvable scale name, unmapped `quality`
- `site` type-checks

---

#### Task Group 13: `ShapeDetailPanel.tsx` — the non-modal slide-over

**Dependencies:** Task Group 11, Task Group 12; soft dependency on Task Group 10 (13.3 receives the `<ShapeCardChordTable>` + report link relocated by 10.3 — coordinate so they don't transiently render in both places or get lost)

- [ ] 13.0 Build the panel component per D-005 (non-modal slide-over) and the spec's chord/scale content sections
  - [ ] 13.1 Create `site/app/shapes/components/ShapeDetailPanel.tsx`: accepts `entry: ShapeCatalogEntry | undefined`, `onClose`, `onSelectEntry(entry)`; all Tonal-derived data computed in a single `useMemo` keyed on `entry` (the `ensureReportUrl` deferred-computation idiom — never for all 159 cards)
  - [ ] 13.2 Structural chrome: `role="complementary"`, `aria-live="polite"` region that announces swaps, no backdrop, no focus trap, Esc closes and returns focus to the triggering card (parent owns the ref hand-off), ✕ close button
  - [ ] 13.3 Chord-entry content: header (display symbol, voicing-family tag, ★ if `featured`, base fret/root, failing indicator) + sibling stepper (Task Group 12.2's `siblingStepper`); big monochrome diagram; "Identified chord" section (primary bold + alternates, empty state "Could not identify these notes"); "Scales over {chord}" section (`rootAnchored` list + `<details>` "Other parent scales (any root) — N" for `otherRoots`, each row showing scale name + a chord-tones "why" caption); "Alternate fingerings" section using `CompactFretboard` thumbnails, selectable (clicking swaps the active entry via `onSelectEntry`), graceful empty state with a report/suggest link; "Inversions" section (Task Group 12.2's `inversionGroups`, current inversion labeled, unregistered siblings marked); moved `<ShapeCardChordTable>` + "Report a problem" link (relocated from `ShapeCard.tsx`, Task Group 10.3)
  - [ ] 13.4 Scale-entry content: header (shape name, system, quality, `parentShape` lineage link) + sibling stepper across same `(system, quality)`; big monochrome diagram; "Related scales/modes" section (Task Group 12.3's `relatedScalesForEntry`); "Compatible shapes" section (Task Group 12.3's `compatibleShapesForEntry`, with the Q4 footnote when applicable, never an assertion of name equality)
  - [ ] 13.5 Mobile variant: below `md`, render as a full-height sheet (`inset-0`, `translateY(100%)→0`) overlaying the single-column grid, top ✕/drag-handle, retains body scroll, closes via ✕/Esc/hardware-back/handle-tap; root strip (consumed via `FilterBar`, not this component) is out of scope here but note the sheet doesn't block it
  - [ ] 13.6 Verify in browser: open a chord card and a scale card, confirm every section renders/degrades correctly against real registry gaps (e.g. a base CAGED major with no `chordType`, a chord type with no alternate fingerings), confirm Esc/✕/focus-return, confirm thumbnail click swaps panel content

**Acceptance Criteria:**

- Non-modal: rest of the page stays interactive while open; clicking another card swaps content in place
- All Tonal computation is deferred to a single `useMemo` keyed on the selected entry
- Every documented degradation case (spec Quality Criteria's edge-case list) renders a graceful empty/footnote state, never a crash or a false assertion
- Keyboard model matches spec: Esc closes, focus returns to the triggering card, `aria-live` announces swaps
- Manually verified in `npm run dev`

---

#### Task Group 14: `ShapeLibrary.tsx` wiring — selection, grouped grid, failing-pinned section

**Dependencies:** Task Group 9, Task Group 10, Task Group 13

- [ ] 14.0 Wire the panel and the reorganized grid into the page container
  - [ ] 14.1 Add `selectedEntry` state, URL-synced via the `shape` param (Task Group 7): on load, resolve `shape` by matching `name` in the catalog behind the existing `urlStateLoaded` hydration guard; unknown name → no panel opens (honest stale link); mirror selection changes via `history.replaceState`
  - [ ] 14.2 Wire `ShapeCard`'s `onSelect`/`isSelected` (Task Group 10.1) to `selectedEntry`; render `ShapeDetailPanel` (Task Group 13) as a grid sibling, code-split via `next/dynamic(() => import("./ShapeDetailPanel"), { ssr: false })` so its Tonal-derivation logic and `scalesContainingChord` call sites stay out of the initial `/shapes` chunk
  - [ ] 14.3 Add the top "⚠ Needs attention" pinned `<section>`: all entries with `issues.length > 0` across every group, rendered before the grouped grid, regardless of active facets/grouping (D-004 invariant) — same severity badges as today
  - [ ] 14.4 Replace the flat grid with grouped `<section>`s: chord grid grouped by `chordType` (heading + count badge, `featured` entries first then base-fret ascending, "Show all N ▾" behind the ≈5-item collapse threshold with URL-persisted expanded state via `expandedGroups`); scale grid grouped by `system` (or `quality`)
  - [ ] 14.5 Desktop layout: page content shifts left when the panel is open (no backdrop, no reflow of the failing-pinned section's visibility)
  - [ ] 14.6 Verify in browser: deep-link a specific `?shape=...` URL and confirm the panel opens on load; toggle facets/groups and confirm the "Needs attention" section never disappears; confirm `LazyShapeCard`'s eager/observer-based mounting still works with the new grouped structure

**Acceptance Criteria:**

- Failing-pinned section always shows every `issues.length > 0` entry regardless of grouping/facet state (D-004 preserved)
- `?shape=<name>` deep-links open the correct panel on load; unknown names silently show no panel
- Panel bundle is code-split (verify in Task Group 15's bundle check)
- Existing lazy-mount behavior (`EAGER_CARD_COUNT`, `IntersectionObserver`) still functions inside the grouped sections
- Manually verified in `npm run dev`

---

#### Task Group 15: Infrastructure — explicit `@tonaljs/*` deps + bundle/static-export verification

**Dependencies:** Task Group 14

- [ ] 15.0 Declare the site's real runtime dependency on the Tonal peers and verify the static-export build end to end
  - [ ] 15.1 Add explicit `dependencies` to `site/package.json`: `@tonaljs/scale ^4.13.0`, `@tonaljs/chord ^6.1.0`, `@tonaljs/key ^4.11.0`, `@tonaljs/note ^4.12.0`, `@tonaljs/interval ^5.1.0` (matching root peer ranges); run `npm install` and confirm no version conflicts
  - [ ] 15.2 Confirm `shapeLibraryUtils.ts` and `shapeDetailUtils.ts` still import only from `"tonal-guitar"` (no direct `@tonaljs/*` imports — the site reaches `scalesContainingChord` only through the `tonal-guitar` re-export)
  - [ ] 15.3 Bundle check: `cd site && npm run build`, inspect the Next build output for `/shapes` First Load JS before/after this feature; confirm the panel (Task Group 13/14's `next/dynamic` split) is excluded from the initial `/shapes` chunk
  - [ ] 15.4 Static-export verification: `npm run build` and `DEPLOY=true npm run build` in `site/`; confirm `out/shapes` exports, first render matches the parameter-free server HTML (no hydration mismatch), panel opens/swaps/deep-links correctly against the exported HTML, no server routes are introduced, URL parsing stays hydration-safe (guarded by `urlStateLoaded`)

**Acceptance Criteria:**

- `site/package.json` declares the five `@tonaljs/*` packages as explicit `dependencies`
- No direct `@tonaljs/*` imports outside `node_modules` resolution paths in any `site/` source file
- `/shapes` First Load JS does not include the panel's Tonal-derivation logic in the initial chunk
- Both `npm run build` and `DEPLOY=true npm run build` succeed with no hydration warnings

---

### Testing Layer

#### Task Group 16: Test review and gap analysis

**Dependencies:** All earlier task groups

- [ ] 16.0 Final regression pass across library and site
  - [ ] 16.1 Audit library test coverage against spec §Library's "Test expectations" list (Task Groups 3/4) and spec Quality Criteria's edge-case list (Task Group 5's featured curation, Task Group 1's audit-interaction invariant)
  - [ ] 16.2 Identify any gaps in scenario fingerprints, ranking-determinism assertions, or `tolerateMissing`/`limitPerGroup` interactions
  - [ ] 16.3 Write up to 8 additional strategic library tests maximum to close any real gaps found (do not pad coverage for its own sake)
  - [ ] 16.4 Run: `npx vitest run src/integration.test.ts src/shape.test.ts src/audit.test.ts src/data/data.test.ts`, then the full suite `npm test` — confirm no regressions across the pre-existing ~922 tests
  - [ ] 16.5 Site manual regression checklist (no automated test infra exists for `site/` — this stays manual per spec's out-of-scope note): facet chips narrow/widen correctly with live counts; failing-pinned section always visible; card click opens/swaps the panel; Esc/✕ close and restore focus; deep-linked `?shape=` opens correctly; mobile sheet behavior below `md`; `DEPLOY=true npm run build` succeeds

**Acceptance Criteria:**

- All spec §Library test-expectation scenarios have corresponding assertions
- `npm test` passes with no regressions in the pre-existing suite
- No unrelated test files are modified
- Site manual checklist (16.5) completed and any found issues logged/fixed before merge

---

## Execution Order

Recommended implementation sequence, with parallelization called out:

1. **Task Groups 1 & 2** (Module/Types) — run in parallel; both are independent scaffolding
2. **Task Group 3** (Core Logic) — depends on 2
3. **Task Group 4** (Integration) — depends on 3
4. **Task Group 5** (data curation) — depends on 1; can run in parallel with 2/3/4
5. **Task Group 6** (Docs) — depends on 1, 4, 5
6. **Task Group 7** (URL state) and **Task Group 11** (`CompactFretboard.tsx`) — can start immediately, in parallel with the library groups (1–6) and with each other
7. **Task Group 8** (facet/grouping/sort helpers) — depends on 1
8. **Task Group 9** (`FilterBar.tsx`) — depends on 7, 8
9. **Task Group 10** (`ShapeCard.tsx`/`ShapeCardDiagram.tsx`) — depends on 1; can run in parallel with 8/9
10. **Task Group 12** (`shapeDetailUtils.ts`) — depends on 4 (blocked on the library's `scalesContainingChord` landing)
11. **Task Group 13** (`ShapeDetailPanel.tsx`) — depends on 11, 12
12. **Task Group 14** (`ShapeLibrary.tsx` wiring) — depends on 9, 10, 13
13. **Task Group 15** (infra + bundle/export verification) — depends on 14
14. **Task Group 16** (final test review) — depends on everything

**Parallel tracks:** `{1, 2}` → `{3 → 4}` and `5` can run concurrently once `1` lands; on the site side, `7` and `11` can start on day one (no library dependency); `8`/`9`/`10` can proceed once `1` lands, independent of the `scalesContainingChord` work; `12`/`13` are the only site groups gated on the full library chain (`1`–`4`).

## Files to Create

| File Path | Task |
| --------- | ---- |
| `site/app/shapes/components/CompactFretboard.tsx` | 11 |
| `site/app/shapes/components/shapeDetailUtils.ts` | 12 |
| `site/app/shapes/components/ShapeDetailPanel.tsx` | 13 |

## Files to Modify

| File Path | Task |
| --------- | ---- |
| `src/shape.ts` | 1 |
| `src/shape.test.ts` | 1, 5 |
| `src/audit.test.ts` | 1, 5 |
| `src/integration.ts` | 2, 3, 4 |
| `src/integration.test.ts` | 2, 3, 4 |
| `src/index.ts` | 2 |
| `src/data/open-chords.ts` | 5 |
| `src/data/caged-chords.ts` | 5 |
| `src/data/caged-chords-7th.ts` | 5 |
| `src/data/jazz-shells.ts` | 5 |
| `src/data/extended-chords.ts` | 5 |
| `src/data/caged-scales.ts` | 5 |
| `src/data/caged-scales-minor.ts` | 5 |
| `src/data/pentatonic.ts` | 5 |
| `src/data/pentatonic-minor.ts` | 5 |
| `src/data/three-nps.ts` | 5 |
| `src/data/data.test.ts` | 5 |
| `docs/api/shapes.md` | 6 |
| `docs/api/integration.md` | 4, 6 |
| `README.md` | 6 |
| `CHANGELOG.md` | 6 |
| `site/app/shapes/components/shapeLibraryUtils.ts` | 7, 8 |
| `site/app/shapes/components/FilterBar.tsx` | 9 |
| `site/app/shapes/components/ShapeCard.tsx` | 10 |
| `site/app/shapes/components/ShapeCardDiagram.tsx` | 10 |
| `site/app/shapes/components/ShapeCardChordTable.tsx` | 13 (relocated usage, no logic change) |
| `site/app/shapes/components/ShapeLibrary.tsx` | 14 |
| `site/app/shapes/components/LazyShapeCard.tsx` | 14 (verify compatibility with grouped rendering) |
| `site/package.json` | 15 |

## Technical Notes

### Dependency layers (CLAUDE.md)

- `scalesContainingChord` belongs only in `src/integration.ts` (optional `@tonaljs/scale` + `@tonaljs/chord` tier). It MUST NOT be imported by `src/audit.ts` or `src/transform.ts`, and MUST NOT be called at any `data/*` import time (CLAUDE.md §Dependency layers, spec §Library "Peer-dep boundary")
- `src/transform.ts`'s `chromaOf` is already imported into `src/integration.ts` (`src/integration.ts:27`) — reuse it for the containment sweep rather than reimplementing chroma math
- `site/app/shapes/components/shapeLibraryUtils.ts` and the new `shapeDetailUtils.ts` MUST import only from `"tonal-guitar"`, never `@tonaljs/*` directly (documented at `shapeLibraryUtils.ts:1-8`)

### Empty-result / error-handling convention

- Every new library function returns a sentinel (`{ chord: "", root: "", rootAnchored: [], otherRoots: [] }`) rather than throwing, matching `NoFrettedScale`'s pattern (`src/shape.ts:99-107`)
- `shapeDetailUtils.ts` helpers must degrade the same way (empty array/`undefined`, never throw) for every documented registry gap: missing `chordType`/`inversion` on base CAGED majors, empty alternate-fingering query, unresolvable scale name, unmapped `quality`, empty `identifyChord` result

### Deferred-computation idiom

- `ShapeCard.tsx`'s `ensureReportUrl` (`ShapeCard.tsx:54-57`) is the codebase's established "defer expensive computation until interaction" pattern — `ShapeDetailPanel.tsx` must follow the same idea via a single `useMemo` keyed on the selected entry, never computing Tonal context for all ~159 cards up front

### Monochrome theming

- `<Fretboard theme>` merges `intervalColors` shallowly with `defaultTheme.intervalColors` (`packages/fretboard-ui/src/Fretboard.tsx:105-115`); `resolveColor` (`Fretboard.tsx:73-82`) checks `marker.color` → `role` (`root`/`ghost`/`highlight`) → `theme.intervalColors[marker.interval]` → `theme.defaultMarker`. Since `ShapeCardDiagram`'s markers never set `role`, monochromizing requires overriding every key present in `defaultTheme.intervalColors` (`packages/fretboard-ui/src/theme.ts:16-31`) to the same single color — not just adding new keys

### URL state pattern

- Existing hydration-safe pattern: parse-on-mount behind `urlStateLoaded`, mirror-on-change via `history.replaceState` (`ShapeLibrary.tsx:51-77`) — the `shape` param and new facet state must follow this exact guard structure so the static-export first render still matches the parameter-free server HTML

### Registry query semantics

- `chordShapes.query({ chordType, system, voicingFamily, stringSet })` (`src/shape.ts:165-188`) has no `inversion` param — inversion grouping is client-side only (spec, research.md confirms)
- Not every registered chord shape has `chordType`/`inversion` populated (the 5 base CAGED majors in `src/data/caged-chords.ts` lack both) — every alternate-fingering/inversion helper must check for `undefined` and degrade rather than assume presence
