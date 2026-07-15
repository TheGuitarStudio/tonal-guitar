# Requirements: Shape Visual Audit Library

## Initial Description

A public "Shape Library" page on the deployed site that renders every registered scale and chord shape as a fretboard diagram alongside its full properties, with filter/search, client-side invariant-check badges that surface likely-broken shapes first, and a "report problem" link opening a prefilled GitHub issue that feeds the `/fix` pipeline. (Issue #97; follow-on to the #39/#94/#96 data-quality thread.)

## Requirements Discussion

### Round 1 Questions

**Q1:** The review's biggest risk: `applyChordShape` rebuilds from intervals and ignores `baseFret`/`fingers`/`barres`, so built geometry may not match the source diagram for `baseFret > 1` shapes. What should the diagram render as the visual source of truth?
**Answer:** Build + mismatch badge. Render build-engine geometry (what the library actually produces); show source-diagram frets in the property table; add a geometry-mismatch audit check comparing the two — turns the risk into a detector. An early spike task validates the comparison logic.

**Q2:** Which invariant badges ship in v1?
**Answer:** Five checks — fret-span, finger-0-on-movable, repeated-fingers-without-barre, build-loss (dropped notes), metadata-completeness — plus the geometry-mismatch check from Q1 (six total). The voicingFamily/baseFret consistency check is deferred until its semantics are precise.

**Q3:** Where should the invariant-check logic live?
**Answer:** Library `src/audit.ts` — pure exported functions with structured results (`{id, severity, message, details}`), vitest-covered, reused by `data.test.ts`, consumed client-side by the site.

**Q4:** Page structure and default view for the ~159 shape cards?
**Answer:** Failures-first flat grid. One `/shapes` page: scale/chord type toggle, filters for system + voicingFamily/quality + name search, default sort puts badge-failing shapes on top.

### Round 2 Questions

**Q5:** What root should movable shapes (no `canonicalRoot`) render at?
**Answer:** Fixed C for all movable — `canonicalRoot ?? "C"`, one deterministic policy for scale and chord shapes, implemented as a tested helper; card shows "rendered at C".

**Q6:** What goes in the prefilled "report problem" GitHub issue body (the `/fix` input contract)?
**Answer:** Full structured payload — shape kind + name, system/voicingFamily/chordType/canonicalRoot/baseFret, render root + tuning, built frets, raw strings/fingers/barres, failing audit check IDs with details, library version — plus an empty "What's wrong" section for the reporter. Labeled `bug`.

**Q7:** Do scale shapes (27) get audit badges too?
**Answer:** Light scale checks — build-loss (every interval placed by `buildFrettedScale`) and metadata-completeness (derived shapes carry `quality` + `parentShape`); fingering checks are chord-only by nature.

### Existing Code to Reference

- Feature: connector-lab-integration — `.tonal-guitar/features/connector-lab-integration/spec.md`
  - Site conventions: one page + `components/*.tsx` + pure-helper `*Utils.ts`, `useMemo` everywhere, exact-markup reuse, manual acceptance verification (no site test infra)
- `site/app/experiments/components/FretboardDiagram.tsx` — canonical `FrettedNote[] → FretMarker[] → <Fretboard>` adapter with labelMode/orientation/viewMode controls
- `site/app/admin/components/ShapeEditor.tsx` — loading registered shapes by name (`get(name)` → `buildFrettedScale`)
- `src/data/data.test.ts:474-508` (`maxSpan`, excludes open strings), `:750-790` (finger-0, repeated-fingers) — invariant reference implementations to promote into `src/audit.ts`
- `src/data/extended-chords.test.ts:121-148` — build-completeness reference (`assertBuildsPlayable`)

## Visual Assets

### Files Provided:

No visual assets provided.

### Visual Guidance:

Follow the existing site look: reuse FretboardDiagram markup/controls patterns and the experiments page card styling. Badges should be visually prominent (error vs warning color distinction) since triage is the page's primary job.

## Requirements Summary

### Functional Requirements

- **Library audit module (`src/audit.ts`):**
  - Pure exported check functions returning structured `ShapeAuditIssue[]` (`{id, severity, message, details}`)
  - Chord checks: `fret-span` (maxSpan > 4, open strings excluded), `finger-zero-on-movable`, `repeated-finger-no-barre`, `build-loss` (built notes ≠ played strings), `metadata-completeness`, `geometry-mismatch` (built frets vs baseFret-implied source frets)
  - Scale checks: `build-loss`, `metadata-completeness` (derived shapes carry `quality`/`parentShape`)
  - Aggregate helpers to audit one shape or the whole registry
  - `data.test.ts` refactored to call the same exported functions (single source of truth)
  - Re-exported from `src/index.ts`; vitest coverage in `src/audit.test.ts`

- **Shape Library page (`site/app/shapes/`):**
  - Public, static-export-compatible, reachable in the deployed GitHub Pages build (no `NODE_ENV` gating)
  - Renders all registered shapes (27 scale + 132 chord at time of writing — counts computed from registries, never hardcoded)
  - Each card: fretboard diagram (build-engine geometry via `buildFrettedScale`/`applyChordShape`), full property display including fingers/barres as a table (fretboard-ui cannot render them), source-diagram frets for chord shapes, "rendered at X" root text, badge strip, report-problem link
  - Failures-first default sort; filters: type (scale/chord), system, voicingFamily/quality, name search
  - Deterministic render-root helper: `canonicalRoot ?? "C"`

- **Report-problem flow:**
  - Prefilled `github.com/TheGuitarStudio/tonal-guitar/issues/new` URL, `bug` label
  - Body: full structured payload (identity, metadata, render root/tuning, built frets, raw strings/fingers/barres, failing check IDs + details, library version) + empty "What's wrong" section

### Reusability Opportunities

- `FretboardDiagram.tsx` adapter pattern for shape cards
- `maxSpan` and #39 invariant assertions promoted from test files into `src/audit.ts`
- `chordShapes.query` for chord filtering; client-side filter over `all()` for scale shapes

### Scope Boundaries

**In Scope:** everything above, plus an early implementation spike validating geometry-mismatch comparison logic against representative shapes (open, baseFret>1, #96 known-bad, shell, extended E/A forms).

**Out of Scope:**

- Editing shapes from the public page (stays in dev-only admin ShapeEditor + `/fix`)
- Auth/permissions
- Extending `fretboard-ui` to render fingers/barres on the diagram
- voicingFamily/baseFret consistency badge (deferred until semantics precise)
- Site test infrastructure (library logic tested via vitest; site verified manually incl. `DEPLOY=true` build)
- Fixing the defects the badges find (flows through `/fix`)

### Technical Considerations

- Site is static export with `basePath: "/tonal-guitar"` under `DEPLOY=true` — all links and imports must survive both
- 159 cards render client-side; memoize cards, use CSS `content-visibility`/lazy rendering rather than adding a virtualization dependency
- `src/audit.ts` sits in the required-peer-deps tier (needs `build.ts` for build-loss/fret-span/geometry checks); must NOT import `./integration` or optional Tonal peers
- Site must render structured audit issue IDs, never parse message strings
