# Task Breakdown: Shape Visual Audit Library

## Overview

Total Tasks: 13 Task Groups

This feature adds a pure, vitest-covered audit module (`src/audit.ts`) that codifies six shape-quality invariant checks (previously test-only assertions scattered across `data.test.ts`/`extended-chords.test.ts`), re-exports it from the public API alongside a new `src/version.ts`, refactors `data/data.test.ts` to consume the exported checks as its single source of truth, and builds a public, read-only `/shapes` audit page in `site/` that renders all 27 scale + 132 chord shapes with failures-first triage badges and a prefilled "report problem" GitHub link. The feature touches both the library (`src/`) and the site (`site/`), plus `docs/api/` and `README.md`.

## Task List

### Module / Types Layer

#### Task Group 1: Audit module scaffold — types, constants, `displayRootFor`, `VERSION`

**Dependencies:** None

- [ ] 1.0 Create the `src/audit.ts` module shell with exported types/constants and the one fully-specified pure helper, plus `src/version.ts`, and wire the initial public re-exports
  - [ ] 1.1 Write focused tests for the scaffolding contract
    - `displayRootFor({ canonicalRoot: "C" })` → `"C"`; `displayRootFor({})` → `"C"`; `displayRootFor({ canonicalRoot: undefined })` → `"C"`
    - Type-only compile check: `AuditSeverity`, `ShapeAuditIssue`, `ShapeAuditOptions` are importable from `../audit` and from `../index`
    - `VERSION` exported from `../version` and re-exported from `../index` equals `"0.1.0"`
    - Create test file: `src/audit.test.ts` (this file grows across Groups 2–7; do not create a second test file)
  - [ ] 1.2 Create `src/audit.ts` with:
    - `export type AuditSeverity = "error" | "warning" | "info";`
    - `export interface ShapeAuditIssue { id: string; severity: AuditSeverity; message: string; details?: Record<string, unknown>; }`
    - `export interface ShapeAuditOptions { root?: string; tuning?: string[]; maxFretSpan?: number; }`
    - The six `CHECK_*` string-literal constants exactly as specified in spec §Core types (`CHECK_FRET_SPAN`, `CHECK_FINGER_ZERO_ON_MOVABLE`, `CHECK_REPEATED_FINGER_NO_BARRE`, `CHECK_BUILD_LOSS`, `CHECK_METADATA_COMPLETENESS`, `CHECK_GEOMETRY_MISMATCH`)
    - `export function displayRootFor(shape: { canonicalRoot?: string }): string { return shape.canonicalRoot ?? "C"; }`
    - Imports **only** `./build` (`applyChordShape`, `buildFrettedScale` — imported now even though unused until Group 2, to lock the import surface), `./shape` (types), `./tuning` (`STANDARD`) — no `./integration`, no `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key`
    - Leave the six `checkX` functions and the three aggregate functions as `// implemented in Task Group N` comments — do NOT stub-throw them (later groups append real implementations to this same file; avoid a throwing stub that would break Group 1's own build)
  - [ ] 1.3 Create `src/version.ts`:
    - `export const VERSION = "0.1.0";` with a one-line comment noting it must be bumped alongside `package.json`'s `version` field at release time (the package `exports` map only exposes `.`, so the site cannot `import` `package.json` directly)
    - Add the release-ritual note where it's visible: append "(also bump `src/version.ts` `VERSION`)" to the `npm run release` row in `CLAUDE.md`'s Commands table (spec: "Add a note to the release ritual to keep it in sync")
  - [ ] 1.4 Wire partial re-exports in `src/index.ts`
    - Add, after the Build-engine block (`export { buildFrettedScale, applyChordShape } from "./build";`): `export { VERSION } from "./version";` and `export { displayRootFor } from "./audit";` and `export type { AuditSeverity, ShapeAuditIssue, ShapeAuditOptions } from "./audit";`
    - Leave the `CHECK_*` constants and `checkX`/`auditX` function re-exports for Group 7 (once every check exists in the file, do a single clean export block rather than incrementally editing it 5 times)
  - [ ] 1.5 Ensure tests pass
    - Run ONLY the tests written in 1.1: `npx vitest run src/audit.test.ts`

**Acceptance Criteria:**

- `src/audit.ts`, `src/audit.test.ts`, `src/version.ts` exist; `npm run build` passes
- `displayRootFor`, `VERSION`, and the three audit types are importable from `src/index`
- `src/audit.ts`'s import list is exactly `./build`, `./shape`, `./tuning` (verified by inspection — no `./integration`, no optional Tonal peers)
- The tests written in 1.1 pass

---

### Core Logic Layer

> Groups 2–6 are independent — each appends a distinct, self-contained set of functions to `src/audit.ts` and adds fixture-backed tests to `src/audit.test.ts`. They share one file, so sequence the actual edits to avoid merge conflicts, but the underlying logic has no cross-dependencies beyond Group 1 and **can be implemented/dispatched in parallel**. Group 6 (the geometry-mismatch spike) is the highest-risk group per D-001 and gates all Lab/Site work — prioritize it if only one can go first.

#### Task Group 2: `checkFretSpan`

**Dependencies:** Task Group 1

- [ ] 2.0 Promote the `data.test.ts:477` open-string-excluding `maxSpan` variant into an exported check
  - [ ] 2.1 Write tests in `src/audit.test.ts`
    - `OPEN_C_MAJOR` (clean, baseFret 1) → `[]`
    - `OPEN_G_AUG` (10-fret span, known-bad #96) → one `error` issue, `id === CHECK_FRET_SPAN`, `details.span > 4`
    - `OPEN_G_M7B5` (8-fret span, known-bad #96) → one `error` issue
    - A shape with `span === maxSpan` exactly (boundary, not `>`) → `[]`
    - Custom `maxSpan` override via 4th arg changes the pass/fail boundary
  - [ ] 2.2 Implement in `src/audit.ts`:
    ```ts
    export function checkFretSpan(shape: ChordShape, root: string, tuning = STANDARD, maxSpan = 4): ShapeAuditIssue[]
    ```
    - Build via `applyChordShape(shape, root, tuning)`; `fretted = frets.filter(f => f !== null && f > 0)`; `span = fretted.length ? max - min : 0`
    - Emit `{ id: CHECK_FRET_SPAN, severity: "error", message, details: { span, frets, maxSpan } }` only when `span > maxSpan`
  - [ ] 2.3 Ensure tests pass: `npx vitest run src/audit.test.ts -t "checkFretSpan"`

**Acceptance Criteria:**

- `checkFretSpan` reproduces the `data.test.ts:474-508` regression exactly (same boundary semantics, excludes open strings)
- `OPEN_G_AUG` and `OPEN_G_M7B5` both produce a `CHECK_FRET_SPAN` error (live #96 fixtures)
- The tests written in 2.1 pass

---

#### Task Group 3: `checkFingerZeroOnMovable` + `checkRepeatedFingerNoBarre`

**Dependencies:** Task Group 1

- [ ] 3.0 Promote `data.test.ts:826-836` and `:839-855` into exported static checks
  - [ ] 3.1 Write tests in `src/audit.test.ts`
    - A movable shape (`canonicalRoot === undefined`) with `fingers` containing `0` → one `error` issue, `id === CHECK_FINGER_ZERO_ON_MOVABLE`, `details.fingers` present
    - A movable shape with no finger `0` → `[]`
    - An open shape (`canonicalRoot` set) with finger `0` → `[]` (the check is movable-only)
    - A shape with adjacent repeated fingers covered by a matching `barres` entry → `[]`
    - A shape with adjacent repeated fingers NOT covered by any `barres` entry → one (or one per pair) `error` issue, `id === CHECK_REPEATED_FINGER_NO_BARRE`, `details.finger` + `details.strings`
    - A shape with repeated finger `0` (open) or `null` on adjacent strings → `[]` (excluded per spec semantics)
  - [ ] 3.2 Implement in `src/audit.ts`:
    ```ts
    export function checkFingerZeroOnMovable(shape: ChordShape): ShapeAuditIssue[]
    export function checkRepeatedFingerNoBarre(shape: ChordShape): ShapeAuditIssue[]
    ```
    - Exact semantics per spec §3 checks 2–3 (`finger !== null && finger !== 0`, barre coverage test `b.finger === finger && i >= b.fromString && i+1 <= b.toString`)
  - [ ] 3.3 Ensure tests pass: `npx vitest run src/audit.test.ts -t "checkFingerZeroOnMovable|checkRepeatedFingerNoBarre"`

**Acceptance Criteria:**

- Both checks are static (no `applyChordShape` call) and pure
- Behavior matches the promoted `data.test.ts` assertions bit-for-bit against the full `chordShapes.all()` registry (all currently-registered shapes pass both checks — no new failures introduced)
- The tests written in 3.1 pass

---

#### Task Group 4: `checkChordBuildLoss` + `checkScaleBuildLoss`

**Dependencies:** Task Group 1

- [ ] 4.0 Author the build-loss checks (no prior reference implementation — mirrors `extended-chords.test.ts:128-129` reasoning)
  - [ ] 4.1 Write tests in `src/audit.test.ts`
    - A clean chord shape (e.g. `OPEN_C_MAJOR`) → `checkChordBuildLoss` returns `[]`
    - A synthetic fixture shape whose interval placement forces the fret window to drop a note (`builtCount < playedCount`) → one `error` issue, `id === CHECK_BUILD_LOSS`, `details.playedCount/builtCount/frets`
    - A clean scale shape (e.g. a CAGED major shape) → `checkScaleBuildLoss` returns `[]`
    - `buildFrettedScale` returning the `NoFrettedScale` sentinel (`empty: true`) for an unresolvable root/shape combination → one `error` issue
    - A scale shape with a `null` string entry → confirm slot counting skips it (no false positive)
  - [ ] 4.2 Implement in `src/audit.ts`:
    ```ts
    export function checkChordBuildLoss(shape: ChordShape, root: string, tuning = STANDARD): ShapeAuditIssue[]
    export function checkScaleBuildLoss(shape: ScaleShape, root: string, tuning = STANDARD): ShapeAuditIssue[]
    ```
    - Chord: `playedCount = shape.strings.filter(s => s != null).length`; `builtCount = frets.filter(f => f != null).length` via `applyChordShape`
    - Scale: `empty === true` sentinel ⇒ emit; else `slotCount = sum of strings[i].length over non-null entries` vs `builtCount = result.notes.length` via `buildFrettedScale`
  - [ ] 4.3 Ensure tests pass: `npx vitest run src/audit.test.ts -t "BuildLoss"`

**Acceptance Criteria:**

- Both checks are `severity: "error"` and match spec §3 check 4 semantics exactly
- No registered shape (27 scale + 132 chord) produces a false-positive build-loss error at its `displayRootFor` root — confirmed by a registry-wide smoke assertion in the test
- The tests written in 4.1 pass

---

#### Task Group 5: `checkChordMetadataCompleteness` + `checkScaleMetadataCompleteness`

**Dependencies:** Task Group 1

- [ ] 5.0 Author the metadata-completeness checks pinned against actual data (spec §3 check 5)
  - [ ] 5.1 Write tests in `src/audit.test.ts`
    - A `caged-chords.ts` base shape (e.g. `CAGED_CHORD_E`, which lacks both `chordType` and `voicingFamily`) → one `warning` issue, `details.missing` includes both fields
    - `OPEN_C_MAJOR` (has both `chordType` and `voicingFamily`) → `[]`
    - A shape with only `chordType` missing → `details.missing === ["chordType"]`
    - A base scale shape (e.g. `"G Shape"`, no `quality`/`parentShape`) → `[]`
    - A derived scale shape (e.g. from `caged-scales-minor.ts` or `pentatonic-minor.ts`, both `quality` and `parentShape` set) → `[]`
    - A synthetic fixture with `quality` set but `parentShape` stripped (both-or-neither violation) → one `warning` issue, `details.quality` present, `details.parentShape` undefined
  - [ ] 5.2 Implement in `src/audit.ts`:
    ```ts
    export function checkChordMetadataCompleteness(shape: ChordShape): ShapeAuditIssue[]
    export function checkScaleMetadataCompleteness(shape: ScaleShape): ShapeAuditIssue[]
    ```
    - Chord: warn when `chordType` missing OR `voicingFamily` missing; do NOT require `stringSet`/`canonicalRoot`/`baseFret`
    - Scale: warn when exactly one of `quality`/`parentShape` is present (XOR)
  - [ ] 5.3 Ensure tests pass: `npx vitest run src/audit.test.ts -t "MetadataCompleteness"`

**Acceptance Criteria:**

- Both checks are `severity: "warning"`
- The 5 base `caged-chords.ts` majors intentionally produce warnings (documented as legitimately-incomplete, not a bug)
- All 10 `relabelShape`-derived scale entries (`caged-scales-minor.ts` + `pentatonic-minor.ts`) pass `checkScaleMetadataCompleteness` cleanly
- The tests written in 5.1 pass

---

#### Task Group 6: `checkGeometryMismatch` spike — build-vs-source geometry (D-001 mitigation, **critical path**)

**Dependencies:** Task Group 1

> This is the pre-UI spike the spec requires (spec §"Early spike"). It MUST be completed and validated before any Lab/Site task group (9–11) begins — reflected in the Execution Order and in Group 9's dependency below.

- [ ] 6.0 Author `gripRootFor`, `sourceFrets`, and `checkGeometryMismatch`, and validate the build-vs-source comparison against representative fixtures BEFORE any site work starts
  - [ ] 6.1 Write a temporary spike test file `src/audit.spike.test.ts` validating, per shape:
    - `OPEN_C_MAJOR` (canonical open, baseFret 1): `sourceFrets` reproduces `baseFret` as the minimum fretted (>0) fret; built frets equal source frets (no mismatch)
    - `OPEN_C_MINOR` (baseFret 3, no `canonicalRoot` — grip root parsed from `"C Minor Open"`): built equals source, `[]`
    - `OPEN_G_AUG` (#96 known-bad): built diverges from source on at least one string — mismatch emitted
    - `OPEN_G_M7B5` (#96 known-bad): built diverges from source — mismatch emitted
    - One jazz shell (e.g. `"Shell maj7 R37 012"` from `SHELL_SHAPES`, no `baseFret`): `checkGeometryMismatch` returns `[]` (skipped, not evaluated as clean)
    - One extended E-form (`EXT_CHORD_E_6`, `"E Shape 6"`, no `baseFret`): `[]` (skipped)
    - One extended A-form (`EXT_CHORD_A_6`, `"A Shape 6"`, no `baseFret`): `[]` (skipped)
    - `gripRootFor` unit cases: `{ canonicalRoot: "G" }` → `"G"`; `{ name: "G m7b5 Open" }` → `"G"`; `{ name: "C Minor Open" }` → `"C"`; a shape with neither `canonicalRoot` nor a parseable leading root token → `undefined`
  - [ ] 6.2 Implement in `src/audit.ts`:
    - Internal `gripRootFor(shape: ChordShape): string | undefined` — `shape.canonicalRoot ?? parseRootFromName(shape.name)`, `parseRootFromName` matching `/^[A-G](#|b)?/` against the leading token
    - Internal `sourceFrets(shape: ChordShape, gr: string, tuning = STANDARD): (number | null)[]` — per string: `null` if `strings[i] == null`; `0` if `fingers[i] === 0`; else `raw = (((chroma(transpose(gr, strings[i])) - chroma(tuning[i])) % 12) + 12) % 12`, then `let f = raw; while (f < shape.baseFret) f += 12;`
    - `export function checkGeometryMismatch(shape: ChordShape, tuning = STANDARD): ShapeAuditIssue[]` — no-op (`[]`) when `shape.baseFret == null`; else compute `gr = gripRootFor(shape)` (no-op if `undefined`), `builtFrets` via `applyChordShape(shape, gr, tuning).frets`, `srcFrets = sourceFrets(shape, gr, tuning)`; emit `severity: "warning"` when built and source differ on any non-muted string, `details: { gripRoot, builtFrets, sourceFrets, mismatchedStrings }`
  - [ ] 6.3 If any well-formed shape (all `open-chords.ts` entries except the known-bad #96 pair) falsely mismatches, tune the lift rule (`while (f < shape.baseFret) f += 12`) and re-run until (a)–(d) from spec §"Early spike" all hold
  - [ ] 6.4 Fold the validated spike assertions into `src/audit.test.ts` (move or duplicate the fixture cases) and delete `src/audit.spike.test.ts`
  - [ ] 6.5 Ensure tests pass: `npx vitest run src/audit.test.ts -t "checkGeometryMismatch|gripRootFor|sourceFrets"`

**Acceptance Criteria:**

- `checkGeometryMismatch` returns `[]` for all shell/extended shapes (no `baseFret`) — confirmed via a registry-wide loop, not just the 3 named fixtures
- Built frets equal source frets for every well-formed `open-chords.ts` shape (all 70 minus the 2 known-#96-bad) — confirmed via a registry-wide loop over `chordShapes.all()` filtered to `baseFret != null`, asserting `mismatchedStrings.length === 0`
- `OPEN_G_AUG` and `OPEN_G_M7B5` both produce a mismatch — the check demonstrably catches the live #96 defect class
- `src/audit.spike.test.ts` no longer exists at the end of this task (folded into `src/audit.test.ts`)
- No Lab/Site task group (9, 10, 11) may begin implementation until this group's acceptance criteria are met

---

### Integration Layer

#### Task Group 7: Aggregate helpers + finalize public API surface

**Dependencies:** Task Groups 2, 3, 4, 5, 6

- [ ] 7.0 Wire `auditChordShape`, `auditScaleShape`, `auditAllShapes` and finalize `src/index.ts`
  - [ ] 7.1 Write tests in `src/audit.test.ts`
    - `auditChordShape(OPEN_G_AUG)` returns issues from checks 1 and 6 combined (fret-span error + geometry-mismatch warning), using `displayRootFor` as the default root
    - `auditChordShape(shape, { root: "D" })` overrides the default root
    - `auditScaleShape(shape)` runs only build-loss + metadata-completeness (never fret-span/finger/geometry checks — those are chord-only)
    - `auditAllShapes()` returns `{ chord: Map, scale: Map }` keyed by `shape.name`, with `chord.size === chordShapes.all().length` and `scale.size === all().length` (27 and 132 respectively at time of writing — assert via `.length`, not hardcoded literals, so the test doesn't rot as data grows)
    - `auditAllShapes()` — spot-check `chord.get("G Augmented Open")` and `chord.get("G m7b5 Open")` both contain at least one `error`-severity issue (regression guard for #96 staying visible)
  - [ ] 7.2 Implement in `src/audit.ts`:
    ```ts
    export function auditChordShape(shape: ChordShape, options: ShapeAuditOptions = {}): ShapeAuditIssue[]
    export function auditScaleShape(shape: ScaleShape, options: ShapeAuditOptions = {}): ShapeAuditIssue[]
    export function auditAllShapes(options: ShapeAuditOptions = {}): { chord: Map<string, ShapeAuditIssue[]>; scale: Map<string, ShapeAuditIssue[]> }
    ```
    - `auditChordShape` runs checks 1–6 with `root = options.root ?? displayRootFor(shape)`, `tuning = options.tuning ?? STANDARD`, `maxFretSpan` piped into `checkFretSpan`
    - `auditScaleShape` runs `checkScaleBuildLoss` + `checkScaleMetadataCompleteness` only
    - `auditAllShapes` iterates `chordShapes.all()` / `all()` (import `chordShapes`, `all` from `./shape`)
  - [ ] 7.3 Finalize `src/index.ts` re-exports (replace the placeholder block from Group 1's task 1.4 with the complete set):
    - `export { auditChordShape, auditScaleShape, auditAllShapes, displayRootFor, checkFretSpan, checkFingerZeroOnMovable, checkRepeatedFingerNoBarre, checkChordBuildLoss, checkScaleBuildLoss, checkChordMetadataCompleteness, checkScaleMetadataCompleteness, checkGeometryMismatch, CHECK_FRET_SPAN, CHECK_FINGER_ZERO_ON_MOVABLE, CHECK_REPEATED_FINGER_NO_BARRE, CHECK_BUILD_LOSS, CHECK_METADATA_COMPLETENESS, CHECK_GEOMETRY_MISMATCH } from "./audit";`
    - Placed immediately after the Build-engine export block, preserving existing ordering elsewhere
  - [ ] 7.4 Ensure tests pass + full build: `npx vitest run src/audit.test.ts && npm run build`

**Acceptance Criteria:**

- All six `checkX` functions, all six `CHECK_*` constants, the three aggregate functions, `displayRootFor`, and the three types are importable from `tonal-guitar` (`src/index.ts`)
- `npm run build` passes, including `scripts/check-dts.mjs`
- `auditAllShapes()` never throws for the full registry
- The tests written in 7.1 pass

---

#### Task Group 8: `data.test.ts` refactor — single source of truth

**Dependencies:** Task Groups 2, 3 (needs `checkFretSpan`, `checkFingerZeroOnMovable`, `checkRepeatedFingerNoBarre`); recommended after Group 7 lands so the import path is stable, but can technically import directly from `../audit`

- [ ] 8.0 Replace the inline reference implementations in `src/data/data.test.ts` with calls to the exported audit functions, per spec §"`data.test.ts` refactor"
  - [ ] 8.1 Write/update tests in `src/data/data.test.ts`
    - Replace the `describe("aug shape fret span stays playable (issue #94)")` block (`:474-508`): each `it` now calls `checkFretSpan(shape, root)` and asserts `.toEqual([])` instead of computing `maxSpan` inline
    - Replace the `describe("chord-shape fingering/barre invariants (issue #39 audit)")` block (`:825-857`): iterate `chordShapes.all()` and assert `checkFingerZeroOnMovable(s)` and `checkRepeatedFingerNoBarre(s)` each return `[]`
    - Add an explicit `KNOWN_ISSUES` allowlist (`["G Augmented Open", "G m7b5 Open"]`) referencing #96, and assert the registry-wide fret-span sweep is `[]` for every shape NOT in the allowlist — do **not** add a blanket zero-errors gate that would fail CI while #96 is open
  - [ ] 8.2 Delete the inline `maxSpan` helper (`:477-480`) once nothing else in the file references it; keep it only if a grep shows another consumer
  - [ ] 8.3 Import `checkFretSpan`, `checkFingerZeroOnMovable`, `checkRepeatedFingerNoBarre` from `../audit` at the top of `src/data/data.test.ts`
  - [ ] 8.4 Ensure tests pass: `npx vitest run src/data/data.test.ts`

**Acceptance Criteria:**

- `src/data/data.test.ts` no longer contains an inline reimplementation of any of the three promoted checks
- CI stays green: the `KNOWN_ISSUES` allowlist keeps `OPEN_G_AUG`/`OPEN_G_M7B5` from failing the registry-wide fret-span sweep until `/fix` lands (per spec — no weakening the check itself)
- The tests written in 8.1 pass
- `npm test` shows no regression in total test count beyond the intentional refactor (inline assertions replaced 1:1 or expanded, never silently dropped)

---

### Lab / Site Layer

> Groups 9–11 may not begin until Task Group 6 (the geometry-mismatch spike) is complete and validated (D-001 / spec constraint). No test infrastructure exists in `site/` — verification is manual (`npm run dev` + `npm run build` + `DEPLOY=true npm run build`), per connector-lab-integration Decision D-006 precedent.

#### Task Group 9: `shapeLibraryUtils.ts` — pure catalog/filter/sort/report helpers

**Dependencies:** Task Group 7 (full audit public API), Task Group 6 (validated geometry-mismatch spike)

- [ ] 9.0 Implement the pure helper module the rest of the site layer consumes
  - [ ] 9.1 Create `site/app/shapes/components/shapeLibraryUtils.ts`:
    - `type ShapeKind = "scale" | "chord"`
    - `interface ShapeCatalogEntry { kind, name, shape, index, renderRoot, frettedScale, builtFrets, sourceFrets?, issues }` per spec §"shapeLibraryUtils.ts pure helpers"
    - `chordFingeringToFrettedScale(shape, root, tuning = STANDARD): FrettedScale` — wraps `applyChordShape(...).positions` as a `FrettedScale`-shaped object (`empty`, `root`, `scaleType: ""`, `scaleName: ""`, `shapeName`, `tuning`, `notes`)
    - `buildCatalog(auditResult: ReturnType<typeof auditAllShapes>): ShapeCatalogEntry[]` — one entry per registered shape (scale via `all()`, chord via `chordShapes.all()`); `renderRoot = displayRootFor(shape)`; scale entries build via `buildFrettedScale`, chord entries via `chordFingeringToFrettedScale` + `builtFrets` from `applyChordShape(...).frets`; `sourceFrets` + `gripRoot` computed locally for **every** chord shape with `baseFret != null` by re-deriving the pure `gripRootFor`/`sourceFrets` math from spec §check 6 (those helpers are internal to `src/audit.ts`, deliberately not exported — do NOT derive `sourceFrets` from the `CHECK_GEOMETRY_MISMATCH` issue's `details`, which are only populated when a mismatch fires; the spec requires the source-frets row on ALL `baseFret` cards, not just mismatching ones). Use the `CHECK_GEOMETRY_MISMATCH` issue's `details.mismatchedStrings` only to drive the mismatch-highlight state; `issues` pulled from `auditResult.chord`/`.scale` maps by name; `index` = registry insertion order
    - `filterCatalog(entries, filters): ShapeCatalogEntry[]` — type, system, voicingFamily/quality, case-insensitive name substring, optional failing-only
    - `sortFailuresFirst(entries): ShapeCatalogEntry[]` — `rank = hasError ? 0 : hasWarning ? 1 : 2`, sort by `rank` asc then `entry.index` asc
    - `distinctSystems(entries)`, `distinctVoicingFamilies(entries)`, `distinctQualities(entries)` — derived, never hardcoded
    - `buildReportUrl(entry): string` per spec §"Site: Report-problem flow" (title/body construction, `REPO = "TheGuitarStudio/tonal-guitar"`, `encodeURIComponent` both parts)
    - Re-export `displayRootFor` from `tonal-guitar`
  - [ ] 9.2 Manual smoke verification (no site test infra — D-006 precedent): a scratch script or temporary `console.log` in `npm run dev` confirming `buildCatalog(auditAllShapes())` produces 159 entries (27 scale + 132 chord) with no thrown exceptions, and `OPEN_G_AUG`/`OPEN_G_M7B5` entries carry `error`-severity issues
  - [ ] 9.3 Remove any temporary debug logging added in 9.2 before moving to Group 10

**Acceptance Criteria:**

- `shapeLibraryUtils.ts` is pure (no React, no `"use client"`) and imports only from `tonal-guitar` and its own types
- `buildCatalog` never throws for any of the 159 currently-registered shapes
- `sortFailuresFirst` is stable on `index` for equal-rank entries
- `buildReportUrl`'s `REPO` constant is `"TheGuitarStudio/tonal-guitar"` (matches `package.json`'s `repository.url`), not the stale `coryleistikow/tonal-guitar` value found in `layout.config.tsx`

---

#### Task Group 10: `FilterBar`, `ShapeCardDiagram`, `ShapeCard` components

**Dependencies:** Task Group 9

- [ ] 10.0 Build the presentational components consumed by the page-level container
  - [ ] 10.1 Create `site/app/shapes/components/ShapeCardDiagram.tsx`
    - `"use client"`; trimmed, controls-less adapter (NOT the full `FretboardDiagram`) — no per-instance `useState`
    - Reuse the `FrettedNote[] → FretMarker[]` mapping from `site/app/experiments/components/FretboardDiagram.tsx:63-82`
    - Fixed `labelMode="intervals"`, `orientation="horizontal"`; `fretRange = [Math.max(0, minFret-1), maxFret+1]` derived from the entry's notes
    - If `frettedScale.notes.length === 0`: render `"Failed to build at {renderRoot}"` placeholder text instead of `<Fretboard>`
    - Reuse the `LEGEND` from `FretboardDiagram.tsx` as a single page-level legend (rendered once in `ShapeLibrary`, Group 11), NOT per-card — 159 repeated legends would be noise
  - [ ] 10.2 Create `site/app/shapes/components/FilterBar.tsx`
    - `"use client"`; reuse the `ToggleGroup` pattern from `FretboardDiagram.tsx:165-194` for the scale/chord type toggle
    - System dropdown, voicingFamily/quality dropdown (options from `distinctSystems`/`distinctVoicingFamilies`/`distinctQualities`, "All" default), name search text input, "Failing only" checkbox, live "Showing N of M" count
    - Switching the type toggle resets system/family/quality filter state (owned by the parent — `FilterBar` receives filter state + setters as props)
  - [ ] 10.3 Create `site/app/shapes/components/ShapeCard.tsx`
    - `"use client"`, wrapped in `React.memo`
    - Header (`name`, kind badge, `system`), `<ShapeCardDiagram>`, `"Rendered at {renderRoot}"` caption
    - Badge strip: one badge per `issue`, errors before warnings (red `bg-red-500/10 text-red-600 border border-red-500/40`, amber `bg-amber-500/10 text-amber-600 border border-amber-500/40`); badge label = `issue.id`, `title` = `issue.message`; a muted "OK" indicator when `issues.length === 0`
    - Properties list (omit undefined): `system`, `voicingFamily`/`quality`, `chordType`, `inversion`, `canonicalRoot`, `baseFret`, `rootString`, `stringSet`, `parentShape`
    - Fingers/barres table (chord only): one column per string index; `"x"` for muted, `"0"` for open (`fingers[i] === 0`), blank for `fingers[i] === null`; `barres` listed below as `"finger N: frets fromString–toString @ fret F"`
    - Source-frets row (chord with `baseFret`): `builtFrets` vs `sourceFrets` side by side, mismatched cells highlighted, labeled `"(source at {gripRoot})"` when the geometry-mismatch issue's `details.gripRoot !== renderRoot`
    - Report-problem link: `<a href={buildReportUrl(entry)} target="_blank" rel="noopener">`
    - Card wrapper uses CSS `content-visibility: auto` + `contain-intrinsic-size` (approx card height) — inline style or Tailwind arbitrary properties, no new deps
    - Card = `rounded-lg border border-fd-border p-4` per Visual Design
  - [ ] 10.4 Manual verification: render a hand-picked subset (`OPEN_C_MAJOR`, `OPEN_C_MINOR`, `OPEN_G_AUG`, a shell, an extended E/A-form) via a throwaway harness in `npm run dev` (temporarily mounted in `page.tsx` from Group 11, or a scratch route) to confirm no crashes and correct badge/table rendering before wiring the full grid

**Acceptance Criteria:**

- `ShapeCardDiagram` never mounts `<Fretboard>` when `notes.length === 0`; shows the failure placeholder instead
- `ShapeCard` is `React.memo`'d and renders the fingers/barres table only for `kind === "chord"`
- Badge colors/ordering match Visual Design exactly (errors before warnings)
- No `NODE_ENV` gating anywhere in these components (anti-pattern from `site/app/admin/page.tsx:9-11`)

---

#### Task Group 11: `ShapeLibrary` container + page/layout scaffold + nav link

**Dependencies:** Task Group 10

- [ ] 11.0 Assemble the page, wire navigation, and verify under both build modes
  - [ ] 11.1 Create `site/app/shapes/components/ShapeLibrary.tsx`
    - `"use client"`; owns all filter state (`type`, `system`, `voicingFamily`/`quality`, `name search`, `failingOnly`)
    - `const auditResult = useMemo(() => auditAllShapes(), []);` — runs exactly once
    - `const catalog = useMemo(() => buildCatalog(auditResult), [auditResult]);`
    - Applies `filterCatalog` then `sortFailuresFirst` (always applied after filtering, per D-004) via `useMemo` keyed on filter state + catalog
    - Renders `<FilterBar>`, the single page-level interval `LEGEND` (from Group 10's `ShapeCardDiagram` note), + a responsive grid `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4` of `<ShapeCard>`; empty-filtered-result → `"No shapes"` message
  - [ ] 11.2 Create `site/app/shapes/layout.tsx` — copy the `experiments/layout.tsx` convention: `<HomeLayout {...baseOptions}>{children}</HomeLayout>`
  - [ ] 11.3 Create `site/app/shapes/page.tsx` — server component: `metadata = { title: "Shape Library - Tonal" }`; renders `<ShapeLibrary />` inside `<main className="container mx-auto max-w-5xl px-4 py-8">` with a header block (`h1` + description), following `experiments/page.tsx`'s shape — NOT `admin/page.tsx`'s `NODE_ENV` gate
  - [ ] 11.4 Update `site/app/layout.config.tsx`:
    - Add `{ text: "Shapes", icon: <LayoutGridIcon />, url: "/shapes" }` to the `links` array (import `LayoutGridIcon` from `lucide-react`, already a site dependency)
    - Correct the stale `"Repository"` link's `url` from `https://github.com/coryleistikow/tonal-guitar` to `https://github.com/TheGuitarStudio/tonal-guitar` (matches `package.json`'s `repository.url` and the `REPO` constant from Group 9) — align both per spec §"Site: Report-problem flow"
  - [ ] 11.5 Manual verification (no site test infra — D-006 precedent):
    - `cd site && npm run dev` — navigate to `/shapes`, confirm all filters work, failures-first sort surfaces `OPEN_G_AUG`/`OPEN_G_M7B5` at the top of the default chord view, report-problem links open a correctly-prefilled `github.com/TheGuitarStudio/tonal-guitar/issues/new` URL
    - `cd site && npm run build` (static export) succeeds
    - `cd site && DEPLOY=true npm run build` succeeds with `basePath: "/tonal-guitar"` applied; confirm the nav "Shapes" link and internal navigation still resolve, and the report-problem link (absolute `github.com` URL) is unaffected by `basePath`

**Acceptance Criteria:**

- `/shapes` is reachable from every `HomeLayout` page's nav (no `NODE_ENV` gating, unlike `/admin`)
- Default view: type = chord, failures-first sort, `OPEN_G_AUG`/`OPEN_G_M7B5` visible without scrolling
- Shape counts in the "Showing N of M" readout are computed live from `chordShapes.all().length`/`all().length`, never hardcoded
- Both `npm run build` and `DEPLOY=true npm run build` succeed in `site/`
- The site consumes `issue.id`/`issue.severity` exclusively for branching — no `message`-string parsing anywhere in the new components

---

### Docs Layer

#### Task Group 12: `docs/api/audit.md` + README mention

**Dependencies:** Task Group 7 (public API finalized)

- [ ] 12.0 Document the new public surface
  - [ ] 12.1 Create `docs/api/audit.md` following the style of `docs/api/transform.md`/`docs/api/shapes.md`:
    - Frontmatter (`title: Audit`, `description`)
    - Document `AuditSeverity`, `ShapeAuditIssue`, `ShapeAuditOptions`
    - Document each of the six checks: signature, precise semantics, fixed severity, one worked example (mirror the `OPEN_G_AUG`/#96 case as it's the most illustrative)
    - Document `displayRootFor`, `auditChordShape`, `auditScaleShape`, `auditAllShapes`
    - Note the `data.test.ts` single-source-of-truth relationship and the `/shapes` site page as the primary consumer
  - [ ] 12.2 Update `README.md`: add one line under the API/features list linking to `docs/api/audit.md` and the deployed `/shapes` page — no deep API dump (per spec, explicitly out of scope for README)
  - [ ] 12.3 Confirm the docs render: `cd site && npm run dev`, open `/docs`, verify the new Audit page appears in the API nav

**Acceptance Criteria:**

- `docs/api/audit.md` covers every exported type, constant, check, and aggregate helper from `src/audit.ts`
- `README.md` gains exactly one new line/reference — no restructuring of existing sections
- The new docs page renders without a broken link in the Fumadocs site nav

---

### Testing Layer

#### Task Group 13: Test review and gap analysis

**Dependencies:** All earlier task groups

- [ ] 13.0 Review coverage against the spec's Quality Criteria and fill critical gaps only
  - [ ] 13.1 Audit `src/audit.test.ts` against spec §"Quality Criteria": every check has a fixed severity, fully specified semantics, and a fixture-backed test; confirm the geometry-mismatch spike's acceptance criteria (registry-wide loops, not just named fixtures) are present in the final (non-spike) test file
  - [ ] 13.2 Identify gaps: edge cases from spec §"Quality Criteria" not yet covered — e.g. empty filtered result set (site, manual check only), `buildFrettedScale`/`applyChordShape` sentinel-returning inputs, scale shapes with `null` string entries in slot counting, muted/open/blank finger rendering in the table (covered in Group 10's manual check, not vitest — confirm no gap was silently left untested where vitest coverage IS feasible, e.g. the build-loss sentinel path)
  - [ ] 13.3 Write up to 8 additional strategic tests maximum in `src/audit.test.ts` or `src/data/data.test.ts` to close any gap found in 13.2
  - [ ] 13.4 Run feature-specific tests + full suite
    - `npx vitest run src/audit.test.ts`
    - `npx vitest run src/data/data.test.ts`
    - `npm test` — confirm no regressions in the pre-existing ~922-test suite
    - `npm run build` — confirm `tsup` + `check-dts.mjs` still pass with the new exports
    - `npm run lint` — confirm `src/audit.ts` and `src/version.ts` are clean

**Acceptance Criteria:**

- All spec §"Quality Criteria" bullets are demonstrably satisfied (cross-reference each bullet against a specific test or manual-verification note)
- `npm test` passes with no regressions; no unrelated test files are modified beyond `src/data/data.test.ts` (Group 8) and `src/audit.test.ts`
- `npm run build` and `npm run lint` both pass

---

## Execution Order

1. **Task Group 1** — Module/Types scaffold (`src/audit.ts`, `src/version.ts`, partial `index.ts`) — foundation for everything downstream
2. **Task Groups 2, 3, 4, 5, 6 — run in parallel** — each appends an independent set of checks to `src/audit.ts` / tests to `src/audit.test.ts`. **Prioritize Group 6 (geometry-mismatch spike)** since it gates all Lab/Site work regardless of the other four groups' completion.
3. **Task Group 7** — Integration: aggregate helpers + finalize `index.ts` exports (needs 2–6 complete)
4. **Task Group 8** — `data.test.ts` refactor (needs Groups 2, 3; can run in parallel with Groups 4–7 once 2 and 3 land)
5. **Task Group 9** — `shapeLibraryUtils.ts` (needs Group 7 AND Group 6's spike validated — hard gate per D-001)
6. **Task Group 10** — `FilterBar` / `ShapeCardDiagram` / `ShapeCard` (needs Group 9)
7. **Task Group 11** — `ShapeLibrary` container + page/layout/nav (needs Group 10)
8. **Task Group 12** — Docs (`docs/api/audit.md` + README) — needs Group 7; can run in parallel with Groups 9–11
9. **Task Group 13** — Final test review and gap analysis (needs everything)

**Parallelizable clusters:**
- Groups 2, 3, 4, 5, 6 (Core Logic) — fully independent of each other, all depend only on Group 1
- Group 8 (`data.test.ts` refactor) can run alongside Groups 4–7 once Groups 2 and 3 land
- Group 12 (Docs) can run alongside Groups 9–11 once Group 7 lands

**Hard sequencing constraint (spec-mandated):** No Lab/Site task group (9, 10, 11) may begin until Task Group 6's geometry-mismatch spike is validated and folded into `src/audit.test.ts` — this is the D-001 mitigation and the single biggest risk identified in research.

## Files to Create

| File Path | Task |
| --- | --- |
| `src/audit.ts` | 1, 2, 3, 4, 5, 6, 7 |
| `src/audit.test.ts` | 1, 2, 3, 4, 5, 6, 7, 13 |
| `src/audit.spike.test.ts` (temporary — deleted in 6.4) | 6 |
| `src/version.ts` | 1 |
| `docs/api/audit.md` | 12 |
| `site/app/shapes/layout.tsx` | 11 |
| `site/app/shapes/page.tsx` | 11 |
| `site/app/shapes/components/ShapeLibrary.tsx` | 11 |
| `site/app/shapes/components/ShapeCard.tsx` | 10 |
| `site/app/shapes/components/ShapeCardDiagram.tsx` | 10 |
| `site/app/shapes/components/FilterBar.tsx` | 10 |
| `site/app/shapes/components/shapeLibraryUtils.ts` | 9 |

## Files to Modify

| File Path | Task |
| --- | --- |
| `src/index.ts` | 1, 7 |
| `CLAUDE.md` | 1 |
| `src/data/data.test.ts` | 8 |
| `site/app/layout.config.tsx` | 11 |
| `README.md` | 12 |

## Technical Notes

### Dependency-layer discipline (CLAUDE.md §Dependency layers)

- `src/audit.ts` sits in the **required-peer-deps tier** alongside `src/build.ts`, `src/fretboard.ts`, `src/transform.ts`. It imports only `./build`, `./shape`, `./tuning`, and may reach `@tonaljs/note`/`@tonaljs/interval` if needed by `sourceFrets` (chroma/transpose arithmetic) — it MUST NOT import `./integration` or reference `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key`. Verify by inspecting the top-of-file import list after every group that touches `src/audit.ts` (Groups 1–7).
- Internal dependency order addition: `audit.ts ← build, shape, tuning` slots directly under `build.ts` in the CLAUDE.md dependency-order list; `index.ts` continues to sit at the bottom, re-exporting everything.

### Empty-result / sentinel conventions (CLAUDE.md §Design conventions)

- All six checks return `[]` (never throw) when the check doesn't apply or nothing is wrong — mirrors the project's `NoFrettedScale`-sentinel convention rather than exceptions.
- `checkChordBuildLoss`/`checkScaleBuildLoss` explicitly handle the `NoFrettedScale` sentinel (`empty: true`) from `buildFrettedScale` (`src/build.ts:180-264,254-263`, `src/shape.ts:99-107`).

### Registry iteration patterns

- Scale registry has no `query()` — filter `all()` client-side (see `src/shape.ts:120-122`); chord registry has `chordShapes.query({ chordType?, system?, voicingFamily?, stringSet? })` (`src/shape.ts:165-188`) but `auditAllShapes` should iterate `chordShapes.all()`/`all()` directly (full sweep), not `query()`.
- `chordShapes.all()` returns 132 shapes; `all()` (scale) returns 27 — both counted live via `.length`, never hardcoded in tests or site copy (spec §Quality Criteria).

### Existing test code being promoted (do not duplicate logic)

- `src/data/data.test.ts:474-508` → `checkFretSpan` (Group 2)
- `src/data/data.test.ts:825-857` → `checkFingerZeroOnMovable` / `checkRepeatedFingerNoBarre` (Group 3)
- `src/data/extended-chords.test.ts:121-148` (`assertBuildsPlayable`) → informs `checkChordBuildLoss` (Group 4); do not modify `extended-chords.test.ts` itself, it stays as its own independent build-equivalence suite

### `open-chords.ts` `baseFret` semantics (Group 6 spike reference)

- `src/data/open-chords.ts:1-29` documents chords-db's `absFret = baseFret === 1 ? frets[i] : frets[i] + (baseFret - 1)` convention — the spec's `sourceFrets` lift rule (`while (f < shape.baseFret) f += 12`) is a from-scratch chroma-based reconstruction of this same intent, not a literal port; validate both agree on `OPEN_C_MINOR` (`baseFret: 3`, no `canonicalRoot`, name `"C Minor Open"`).
- `OPEN_G_AUG` (`src/data/open-chords.ts:562-575`) and `OPEN_G_M7B5` (`:619-631`) are the live #96 fixtures every spike/test group must exercise.

### Site conventions to reuse (never copy the admin anti-pattern)

- `site/app/experiments/components/FretboardDiagram.tsx:63-82` — `FrettedNote[] → FretMarker[]` mapping to reuse in `ShapeCardDiagram`; `:165-194` — `ToggleGroup` component to reuse in `FilterBar`.
- `site/app/experiments/layout.tsx` / `page.tsx` — the page/layout scaffold convention for `site/app/shapes/`.
- `site/app/admin/page.tsx:8-11` — the `NODE_ENV === "production"` → `notFound()` gate. **Do not replicate this anywhere in `site/app/shapes/`** — the page must be public in every build.
- `site/app/layout.config.tsx:22` — currently links to the stale `coryleistikow/tonal-guitar` repo; `package.json:82` confirms the correct slug is `TheGuitarStudio/tonal-guitar`, matching the `REPO` constant Group 9 must use in `buildReportUrl`.
- `site/next.config.mjs:6-14` — `output: "export"`, `basePath` only under `DEPLOY=true`, `transpilePackages: ["fretboard-ui"]`; the new page must work under both build modes with zero server routes.
