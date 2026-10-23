# Task: Shape Workbench: open and edit registered arpeggio shapes (shape-catalog arpeggio entries)

**Issue:** #212 | **Started:** 2026-10-22 | **Size:** L

## Status

- [x] Investigate
- [x] Execute

## Context

- **Origin:** #212
- **Branch:** feat/212-workbench-arpeggio-shapes
- **Description:** Give `shape-catalog` arpeggio entries for the 20 registered CAGED arpeggio seeds, show them on the workbench's arpeggio board, and let the Editor open, edit and export one as an `update` change that `shapes:merge` applies to `src/data/caged-arpeggios.ts`.

## Investigation

- `buildCatalog` (`packages/shape-catalog/src/catalog.ts`) emits only scale and chord entries; `ShapeKind` is `"scale" | "chord"`. `auditAllShapes` already returns an `arpeggio` map, so issues are available.
- `boardModel` (`board.ts`) already supports `kind: "arpeggio"` (rows from `chordType`, CAGED columns, `ArpeggioSlot` cells) and falls back to `CHORD_SCALE_RULE` rows only when no arpeggio entries exist. With no entries, every cell is a gap.
- The workbench Board can't select arpeggios at all: `FilterBar`'s `KIND_TOGGLE_OPTIONS` (shape-library-ui) is hardcoded to Scale/Chord.
- `handlers.ts` `onEditShape`/`onDuplicateToPosition`/`onAddTag` branch chord-else-scale, so an arpeggio entry would become a `kind: "scale"` draft.
- The Editor is chord-only: `EditorScreen` renders an "isn't implemented yet" placeholder for any non-chord draft. `deriveShape.ts`, `saveDraft.ts`, `checks.ts` and `PropertiesForm` are `ChordShape`-typed.
- `fretboard-ui` already has `cellsToScaleShapeStrings` (cells → per-string interval arrays) and `frettedNotesToCells`, so an arpeggio editor needs no new fretboard-ui code. Two traps: it takes `rootString` from the first `isRoot` cell (and `frettedNotesToCells` marks every `1P` as root), and it sorts each string by fret and emits only simple interval names.
- Export side already handles arpeggios: `changeInfo.ts` audits with `auditArpeggioShape*`, `previewText.ts` renders via `renderShapeTs(draft.kind, ...)`, and `shapes:merge` knows `ArpeggioShape` and owns `caged-arpeggios.ts` (GENERATED header).
- The site passes `buildCatalog(...)` straight into `FilterBar entries=`, so adding arpeggios to `buildCatalog` itself would change site counts.

### Files to Change

| File | Change | Status |
| ---- | ------ | ------ |
| `packages/shape-catalog/src/catalog.ts` | `ArpeggioCatalogEntry` variant, `ShapeKind` + `"arpeggio"`, `buildArpeggioCatalog`, union-safe helpers | complete |
| `packages/shape-catalog/src/catalog.test.ts` | arpeggio entry generation tests | complete |
| `packages/shape-catalog/src/board.test.ts` | arpeggio board: 20 filled, 0 gaps | complete |
| `packages/shape-catalog/src/detail.ts` | `ArpeggioDetail` in `PanelDetail` | complete |
| `packages/shape-library-ui/src/FilterBar.tsx` | optional `kinds` prop (default Scale/Chord) | complete |
| `packages/shape-library-ui/src/ShapeDetailPanel.tsx` (+ ShapeCard/BoardCellCard tests) | arpeggio detail view and label; ShapeCard/BoardCellCard needed no change | complete |
| `packages/shape-workbench/src/screens/Board.tsx` | include arpeggio catalog, three-kind toggle, CAGED-only axis for arpeggios | complete |
| `packages/shape-workbench/src/handlers.ts` | arpeggio-aware edit/duplicate/tag handlers | complete |
| `packages/shape-workbench/src/editor/deriveArpeggio.ts` (new) | cells ⇄ `ArpeggioShape` conversion | complete |
| `packages/shape-workbench/src/editor/saveDraft.ts`, `checks.ts` | arpeggio branches | complete |
| `packages/shape-workbench/src/editor/ArpeggioPropertiesForm.tsx` (new) | arpeggio metadata fields | complete |
| `packages/shape-workbench/src/screens/Editor.tsx` | arpeggio editor path | complete |
| `CHANGELOG.md` | `[Unreleased]` entries | complete |

## Plan

1. **G1 (shape-catalog + shape-library-ui):** add the arpeggio catalog entry type and `buildArpeggioCatalog`, make every kind-switching helper/component union-safe, add `FilterBar` `kinds`. Tests: 20 entries with identity/geometry/links/tags; `boardModel` arpeggio → 4 rows × 5 columns, 20 filled, 0 gaps.
2. **G2 (workbench Board + handlers), after G1:** Board includes arpeggios and offers an Arpeggio kind; handlers create `kind: "arpeggio"` drafts.
3. **G3 (workbench Editor), after G1, parallel with G2:** arpeggio editing path (note/root tools), arpeggio checks and save. Key test: every seed opened and re-derived with no edits yields an `UpdateChange` with an empty patch.
4. **Orchestrator verification:** run `shapes:merge` end to end on a one-seed `update` changeset and confirm only that seed's block changes; then `npm test && npm run lint && npm run build` and `npx tsc --noEmit` in `site/`.

## Progress

- 2026-10-22: Investigation done; board item moved to In Progress.
- 2026-10-22: G1 (shape-catalog/shape-library-ui) merged. `serializeShapesUrlState` skips `kind=arpeggio` so site URLs can't carry it.
- 2026-10-22: G2 (Board + handlers) merged. The arpeggio board always uses CAGED columns and hides the Columns toggle. Arpeggio duplicate-to-position drafts are keyed `arpeggio:<type>::<pos>` so they can't collide with chord drafts, and `draftFor` maps arpeggio gap drafts back to their cell.
- 2026-10-22: G3 (Editor) merged. All 20 seeds round-trip at roots A/C/F# (re-deriving with no edits gives an empty patch). A new gap arpeggio draft defaults its file to `caged-arpeggios`.
- 2026-10-22: Verified: `npm test` (2015 tests), lint, build, site `tsc --noEmit`. The workbench produced two changesets for E Shape Minor Arpeggio, one tags-only and one geometry (`strings`). `shapes:merge` applied each with a clean audit, and each changed one line inside that seed's block. No browser was available for a click-through.

## Decisions

- **D1: Arpeggio entries come from a separate `buildArpeggioCatalog`, not `buildCatalog`.** The site passes `buildCatalog` output straight into `FilterBar`/grid counts. Keeping arpeggios opt-in leaves the site's runtime unchanged.
- **D2: Read-only arpeggio display in shape-library-ui/site is deferred (scope item 3).** shape-library-ui components only get the type-level changes they need to render an arpeggio entry in the workbench. Showing arpeggios on the docs site needs its own UX pass (an Arpeggios tab, URL state, detail view), so it is a follow-up, not part of #212.
- **D3: Arpeggio board rows come from the registered entries' chord types**, matching the chord board. The `CHORD_SCALE_RULE` fallback still applies when no arpeggios are registered. This gives 4 rows (M, m, maj7, m7) and no gaps, but no cell to start a new arpeggio chord type from. Authoring new arpeggio types is #58 territory.
- **D4: The arpeggio editor edits geometry (intervals per string + root) and metadata only.** `fingers` (per-string arrays) is carried through unchanged and can't be edited yet. None of the seeds set it.
