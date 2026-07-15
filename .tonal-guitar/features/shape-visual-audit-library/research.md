# Research: Shape Visual Audit Library

**Date:** 2026-07-14 | **Issue:** #97

---

## Codebase Research

### Relevant Types and Data

**`ScaleShape` / `ChordShape` (`src/shape.ts:22-67`):**

```ts
export interface ScaleShape {
  name: string;
  system: string; // "caged" | "3nps" | "pentatonic" | "custom"
  strings: (string[] | null)[]; // per-string intervals, low to high
  rootString: number;
  span?: number;
  quality?: string; // "major" | "minor" | "minor-pentatonic"
  parentShape?: string; // relabelShape provenance
}

export interface ChordShape {
  name: string;
  system: string;
  strings: (string | null)[];
  fingers: (number | null)[];
  barres: Barre[];
  rootString: number;
  chordType?: string;
  inversion?: number;
  voicingFamily?: VoicingFamily; // "caged"|"extended"|"shell"|"open"|"barre"|"drop2"|"drop3"|"drop2+4"|"sweep"
  stringSet?: number[];
  omittedIntervals?: string[];
  canonicalRoot?: string;
  baseFret?: number;
}
```

Key facts:

- **`ChordShape` has no `quality`/`parentShape`** — those audit fields apply only to scale shapes.
- **`ChordShape.baseFret` is set throughout `open-chords.ts`** (all 70 shapes; e.g. `OPEN_C_MINOR.baseFret = 3`) with documented chords-db semantics (`absFret = baseFret === 1 ? frets[i] : frets[i] + (baseFret - 1)`, `open-chords.ts:25-26`) — but **it is never consumed by the build engine**: `applyChordShape` rebuilds from intervals and ignores `baseFret`/`fingers`/`barres`. The "voicingFamily/baseFret consistency" badge is therefore *underspecified*, not a no-op — its exact rule (e.g. `baseFret > 1` + no open strings ⇒ not `voicingFamily: "open"`) must be defined in the Shape phase or the badge deferred. *(Corrected 2026-07-14 per adversarial review — the initial research claimed baseFret was never set.)*
- **Registries (`src/shape.ts:113-189`):** scale — `get(name)`, `all()`, `names()`, `add()`; chord — `chordShapes.get/all/names/add/query(filter)`. `chordShapes.query({ chordType?, system?, voicingFamily?, stringSet? })` is the only pre-built filter; **no scale-shape equivalent of `query`** — scale filtering must be done client-side over `all()`.
- All registries populate via side-effect imports at `src/index.ts:123-132`, so `import "tonal-guitar"` fully populates both before any page code runs.

**Shape inventory (registered by `index.ts`): 27 scale shapes, 132 chord shapes.**

| File | Shapes | Registry | voicingFamily |
|---|---|---|---|
| `caged-scales.ts` | 5 | scale | — |
| `caged-scales-minor.ts` | 5 (derived via `relabelShape`) | scale | — (`quality: "minor"`) |
| `three-nps.ts` | 7 | scale | — |
| `pentatonic.ts` | 5 | scale | — |
| `pentatonic-minor.ts` | 5 (derived) | scale | — (`quality: "minor-pentatonic"`) |
| `caged-chords.ts` | 5 | chord | none set |
| `caged-chords-7th.ts` | 11 | chord | `"caged"` |
| `open-chords.ts` | 70 | chord | `"open"` / `"barre"` |
| `jazz-shells.ts` | 16 (generated from `SHELL_DICTIONARY` × `STRING_SETS`) | chord | `"shell"` |
| `extended-chords.ts` | 30 (15 types × E/A form) | chord | `"extended"` |

### Relevant Pure-Function Primitives

- **`buildFrettedScale(shape, root, tuning = STANDARD, options)` (`src/build.ts:180-264`)** → `FrettedScale { empty, root, scaleType, scaleName, shapeName, tuning, notes: FrettedNote[], anchorFret }`.
- **`applyChordShape(shape, root, tuning = STANDARD, options)` (`src/build.ts:283-313`)** → `Fingering { positions, frets: (number|null)[], root, shapeName, startFret }`. **Does not surface `fingers`/`barres`** — a shape card must read those from the source `ChordShape` directly, paired positionally with `frets`.
- **Render-root default:** only `open-chords.ts` sets `canonicalRoot`. Test-fixture convention (`data.test.ts`): E-forms built at F, A-forms at C, `canonicalRoot` shapes at their literal root. Recommended display default (site-side, pure): `canonicalRoot ?? (form letter parsed from name) ?? "C"`.

### Invariant-Check Reference Implementations

Three of the four badge checks already exist as test-only assertions:

1. **finger-0-on-movable** — `src/data/data.test.ts:750-790` (issue #39 audit): movable shapes (`canonicalRoot === undefined`) must never use finger 0.
2. **repeated-fingers-without-barre** — same describe block: repeated finger N on adjacent strings must be covered by a `barres` entry with that finger.
3. **fret-span** — two variants:
   - `src/data/extended-chords.test.ts:121-148` (`assertBuildsPlayable`): build via `applyChordShape`, span = `max(frets) - min(frets) ≤ 4`.
   - `src/data/data.test.ts:474-508` (issue #94 regression, landed via PR #95 and merged into this branch): `maxSpan` helper that **excludes open strings (`f > 0`)** — the more correct variant for open-position shapes.
4. **voicingFamily/baseFret consistency** — **no reference implementation exists.** `baseFret` data exists on all open-chords shapes (see above) but no code reads it, so the check must be authored fresh with explicit semantics (candidate rules: `"open"` implies `canonicalRoot` + at least one open string; `"barre"` implies no `canonicalRoot`; `baseFret > 1` with no open strings ⇒ not open-position). The real CR-009 defect class was *voicingFamily mistagging* (open vs. barre).

Fret-span is a **build-time** check (needs `applyChordShape` per shape at a representative root), not a static-data check. 132 builds client-side is cheap but nonzero.

No `src/audit.ts` or invariant module exists yet; checks are inlined in test files only.

### Relevant Site Patterns (`site/`)

- **Wiring:** `site/package.json` uses `file:` deps — `"tonal-guitar": "file:.."`, `"fretboard-ui": "file:../packages/fretboard-ui"` (source-only package, consumed via `transpilePackages` in `site/next.config.mjs:13`).
- **Deploy:** `output: "export"` static export, `basePath: "/tonal-guitar"` when `DEPLOY=true`, published via `gh-pages -d out/`. **Everything must work fully client-side/static — no server routes.**
- **`fretboard-ui` cannot render fingering or barres.** `FretboardProps` (`Fretboard.tsx:39-52`) and `FretMarker` (`types.ts:35-52`) have no `finger` field and the SVG render tree has no barre path. Resolves the raw-idea's open question: **v1 shows fingers/barres as a properties table** (or defers a `fretboard-ui` extension as separate work).
- **Reusable adapter:** `site/app/experiments/components/FretboardDiagram.tsx` — the canonical "FrettedNote[] → FretMarker[] → `<Fretboard>`" pattern with labelMode/orientation/handedness/viewMode toggles. Most directly reusable component for shape cards.
- **Shape loading precedent:** `site/app/admin/components/ShapeEditor.tsx` loads any registered shape by name (`get(name)` → `buildFrettedScale` → cells). `ShapeStep.tsx:9-22` groups scale-shape names by substring heuristic (chord shapes are not browsable anywhere today).
- **Anti-pattern to avoid:** `site/app/admin/page.tsx:8-11` gates via `NODE_ENV === "production"` → `notFound()`, which 404s in **every** production build. The new page must be public and must NOT copy this.
- **No test infrastructure in `site/`** (precedent: connector-lab-integration Decision D-006 — manual acceptance verification).

### Suggested Code Placement

| New File | Tier | Rationale |
| --- | --- | --- |
| `src/audit.ts` | Required-peer-deps tier (same as `build.ts`) | Promote the 3 existing test-only invariants + a redefined voicingFamily check into pure exported functions (`checkFretSpan`, `checkFingerZeroOnMovable`, `checkRepeatedFingerBarre`, …); needs `applyChordShape` for span. Site imports them client-side; `data.test.ts` refactors to call the same functions — closing the raw-idea's "codify as library tests" deferred item essentially for free. **Key architecture decision for the Shape phase.** |
| `src/audit.test.ts` | — | Sibling tests per project convention |
| `src/index.ts` (modify) | — | Re-export audit functions |
| `site/app/shapes/page.tsx` + `site/app/shapes/components/*` + `*Utils.ts` | site | Follows the experiments/ structure convention (one page + components + pure-helper utils file) |

Everything else the page needs (`names`, `all`, `chordShapes`, `buildFrettedScale`, `applyChordShape`, tunings, types) is already public API — no other library changes required.

---

## Product Research

### Roadmap Alignment

No `docs/product/mission.md` or `docs/product/roadmap.md` exists; direction lives in `docs/PLAN.md` (v0.1.0 plan, all shipped), CHANGELOG, and `.tonal-guitar/features/*` artifacts. This feature is not plan-tracked — it's a new site-tier effort, a direct follow-on to the #39/#94/#96 data-quality thread. It neither blocks nor is blocked by v0.2.0 library work, but surfaces exactly the metadata (`quality`/`parentShape`) v0.2.0 added.

**Alignment: Strong** — graduated through `/idea` (#97), continues an active defect-audit lineage with a live open bug (#96) it would immediately triage.

### Related Specifications

| Document | Relevance |
| --- | --- |
| `.tonal-guitar/features/connector-lab-integration/spec.md` | Only prior completed site feature. Conventions to follow: pure-helper `*Utils.ts` modules, `useMemo` everywhere, exact-markup reuse, **manual acceptance verification (no site test infra — Decision D-006)** |
| `.tonal-guitar/features/minor-quality-shape-relabeling/spec.md` | Source of `quality`/`parentShape` fields this page surfaces; explicitly excluded visual rendering — this is the first shape-catalog UI |
| `.tonal-guitar/features/extended-chord-shapes-import/spec.md`, `arpeggio-chord-shapes-detection-and-fingerings/spec.md` | Library-data-only precedents; the arpeggio feature's code review produced issue #39, motivating this feature's badges. Lab-palette shape browsing ("#29") is a distinct, separate effort |

### User Context & Data-Quality History

Defect lineage (repo `TheGuitarStudio/tonal-guitar`):

- **#39** (closed via PR #93, 2026-07-14): CR-005 finger-0 on movable shapes (17 shapes), CR-006 repeated fingers without barre (~30 shapes), CR-009 voicingFamily mistags (2 shapes). PR #93 verified fixes with an independent pure interval-math calculator — the ground-truth approach badges should encode.
- **#94** (closed via PR #95): `OPEN_E_AUG`/`BARRE_E_AUG` mis-ordered intervals → unplayable ~9-fret span. Regression test now in `data.test.ts:474-508` (merged into this branch on 2026-07-14).
- **#96** (**still open**, `bug`): same class recurring — `OPEN_G_AUG` (10-fret span), `OPEN_G_M7B5` (8-fret span), found via a one-off registry-wide fret-span audit. **Live fixtures the fret-span badge must flag.**

Impact: every prior defect was found reactively (code review of unrelated work) or via ad hoc scripts. Maintainers get continuous visual triage; guitar-expert reviewers currently have **zero** path to review the catalog without a dev environment — this page is the only way a non-developer domain expert can contribute. "Report problem" issues (`bug` label, structured title/body carrying shape identity + properties + failing badges) feed the existing `/fix #<id>` pipeline directly.

### Scope Assessment

**In Scope (v1):**

- Public, read-only Shape Library page in the deployed static export, rendering all 27 scale + 132 chord shapes as fretboard diagrams with full property display
- Fingers/barres as a property table (not diagram overlays — `fretboard-ui` can't render them)
- Render movable shapes at `canonicalRoot ?? sensible default`
- Client-side invariant badges: fret-span, finger-0-on-movable, repeated-fingers-without-barre, plus a redefined voicingFamily-consistency check (baseFret variant is a no-op today)
- Filter/search by type (scale/chord), system, voicingFamily/quality
- "Report problem" prefilled GitHub new-issue link (`bug` label; no issue templates exist — body format is this feature's design decision)

**Out of Scope:**

- Editing shapes from the public page (stays in dev-only admin ShapeEditor + `/fix`)
- Auth/permissions (public read-only by design)
- Extending `fretboard-ui` to render fingers/barres (candidate follow-up)
- Adding `site/` test infrastructure (follow connector-lab-integration precedent: manual verification; library-side `src/audit.ts` gets normal vitest coverage)

**Adjacent Features (separate efforts):**

- Lab-palette chord-shape browsing in the pipeline builder (issue #29)
- Additional mode/harmonic-minor registry entries; 3NPS modal naming (QUESTIONS.md Q4)
- fretboard-ui fingering/barre rendering

### GitHub Project Context

- Issue #97 is on the **"Tonal Guitar"** org project (TheGuitarStudio, project #2, `PVT_kwDOEFcb-s4BX5t_`), status **Backlog**. (`.tonal-guitar/project-config.json` was initially auto-detected against the wrong board — "Guitar Studio", a different product — and has been corrected during this research pass.)
- #39/#94 closed, #96 open (`bug`), #97 open (`feature-spec`).

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
| --- | --- | --- |
| `applyChordShape` ignores `baseFret`/`fingers`/`barres` — built geometry may not match the source-diagram grip for `baseFret > 1` shapes, so the page could render a transposed shape while hiding the actual data defect | **High** | **Validate early (pre-UI spike):** compare `applyChordShape` frets vs. baseFret-implied source frets for representative shapes (open, baseFret>1 barre, #96 known-bad, shell, extended E/A); decide whether the visual source of truth is build-engine geometry, source-diagram geometry, or both labeled distinctly |
| voicingFamily/baseFret badge semantics undefined | Medium | Define exact rules in Shape phase (open ⇒ canonicalRoot + open string; barre ⇒ no canonicalRoot; baseFret>1 + no open strings ⇒ not open) or defer the badge |
| `fretboard-ui` can't render fingers/barres | Medium | v1 property-table fallback (confirmed, not speculative); fretboard-ui extension as follow-up |
| Fret-span check requires a build call per chord shape (132 × `applyChordShape`) | Low | Cheap client-side; compute once per page load (or at build time via static generation) |
| No scale-shape `query()` helper | Low | Filter `all()` client-side in a pure site util |
| Admin `NODE_ENV` gating pattern would hide the page in production | Medium | New page is public; never copy `admin/page.tsx` gating |
| No site test infra — badge logic unverifiable by site tests | Medium | Put invariant logic in library `src/audit.ts` with vitest coverage; site is a thin consumer verified manually |
| Issue #96 defects still unfixed in data | Low (opportunity) | Known-bad fixtures to validate badges against; fix flows through `/fix`, not this feature |
| Two fret-span variants exist (open-string handling differs) | Low | Standardize on `data.test.ts:477` `maxSpan` (excludes open strings) when promoting to `src/audit.ts` |

## Open Questions

- Should invariant checks live in the library (`src/audit.ts`, exported + reused by `data.test.ts`) or site-only? (Research strongly favors library — resolves a raw-idea deferred item for free. Needs a Shape-phase decision.)
- Exact voicingFamily/baseFret badge semantics — define precise rules or drop to three structural badges for v1? (Review recommends deferring unless made precise.)
- Should v1 add a **build-loss badge** (`applyChordShape` silently drops notes when it can't place every interval) and a **metadata-completeness badge** (missing `chordType`/`voicingFamily`/`stringSet`)? (Review recommends both.)
- Which geometry is the visual source of truth — build-engine frets, baseFret-implied source-diagram frets, or both labeled distinctly? (**Needs pre-UI spike — biggest risk per review.**)
- Page grouping/navigation: by type then system (scale: caged/3nps/pentatonic; chord: caged/open/barre/shell/extended), by data file, or flat with filters?
- Render-root default for movable shapes: `canonicalRoot ?? form-letter-from-name ?? "C"` — confirm, and at what fret window for the diagram (`viewMode: "shape"` vs `"full"`)?
- Prefilled issue body format: which fields, and should failing badge names be included automatically?
- Should shape cards render lazily (159 diagrams on one page) — virtualization/pagination vs. render-all?
