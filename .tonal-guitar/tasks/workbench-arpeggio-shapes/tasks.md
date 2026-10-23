# Task Plan: Shape Workbench arpeggio shapes (#212)

## Overview

Total Tasks: 3 Task Groups
Add shape-catalog arpeggio entries, put them on the workbench arpeggio board, and make the workbench Editor able to open, edit and export a registered arpeggio as an `update` change.

## Task List

#### Task Group 1: shape-catalog arpeggio entries + shape-library-ui union safety

**Dependencies:** None

- [ ] 1.1 `ArpeggioCatalogEntry` variant + `ShapeKind` `"arpeggio"` + `buildArpeggioCatalog(auditResult)`
  - File: `packages/shape-catalog/src/catalog.ts`
- [ ] 1.2 Make kind-switching helpers union-safe (`metadataLines`, `buildReportUrl`, search, detail)
- [ ] 1.3 `FilterBar` `kinds?: ShapeKind[]` prop (default `["scale","chord"]`); arpeggio-safe `ShapeCard`/`ShapeDetailPanel`/`BoardCellCard`
- [ ] 1.4 Tests: entry generation; `boardModel` arpeggio 20 filled / 0 gaps; FilterBar `kinds`
- [ ] 1.5 Verify: `npm run lint && npm test` (root); `npx tsc --noEmit` in `site/`

**Acceptance Criteria:**

- `buildArpeggioCatalog(auditAllShapes())` returns 20 entries with `kind: "arpeggio"`, the source shape and its links/tags, built geometry and audit issues
- The site's catalog and UI are unchanged

---

#### Task Group 2: workbench Board + handlers

**Dependencies:** Task Group 1

- [ ] 2.1 Board: catalog includes arpeggios; FilterBar gets three kinds; arpeggio board uses CAGED columns
- [ ] 2.2 handlers: `onEditShape`/`onDuplicateToPosition`/`onAddTag` produce `kind: "arpeggio"` drafts for arpeggio entries
- [ ] 2.3 Tests: Board arpeggio view shows 20 filled cells, 0 gaps; handler tests for arpeggio entries
- [ ] 2.4 Verify: `npm run lint && npm test`

---

#### Task Group 3: workbench Editor arpeggio path

**Dependencies:** Task Group 1

- [ ] 3.1 `editor/deriveArpeggio.ts`: seed cells from an `ArpeggioShape`; derive an `ArpeggioShape` from cells (lowest-`1P` rootString, base spelling/order preserved)
- [ ] 3.2 `saveDraft.ts` and `checks.ts` arpeggio branches
- [ ] 3.3 `ArpeggioPropertiesForm.tsx` + arpeggio editor in `Editor.tsx` (note/root tools, preview, checks, save)
- [ ] 3.4 Tests: all 20 seeds round-trip to an empty-patch `UpdateChange`; an edit yields a minimal patch; Editor renders and saves an arpeggio draft
- [ ] 3.5 Verify: `npm run lint && npm test`

---

## Execution Order

1. **Task Group 1** — shared types every workbench change depends on
2. **Task Groups 2 and 3** — in parallel after Group 1 merges (no file overlap)

## Files to Modify

| File Path | Task |
| --------- | ---- |
| `packages/shape-catalog/src/{catalog,board,detail}.ts` + tests | 1 |
| `packages/shape-library-ui/src/{FilterBar,ShapeCard,ShapeDetailPanel,BoardCellCard}.tsx` + tests | 1 |
| `packages/shape-workbench/src/screens/Board.tsx`, `handlers.ts` + tests | 2 |
| `packages/shape-workbench/src/screens/Editor.tsx`, `editor/*` + tests | 3 |
