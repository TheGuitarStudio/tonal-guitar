# Requirements: Shape Workbench

**Date:** 2026-08-30 | **Issue:** #161 | **Phase:** 2 (Shape)

## Initial Description

A shape-authoring app ("Shape Workbench") for browsing, creating, and editing guitar
shapes — chords first, then arpeggios and scales — with a CAGED board view and an export
flow producing a `tonal-guitar/changeset@1` JSON merged into `src/data/*` via
`npm run shapes:merge`. New direction (2026-08-30): the same UI ships read-only as the
deployed docs Shape Library — one component investment serves both surfaces.

Design canvas (authoritative for screens/UX):
https://claude.ai/code/artifact/97d6fbbc-98f3-44be-8670-41aa00ceabcd

## Requirements Discussion

### Round 1 Questions (architecture-defining)

**Q1: How is the shared UI packaged, given site components are coupled to Next?**
**Answer:** 4-package split — `packages/shape-catalog` (pure catalog/detail model),
`packages/shape-library-ui` (framework-neutral React: board, cards, filters, detail
panels), `site/app/shapes` reduced to a thin Next adapter (URL state, static export),
`packages/shape-workbench` (Vite app: editing state, dev-server persistence). Follows
the Codex research-review recommendation.

**Q2: How do the shared components switch between read-only (docs) and editing (workbench)?**
**Answer:** Capability props — components take injected capabilities (edit/export
handlers or an editing context). The site never passes them; the workbench does. No
runtime dev-server sniffing for core rendering behavior; no separate entry points.

**Q3: When does the deployed docs site swap to the shared packages?**
**Answer:** Vertical slice first — prove one shared chord card/board rendering in both
Next static export and Vite, plus edit → changeset → merge end-to-end — then migrate the
rest of `site/app/shapes` incrementally within this feature. No big-bang rewrite, no
indefinite dual-UI period.

**Q4: Which screens are in the workbench MVP?**
**Answer:** Board (CAGED grid, vertical/horizontal diagram toggle) + Editor (fingers/
barres, live audit checks) + Export. Graph and the standalone Chords page are deferred
to a later phase. MVP proves: browse gaps → create/edit chord → live checks → export
changeset → merge → same component renders read-only in docs. Closes #66 and #57.

### Round 2 Questions (mechanics)

**Q5: Implementation strategy for `scripts/shapes-merge.mjs`?**
**Answer:** Generator-owned blocks — the script owns clearly delimited generated
regions/files whole (regenerate, never text-patch), with identifier-collision checks,
`--dry-run`/`--check`, stable formatting, schema validation, computed-file refusal, and
fixture-changeset tests. No new runtime dependencies. Hand-written data outside owned
blocks is never touched.

**Q6: Where does the `identify-mismatch` audit check live (needs `@tonaljs/chord`)?**
**Answer:** New optional-tier sibling module `src/audit-integration.ts`. `audit.ts`
stays required-peer-only per CLAUDE.md; the workbench composes both check sets.

**Q7: Absorb issue #66 into #161?**
**Answer:** Yes — absorb and close #66 now with a comment linking #161. Phase 3
sub-issues cover the work; one source of truth.

**Q8: Where does the exported changeset live relative to git?**
**Answer:** `.workbench/changeset.json` is a gitignored working file. Committed sample
changesets live under the merge script's test fixtures, not `.workbench/`.

### Existing Code to Reference

- **`packages/fretboard-ui`** — existing shared React package (`Fretboard`,
  `FretboardEditor`, cell-model converters), already consumed by the docs Shape Library
  and `/admin` via `file:` links. The 4-package split extends this precedent.
- **`site/app/shapes/shapeLibraryUtils.ts` (1010 lines) + `shapeDetailUtils.ts` (350
  lines)** — pure, zero-React, import only `"tonal-guitar"`; direct extraction targets
  for `packages/shape-catalog` (config-inject `REPO_SLUG`).
- **`src/integration.ts:67-128`** — `arpeggioFromShape`/`arpeggioFromScale` already
  shipped; the "derived" arpeggio tier needs zero new library code.
- **`src/data/caged-scales-minor.ts`** — `relabelOrThrow` precedent for seeding
  relabeled data at import time with zero optional peers.
- **`src/shape.ts:141-173`** — registry `add()` pattern that `arpeggioShapes` mirrors
  and that `remove()`/replace-on-add extends.
- **Shape-visual-audit-library feature (#97)** — audit engine reused for the editor's
  live checks; documents known data debt (not to be silently auto-fixed).

## Visual Assets

### Files Provided:

Design canvas artifact (authoritative):
https://claude.ai/code/artifact/97d6fbbc-98f3-44be-8670-41aa00ceabcd — pages: Screens
(Board / Editor / Chord / Graph / Export), Arpeggios (derive→core→override + arpeggio
editor), Triads & shells by string set, Data model & export proposal; screen 7
"Diatonic arpeggios in one shape". A text snapshot is committed at
`canvas-content.txt` (the `Proposal.dc.html` section is the verified draft spec).

### Visual Guidance:

- Board: CAGED-position columns (also groupable by string set / inversion);
  vertical (chord-box, low E left) vs horizontal diagram toggle.
- Fretboard rendering stays in `packages/fretboard-ui` — shared components delegate
  to it, as the site already does.
- Read-only docs surface = improved Shape Library (board grid + detail views);
  editor/export affordances appear only when capability props are injected.

## Requirements Summary

### Functional Requirements

- **Library data model (additive):** `cagedPosition`, `movable` (default
  `canonicalRoot === undefined`), `parentShape` on `ChordShape` (`ScaleShape` already
  has it); `chordType` on `ScaleShape`; `tags`, `tuning`, `overrides`, `notes`;
  `VoicingFamily` gains `"triad"`.
- **Registries:** `remove()` + replace-on-same-name-add; new `arpeggioShapes` registry
  (ScaleShape structure, chord-frame intervals, `chordType` required); explicit
  resolver layer for override → core → derived arpeggio resolution (raw `all()` cannot
  both hide core and keep it reachable).
- **Library helpers (new public API):** `isMovable(shape)`;
  `playedStringSet`/`impliedStringSet`; `absoluteBarreFret` (migration aid); arpeggio
  slot resolvers; stable export-identifier/slot-key generation + collision checks;
  public `changeset@1` schema type.
- **Fingering round-trip:** `Fingering` carries `fingers`/`barres` through `build.ts`
  (closes #66).
- **Audit:** new required-tier checks (`stringset-mismatch`, `tuning-mismatch`,
  `barre-fret-origin`, `name-unique`) in `audit.ts`; `identify-mismatch` in optional-tier
  `audit-integration.ts`; workbench editor runs checks live.
- **Data corrections:** `jazz-shells.ts` 16 → traditional 8 (with deliberate
  `data.test.ts` assertion rewrite); `Barre.fret` absolute → offset-from-`baseFret`
  migration in `open-chords.ts` (70 shapes, 35 barres) as its own gated task with
  before/after fixtures for open, fixed-barre, and movable-barre shapes (audit.ts:147
  consumes barre ranges — not display-only).
- **New data:** CAGED minor triads row (#57); closed triads from [1P 3M 5P] rotations
  as proposed core set; arpeggio seeds per the three-tier model.
- **Chord-scale rule:** chord type → scale frame (7 → mixolydian, maj7 → major,
  m7 → aeolian), box selected by matching rootString via `relabelShapeToScale`;
  derive-on-demand first, mode-box seeding later; the rule stored explicitly so it can
  evolve without changing authored data.
- **Workbench app:** Vite + React in `packages/shape-workbench`; Board + Editor +
  Export screens; dev-server plugin persists `.workbench/changeset.json` (gitignored).
- **Merge flow:** `npm run shapes:merge -- .workbench/changeset.json`;
  generator-owned blocks; `--dry-run`/`--check` and "what files will change" as
  first-class reviewer UX; fixture-changeset tests.
- **Docs site:** swaps to `shape-catalog` + `shape-library-ui` after the vertical
  slice proves the boundary; stays static (`output: "export"`) and read-only.

### Reusability Opportunities

See "Existing Code to Reference" above — fretboard-ui package precedent, pure site
utils, shipped arpeggio wrappers, relabel precedent, audit engine.

### Scope Boundaries

**In Scope:** everything in Functional Requirements; three user roles — author/teacher
(local editing), docs visitor (read-only), reviewer/maintainer (dry-run/check merge
review).

**Out of Scope:**

- Auth'd deployment of edit mode (architecture must not preclude it; auth itself out)
- Open strings and alternate tunings authoring (phase 4/later)
- Sweep arpeggios (#30) — needs its own design first
- Full mode-box seeding beyond what the chord-scale rule needs
- Graph screen and standalone Chords page (deferred past MVP)
- Lab v2 items (#64/#65/#67); adjacent API work #34-#37
- Silently auto-fixing pre-existing data debt surfaced visually (shells fix and barre
  migration are explicit in-scope corrections; everything else gets tracked, not fixed)

### Technical Considerations

- No npm workspaces — new packages follow the existing plain `file:` convention.
- Site is static export; only the workbench dev server writes files.
- Dependency tiers (CLAUDE.md) are load-bearing: new shape fields/registries in the
  zero-Tonal tier, fingering pass-through in required-peer tier, `identify-mismatch`
  in optional tier.
- `data.test.ts` hard-codes counts — shells fix and merge script must update
  assertions deliberately, never incidentally.
- Registries are the sanctioned mutable seam (side-effect imports); `remove()`/replace
  stays within that convention and gets documented as such.
