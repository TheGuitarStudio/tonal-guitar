# Code Review: feat/shape-workbench

**Date:** 2026-09-02 | **Base:** main | **Scope:** full
**Commits:** 81 | **Files Changed:** 197 | **Loop:** 1/2

## Affected Packages

- `src/` (library, 24 files changed — incl. `src/data/`)
- `packages/shape-catalog` (13 files changed)
- `packages/shape-library-ui` (34 files changed)
- `packages/shape-workbench` (43 files changed)
- `packages/fretboard-ui` (5 files changed)
- `site/` (18 files changed)
- `scripts/` (merge tooling + fixtures, ~34 files changed)

## Review Progress

- [x] Phase 1: Setup
- [x] Phase 2: Lint/Test Fix
- [x] Phase 3: Architecture Review
- [x] Phase 4: Architecture Fix
- [x] Phase 5: Code Simplification Review
- [x] Phase 6: Code Simplification Fix
- [x] Phase 7: Specialized Reviews
- [x] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

## Statistics

- Critical: 15 fixed, 0 remaining | Important: 29 fixed, 4 deferred | Suggestion: 31 deferred
- GitHub Issues Created: #192–#199
- Total Commits: 3 | Total Fixes: 44 | Final Status: IN PROGRESS

---

## Phase 2: Lint/Test Results

All checks passed with no fixes needed:

- `npm run lint` — clean
- `npm run build` (tsup + dts verification) — clean
- `npm test` — 50 files, 1653 tests passed (includes the registry-wide `src/audit.test.ts` sweep for shape-data invariants)
- `packages/shape-workbench`: `tsc --noEmit && vite build` — clean
- `site`: `next build` — clean (14 static pages)

(`packages/fretboard-ui`, `shape-catalog`, `shape-library-ui` have no build scripts; they are typechecked/tested via the root pipeline.)

---

## Phase 3: Architecture Review

79 findings (15 Critical, 33 Important, 31 Suggestion) from five parallel opus review agents.

### src/ (library)

- CR-001: [Critical] Un-migrated absolute barre frets in `src/data/extended-chords.ts:495` (also `:282`, `:383`, `:548`) — D-010 redefined `Barre.fret` as grip-base offset and `applyChordShape` materializes `gripBase + b.fret` (`src/build.ts:331-335`), but only `open-chords.ts` was migrated. E.g. `EXT_CHORD_A_13` stored `fret: 3` resolves to absolute 5; real barre is 3 (offset 1). `EXT_CHORD_A_DIM7` resolves to 4, real barre at 2 (offset 0). Not caught by `checkBarreFretOrigin` (within span, no `baseFret`). Needs the same `newFret = absoluteFret - sourceGripBase` pass open-chords got.
- CR-002: [Important] Grip-base offset convention not root-invariant in `src/shape.ts:219` / `src/data/caged-chords-minor.ts:47-50` — `gripBaseFret` excludes open strings, so the base moves for shapes whose root string is open at some roots. `CAGED_CHORD_GM` offsets correct at C, off by one at G; `EXT_CHORD_A_M6` correct at C, off at A. Anchor offsets to a documented reference root/`baseFret`, or include open strings in the base.
- CR-003: [Important] `Fingering.barres` string indices not remapped by `stringOffset` in `src/build.ts:332-335` — `frets`/`fingers` are tuning-indexed via `strOffset` but `barres.fromString/toString` pass through shape-indexed. `autoFingering` (`src/build.ts:367`) has the mirror problem (returns tuning-length arrays meant to seed shape-indexed fields).
- CR-004: [Important] `checkNameUnique` self-exclusion is reference equality in `src/audit.ts:683` — any draft/clone of a registered shape is a false positive, forcing downstream to suppress the whole check class (`packages/shape-workbench/src/editor/checks.ts:69`, `scripts/shapes-merge.mjs`), which also suppresses genuine rename-into-collision. Add `options.ignoreName`/`selfName`.
- CR-005: [Important] `checkNameUnique` unbounded registry scan with per-entry identifier derivation in `src/audit.ts:698` — full audit is O(N²) regex work; workbench re-runs per edit. Build identifier set once per call site or memoize keyed off registry mutation.
- CR-006: [Important] Arpeggio audit path rebuilds the same shape five times in `src/audit.ts:905` and `src/audit-integration.ts:282` — `checkScaleBuildLoss`, `checkPositionSpan`, `checkChordTonesOnly`, `checkCoversChord`, `checkContainsChordGrip` each call `buildFrettedScale`; thread an optional `prebuilt?: FrettedScale` like the chord path does.
- CR-007: [Important] CLAUDE.md dependency-layer docs stale for three new modules — `src/audit-integration.ts` (second optional-peer module), `src/chord-scale.ts` and `src/changeset.ts` (new zero-Tonal-dep modules) are absent from the layer lists. Tier placements verified correct; docs need updating.
- CR-008: [Important] Registered shape names removed/renamed with no CHANGELOG entry in `src/data/jazz-shells.ts:79,139` — D-012 drops shells 16→8 and renames all; names are public lookup keys in a published package. Needs breaking-change CHANGELOG entry (+ version-bump note).
- CR-009: [Suggestion] `parentBoxForChordShape` re-resolves the Tonal scale once per registry candidate in `src/integration.ts:264`; also rejects 6-string boxes under 7/8-string tunings contradicting `buildFrettedScale`'s `stringOffset` handling.
- CR-010: [Suggestion] `CHORD_SCALE_RULE` is a mutable export indexed without own-property guard in `src/chord-scale.ts:20,37` — `scaleTypeForChordType("constructor")` returns a prototype member. Use `Object.hasOwn` and freeze the table.
- CR-011: [Suggestion] `AddChange.shape` is an undiscriminated union in `src/changeset.ts:35` — `kind` and `shape` can disagree; make `ChangesetChange` a per-kind discriminated union.
- CR-012: [Suggestion] Audit aggregate/API asymmetries in `src/audit.ts:935,769,627` — `auditAllShapes` omits arpeggios; `checkNameUnique` wired only into chord audit; `NameUniqueKind` not re-exported from index.
- CR-013: [Suggestion] `sourceGripBaseFret` takes a deliberately unused `_shape` parameter in `src/shape.ts:240` but is public API — drop it or use it.

### packages/shape-catalog + scripts/ (merge tooling)

- CR-014: [Critical] No atomicity across multi-file writes in `scripts/shapes-merge.mjs:372-381` — `apply()` writes/unlinks one file at a time with no staging or rollback; a failure mid-loop leaves a half-merged tree. Stage temp files + rename in a second pass, or restore `originalText` on failure.
- CR-015: [Critical] Partial merges unrecoverable by re-run in `scripts/shapes-merge.mjs:911` — `data-imports` insertion gated on `isNewOnDisk`; after a partial failure the data file exists so re-run skips the `src/index.ts` import and `--check` reports a false no-op. Always push the insertion; the `order.includes(file)` dedupe at `:973` keeps it idempotent.
- CR-016: [Critical] Whole-file reconstruction silently destroys content outside recognized owned blocks in `scripts/shapes-merge.mjs:890-892,908` (and `:946-953` for remove) — `buildGeneratedFileText` emits only header + imports + parsed blocks; anything unparsed is dropped without refusal.
- CR-017: [Critical] Identifier validation wider than marker grammar — `scripts/lib/render-shape.mjs:51` accepts `$` in idents but `scripts/lib/owned-blocks.mjs:25` marker parse doesn't, so a `$`-ident block becomes invisible and is destroyed by the next add. Validate `change.ident` against the marker grammar in `shapes-merge.mjs` (`:750`).
- CR-018: [Critical] `--update-counts` double-increments on re-run in `scripts/shapes-merge.mjs:1073` — no `alreadyApplied` guard (unlike `:814-818`), breaking the §6.6 idempotence contract; untested in `--update-counts` mode.
- CR-019: [Critical] Renaming `update` bypasses name-uniqueness in `scripts/shapes-merge.mjs:841` — `CHECK_NAME_UNIQUE` filtered for updates and rule 6 (`:731`) only checks adds, but `patch.name` renames are supported (`packages/shape-catalog/src/changeset.ts:105-113`) and `detectCollisions` skips non-adds (`:191`). Rename onto an existing name merges cleanly → duplicate registration.
- CR-020: [Critical] `locateOwnedRegion` resolves update/remove targets by name only, ignoring `change.kind`, in `scripts/shapes-merge.mjs:230-242` — names are unique per kind only; a chord and scale sharing a name rewrites whichever file lists first, and the raw substring match also hits comments. Filter candidate blocks by declared type annotation matching `change.kind`.
- CR-021: [Important] Rename-fallback can target an unrelated shape in `scripts/shapes-merge.mjs:298-300` — strategy-2 fallback to `patch.name` can silently overwrite a different registered shape; require deep-equality of the located block with the merged result.
- CR-022: [Important] `remove` not idempotent and breaks `--check` in `scripts/shapes-merge.mjs:638-650` — re-running an applied remove throws `MergeRefusal` instead of the documented no-op; treat already-absent targets as satisfied.
- CR-023: [Important] Removals/renames leave dangling `overrides`/`parentShape` references — rule 7 (`scripts/shapes-merge.mjs:768-791`) checks outbound refs only; no inbound-reference check on delete (`:941-956`) or rename.
- CR-024: [Important] `packages/shape-catalog/src/detail.ts:14-22` imports integration-tier functions requiring optional peers `@tonaljs/scale/chord/key`, but `package.json:9-18` declares only note/interval — and `src/index.ts` re-exports `./detail`. Declare optional peers or split detail behind a subpath.
- CR-025: [Important] `packages/shape-catalog/src/render.ts:11` imports `../../../scripts/lib/render-shape.mjs`, escaping the package boundary (`"files": ["src"]`) and dragging `import("prettier")` (`scripts/lib/render-shape.mjs:276`) into browser bundles via the barrel.
- CR-026: [Important] `renderShape` not pure — output depends on prettier resolution and `resolveConfig(process.cwd())` (`scripts/lib/render-shape.mjs:285`), so workbench and merge script format differently (violates §6.5); parity test `packages/shape-catalog/src/render.test.ts:39` compares a function to itself (vacuous). Pin prettier options; golden-string test the fallback.
- CR-027: [Suggestion] `parseShapeLiteral` fragile first-`=` regex in `scripts/shapes-merge.mjs:1047-1053`; failures throw bare `Error` not `MergeRefusal`.
- CR-028: [Suggestion] `--force` with missing `tuning` crashes at `scripts/shapes-merge.mjs:586` (`changeset.tuning.length` unguarded); validate `Array.isArray` in structural block.
- CR-029: [Suggestion] `--out`/`--root` swallow the next flag in `scripts/shapes-merge.mjs:147,151` — reject values starting with `--`.
- CR-030: [Suggestion] Board cells silently collapse duplicates in `packages/shape-catalog/src/board.ts:302-306` — first match per (row, column) wins; expose a count on `BoardCell`.
- CR-031: [Suggestion] `diffShape` equality is key-order sensitive (`JSON.stringify` compare) in `packages/shape-catalog/src/diff.ts:50-53`, can emit spurious geometry patches.
- CR-032: [Suggestion] `badgeClassFor` returns Tailwind classes from the framework-agnostic layer in `packages/shape-catalog/src/catalog.ts:180-185` — class mapping belongs in shape-library-ui.
- CR-033: [Suggestion] Wildcard ambient module `declare module "*/render-shape.mjs"` in `packages/shape-catalog/src/render-shape-mjs.d.ts:20` is global; scope it to the one real module.

### packages/shape-library-ui + packages/fretboard-ui

- CR-034: [Critical] `cellsToChordShape` drops a mute when the string also carries a fretted cell in `packages/fretboard-ui/src/FretboardEditor.tsx:289-301` — sort + `continue` lets a later fretted cell overwrite a lower-fret muted cell; docstring and test assert the opposite (test fixture only supplies the mute, so it passes). Pre-compute muted-string set and skip those strings.
- CR-035: [Critical] Circular imports between `packages/shape-library-ui/src/ShapeDetailPanel.tsx:37-38` and `ChordDetailView.tsx:22`/`ScaleDetailView.tsx:11` — resolves only because shared bindings are hoisted `function` declarations; a `const`/`memo` addition becomes a TDZ error. Extract shared primitives/types into their own modules.
- CR-036: [Important] `packages/shape-library-ui/src/reactGlobal.ts:25` is a Vitest-only workaround shipping an unconditional `globalThis.React` mutation to production (Next RSC/SSR use different React builds), and is load-bearing-by-accident (`ChordDetailView` relies on a transitive import). Fix jsx runtime config in fretboard-ui/vitest instead and delete the module.
- CR-037: [Important] Five `FretboardEditorProps` declared but never read in `packages/fretboard-ui/src/FretboardEditor.tsx:37-46` (`tool`, `activeFinger`, `barres`, `onBarresChange`, `ghostMarkers`) — type-checked no-ops; implement or remove.
- CR-038: [Important] `ShapeBoard` re-derives shape-catalog's private cell-key format in `packages/shape-library-ui/src/ShapeBoard.tsx:26-28` (duplicates unexported `cellKey`, `packages/shape-catalog/src/board.ts:126-127`) — format drift renders the board silently empty. Export `cellKey` or attach cells to rows.
- CR-039: [Important] Scale facets carry two parallel state representations in `packages/shape-library-ui/src/FilterBar.tsx:58-62` (`scaleSelection` + flat `system`/`quality`/`FILTER_ALL`) — counts and `aria-pressed` can disagree; mirror the chord side.
- CR-040: [Important] `toggleInAllOnSet` facet business logic lives in the UI at `packages/shape-library-ui/src/FilterBar.tsx:361-368` — encodes the "empty = all-on" invariant; move next to facet helpers in catalog.ts and unit-test.
- CR-041: [Important] Derived state synced via `useEffect` in `packages/shape-library-ui/src/ShapeCard.tsx:78-85` — one-way `visible` should be computed during render.
- CR-042: [Important] Invalid ARIA structures in `packages/shape-library-ui/src/ShapeBoard.tsx:77-95` (`role="grid"` with rows flattened through Fragments) and `:54` (`role="list"` with `role="group"` children) — drop the roles or use `display: contents` row wrappers with `role="row"`.
- CR-043: [Important] `fretboard-ui`/`shape-catalog` listed in both `dependencies` and `devDependencies` in `packages/shape-library-ui/package.json:14-23` — hard deps produce the nested-React install forcing `resolve.dedupe` workarounds; move to `peerDependencies`.
- CR-044: [Important] Select-entry callback named inconsistently across the public API: `onSelect` (`ShapeCard.tsx:37`) vs `onSelectEntry` (`ShapeBoard.tsx:21`, `BoardCellCard.tsx:18`, `ShapeDetailPanel.tsx:52`) with mixed optionality — standardize.
- CR-045: [Suggestion] Unmemoized per-hover recomputation in `packages/shape-library-ui/src/ChordDetailView.tsx:199-201` (`buildFretMarkers`/`fretRangeFor`/`fretSummary`) and fresh `layout` object per render at `ShapeDiagram.tsx:119-126`.
- CR-046: [Suggestion] CAGED position order defined three times (`packages/shape-catalog/src/board.ts:117`, `ShapeDetailPanel.tsx:239`, `packages/shape-workbench/src/editor/PropertiesForm.tsx:24`) — export one constant.
- CR-047: [Suggestion] Audit-payload parsing in presentational component `packages/shape-library-ui/src/ShapeCardChordTable.tsx:20-25` — `CHECK_GEOMETRY_MISMATCH` details knowledge belongs beside the audit types.
- CR-048: [Suggestion] Library stylesheet declares theme defaults on bare `:root` + media query in `packages/shape-library-ui/src/styles.css:12-34`; site override wins only by import order, and unmapped `--tg-warn`/`--tg-error` give dark badge colors on light theme. Scope with `:where()`/opt-in class.
- CR-049: [Suggestion] No `"use client"` directives in shape-library-ui despite module-scope `createContext` (`capabilities.ts:26`) and hooks — boundary pushed onto consumers; sibling fretboard-ui marks its components.
- CR-050: [Suggestion] `packages/shape-library-ui/tsconfig.json:18` reaches into sibling package internals (`../shape-catalog/src/render-shape-mjs.d.ts`) — shape-catalog should ship the shim via its own types entry.
- CR-051: [Suggestion] `buildDetail`/`buildEntryNameMap` in `packages/shape-library-ui/src/ShapeDetailPanel.tsx:92-127` are pure catalog orchestration; detail-view tests hand-reimplement `buildDetail` (drift risk). Move into shape-catalog (also halves the CR-035 cycle).

### packages/shape-workbench

- CR-052: [Critical] Editor geometry (`cells`/`barres`) lives only in component-local state in `packages/shape-workbench/src/screens/Editor.tsx:84` — breadcrumb/Back/reload discards everything since the last Run-checks/Save; localStorage "crash resilience" persists an empty-geometry draft; no autosave or unsaved-changes guard. Persist derived geometry to the store on change (or at least on unmount/route change).
- CR-053: [Critical] `onCreateShape` unconditionally overwrites an existing draft in `packages/shape-workbench/src/handlers.ts:127` — and it's the resume path: clicking a draft badge on the Board (`BoardCellCard.tsx:60`) destroys the draft. Reuse `deps.state.drafts[key]` when present.
- CR-054: [Critical] `onEditShape` re-seeds from the registry and clobbers any in-progress draft for that shape in `packages/shape-workbench/src/handlers.ts:137` — read `state.drafts[entry.shape.name]` first.
- CR-055: [Critical] Save round-trip silently rewrites interval spellings in `packages/shape-workbench/src/editor/deriveShape.ts:95,66` — cells→shape uses `intervalFromTo` (12 simple names only), so metadata-only edits to shapes using `"9M"`/`"11P"`/`"4A"` etc. emit patches rewriting `strings` (`"9M"`→`"2M"`) that shapes:merge applies to library source. Preserve `base.strings`/`fingers` when derived geometry is semitone-equivalent.
- CR-056: [Important] `computeSaveDraft` never validates a non-empty name in `packages/shape-workbench/src/editor/saveDraft.ts:43` — empty-name AddChange yields ident `"CHORD_"`, breaks `findDraftForChange` matching, and makes `renderShapeTs` throw. Add a name refusal.
- CR-057: [Important] Unhandled promise rejections leave TS preview stuck at "rendering…" — no `.catch` on `renderDraftTs` in `packages/shape-workbench/src/editor/OutputPreview.tsx:45` and `packages/shape-workbench/src/export/ExportDiffView.tsx:56,61`; render the error instead.
- CR-058: [Important] `file`/`ident` duplicated between store draft and local state in `packages/shape-workbench/src/screens/Editor.tsx:91-92` and diverge — property edits re-broadcast stale values; move into the draft and dispatch like other fields.
- CR-059: [Important] Changeset is append-only in `packages/shape-workbench/src/store.ts:60` — no remove/clear action, no per-row delete on Export screen, double-save appends duplicates, nothing clears after merge. Dedup by target on ADD_CHANGE + clear-after-merge action.
- CR-060: [Important] `/__workbench/status` and GET changeset endpoints implemented but never called (`packages/shape-workbench/src/plugins/workbench-io.ts:34,252`) — no writable probe, no rehydration from disk; in `vite preview` the POST gets SPA-fallback HTML and a cryptic JSON-parse error. Gate the write button on a status probe.
- CR-061: [Important] "Write changeset.json" enabled despite detected collisions in `packages/shape-workbench/src/screens/Export.tsx:105,124` — disable or require explicit override when `built.collisions.length > 0`.
- CR-062: [Suggestion] `capabilities` memoized on the whole `state` in `packages/shape-workbench/src/App.tsx:78` — every keystroke invalidates the provider context; use stable dispatch/navigate + narrow selectors.
- CR-063: [Suggestion] `autoFingering` seed effect keyed on a fresh-identity object in `packages/shape-workbench/src/screens/Editor.tsx:132` (re-runs every render, guarded by boolean); seed in `handleCellsChange` or lazy initializer. The `seed` memo at line 74 has the same smell.
- CR-064: [Suggestion] `onEditShape` shallow-copies the registry entry in `packages/shape-workbench/src/handlers.ts:135` — draft, original, and live registry share array references; structured clone is cheap insurance.
- CR-065: [Suggestion] `REPLACE_STATE` is dead code in `packages/shape-workbench/src/store.ts:42,64` — wire it to GET-changeset rehydration or drop it.
- CR-066: [Suggestion] `frettedScaleFor` hand-assembles a `FrettedScale` literal inside a component in `packages/shape-workbench/src/editor/IdentifyAndRoots.tsx:50` — move to a pure `editor/*` helper.

### site/

Note: the admin area was deleted (moved to shape-workbench); former local duplicates are gone, not forked. `ShapeBoardView.tsx` is the only site-local component left.

- CR-067: [Critical] Board view renders permanently empty for `kind === "scale"` in `site/app/shapes/components/ShapeBoardView.tsx:54` — `rowGrouping: "chordType"` hardcoded; scale shapes have no `chordType`, so "Showing 0 of 0". Hide the toggle for scales, group differently, or render an explicit chord-only empty state.
- CR-068: [Important] `next/dynamic` code-split defeated in `site/app/shapes/components/ShapeLibrary.tsx:37` — lazily imports the same barrel line 27 imports statically, so the panel folds into the eager chunk (verified in `.next` output). Deep-import `shape-library-ui/src/ShapeDetailPanel`.
- CR-069: [Important] "Showing N of M" wrong in Board view at `site/app/shapes/components/ShapeLibrary.tsx:563` — reports the whole registry while `ShapeBoard` renders its own correct count below; two contradictory counts on screen.
- CR-070: [Important] Most filters silently inert in Board view — FilterBar renders all facets (`ShapeLibrary.tsx:543-565`) but `ShapeBoardView` forwards only `kind`/`nameQuery`; facets still mirror into the URL. Map facets onto boardModel or reduce the control set in board mode.
- CR-071: [Important] `site/package-lock.json:102` stale for `../packages/shape-catalog` (missing the `@tonaljs/note`/`@tonaljs/interval` peers added in bd9065b) — `npm ci` in deploy workflow validates linked `file:` targets; re-run `npm install --prefix site` and commit.
- CR-072: [Important] `site/types/shape-catalog-shims.d.ts:23,51` is a third hand-maintained copy of the render-shape signature and its second wildcard matches any `*/render-shape` specifier — root cause is shape-catalog's barrel re-exporting a Node-only printer; split a `render` subpath entry (see CR-025) to delete this file.
- CR-073: [Suggestion] Add `"sideEffects": false` to shape-catalog (and shape-library-ui) so tree-shaking of `render-shape.mjs`'s `import("prettier")`/`process.cwd()` out of the static export is guaranteed rather than incidental.
- CR-074: [Suggestion] `site/app/layout.tsx:10` imports the ~700-line tg stylesheet on every route — move to `site/app/shapes/layout.tsx`.
- CR-075: [Suggestion] "Diagrams" orientation toggle is a no-op in `site/app/shapes/components/ShapeBoardView.tsx:47,66` — omit until board cells render diagrams.
- CR-076: [Suggestion] `site/app/global.css:16-23` leaves `--tg-warn`/`--tg-error` on media-query defaults — dark-OS + light-site users get dark badge colors; map both under `:root`/`.dark`.
- CR-077: [Suggestion] Hand-rolled Grid/Board toggle in `site/app/shapes/components/ShapeLibrary.tsx:524-541` duplicates the package's toggle-group markup — export a generic `ToggleGroup` from shape-library-ui.
- CR-078: [Suggestion] `view` not round-tripped through the shapes URL state (`ShapeLibrary.tsx:106`) — Board view isn't deep-linkable while every filter is.
- CR-079: [Suggestion] Shared card dropped the deleted local card's `content-visibility: auto` / `contain-intrinsic-size` optimization — add to `.tg-card` in `packages/shape-library-ui/src/styles.css`.

---

## Phase 4: Architecture Fixes

### Fixed

**Library (src/):**
- CR-001: Fixed — 6 un-migrated barre frets corrected in `extended-chords.ts` (A_9 3→1, A_M9 3→2, A_13 3→1, A_DIM7 2→0, E_69 2→0, A_69 2→0), verified via scratch builds at three roots; all other data files swept clean. Stale audit comments updated.
- CR-003: Fixed — `applyChordShape` barres remapped by `strOffset` (clamped); `autoFingering` now returns shape-indexed output; 7-string regression tests added.
- CR-004: Fixed — `checkNameUnique` gained `options.selfName` (additive; reference-equality exclusion kept); unit tests added.
- CR-005: Fixed — identifier→names index cached per kind keyed by registry size.
- CR-006: Fixed — `prebuilt?: FrettedScale` threaded through the five arpeggio checks; single `buildFrettedScale` hoisted in both aggregate paths.
- CR-007: Fixed — CLAUDE.md dependency layers updated for `chord-scale.ts`, `changeset.ts`, `audit-integration.ts`.
- CR-008: Fixed — CHANGELOG `[Unreleased]` entry for the jazz-shell breaking change (16→8, renames); verified no other data file renames/removals.

**Merge tooling (scripts/ + shape-catalog):**
- CR-014: Fixed — `apply()` stages temp file + `renameSync` with full rollback of applied writes/unlinks on mid-loop failure.
- CR-015: Fixed — data-imports insertion unconditional; `order.includes(file)` dedupe keeps idempotency.
- CR-016: Fixed — `assertReconstructible()` refuses (new `unrecognized-content` rule) when reconstruction wouldn't reproduce the current file byte-for-byte (add + remove paths).
- CR-017: Fixed — `IDENTIFIER_PATTERN` tightened to marker∩JS grammar; idents validated in shapes-merge before other rules.
- CR-018: Fixed — `--update-counts` skips already-applied adds (and absent removes); regression test in that mode.
- CR-019: Fixed — rule 6b refuses renaming updates colliding with same-kind names; `detectCollisions` also checks renames on the authoring side.
- CR-020: Fixed — `locateOwnedRegion` kind-aware two-pass (also fixed a wrong-kind shadowing bug caught by the new regression test).
- CR-021: Fixed — rename-fallback requires reapplying patch/unset to the located block to be a no-op (deep-equal) before trusting it.
- CR-022: Fixed — remove is idempotent; already-absent targets satisfied in apply and `--check`.
- CR-023: Fixed — `scanInboundReferences()` refuses removes/renames leaving dangling `overrides`/`parentShape` (with same-changeset exemptions).
- CR-024: Fixed — optional peers `@tonaljs/scale/chord/key` declared with `peerDependenciesMeta.optional`.
- CR-026: Fixed — pinned `PRETTIER_OPTIONS` (no `resolveConfig`); vacuous parity test replaced with golden-string fallback assertion.

**UI packages:**
- CR-034: Fixed — `cellsToChordShape` pre-computes muted-string set; mute always wins; both-ordering tests added.
- CR-035: Fixed — shared primitives extracted to `detailPrimitives.tsx` + `detailTypes.ts`; import graph is a DAG; barrel unchanged.
- CR-036: Fixed — `reactGlobal.ts` deleted; root vitest.config.ts uses `esbuild: { jsx: "automatic" }`.
- CR-037: Fixed — five no-op props removed from `FretboardEditorProps`; workbench call site cleaned up.
- CR-038: Fixed — `cellKey` exported from shape-catalog board.ts and consumed by ShapeBoard.
- CR-040: Fixed — `toggleInAllOnSet` moved to shape-catalog catalog.ts with 5 invariant tests.
- CR-041: Fixed — ShapeCard one-way `visible` latch; sync effect deleted.
- CR-042: Fixed — invalid `grid`/`list`/`group` roles dropped from ShapeBoard.
- CR-043: Fixed — `fretboard-ui`/`shape-catalog` moved to peerDependencies in shape-library-ui; all lockfiles refreshed by lead.
- CR-044: Fixed — select-entry callback standardized to optional `onSelectEntry` across the package + consumers.

**Workbench:**
- CR-052: Fixed — geometry changes dispatch `SET_DRAFT` with the derived shape, so store + localStorage track live edits.
- CR-053: Fixed — `onCreateShape` reuses an existing draft (Board draft-badge resume path).
- CR-054: Fixed — `onEditShape` prefers the in-progress draft over registry re-seed.
- CR-055: Fixed — `preserveBaseSpelling` keeps original interval spellings when chroma-equivalent; metadata-only edits emit no `strings` patch (tests incl. "9M" end-to-end).
- CR-056: Fixed — empty/whitespace name refusal in `computeSaveDraft`.
- CR-057: Fixed — rejection handlers render errors in OutputPreview and ExportDiffView.
- CR-058: Fixed — `file`/`ident` live on the draft only; local shadow state removed.
- CR-059: Fixed — `ADD_CHANGE` dedups by kind::name; `REMOVE_CHANGE` + `CLEAR_CHANGES` actions with Export-screen UI; reducer + UI tests.
- CR-060: Fixed — Export screen probes `/__workbench/status` on mount; explicit "dev server required" disabled state.
- CR-061: Fixed — write button disabled with visible reason when collisions are present.

**Site:**
- CR-067: Fixed — Board toggle disabled for scales (tooltip + no-op onClick) and `ShapeBoardView` short-circuits with an explicit "Board view is chord-only" state.
- CR-068: Fixed — deep-imported `ShapeDetailPanel` AND converted all static barrel imports in ShapeLibrary/ShapeBoardView to deep imports (barrel pull-in defeated the split otherwise); verified: panel strings now only in async chunk, /shapes First Load JS 15.1→11 kB.
- CR-069: Fixed — FilterBar count hidden in board mode via `.tg-filterbar-board-mode` wrapper; ShapeBoard's header is the single count.
- CR-070: Fixed — inert facet/sort/failing-only controls hidden in board mode via the same wrapper CSS (FilterBar's public API untouched); kind toggle + name search stay live.
- CR-071: Fixed — `npm install` re-run in site/ (and all packages) after the peer-dependency changes; lockfiles committed.

### Deferred

- CR-002: GitHub issue #192 — grip-base barre offset convention not root-invariant (design decision).
- CR-025, CR-072, CR-073: GitHub issue #193 — split Node-only render printer out of the shape-catalog browser barrel.
- CR-039: GitHub issue #194 — FilterBar scale-facet dual-state refactor (public prop surface).
- CR-009..CR-013: GitHub issue #195 — library suggestions.
- CR-027..CR-033: GitHub issue #196 — merge-tooling & shape-catalog suggestions.
- CR-045..CR-051: GitHub issue #197 — UI package suggestions.
- CR-062..CR-066: GitHub issue #198 — workbench suggestions.
- CR-074..CR-079: GitHub issue #199 — site suggestions.

### Won't Fix

- (none)

---

## Phase 5: Code Simplification Review

21 findings (2 Important, 19 Suggestion) from five parallel review agents. Everything already tracked in Phase 3 was excluded.

### src/ (library)

- CR-080: [Important] Registry `add`/`remove` logic duplicated identically across three registries in `src/shape.ts:300-327` (scale), `:351-377` (chord), `:438-464` (arpeggio) — extract shared helpers parameterized on the dictionary+index pair.
- CR-081: [Suggestion] `chordShapes.query` `cagedPosition`/`tags` filter clauses (`src/shape.ts:405-413`) copied verbatim into `arpeggioShapes.query` (`:484-492`).
- CR-082: [Suggestion] `autoFingering` is ~67 lines with 4-level nesting in `src/build.ts:382-448` — split finger-assignment and barre-collapsing passes.
- CR-083: [Suggestion] `chordShapeGeometry` computed twice per shape in `auditAllShapes` (`src/audit.ts:1005-1025`) — same redundancy CR-006 fixed for arpeggios.
- CR-084: [Suggestion] Span computation duplicated near-verbatim three times in `src/audit.ts:127,578,869` — extract `fretSpan(frets)`.
- CR-085: [Suggestion] `checkCoversChord` re-derives `getChord` resolution that `chordToneChromas` already performs (`src/audit-integration.ts:188/107`) — `getChord` invoked twice per audited arpeggio.
- CR-086: [Suggestion] `checkNameUnique` packs two dense collision computations into one 53-line function (`src/audit.ts:721-773`) — extract `nameCollides`/`identifierCollides`.

### packages/shape-catalog + scripts/

- CR-087: [Important] `scanRegisteredShapes` and `scanInboundReferences` re-implement identical declaration-chunk scanning in `scripts/shapes-merge.mjs:1307-1360` — grammar changes must be applied twice or the scans diverge; extract shared `scanDeclarationChunks`.
- CR-088: [Suggestion] `deepEqualArray` (`scripts/shapes-merge.mjs:185-187`) is now a strict subset of `deepEqual` (`:194-207`) — delete and switch the one call site.
- CR-089: [Suggestion] `FileStates.apply()` rollback branch nests 5 levels in `scripts/shapes-merge.mjs:508-521` — extract a `restoreFile` helper.
- CR-090: [Suggestion] `planMerge()` is ~630 lines (`scripts/shapes-merge.mjs:665-1296`) — extract the numbered spec rules into `validateRuleN` functions.
- CR-091: [Suggestion] `detectCollisions` add/rename blocks structurally similar in `packages/shape-catalog/src/changeset.ts:181-251` — shared helper parameterized on `{ trackIdentifier }`.

### packages/shape-library-ui + fretboard-ui

- CR-092: [Suggestion] Toggle-group widget duplicated three times intra-package (`FilterBar.tsx:401-411` private, `ColumnsToggle.tsx:16-34`, `DiagramOrientationToggle.tsx:16-34`) with a11y drift (FilterBar's copy lacks `role="group"`/`aria-label`) — extract one generic `ToggleGroup`. (Distinct from CR-077, which is site-side.)
- CR-093: [Suggestion] `cellsToChordShape` duplicates `cellsToScaleShapeStrings` root-resolution + cell-sort logic in `packages/fretboard-ui/src/FretboardEditor.tsx:226-230/271-275,233/286` — factor a shared helper.

### packages/shape-workbench

- CR-094: [Suggestion] Byte-identical `copyToClipboard` in `editor/OutputPreview.tsx:23-29` and `export/ExportDiffView.tsx:29-35` — extract shared helper.
- CR-095: [Suggestion] `resolvedFetch` fallback expression repeated verbatim in `screens/Export.tsx:65,98`.
- CR-096: [Suggestion] `STATUS_CLASS` badge map duplicated between `editor/ChecksCard.tsx:21-26` and `export/ExportChangeList.tsx:20-25`.
- CR-097: [Suggestion] `onAddTag` duplicates its body across chord/scale branches in `handlers.ts:176-203` — unify after computing `kind`/`base`/`original` once.
- CR-098: [Suggestion] `ExportDiffView` TS-fetch effect repeats the same `renderShapeTs().then()` block twice (`export/ExportDiffView.tsx:63-82`) — collapse to a loop.

### site/

- CR-099: [Suggestion] `handleGridSelectEntry` is misleadingly named in `site/app/shapes/components/ShapeLibrary.tsx:353` — it's wired to board and grid alike; rename per its own comment.
- CR-100: [Suggestion] Grid-view JSX stayed inline (`ShapeLibrary.tsx:650-693`) while the board branch became `ShapeBoardView` — extract a sibling `GridView` for symmetry.

No dead code, orphaned CSS, or stale references from the component-deletion refactor were found (site agent grepped all deleted component names).

---

## Phase 6: Code Simplification Fixes

### Fixed

- CR-080: Fixed — module-private generic `upsertShape`/`removeShapeByName` helpers in `src/shape.ts`; all three registries delegate to them. Public API and behavior unchanged.
- CR-087: Fixed — shared `scanDeclarationChunks` generator in `scripts/shapes-merge.mjs`; `scanRegisteredShapes` and `scanInboundReferences` rebuilt on it, keeping their own field-extraction logic.

### Deferred

- CR-081..CR-086, CR-088..CR-091: GitHub issue #200 — library & merge-tooling simplification suggestions.
- CR-092..CR-100: GitHub issue #201 — UI/workbench/site simplification suggestions.

Verification: `npm run lint` clean, `npm run build` clean, `npm test` 1701/1701.

---

## Phase 7: Specialized Reviews

6 findings (4 Critical, 1 Important, 1 Important-downgraded).

### Security

- CR-101: [Critical] Arbitrary TypeScript injection into generated `src/data/*.ts` via unescaped object-literal keys — `scripts/lib/render-shape.mjs:178-187` (`collectKeys`) appends any unknown `shape`/`patch` keys as "extra" fields and `renderTopLevelObject`/`renderNestedObject` (`:238-246,260-264`) interpolate key names unescaped; nothing in `shapes-merge.mjs` allowlists keys. A malicious changeset key like `"x\": 1 }; …; const y = { z"` injects top-level statements into a file later imported by build/test. Fix: reject keys not matching `IDENTIFIER_PATTERN`/known field lists (top-level and nested `barres` entries) before rendering.
- CR-102: [Critical] No Origin/Host/Content-Type validation on the workbench-io endpoints (`packages/shape-workbench/src/plugins/workbench-io.ts:268-324`) — a `Content-Type: text/plain` POST is a CORS simple request, so any web page open while `vite dev` runs can overwrite `.workbench/changeset.json` (content attacker-controlled; path containment is enforced). Chains with CR-101 into no-interaction code execution via the documented `shapes:merge` workflow. Fix: require `application/json` and reject mismatched `Origin` (when present) / non-local `Host`.
- CR-103: [Important] Unbounded request-body read in `readRequestBody` (`workbench-io.ts:226-233`) — memory-exhaustion DoS against the dev server; cap at a few MB.

No XSS vectors found (all shape data rendered via JSX text); no secret-handling changes in the diff.

### Type Safety

- CR-104: [Critical] Unvalidated `as` cast on `fetch().json()` success body in `packages/shape-workbench/src/export/writeChangeset.ts:115` — a wrong-shaped response silently reports a successful write with `undefined` fields; validate structurally like the error path already does.
- CR-105: [Critical] Unvalidated `JSON.parse(raw) as Partial<WorkbenchState>` on the localStorage read in `packages/shape-workbench/src/store.ts:130` — a structurally-wrong persisted value flows into live state (`state.changes.some(...)` etc. assume shapes); validate `drafts`/`changes` structure, falling back to `initialWorkbenchState`.

All other `as` casts checked were guarded by upstream `kind` checks or internal round-trips.

### Accessibility

- CR-106: [Important] Fretboard editor grid is mouse-only — `packages/fretboard-ui/src/Fretboard.tsx:159-320` / `FretboardEditor.tsx:53-215` have no `tabIndex`/`role`/`onKeyDown`; a keyboard-only user cannot place, root, finger, or mute a note in the workbench editor. Needs roving-tabindex grid cells with arrow-key navigation + Enter/Space, or a parallel keyboard input path. *(Reported Critical by the review agent; triaged to Important: the workbench is a local dev-facing tool per the review weighting, and the fix is a substantial feature — deferred with a tracking issue rather than patched inline.)* Everything else already passes: `role="img"` + labels on diagrams, Escape/focus management on the panel, `aria-live` regions, labeled icon buttons, no suppressed focus outlines.

---

## Phase 8: Specialized Fixes

### Fixed

- CR-101: Fixed — `assertValidKey` in render-shape.mjs (identifier-pattern check on every unescaped key, last line of defense) + `assertKnownShapeFields` in shapes-merge.mjs refusing (`unknown-field`) any shape/patch/barre key outside the per-kind `FIELD_ORDER`/`BARRE_KEYS` allowlists (primary defense). 9 regression tests incl. the hostile-key payload; nothing is written.
- CR-102: Fixed — workbench-io POST now returns 415 for non-`application/json` (forces CORS preflight) and 403 for cross-origin `Origin`; no-Origin tooling clients still work. 9 unit tests.
- CR-103: Fixed — `readRequestBody` capped at 8 MB, request destroyed, 413 returned. 4 tests.
- CR-104: Fixed — `successBodyFrom` validates the write response structurally; malformed responses return `ok: false`. 3 tests.
- CR-105: Fixed — `loadPersistedState` validates the parsed payload (plain object; `drafts` object / `changes` array of objects) with per-field fallback. 5 tests.

### Deferred

- CR-106: GitHub issue #202 — keyboard operability for the fretboard editor grid.

Verification: lint clean, root build clean, `npm test` 1732/1732 (+31 new), workbench `tsc --noEmit` + vite build clean.
