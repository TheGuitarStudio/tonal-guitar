# Requirements: Shape Library Detail Side Panel

## Initial Description

Clicking a shape card in the Shape Library (`site/app/shapes/`) opens a side panel with
Tonal.js-powered context for the shape: identified chord name(s), scales containing the
chord, alternate fingerings of the same chordType from the registry, and inversions.
Includes a visual reorganization pass on the Shape Library page.

## Requirements Discussion

### Round 1 Questions

**Q1: What should "scales containing this chord" mean in the panel?**
**Answer:** Both, grouped — root-anchored list first ("scales you can play over Cmaj7":
scales rooted at the chord's root whose pitch classes contain the chord tones), with an
expandable "other parent scales" section (any root whose pitch classes contain the
chord tones) below.

**Q2: Where should the chord→scales containment helper live?**
**Answer:** Library — new tested public function in `src/integration.ts` (e.g.
`scalesContainingChord`), chroma-subset sweep over a fixed scale corpus. Becomes
reusable public API with docs. (Matches Codex review recommendation.)

**Q3: How should the detail panel present on desktop (slide-over vs docked master-detail vs expanding card)?**
**Answer:** Undecided — user wants design experiments first: build test HTML pages of
the candidate layouts and evaluate by looking at them before committing. The panel
likely shows small SVG chord thumbnails with hover-to-enlarge ("hoverability to see a
better image"), but presentation form is TBD pending experiments.

**Q4: What should the visual reorganization pass concretely include?**
**Answer:** Grouped sections (group-by toggle, failing shapes stay pinned to preserve
the audit invariant), sticky filter bar, per-group count badges — plus a deeper
taxonomy direction: **voicing family should be a tag/category, not part of the shape's
display name.** "E m7b5 Open" bothers the user as a *name*; the mental model is: the
chord entity is "Em7b5", and it *has* an open version, drop-2 / drop-3 versions, shell
versions, etc. This implies sub-filters (chord quality → voicing family), and possibly
a modal or a whole-page reorganization when filtered. Needs experiments to see how it
feels. (Registry names stay as-is — this is a display/taxonomy layer, derived from
existing `chordType` / `voicingFamily` / `canonicalRoot` metadata.)

### Existing Code to Reference

- Shape Library page: `site/app/shapes/components/*` — catalog, filters, URL state,
  lazy cards (see research.md §Codebase for full inventory)
- URL deep-link pattern: `parseShapesUrlState`/`serializeShapesUrlState`
  (`shapeLibraryUtils.ts`) — extend with panel-open param
- Deferred-computation idiom: `ensureReportUrl` (`ShapeCard.tsx:54–57`)
- Compact fretboard rendering: `<Fretboard layout={...}>` overrides
  (`packages/fretboard-ui/src/theme.ts:34–47`)

### Follow-up Questions

**Follow-up 1 (after browsing the experiments): Which panel presentation?**
**Answer:** Slide-over — but non-modal: the rest of the page stays interactive; clicking
another chord card replaces the panel content in place. (Logged as D-005.)

**Follow-up 2: Card density?**
**Answer:** Cards should be a bit smaller so more chords fit on screen — "seeing more
at a glance is helpful." Compact card = name + voicing tag + diagram only.

**Follow-up 3: Filtering/sorting model?**
**Answer:** Needs more exploration. Research dispatched on how existing chord tools
sort/categorize chord libraries: toggleable category chips (on/off), root pickers,
type pickers, sort orders, etc. Findings will drive another experiment round and
D-006. Still open: mobile presentation.

## Visual Assets

### Files Provided:

None from the user. Design-experiment HTML pages to be produced during shaping:
`.tonal-guitar/features/shape-detail-panel/experiments/` (self-contained mockups of
panel + taxonomy candidates, using real registry names/data).

### Visual Guidance:

- Match the existing site: Tailwind-esque dark-first styling, fumadocs `fd-*` semantic
  tokens, hand-rolled small primitives (no UI library)
- Audit surface (failures-first, badges, report flow) must remain visually primary
- Small SVG chord diagrams as thumbnails; hover to see a larger rendering

## Requirements Summary

### Functional Requirements

- **Detail panel (form TBD by experiments):**
  - Opens from a shape card interaction; close via Esc / explicit control
  - Identified chord name(s) via `identifyChord` for chord entries
  - Scales containing the chord: root-anchored group + expandable all-roots group
  - Alternate fingerings of the same chordType (thumbnails, hover-to-enlarge),
    graceful empty state when registry has none
  - Inversions of the same chordType, grouped/labeled
  - Deep-linkable open state (URL `shape` param) — decided yes per Codex review
- **Library:**
  - New `scalesContainingChord` (name TBD) in `src/integration.ts`: chroma-subset
    sweep, fixed scale corpus, root-anchored + all-roots results, omitted-tone
    handling, tests + `docs/api/integration.md` entry
- **Page reorganization:**
  - Chord-quality-first taxonomy with voicing family as tags/sub-filters (display
    layer only; registry names unchanged)
  - Grouped sections with count badges; failing shapes pinned; sticky filter bar
  - Exact interaction form (sub-filter chips vs modal vs page morph) decided by
    experiments

### Reusability Opportunities

- `ShapeCatalogEntry` as the panel's input contract (no new catalog plumbing)
- Existing URL-state parse/serialize pattern
- `<Fretboard>` `layout` overrides for thumbnails — no new fretboard-ui component

### Scope Boundaries

**In Scope:** panel + library helper + reorganization as above; explicit `@tonaljs/*`
deps in `site/package.json`; production-build bundle check.

**Out of Scope:** audio (#67), editing (#66), multi-shape overlay (#65),
`inferChordShape` (#36), voice-leading (#33), registry data fixes (#56–58),
`analyzeInKey` key-context UI, site test infrastructure, registry renames.

### Technical Considerations

- Static-export compatible; hydration-safe URL handling (existing pattern)
- Compute Tonal context per opened entry only (`useMemo` keyed on entry)
- Bundle-size check in production build; consider lazy-loading the panel
- Empty states are first-class (registry gaps: no minor-triad CAGED, missing
  chordType/inversion metadata on base CAGED majors)
- Root-ambiguity semantics resolved: both groups, root-anchored primary (Q1)
