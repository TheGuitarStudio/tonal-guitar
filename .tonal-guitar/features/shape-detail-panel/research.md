# Research: Shape Library Detail Side Panel

**Date:** 2026-07-21 | **Issue:** #139

---

## Codebase Research

### The Shape Library page (primary surface)

All state lives in `site/app/shapes/components/ShapeLibrary.tsx`:

- Filter state: `kind`, `system`, `familyOrQuality`, `nameQuery`, `failingOnly`; `auditAllShapes()` runs once in a `useMemo` (`ShapeLibrary.tsx:35`), `buildCatalog` derives the 159-entry catalog (27 scale + 132 chord).
- **URL deep-link state already exists** (`ShapeLibrary.tsx:53–77`): parse-on-mount guarded by a `urlStateLoaded` flag, mirror-on-change via `history.replaceState`, helpers `parseShapesUrlState`/`serializeShapesUrlState` in `shapeLibraryUtils.ts` (params `kind`/`system`/`family`/`q`/`failing`). This is the exact pattern to extend with a panel-open/`shape` param.
- Grid: flat `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` of `LazyShapeCard` (IntersectionObserver-gated, `EAGER_CARD_COUNT = 9`).
- **`ShapeCard` has no click handler at all** — it is a static `div` (`ShapeCard.tsx:80`). Click-to-open is genuinely new interaction surface. The card's `ensureReportUrl` hover/focus-deferred pattern (`ShapeCard.tsx:54–57`) is the codebase's "defer expensive computation until interaction" idiom — the panel's Tonal calls should follow it (compute per opened entry in a `useMemo`, never for all 159 cards).
- `ShapeCatalogEntry` (discriminated union in `shapeLibraryUtils.ts`) already carries everything the panel needs as base data: `shape`, `renderRoot`, `frettedScale`, `builtFrets`, `issues`, plus chord-only `sourceFrets`/`gripRoot`. The panel can take `entry: ShapeCatalogEntry` directly; only the derived context (chord ID, related scales, alternates, inversions) is new computation.
- **No modal/drawer/side-panel pattern exists anywhere in `site/`** (checked `admin/`, `experiments/`). No UI library is used; small primitives are hand-rolled (`ToggleGroup` in `FilterBar.tsx:150–181`). A new panel is built from scratch with Tailwind + `fd-*` tokens.

### Library capabilities the panel consumes (`src/integration.ts`)

```ts
identifyChord(frets: (number | null)[], tuning?: string[]): string[]
relatedScales(frettedScale: FrettedScale): Array<{ root: string; scale: string }>
analyzeInKey(frets, keyName, tuning?): KeyAnalysis
modeShapes(modeName: string, shapeSystem?: string): ScaleShape[]
buildFromScale(shape: ScaleShape, scaleName: string, tuning?): FrettedScale
```

- `identifyChord` (`integration.ts:248–268`) takes a per-string fret array (low→high, null = muted) — exactly `entry.builtFrets`. Cheap; safe to call synchronously on panel-open. `docs/api/integration.md` has worked examples for spot-checks.
- **`relatedScales` requires `frettedScale.scaleType`/`root` populated** (it calls `modeNames(`${root} ${scaleType}`)`). `buildCatalog` builds scale entries via plain `buildFrettedScale`, which leaves `scaleType: ""` — the panel needs its own `buildFromScale` call (deriving a scale name from the shape's `quality`/`parentShape` metadata) before `relatedScales` works.
- **For chord entries `relatedScales` does not cleanly apply**: `modeNames` resolves against Tonal's *scale* dictionary; feeding a detected chord type (e.g. "major seventh") returns `[]` for most chord types. **Biggest "library API doesn't quite fit" risk in this feature.** Options: (a) curated chordType→scale-name mapping, or (b) chroma-subset sweep over a fixed list of common scales (major, natural/harmonic/melodic minor, the 7 diatonic modes) checking the chord's pitch classes are contained. Resolve in Shape phase.
- `analyzeInKey` needs a caller-supplied key, which the page has no notion of — likely out of scope for v1 unless the panel adds a key picker.

### Registries — alternate fingerings and inversions

- `chordShapes.query({ chordType, system, voicingFamily, stringSet })` (`shape.ts:165–188`) directly satisfies "alternate fingerings of the same chordType" (exclude current entry by name). `inversion` is **not** a query param — filter/group client-side on `ChordShape.inversion`.
- Not every chord shape has `chordType`/`inversion` populated (the 5 base CAGED majors lack both; `checkChordMetadataCompleteness` flags this) — panel must degrade gracefully (`chordType === undefined` → skip section or fall back to `voicingFamily` grouping).

### Fretboard rendering (`packages/fretboard-ui`)

`<Fretboard>` is stateless SVG, fully parameterizable via `layout` (`theme.ts:34–47`: `cellWidth`, `cellHeight`, `markerRadius`, `showFretNumbers`, `showStringLabels`, gutters). Compact alternate-fingering thumbnails need **no new fretboard-ui component** — just a new adapter (parallel to `ShapeCardDiagram.tsx`) with a reduced `layout`. `onMarkerClick`/`onCellClick` exist if thumbnails should be clickable. `intervalFromTo`/`intervalToDegreeNumber` re-exports are available for relabeling intervals against a different root.

### Peer-dependency risk (real, latent)

- `@tonaljs/scale`/`chord`/`key` are *optional* peers of `tonal-guitar`; `site/package.json` declares **none** of the `@tonaljs/*` packages.
- `src/index.ts` statically re-exports all of `integration.ts` (top-level imports of the optional peers) and does side-effect data imports — not tree-shakeable. The site resolves the optional peers today **only** by incidental monorepo hoisting (root `node_modules` via the `file:..` symlink). A standalone `site/` install would break.
- **Recommendation:** add `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`, `@tonaljs/note`, `@tonaljs/interval` as explicit `dependencies` of `site/` as part of this feature — it is the first feature to *intentionally* rely on integration-tier calls at runtime.

### Suggested Code Placement

| New/Modified File | Rationale |
| ----------------- | --------- |
| `site/app/shapes/components/ShapeDetailPanel.tsx` (new) | The panel; receives selected `ShapeCatalogEntry` + close callback; Tonal work in `useMemo` keyed on entry |
| `site/app/shapes/components/shapeDetailUtils.ts` (new, pure) | chordType→related-scales resolution, alternate/inversion grouping, entry→input adapters |
| `site/app/shapes/components/CompactFretboard.tsx` (new) or `compact` prop on `ShapeCardDiagram` | Thumbnail diagrams for alternate fingerings |
| `shapeLibraryUtils.ts` (modify) | Extend `ShapesUrlState` + parse/serialize with panel-open shape param |
| `ShapeLibrary.tsx` (modify) | `selectedEntry` state (URL-synced), click handler down, render panel as grid sibling |
| `ShapeCard.tsx` (modify) | `onSelect` prop; clickable wrapper with button semantics + keyboard handler |
| `FilterBar.tsx` / `ShapeLibrary.tsx` (modify) | Visual reorg pass: grouping toggle, grouped `<section>` rendering |
| `site/package.json` (modify) | Declare `@tonaljs/*` dependencies explicitly |

---

## Product Research

### Roadmap Alignment

`docs/product/mission.md`/`roadmap.md` do not exist; de-facto roadmap is CLAUDE.md "Remaining work" (fully checked off) + GitHub milestones: `v0.2.0 — Registry depth` (#56–#58, #37) and `Lab v2` (#64–#67, #29). This feature is standalone (#139, no milestone), additive on a just-shipped page, and consumes only existing tested library primitives — no new library work required.

**Alignment:** Moderate-to-strong.

### Related Specifications

| Document | Relevance |
| -------- | --------- |
| `.tonal-guitar/features/shape-visual-audit-library/` (spec, requirements, decisions) | Built the page. Constraints to honor: public read-only, no NODE_ENV gating, static-export compatible (no server routes), failures-first sort + badge prominence stays primary (D-004), derived-not-hardcoded lists, branch on structured fields not message strings. Chord ID/related scales/alternates/inversions were never mentioned — new ground, not a picked-up deferral. |
| `.tonal-guitar/features/connector-lab-integration/` | Precedent for "wire existing pure library functions into a site page, zero library changes." Site has **no test infrastructure** — manual verification incl. `DEPLOY=true npm run build`. |
| `docs/QUESTIONS.md` Q4 (open) | 3NPS shapes carry traditional modal names that `isShapeCompatible`/`modeShapes` won't corroborate — panel should not assert registry name and Tonal-derived modal names must match. |
| `docs/QUESTIONS.md` Q3 (resolved) | `identifyChord` enharmonic matching (#61) sets precedent for chord-name display handling. |

### User Context

The page was designed as a **failures-first audit tool** for maintainers (D-004). The panel adds a **learner/guitarist-facing reference workflow** ("what chord is this, where does it live, how else can I play it"). These coexist if the audit surface (failures-first sort, badges, report flow) remains undisturbed and the panel is additive. The site already serves the learner persona via Guitar Lab, so this is consistent evolution, not drift.

### Scope Assessment

**In Scope (first shippable slice):**

- Click-to-open side panel per card, driven by the existing `ShapeCatalogEntry`
- Chord identification (`identifyChord(builtFrets, tuning)`) for chord entries
- Related scales/modes for scale entries (via `buildFromScale` + `relatedScales`); chord-entry scale containment per the resolution chosen for the modeNames gap
- Alternate fingerings via `chordShapes.query({ chordType })`, current shape excluded, graceful empty state
- Inversions: display current `inversion`, group/link sibling inversions from the same query
- Visual reorganization pass on filter/grid without breaking existing URL deep-links
- Explicit `@tonaljs/*` deps in `site/package.json`

**Out of Scope:**

- Audio / click-to-play (#67); editing from the panel (#66 / dev-only ShapeEditor); multi-shape overlay (#65); `inferChordShape` (#36); voice-leading navigation (#33)
- Fixing registry gaps the panel exposes (#56/#57/#58) — panel shows graceful empty states instead
- New site test infrastructure (site verification stays manual)
- `analyzeInKey` key-context UI (needs a key picker; defer)

**Adjacent Features (separate efforts):** #64, #65, #66, #67, #29 (Lab v2), #36, #33, and the v0.2.0 registry-depth milestone.

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
| --------------- | -------- | ---------- |
| `relatedScales`/`modeNames` doesn't accept chord types — "scales containing this chord" has no direct library call | High | Decide in Shape phase: curated chordType→scale mapping vs. chroma-subset sweep over a fixed scale list; possibly a new pure helper worth upstreaming to `src/` later |
| Optional `@tonaljs/*` peers resolve only via incidental monorepo hoisting | Medium | Declare explicit deps in `site/package.json` within this feature |
| Registry metadata gaps (`chordType`/`inversion` missing on base CAGED majors; no minor triads, #57) | Medium | Graceful empty states as first-class design, not error styling |
| Panel compute cost if run eagerly for 159 entries | Low | Compute per opened entry in `useMemo` (established `ensureReportUrl` idiom) |
| 3NPS modal naming mismatch (Q4) | Low | Don't assert registry names match Tonal-derived names; optional footnote in UI |
| Visual reorg could disturb the audit workflow (failures-first, badges) | Medium | Treat audit surface as invariant; reorg is grouping/layout only |

## Open Questions

- Should the open panel's shape be URL-encoded (e.g. `?shape=E+m7b5+Open`) for deep-linking, extending `ShapesUrlState`? (Precedent exists; decide deliberately.)
- Panel presentation: slide-over overlaying the grid vs. docked panel that narrows the grid vs. expanding card? Mobile behavior (bottom sheet vs. full-screen)?
- How to resolve "scales containing this chord" (curated mapping vs. chroma-subset sweep) — and does that helper belong in `site/` or upstream in `src/` (new library function, needs tests + docs if so)?
- What does the visual reorganization concretely include — grouping by system/voicingFamily, collapsed sections, sticky filter bar, count badges per group?
- Should alternate-fingering thumbnails be clickable (swap into panel / navigate selection)?
- For scale entries, which scale name seeds `buildFromScale` — derive from `quality` (`major`/`minor`) and is that reliable for pentatonic boxes?
