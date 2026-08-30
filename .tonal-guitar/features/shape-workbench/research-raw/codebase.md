# Research Findings: Shape Workbench (Codebase)

## Key discovery up front

A **fully-formed design proposal already exists** and matches the live codebase closely: `canvas-content.txt` (`Proposal.dc.html` section) contains a complete data-model spec, phasing plan, export-format spec, and architecture rationale. Every claim in it was verified against the actual code — it is accurate and should be treated as the authoritative design starting point, not just a mockup.

Also critical: **`packages/fretboard-ui` already exists** as a working, unbuilt (raw-TS) React package consumed by both the docs Shape Library (`site/app/shapes/*`) and an existing (partial) `/admin` shape editor (`site/app/admin/*`). The "shared UI" goal is therefore already ~60% real — it's an extraction/completion job, not a from-scratch build.

---

## 1. Types and data (`src/shape.ts`, `src/fretboard.ts`, `src/data/*`)

**`src/shape.ts`** (203 lines) defines everything:
- `ScaleShape` (`shape.ts:22-36`): `name, system, strings, rootString, span?, quality?, parentShape?, featured?`. No `chordType` yet.
- `ChordShape` (`shape.ts:51-73`): `name, system, strings, fingers, barres, rootString`, plus optional `chordType, inversion, voicingFamily, stringSet, omittedIntervals, canonicalRoot, baseFret, featured`. No `cagedPosition`, `movable`, `parentShape`, `tags`, `tuning`, `overrides`, `notes` — all proposed additive fields are genuinely absent.
- `Barre` (`shape.ts:75-80`): `{ fret, fromString, toString, finger }` — `fret` semantics not consistent today.
- `VoicingFamily` (`shape.ts:38-47`): `"caged"|"extended"|"shell"|"open"|"barre"|"drop2"|"drop3"|"drop2+4"|"sweep"` — no `"triad"` yet.
- Registries: `dictionary`/`index` (scale) and `chordDictionary`/`chordIndex` (chord) are plain module-level arrays/Maps. `add()` (`shape.ts:141-145`, `169-173`) unconditionally **pushes** — no de-dupe or replace-on-add. `removeAll()` exists for both registries but there is **no single-name `remove()`**. `chordShapes.query({chordType, system, voicingFamily, stringSet})` (`shape.ts:178-201`) exists and is already used by the site (`shapeDetailUtils.ts:102`).

**`src/data/*`** — 10 files, all zero-Tonal-dep except `caged-scales-minor.ts`/`pentatonic-minor.ts`:
- `open-chords.ts` (1514 lines): ~50 hand-authored open/barre `ChordShape`s with `baseFret`. **Barre.fret migration is real and narrow**: e.g. `OPEN_A_MAJOR` has `baseFret: 1` and `barres: [{fret: 2, ...}]` (`open-chords.ts:260-276`) — *absolute* fret. `OPEN_C_MINOR` has `baseFret: 3`, `barres:[{fret:3,...}]` (`open-chords.ts:66-78`) — also absolute. Every `baseFret`-carrying shape stores absolute barre frets.
- `jazz-shells.ts` (169 lines): **generates exactly 16 shapes** (`SHELL_DICTIONARY` × 2 string sets `[0,1,2]`/`[1,2,3]` × 2 orderings R37/R73 × 4 chord types), confirmed at `jazz-shells.ts:64-67, 150-165` and asserted by `data.test.ts:683` (`expect(SHELL_SHAPES).toHaveLength(16)`) plus `.filter()`-based tests at `data.test.ts:667-755`. The 16→8 fix requires rewriting the test file too, not just the data file.
- `caged-chords.ts` (77 lines): 5 base CAGED major triads — **no `chordType`/`voicingFamily`** (documented, acceptable warning per `audit.ts:264-269`).
- `caged-chords-7th.ts`, `extended-chords.ts`: movable CAGED/extended types with full metadata, no `baseFret` (Barre.fret migration doesn't touch them).
- `caged-scales-minor.ts` (`:44-78`), `pentatonic-minor.ts`: derived via `relabelShape` at import time — the working precedent for derived-entry `parentShape`/`quality` conventions the arpeggio-derivation flow should follow.

**Gap analysis**: all seven proposed fields are absent today and additive-only; none conflict. `movable` formalizes the implicit `canonicalRoot === undefined` check already used at `audit.ts:126` (`checkFingerZeroOnMovable`).

## 2. Pure-function primitives

- **`src/transform.ts`** (`relabelShape`, 128 lines): pure chroma-anchored rotation; strict import boundary (`@tonaljs/interval` only); proven at scale.
- **`src/arpeggio.ts`** (313 lines, zero-Tonal-dep): `filterChordTones`, `scoreShapeMatch` + `InferenceProbe`/`ScoreBreakdown`. **`arpeggioFromShape`/`arpeggioFromScale` do NOT live here** — see `arpeggio.ts:126-128` comment.
- **`src/integration.ts`** (1217 lines, optional-peer): `arpeggioFromScale` (`integration.ts:67-108`) and `arpeggioFromShape` (`integration.ts:118-128`) **already exist and are exported** (`index.ts:144-145`). The "derived" arpeggio tier requires **zero new library code**. Also here: `relabelShapeToScale` (`integration.ts:200-211`), `modeShapes`, `isShapeCompatible`, `scalesContainingChord`, `inferShapeContext`.
- **`src/build.ts`**: `buildFrettedScale`, `applyChordShape`. **Confirmed: `Fingering` does NOT carry `fingers`/`barres` through** (`build.ts:270-276`) — only `positions, frets, root, shapeName, startFret`. The proposal's pass-through is a real, necessary, small addition for editor round-tripping.
- `walker.ts`, `pattern.ts`, `notation.ts`, `sequence.ts`, `connect.ts`: secondary to this feature.

**Dependency-tier placement**: new pure derivation belongs in zero-dep or required-peer tier. `arpeggioShapes` registry belongs in `shape.ts` (zero-dep, mirrors `chordShapes` at `shape.ts:159-202`). New audit checks (`stringset-mismatch`, `tuning-mismatch`, `barre-fret-origin`, `name-unique`) belong in `audit.ts` (required-peer tier). `identify-mismatch` needs `@tonaljs/chord` → must be **opt-in**/outside `audit.ts`'s strict-import contract — a named architecture decision, not a checkbox.

## 3. Integration and output

- `integration.ts` covers everything the Chords/Arpeggios/Diatonic screens need — no new integration-tier functions appear necessary for Phases 1-3; it's composition of existing primitives.
- `src/output/*` operate on `FrettedNote[]`, not `ChordShape`/`Barre` — irrelevant to the Barre migration; reusable later for preview/export if wanted (canvas uses "Copy TS"/"Copy JSON" instead).

## 4. Public API (`src/index.ts`)

`index.ts` (185 lines): full re-export surface + side-effect data imports (`index.ts:161-170`). Everything the workbench needs is **already publicly exported**; the site consumes the library exclusively through the public surface via `tonal-guitar: "file:.."` (`site/package.json:28`). `VERSION` (`src/version.ts`) is what the changeset schema records for drift detection.

## 5. Site / docs surface (critical path)

The `/shapes` Shape Library has a clean pure/impure split — **already most of the way to the shared-package goal**:

- **Pure, zero-React helpers** (extraction targets for `packages/shape-catalog`):
  - `site/app/shapes/components/shapeLibraryUtils.ts` (1010 lines) — `buildCatalog`, filter/facet/sort/group/URL-state logic, `buildReportUrl`. Header comment (lines 1-8) already states the needed import discipline: only `"tonal-guitar"`, never `"@tonaljs/*"`.
  - `site/app/shapes/components/shapeDetailUtils.ts` (350 lines) — `chordDetailFor`, `chordTypeSiblings`, `inversionGroups`, `relatedScalesForEntry`, `compatibleShapesForEntry`, etc.
  - One site-only dep to carry/stub: `REPO_SLUG` from `@/lib/repo` (`shapeLibraryUtils.ts:28`) — only for the GitHub "report a problem" URL.
- **Presentational, Next-coupled components** (stay per-app, thin adapters): `ShapeLibrary.tsx` (URL state, `next/dynamic`), `ShapeCard.tsx`/`ShapeCardDiagram.tsx`/`CompactFretboard.tsx` (all delegate rendering to `fretboard-ui`'s `<Fretboard>` — `ShapeCardDiagram.tsx:3,120`, `CompactFretboard.tsx:4,105,123`), `ShapeDetailPanel.tsx` + `ChordDetailView.tsx`/`ScaleDetailView.tsx` (PR #160), `FilterBar.tsx`, `LazyShapeCard.tsx`, `IssueBadges.tsx`, `ShapeCardChordTable.tsx`.
- **`packages/fretboard-ui`**: **private, unbuilt** — `"main": "src/index.ts"`, no build script, consumed via `transpilePackages: ["fretboard-ui"]` (`site/next.config.mjs:13`) and `"fretboard-ui": "file:../packages/fretboard-ui"` (`site/package.json:20`). Exports `Fretboard` (pure SVG), `FretboardEditor` (click editor with `cellsToScaleShapeStrings`/`frettedNotesToCells`), `modes.ts` helpers (`MODES`, `parentRoot`, `effectiveModeForSystem`, `isModeCompatibleWithSystem`), `intervals.ts`. Peer deps: `react`, `react-dom`, `tonal-guitar`.
- **`site/app/admin/`**: existing partial editor. `ShapeEditor.tsx` (434 lines) builds `ScaleShape` intervals from `FretboardEditor` cells, "Copy TS" export; **no chord-shape export** (`ShapeEditor.tsx:409-414`). `admin/page.tsx:8-11` gates via `notFound()` in production. Exactly issue #66's gap; retire `/admin` once the Workbench covers it.
- **Build/deploy**: `site/next.config.mjs` sets `output: "export"` (line 7), `basePath` via `DEPLOY` env, `images.unoptimized`. `site/package.json` `deploy` → `gh-pages -d out/`.
- **No npm/pnpm/yarn workspaces anywhere**. Cross-package convention is plain `file:` deps (`site` → `file:..`, `site` → `file:../packages/fretboard-ui`, `fretboard-ui` devDep → `file:../..`). **New packages should follow the same `file:` convention** — no workspace migration. No Vite installed anywhere yet; the workbench would be the first Vite consumer.

## 6. Related features and issues

- `.tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/deferred.md`: `arpeggioFromShape`/`arpeggioFromScale`, `scoreShapeMatch`/`inferShapeContext` are the shipped part; #30 (sweep), #28 (voicing lookup), #29 (lab integration), #34 (CAGED classification) deferred — relevant to Phases 3/3b.
- `.tonal-guitar/features/shape-detail-panel/`: source of the `featured`/spotlight-tier convention (D-006 amendment 3) consumed by `shapeLibraryUtils.ts`'s `buildGroup`.
- Issues: **#57** (16 of 30 CAGED shapes; minor triads absent; C/G 7th voicings missing) → closed by Phase 2. **#66** (finger/barre UI + real `ChordShape` export) → closed by Phase 2. **#58** (5 of 10 arpeggio seeds; no first-class registry) → closed by Phase 3. **#30** (sweep shapes; no authoritative canon — needs a design decision first, not just data entry).

---

## Gaps, risks, blast-radius notes

1. **Barre.fret migration blast radius is narrow.** Traced every consumer: `build.ts`/`applyChordShape` never reads `Barre`; `audit.ts`'s `sourceFrets`/`chordShapeGeometry`/`checkGeometryMismatch` (`audit.ts:360-451`) reconstruct frets independently. The **only** production consumer of `Barre.fret` is `site/app/shapes/components/ShapeCardChordTable.tsx:43-45` (`barreLabel`, display string). Migration = (a) redefine convention, (b) convert `open-chords.ts` literals to `N - (baseFret - 1)`, (c) update `barreLabel` to reconstruct absolute (`barre.fret + (shape.baseFret ?? 1) - 1`), (d) add `barre-fret-origin` audit check. No build-engine changes.
2. **`jazz-shells.ts` correction is not just a data edit** — `data.test.ts:683` hard-codes 16, plus `.filter()` assertions (`data.test.ts:667-755`) and count assertions at `data.test.ts:1111,1289,1355`. Merge tooling's "bump hard-coded count assertions" needs to handle this specifically.
3. **`Fingering` doesn't carry `fingers`/`barres`** — confirmed gap; blocks load-existing-chord → edit → re-save round-trip (only ScaleShape loading round-trips today per `ShapeEditor.tsx`'s `handleLoadShape`).
4. **Registry has no replace-on-add and no single-item `remove()`** (`shape.ts:141-145,169-173`) — blocks the teacher-override mechanism. Foundational (Phase 1) work.
5. **Chord-scale rule needs unseeded mode boxes** — `scalesContainingChord`'s `DEFAULT_SCALE_CORPUS` (`integration.ts:427-439`) is fine, but `relabelShapeToScale` targets (mixolydian/locrian/dorian boxes per CAGED position) aren't registered; canvas's "derived on demand · seed (phase 3)" is accurate and non-trivial (per-position `relabelOrThrow`-style verification like `caged-scales-minor.ts`).
6. **`identify-mismatch` can't run in the required-peer tier** — needs `@tonaljs/chord` → either a second entry point or an optional-tier sibling to `audit.ts`; named architecture decision required.
7. **`stringset-mismatch` prior art**: no exported `impliedStringSet` helper found in `extended-chords.test.ts` — re-derive the invariant from `ChordShape.strings`/`stringSet`; don't assume a reusable helper exists.

## Recommended placement for new code

- **`src/shape.ts`**: new optional fields; `VoicingFamily` gains `"triad"`; registry `remove()` + replace-on-`add()`; new `arpeggioShapes` registry (`ArpeggioShape extends ScaleShape`) — zero-Tonal-dep tier.
- **`src/build.ts`**: extend `Fingering` to carry `fingers`/`barres`.
- **`src/audit.ts`**: `stringset-mismatch`, `tuning-mismatch`, `barre-fret-origin`, `name-unique`; `identify-mismatch` needs a tiering decision.
- **`src/data/open-chords.ts`**: mechanical Barre.fret conversion.
- **`src/data/jazz-shells.ts` + `data.test.ts`**: 16→8 replacement + test rewrite.
- **New `src/data/caged-chords-minor.ts`, `src/data/caged-arpeggios-*.ts`**: registered in `src/index.ts` after their `parentShape` source file (mirrors `index.ts:161-167`).
- **`packages/shape-catalog`** (new, `file:`-linked): extracted `shapeLibraryUtils.ts` + `shapeDetailUtils.ts`, config-injected `REPO_SLUG`.
- **`packages/shape-workbench`** (new, Vite + React, `file:`-linked to `tonal-guitar`, `fretboard-ui`, `shape-catalog`): local editing app + dev-server plugin writing `.workbench/changeset.json`.
- **`scripts/shapes-merge.mjs`** (new, `npm run shapes:merge`): the only piece touching `src/data/*.ts` / `src/index.ts` on disk.
- **`site/app/shapes/*`**: consume `packages/shape-catalog`; retire `site/app/admin/*` once covered.
