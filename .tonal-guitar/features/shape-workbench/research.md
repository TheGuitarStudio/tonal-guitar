# Research: Shape Workbench

**Date:** 2026-08-30 | **Issue:** #161

Merged from two research agents. Full findings: [research-raw/codebase.md](research-raw/codebase.md), [research-raw/product.md](research-raw/product.md). Design source: [canvas-content.txt](canvas-content.txt) (`Proposal.dc.html` section = verified draft spec).

---

## Codebase Research

### Headline findings

1. **The design canvas's Proposal artboard is accurate against the live code** — every claim verified. Treat it as the draft spec.
2. **`packages/fretboard-ui` already exists** (private, unbuilt, `file:`-linked; `Fretboard`, `FretboardEditor`, cell-model converters) and is already shared by the docs Shape Library and the existing `/admin` editor. The shared-UI goal is an extraction/completion job.
3. **`arpeggioFromShape`/`arpeggioFromScale` already shipped** in `src/integration.ts` (`:67-128`) — the "derived" arpeggio tier needs zero new library code.
4. **The site's Shape Library is already split pure vs. presentational**: `shapeLibraryUtils.ts` (1010 lines) + `shapeDetailUtils.ts` (350 lines) are zero-React, import only `"tonal-guitar"` — direct extraction targets for `packages/shape-catalog`. Presentational components delegate all fretboard rendering to `fretboard-ui`.

### Relevant types & registries (`src/shape.ts`)

All seven proposed fields (`cagedPosition`, `movable`, `parentShape` on ChordShape, `chordType` on ScaleShape, `tags`, `tuning`, `overrides`, `notes`) are **absent today and purely additive**. `VoicingFamily` lacks `"triad"`. Registry `add()` pushes unconditionally (`shape.ts:141-145,169-173`); no `remove()`, no replace-on-add — **foundational gap blocking the override mechanism**. No `arpeggioShapes` registry exists.

### Confirmed real gaps the proposal names

- `Fingering` doesn't carry `fingers`/`barres` (`build.ts:270-276`) — blocks chord-grip round-tripping in the editor.
- `Barre.fret` stored absolute in `open-chords.ts` (70 shapes, 35 barre entries) vs. proposed offset-from-`baseFret`. **Blast radius is tiny**: only real consumer is `ShapeCardChordTable.tsx:43-45` display label; build/audit never read it.
- `jazz-shells.ts` generates 16 shells; correction to the traditional 8 also requires rewriting `data.test.ts` assertions (`:683`, `:667-755`, counts at `:1111,1289,1355`).
- `identify-mismatch` audit check needs `@tonaljs/chord` → cannot live in `audit.ts`'s required-peer tier; needs a named tiering decision (opt-in entry point or optional-tier sibling).
- Chord-scale rule needs mode boxes (mixolydian/locrian/dorian per CAGED position) that aren't registered — derive-on-demand first, seed later (canvas phase 3), following `caged-scales-minor.ts`'s `relabelOrThrow` precedent.

### Repo structure facts

- **No workspaces**; the convention is plain `file:` deps. New packages follow it — no tooling migration.
- Site is `output: "export"` (`site/next.config.mjs:7`), deployed via `gh-pages`; `/admin` self-gates with `notFound()` in production (`admin/page.tsx:8-11`) and exports ScaleShape only (`ShapeEditor.tsx:409-414`) — exactly issue #66's gap.
- No Vite anywhere yet; the workbench would be the first Vite consumer.

### Suggested Code Placement

| New/changed | Where | Rationale |
| --- | --- | --- |
| New shape fields, `"triad"`, `remove()`/replace-on-add, `arpeggioShapes` registry | `src/shape.ts` | zero-Tonal-dep tier, mirrors `chordShapes` pattern |
| `Fingering.fingers`/`barres` pass-through | `src/build.ts` | required-peer tier, small additive change |
| `stringset-mismatch`, `tuning-mismatch`, `barre-fret-origin`, `name-unique` checks | `src/audit.ts` | required-peer tier; `identify-mismatch` needs tiering decision |
| Barre.fret offset migration | `src/data/open-chords.ts` (+ `ShapeCardChordTable.tsx` label) | only file storing absolute barres with `baseFret` |
| Shells 16→8 | `src/data/jazz-shells.ts` + `data.test.ts` | data fix + test rewrite |
| New data files (`caged-chords-minor.ts`, `caged-arpeggios-*.ts`) | `src/data/` + `src/index.ts` registration order | mirrors `caged-scales-minor.ts` precedent |
| `packages/shape-catalog` | extracted `shapeLibraryUtils.ts`/`shapeDetailUtils.ts` | already pure; config-inject `REPO_SLUG` |
| `packages/shape-workbench` | new Vite+React app, `file:`-linked | site can't write files; dev-server plugin writes `.workbench/changeset.json` |
| `scripts/shapes-merge.mjs` | root `scripts/`, `npm run shapes:merge` | single writer of `src/data/*.ts`/`src/index.ts` |

---

## Product Research

### Roadmap Alignment

**Alignment: Strong.** No "workbench" phase exists in `docs/PLAN.md` (nearest anchor: Epic 8, docs site — done); this is effectively a new epic layered on shipped infra. It directly answers `docs/design.md` open questions #2 (open strings in movable shapes — deferred by our scope cut) and #3 (barre representation — the Barre.fret decision), and unblocks the registry-depth backlog.

### Related Specifications

| Document | Relevance |
| --- | --- |
| `.tonal-guitar/features/shape-visual-audit-library` (#97) | audit engine to reuse for live editor checks; documents known data debt (span issues, mistagged `OPEN_G_DIM`/`OPEN_G_M7B5`) |
| `.tonal-guitar/features/shape-detail-panel` (#139) | current read-only Shape Library this feature absorbs; its reviewer already called for consolidating recurring Shape Library UI work |
| `.tonal-guitar/features/minor-quality-shape-relabeling` (#54) | `relabelShape`/`relabelShapeToScale` — the chord-scale rule's engine |
| `.tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings` (#16) | shipped arpeggio primitives + deferred issues #28-#37 |

### Issue landscape

- **#57** (CAGED: 16/30 shapes, minor triads absent) → Phase 2 closes.
- **#66** (chord editor finger/barre export) → **absorb into #161's scope**; it is this feature's chord-editor deliverable.
- **#58** (arpeggio registry 5/10 seeds, no first-class registry) → Phase 3 closes.
- **#30** (sweep arpeggios) → out of scope; needs its own design decision first.
- **#56** (blues scales) → not named in the canvas but same registry-depth pattern; becomes fillable via the workbench.
- Lab v2 items #64/#65/#67 → separate (touch `site/app/experiments/`, not `shapes/`/`admin/`).
- #34-#37 → adjacent library-API work, not blocking.

### User Context

- **Author/teacher (local, editing)**: replaces hand-editing `src/data/*.ts` + after-the-fact audit with see-it-render-first authoring; export is a reviewable `changeset@1` JSON merged by `npm run shapes:merge` (human still reviews the diff).
- **Docs visitor (read-only)**: gets the improved shared Shape Library UI; deployed site stays static and read-only.

### Scope Assessment

**In scope:** additive shape fields; registry `remove()`/replace-on-add; `arpeggioShapes` registry (derive→core→override); Barre.fret offset migration (distinct, gated task); shells 16→8 fix; `packages/shape-catalog` extraction; workbench app (Board, editor, export; chords first); merge script; shared read-only library UI on the docs site; CAGED minor triads row; chord fingering/barre export.

**Out of scope:** auth'd deployment of edit mode (architecture must not preclude it); open strings & alternate tunings (phase 4/later); sweep arpeggios (#30); full mode-box seeding beyond what the chord-scale rule needs; Lab v2 items; #34-#37; silently auto-fixing pre-existing data debt surfaced visually.

**Adjacent (separate efforts):** #30, #56 (workbench makes it easy, but data entry is its own task), #64/#65/#67, #34-#37.

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
| --- | --- | --- |
| Barre.fret absolute→offset is the one breaking migration | Medium | isolate as its own task; consumers traced (display label only); add `barre-fret-origin` audit + regression gates |
| `data.test.ts` hard-codes counts (shells 16, featured counts) | Medium | merge script + shells task must update assertions deliberately |
| `identify-mismatch` breaks `audit.ts` tier contract | Medium | named architecture decision: opt-in entry point vs optional-tier sibling |
| Mode boxes unseeded for chord-scale rule | Medium | derive-on-demand first; seed as phase-3 task with `relabelOrThrow`-style verification |
| Pre-existing data debt surfaces visually | Low | don't auto-fix; track as separate corrections (shells fix is in-scope by decision) |
| Registry mutation (`remove`/replace) vs pure-function convention | Low | registries are already the sanctioned mutable seam (side-effect imports); document |
| Site refactor to `shape-catalog` regressing `/shapes` | Medium | extraction is move-only for pure utils; site keeps thin adapters; existing site tests/verify pass |

## Open Questions (for Phase 2 — Shape)

1. **How much workbench UI ships read-only to the docs site?** Just the improved Shape Library (Board grid + detail views), or also Chords page/Graph? Mechanically: shared React components package (beyond pure `shape-catalog` utils) vs. per-app thin adapters — the canvas assumed utils-only sharing; the user's new direction ("reuse all the UI") may want a shared component package (e.g. `packages/shape-catalog` growing React components, or a third package).
2. Read-only/edit mode switch: build-time flag, runtime capability detection (dev-server endpoint present?), or separate entry points?
3. m7 alternate scale frame: aeolian decided; dorian/relative-major boxes as user-selectable alternates in v1 or later?
4. `identify-mismatch` tiering: opt-in flag in `auditAllShapes` vs. optional-tier sibling module.
5. Does the workbench replace `site/app/shapes` in the same PR-phase as its extraction, or does the site swap to shared components in a later phase?
6. Absorb #66 into #161 (recommended) — close #66 as duplicate/absorbed, or keep it as the Phase-2 sub-issue?
7. Where does `.workbench/changeset.json` live relative to git (gitignored working file, committed artifact, or either)?
