# Task Breakdown: Minor-Quality Shape Relabeling API

## Overview

Total Tasks: 7 Task Groups

This feature adds a pure-tier `relabelShape` primitive (`src/transform.ts`), registers 5 minor CAGED and 5 minor pentatonic `ScaleShape` entries derived at import time, rewrites `isShapeCompatible` to use interval-chroma coverage (enharmonic-safe, root-relative), makes `buildFromScale` relabel the shape into the requested scale's frame before building (pitch-correctness fix), and exposes a scale-name wrapper `relabelShapeToScale`. The feature is library-only (`src/`); `site/` is out of scope.

Group 2 (Core Logic) must precede Groups 3 and 4 because the data files call `relabelShape` at import time, but Groups 3 and 4 can run in parallel with each other once Group 2 is complete. Group 5 (Integration) depends on Groups 2, 3, and 4 all being complete (its `modeShapes` count assertions require all 10 entries registered).

## Task List

---

### Module / Types Layer

#### Task Group 1: ScaleShape Type Extension + transform.ts Shell + Re-exports

**Dependencies:** None

- [ ] 1.0 Extend `ScaleShape`, create `src/transform.ts` with exported types and a stub, and wire all new public re-exports in `src/index.ts`
  - [ ] 1.1 Write focused tests for the scaffolding contract
    - Import smoke: `relabelShape` and `RelabelOptions` resolve from `src/index` without error
    - Type check: `ScaleShape` with `quality` and `parentShape` fields compiles; both fields optional so existing shape literals are unchanged
    - Stub behavior: calling `relabelShape(anyShape, [])` returns `undefined` (stub returns `undefined`)
    - Create test file: `src/transform.test.ts`
  - [ ] 1.2 Extend `ScaleShape` interface in `src/shape.ts` (lines 22–28)
    - Add `quality?: string` and `parentShape?: string` as optional fields after `span?`
    - No changes to registry functions (`get`/`all`/`names`/`add`/`removeAll` at `src/shape.ts:95-116`)
    - No default values — backward-compatible; all existing shape literals remain valid
  - [ ] 1.3 Create `src/transform.ts`
    - Export `RelabelOptions` interface: `{ name?: string; quality?: string; parentShape?: string }`
    - Export stub `relabelShape(shape: ScaleShape, targetIntervals: string[], options?: RelabelOptions): ScaleShape | undefined` — stub body: `return undefined`
    - Import only `@tonaljs/interval` (required peer) and `./shape` (types only); MUST NOT import `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`, or `./integration`
    - Dependency tier: same as `build.ts` (required peer only) — zero optional deps
  - [ ] 1.4 Wire re-exports in `src/index.ts`
    - Add `export { relabelShape } from "./transform"` and `export type { RelabelOptions } from "./transform"` in the pure-tier export block (before the Tonal integration block at line 99)
    - `relabelShapeToScale` export is added in Task Group 5 (integration tier)
  - [ ] 1.5 Update `CLAUDE.md` source layout table to include the `transform.ts` row ONLY (dependency-tier lists, the dependency-order diagram, and the two new data file rows are handled later in 6.4 — do not double-book)
  - [ ] 1.6 Ensure tests pass: `npx vitest run src/transform.test.ts`

**Acceptance Criteria:**

- `src/shape.ts` `ScaleShape` has `quality?: string` and `parentShape?: string`; all 845 existing tests still pass (`npm test`)
- `src/transform.ts` exists; `relabelShape` and `RelabelOptions` are importable from `src/index`
- `npm run build` passes (ESM + CJS + types)
- The stub `relabelShape` returns `undefined`; import-smoke tests pass

---

### Core Logic Layer

#### Task Group 2: relabelShape Algorithm Implementation

**Dependencies:** Task Group 1

- [ ] 2.0 Implement the full `relabelShape` algorithm in `src/transform.ts`, replacing the stub
  - [ ] 2.1 Write focused tests in `src/transform.test.ts` (test-first; run stub first to confirm all fail, then implement)
    - **Natural-minor rewrite — cell-by-cell (spec R2.4):** `relabelShape(CAGED_G, ["1P","2M","3m","4P","5P","6m","7m"], { name: "Em Shape", quality: "minor", parentShape: "G Shape" })` — verify every per-string interval array matches the R2.4 mapping table; `rootString === 0`; `quality === "minor"`; `parentShape === "G Shape"`; `system === "caged"`
    - **No mutation:** input `CAGED_G.strings` is deep-unchanged after the call
    - **Identity relabel (spec R2.6, t=0):** relabeling a minor-frame shape to the same minor frame selects `t = 0` and returns an interval-identical shape
    - **Non-subset chroma → undefined (spec R2.6):** relabeling a 7-note CAGED shape (`CAGED_E`) into a 5-note minor-pentatonic frame `["1P","3m","4P","5P","7m"]` returns `undefined`
    - **Null string preservation (spec R2.3):** construct a `ScaleShape` with a `null` entry in `strings`; verify the result has `null` at the same index and non-null strings are relabeled
    - **All-null/empty strings → undefined (spec R2.6 subset guard):** a shape where all strings are `null` or empty arrays returns `undefined`
    - **Dorian relabel (spec R5.3 general-API validation):** `relabelShape(CAGED_G, ["1P","2M","3m","4P","5P","6M","7m"])` succeeds (Dorian, `t = 2`) — validates modes beyond minor
    - **rootString recomputation (spec R2.7):** natural-minor rewrite of `CAGED_E` yields `rootString === 2` (lowest string carrying `6M` in CAGED_E — per R4.1 table)
    - **options.name override (spec R2.8):** when `options.name` is provided, result `name` equals that value; when omitted, result `name` equals input `shape.name`
    - **system preservation (spec R2.9):** result `system` equals input `system`
  - [ ] 2.2 Implement `relabelShape` in `src/transform.ts`
    - Import `semitones` from `@tonaljs/interval` (mirrors `src/build.ts:14-17` import pattern)
    - **Step 1 — build targetChromas map:** `targetIntervals.map(i => ((semitones(i) % 12) + 12) % 12)` → `Map<chroma, targetInterval>` (first-wins on collision)
    - **Step 2 — collect parentChromas:** unique chromas from all non-null string intervals in `shape.strings`; if empty, return `undefined`
    - **Step 3 — select tonic offset `t` (spec R2.6):** iterate candidate offsets as `Array.from(parentChromas).sort((a,b)=>a-b)`; for each candidate `t`, check every `((c - t + 12) % 12)` is in `targetChromas`; select the first valid `t`; if none, return `undefined`
    - **Step 4 — rewrite per-string intervals (spec R2.3):** for each string, if `null`, keep `null`; else map each interval `p` → `targetByChroma.get(((semitones(p) - t) % 12 + 12) % 12)` (preserve array ordering per R2.3)
    - **Step 5 — recompute rootString (spec R2.7):** find all string indices where the new tonic (target-frame `1P`, chroma 0 after remap) appears; select the lowest index; if none found, return `undefined`
    - **Step 6 — assemble result:** new `ScaleShape` object with rewritten `strings`, new `rootString`, `system` from input, `name` from `options.name ?? shape.name`, `quality` from `options.quality`, `parentShape` from `options.parentShape ?? shape.name`, `span` from input; DO NOT mutate input
  - [ ] 2.3 Ensure all tests in `src/transform.test.ts` pass: `npx vitest run src/transform.test.ts`

**Acceptance Criteria:**

- All R2.3–R2.9 behaviors verified by tests
- Mapping table in spec R2.4 verified cell-by-cell for `CAGED_G → "Em Shape"`
- `relabelShape` returns `undefined` (no throw) for all invalid inputs (spec R2.2 convention matches `src/build.ts:188,192`)
- Per-string array ordering preserved (no re-sort); null entries preserved at same index
- No optional-peer imports in `src/transform.ts`
- All tests pass; `npm run build` passes

---

### Data Layer

#### Task Group 3: Minor CAGED Entries (caged-scales-minor.ts)

**Dependencies:** Task Group 2 (relabelShape must be fully implemented)

*Can run in parallel with Task Group 4 once Task Group 2 is complete.*

- [ ] 3.0 Create `src/data/caged-scales-minor.ts` and register 5 derived minor CAGED entries at import time
  - [ ] 3.1 Write build-equivalence tests in `src/data/data.test.ts` (test-first; add a new `describe` block)
    - Import `caged-scales-minor` for side-effect registration (after existing data imports)
    - **For each of the 5 pairs** (spec R4.1 table): `buildFrettedScale(get("<minor name>"), "A")` produces the same `{string, fret}` position set as `buildFrettedScale(<source const>, "C")` — geometric identity
    - **Minor-frame labels:** in the "A"-root build, the note with pc `"A"` carries `interval === "1P"`; the note with pc `"C"` carries `interval === "3m"`
    - **Registry metadata:** `get("Em Shape").quality === "minor"`, `get("Em Shape").parentShape === "G Shape"`, `get("Em Shape").rootString === 0`; repeat for all 5 entries per R4.1 table
    - **Registry count:** `names().length` increases by exactly 5 after this file's side-effect import (relative to the pre-feature count)
  - [ ] 3.2 Create `src/data/caged-scales-minor.ts`
    - Import `relabelShape` from `"../transform"` and `add` from `"../shape"`
    - Import `CAGED_E`, `CAGED_D`, `CAGED_C`, `CAGED_A`, `CAGED_G` from `"./caged-scales"`
    - Declare module constant `const MINOR_INTERVALS = ["1P","2M","3m","4P","5P","6m","7m"]`
    - For each of the 5 source shapes, call `relabelShape(source, MINOR_INTERVALS, { name, quality: "minor", parentShape: source.name })` and assert non-undefined (verified valid at design time per R4.1)
    - Registered names per spec R4.1: `"Dm Shape"` (from `CAGED_E`), `"Cm Shape"` (from `CAGED_D`), `"Am Shape"` (from `CAGED_C`), `"Gm Shape"` (from `CAGED_A`), `"Em Shape"` (from `CAGED_G`)
    - Register via the `[...].forEach(add)` pattern from `src/data/caged-scales.ts:86-87`
    - Export the 5 derived `ScaleShape` consts for test imports
  - [ ] 3.3 Add side-effect import to `src/index.ts` AFTER `"./data/caged-scales"` (spec R4.3): `import "./data/caged-scales-minor";`
  - [ ] 3.4 Ensure tests pass: `npx vitest run src/data/data.test.ts`

**Acceptance Criteria:**

- `src/data/caged-scales-minor.ts` exists; 5 entries registered at import time
- All per-string interval arrays are computed by `relabelShape` at import time (NOT hand-authored)
- `get("Em Shape")`, `get("Am Shape")`, `get("Dm Shape")`, `get("Gm Shape")`, `get("Cm Shape")` all return defined shapes
- `rootString` values match R4.1: Dm Shape=2, Cm Shape=1, Am Shape=1, Gm Shape=0, Em Shape=0
- `quality === "minor"` and `parentShape` set to source name for all 5 entries
- Build-equivalence tests pass; `npm run build` passes

---

#### Task Group 4: Minor Pentatonic Entries (pentatonic-minor.ts)

**Dependencies:** Task Group 2 (relabelShape must be fully implemented)

*Can run in parallel with Task Group 3 once Task Group 2 is complete.*

- [ ] 4.0 Create `src/data/pentatonic-minor.ts` and register 5 derived minor pentatonic entries at import time; fix the misleading comment in `src/data/pentatonic.ts`
  - [ ] 4.1 Write build-equivalence tests in `src/data/data.test.ts` (add a new `describe` block after the CAGED-minor block)
    - Import `pentatonic-minor` for side-effect registration
    - **For each of the 5 pairs** (spec R4.2 table): `buildFrettedScale(get("Pentatonic Box N Minor"), "A")` produces the same `{string, fret}` position set as `buildFrettedScale(PENTA_BOX_N, "C")` — geometric identity
    - **Minor-pent frame labels:** note with pc `"A"` carries `interval === "1P"`; note with pc `"C"` carries `interval === "3m"`
    - **Registry metadata:** `get("Pentatonic Box 1 Minor").quality === "minor-pentatonic"`, `.parentShape === "Pentatonic Box 1"`, `.rootString === 0`; repeat for all 5 per R4.2 table
    - **Registry count:** `names().length` increases by exactly 5 after this file's side-effect import (10 total once both data groups land)
  - [ ] 4.2 Create `src/data/pentatonic-minor.ts`
    - Import `relabelShape` from `"../transform"` and `add` from `"../shape"`
    - Import `PENTA_BOX_1` through `PENTA_BOX_5` from `"./pentatonic"`
    - Declare `const MINOR_PENTA_INTERVALS = ["1P","3m","4P","5P","7m"]`
    - For each box, call `relabelShape(source, MINOR_PENTA_INTERVALS, { name: "Pentatonic Box N Minor", quality: "minor-pentatonic", parentShape: source.name })`
    - Registered names: `"Pentatonic Box 1 Minor"` … `"Pentatonic Box 5 Minor"`
    - Expected `rootString` values per R4.2: Box 1=0, Box 2=2, Box 3=1, Box 4=1, Box 5=0
    - Register via `[...].forEach(add)`; export the 5 consts
  - [ ] 4.3 Add side-effect import to `src/index.ts` AFTER `"./data/pentatonic"` (spec R4.3): `import "./data/pentatonic-minor";`
  - [ ] 4.4 Fix misleading comment in `src/data/pentatonic.ts` (spec R4.5)
    - Replace aspirational `"minor-pent"` build-engine comment (lines 1–16) with an accurate description pointing to `relabelShape`/`relabelShapeToScale` and the registered `"Pentatonic Box N Minor"` entries
    - No changes to any interval data or the registration call
  - [ ] 4.5 Ensure tests pass: `npx vitest run src/data/data.test.ts`

**Acceptance Criteria:**

- `src/data/pentatonic-minor.ts` exists; 5 entries registered at import time
- All per-string interval arrays computed by `relabelShape` (NOT hand-authored)
- `get("Pentatonic Box 1 Minor")` through `get("Pentatonic Box 5 Minor")` return defined shapes
- `rootString` values match R4.2 table
- `quality === "minor-pentatonic"` and `parentShape` set to source name for all 5
- Build-equivalence tests pass; `pentatonic.ts` comment is updated; `npm run build` passes

---

### Integration Layer

#### Task Group 5: isShapeCompatible Rewrite + relabelShapeToScale + buildFromScale Relabel Pass

**Dependencies:** Task Groups 2, 3, and 4 (all 10 derived entries must be registered)

- [ ] 5.0 Rewrite `isShapeCompatible` (R3.1), add `relabelShapeToScale` (R3.0), update `buildFromScale` (R3.3), and add the extended-range regression test (R3.4)
  - [ ] 5.1 Write focused tests in `src/integration.test.ts` (add new `describe` blocks; test-first)
    - **`isShapeCompatible` full behavior table (spec R3.1):** assert all 7 rows of the R3.1 table case-by-case, plus unknown scale → `false` and empty-interval shape → `false`
    - **`modeShapes` counts (spec R3.2):** `modeShapes("C major", "caged")` length 5 (regression: minor entries NOT compatible with major frame); `modeShapes("A minor", "caged")` length 5 with names exactly `{"Em Shape","Am Shape","Dm Shape","Gm Shape","Cm Shape"}`; `modeShapes("A minor pentatonic", "pentatonic")` length 5; `modeShapes("A major pentatonic", "pentatonic")` length 5; `modeShapes("A minor")` (no filter) length 10; `modeShapes("A dorian")` length 0
    - **`buildFromScale` relabel (spec R3.3):** `buildFromScale(CAGED_E, "A minor")` → `root === "A"`, pitch classes include all of `{A,B,C,D,E,F,G}`, the note with `pc === "C"` has `interval === "3m"`; `buildFromScale(PENTA_BOX_1, "A minor pentatonic")` → note with `pc === "A"` has `interval === "1P"`, note with `pc === "C"` has `interval === "3m"`
    - **`buildFromScale` identity path (spec R3.3):** `buildFromScale(CAGED_E, "C major")` produces the same notes as `buildFrettedScale(CAGED_E, "C")`; `buildFromScale(get("Em Shape"), "A minor")` builds non-empty with A as root
    - **`buildFromScale` fallback (spec R3.3):** a shape whose intervals are not rotation-compatible with the requested scale still produces a non-empty `FrettedScale` (no regression to `NoFrettedScale`)
    - **`relabelShapeToScale` (spec R3.0):** `relabelShapeToScale(CAGED_G, "A minor")` returns the same result as the pure `relabelShape` call with the natural-minor frame; unknown scale name → `undefined`; non-rotation-compatible shape+scale → `undefined`
    - **Extended-range regression (spec R3.4):** `buildFromScale(get("Em Shape"), "A minor", <7-string tuning>)` is non-empty; the note with `pc === "A"` exists on the auto-adjusted root string
    - **Target-frame constants sanity (spec R5.3, optional-dep guarded):** `Scale.get("A minor").intervals` deep-equals the `MINOR_INTERVALS` literal; `Scale.get("A minor pentatonic").intervals` deep-equals `MINOR_PENTA_INTERVALS`
  - [ ] 5.2 Update `src/index.test.ts` (existing tests, spec R5.2)
    - Line ≈1598: retitle `"CAGED_E is not compatible with 'A minor pentatonic'"` to reflect chroma-set reasoning ("7-note major frame ⊄ 5-note pentatonic frame"); outcome (`false`) unchanged
    - Line ≈1603–1609: `PENTA_BOX_1` vs `"A minor pentatonic"` stays `false` (major-pent frame ⊄ minor-pent frame, root-relative); retitle to chroma-set language; add companion `true` assertion: `isShapeCompatible(get("Pentatonic Box 1 Minor"), "A minor pentatonic") === true`
    - Lines ≈1622–1636: `modeShapes("C major", "caged")` and `modeShapes("A major pentatonic", "pentatonic")` count-5 assertions — keep as regressions, no outcome change
    - Update any `names().length` or `all().length` registry-count assertions to reflect +10 new entries
  - [ ] 5.3 Implement `relabelShapeToScale` in `src/integration.ts`
    - Import `relabelShape` and `RelabelOptions` from `"./transform"`
    - Function: resolve `getScale(scaleName)`; guard `scale.empty` → return `undefined`; delegate to `relabelShape(shape, scale.intervals, options)`; return result directly
    - Add to exports in `src/index.ts` (spec R4.4): `export { relabelShapeToScale } from "./integration"`
  - [ ] 5.4 Rewrite `isShapeCompatible` in `src/integration.ts` (lines 314–337, spec R3.1)
    - Import `semitones` from `@tonaljs/interval`
    - Replace strict interval-string subset with chroma-set coverage: compute shape chroma set from `shape.strings.flatMap(s => s || [])` → `((semitones(ivl) % 12) + 12) % 12`; compute scale chroma set from `scale.intervals`; return true iff shape chroma set is non-empty and a subset of the scale chroma set
    - Preserve existing guards at lines 319–331 (empty/unknown scale → `false`, empty shape intervals → `false`)
    - Update the function's doc comment (lines 306–313) to describe chroma-set semantics
    - `modeShapes` at lines 350–361 requires NO logic change (spec R3.2 — behavior improves via registered entries alone)
  - [ ] 5.5 Update `buildFromScale` in `src/integration.ts` (lines 132–148, spec R3.3)
    - After resolving `result = getScale(scaleName)` and before calling `buildFrettedScale`, attempt `relabelShape(shape, result.intervals)` (no options — name/quality/parentShape irrelevant to build)
    - If a relabeled shape is returned, call `buildFrettedScale(relabeled, result.tonic, tuning)`
    - If `relabelShape` returns `undefined`, fall back to `buildFrettedScale(shape, result.tonic, tuning)` (current behavior — no regression)
    - The `scaleType`/`scaleName` overwrite at line 147 stays unchanged; update the doc comment to note the relabel pass
  - [ ] 5.6 Ensure all new integration tests pass: `npx vitest run src/integration.test.ts`
  - [ ] 5.7 Ensure full suite passes: `npm test`

**Acceptance Criteria:**

- `isShapeCompatible` uses chroma-set coverage (enharmonic-safe, root-relative); the full R3.1 behavior table verified case-by-case
- `modeShapes("A minor", "caged")` length 5; `modeShapes("A minor pentatonic", "pentatonic")` length 5; `modeShapes("A minor")` length 10; existing major counts unchanged (5 CAGED, 5 penta)
- `buildFromScale(CAGED_E, "A minor")` produces A-natural-minor pitch classes with `3m` on the C note
- `buildFromScale` fallback: non-compatible shape still builds non-empty
- `relabelShapeToScale` exported from `src/index` and returns `undefined` for unknown scales
- Extended-range regression: `buildFromScale(get("Em Shape"), "A minor", <7-string tuning>)` non-empty
- All updated `src/index.test.ts` assertions (R5.2) pass
- `npm test`, `npm run lint`, `npm run build` all pass

---

### Docs Layer

#### Task Group 6: API Docs, README, PLAN.md, CLAUDE.md

**Dependencies:** Task Groups 1–5 (all library changes complete)

- [ ] 6.0 Document all new and changed public API surface; update project planning docs
  - [ ] 6.1 Update or create `docs/api/` page for transform functions
    - Update the page covering `isShapeCompatible`/`modeShapes`/`buildFromScale`:
      - `buildFromScale`: flag as v0.2.0 behavior change — now relabels the shape into the requested scale's interval frame; previously produced wrong pitch content for non-major scale names (pitch-correctness fix)
      - `isShapeCompatible`: chroma-set coverage semantics (root-relative, enharmonic-safe); note a major-frame shape is NOT compatible with "A minor"
      - `modeShapes`: examples showing `modeShapes("A minor", "caged")` returning the 5 minor entries
    - Add new entries (or new page `docs/api/transform.md`) for `relabelShape` (signature, R2.6 undefined conditions, example relabeling `CAGED_G`), `relabelShapeToScale`, `RelabelOptions`, and the `ScaleShape.quality`/`parentShape` fields
  - [ ] 6.2 Update `README.md`
    - Add `relabelShape` and `relabelShapeToScale` to the API/export surface section
    - Add `ScaleShape.quality` / `ScaleShape.parentShape` to the Key Types section
    - Document the 10 new registered entries with the R4.1/R4.2 mapping tables
    - Call out the `buildFromScale` pitch-correctness fix in a v0.2.0 changes note
  - [ ] 6.3 Update `docs/PLAN.md`
    - Mark the "Pentatonic-Modal same-shape relationship" behavior as implemented via `relabelShape` + registered minor entries
    - Note `docs/QUESTIONS.md` Q4 (3NPS modal naming) remains deferred
  - [ ] 6.4 Update `CLAUDE.md`
    - Source layout table: add `data/caged-scales-minor.ts` and `data/pentatonic-minor.ts` rows (the `transform.ts` row was added in 1.5)
    - Dependency-tier "Required peer deps" list: add `transform.ts`
    - Dependency-tier "Zero Tonal deps" list: correct the blanket `data/*` claim — `data/caged-scales-minor.ts` and `data/pentatonic-minor.ts` transitively require `@tonaljs/interval` via `transform.ts`; add a carve-out or move the two files to the "Required peer deps" tier entry
    - Internal dependency order diagram: add `transform.ts ← shape (types only)` and note the two derived data files depend on `transform.ts`
  - [ ] 6.5 Create or update `CHANGELOG.md` with a v0.2.0 entry (spec R3.3 "Changelog MUST")
    - Flag the `buildFromScale` pitch-correctness fix as a behavior change (previously built wrong pitch content for non-major scale names)
    - Note the `isShapeCompatible` chroma-set semantics change and the 10 new registered entries

**Acceptance Criteria:**

- All new public exports (`relabelShape`, `relabelShapeToScale`, `RelabelOptions`, `ScaleShape.quality`/`.parentShape`) documented with signature, return type, and example
- `buildFromScale` v0.2.0 behavior change flagged in docs, README, and `CHANGELOG.md`
- `docs/PLAN.md` updated
- `CLAUDE.md` source layout and dependency-tier lists accurate, including the `data/*` zero-dep carve-out for the two derived data files
- `npm run build` still passes

---

### Testing Layer

#### Task Group 7: Final Test Review and Gap Analysis

**Dependencies:** All Task Groups 1–6

- [ ] 7.0 Review all tests written across groups against spec R5.3 list; fill critical gaps only
  - [ ] 7.1 Audit `src/transform.test.ts` against R5.3 pure-tier test list
    - Confirm: natural-minor rewrite cell-by-cell (R2.4), identity relabel (t=0), non-subset → undefined, null string entry, all-null → undefined, dorian relabel succeeds (t=2), rootString recomputation, no mutation
    - If any R5.3 item is missing from earlier tasks, add it now (max 4 additional tests)
  - [ ] 7.2 Audit `src/data/data.test.ts` against R5.3 data-layer test list
    - Confirm: all 5 CAGED-minor build-equivalence pairs; all 5 pentatonic-minor pairs; all 10 `get()` lookups with correct `parentShape`/`rootString`/`quality`; `names()` length increases by exactly 10 relative to the pre-feature count
    - If the count-by-10 assertion is missing, add it
  - [ ] 7.3 Audit `src/integration.test.ts` against R5.3 integration-layer test list
    - Confirm: full R3.1 behavior table (7 rows + unknown scale + empty shape); all R3.2 `modeShapes` counts; `buildFromScale` relabel cases (R3.3); fallback; `relabelShapeToScale` round-trip; extended-range regression (R3.4); target-frame constants sanity
  - [ ] 7.4 Run feature-specific tests and full suite
    - `npx vitest run src/transform.test.ts src/data/data.test.ts src/integration.test.ts src/index.test.ts`
    - `npm test` — confirm all 845 + new tests pass, no regressions
  - [ ] 7.5 Final build and lint check
    - `npm run build` — confirm ESM + CJS + types output
    - `npm run lint` — no new lint errors
    - Verify `src/transform.ts`, `src/data/caged-scales-minor.ts`, `src/data/pentatonic-minor.ts` contain no imports of `@tonaljs/scale`, `@tonaljs/chord`, or `@tonaljs/key`

**Acceptance Criteria:**

- All spec R5.3 test categories have coverage (pure, data, integration)
- `npm test` passes with 0 regressions
- No unrelated test files modified except deliberate retitles and count updates in `src/index.test.ts` per R5.2
- `npm run build` and `npm run lint` clean
- Pure-tier and data-tier dependency boundaries verified (no optional-peer imports)

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Module / Types** — Foundation. No dependencies.
2. **Task Group 2: Core Logic — relabelShape** — Must complete before data groups (data files call it at import time).
3. **Task Groups 3 and 4: Data — PARALLEL** — Both depend only on Task Group 2. Independently create `caged-scales-minor.ts` and `pentatonic-minor.ts`; both add their own `data.test.ts` describe blocks and side-effect import to `index.ts`. Can be dispatched concurrently.
4. **Task Group 5: Integration** — Waits for Groups 2, 3, 4 (modeShapes count assertions require all 10 entries registered).
5. **Task Group 6: Docs** — After all library changes.
6. **Task Group 7: Test Review** — Final verification.

**Parallelism:** Task Groups 3 and 4 are fully independent of each other and can run concurrently after Task Group 2. All other groups are strictly sequential.

## Files to Create

| File Path | Task |
|-----------|------|
| `src/transform.ts` | 1.3 |
| `src/transform.test.ts` | 1.1, 2.1 |
| `src/data/caged-scales-minor.ts` | 3.2 |
| `src/data/pentatonic-minor.ts` | 4.2 |

## Files to Modify

| File Path | Task |
|-----------|------|
| `src/shape.ts` | 1.2 — add `quality?` and `parentShape?` to `ScaleShape` |
| `src/index.ts` | 1.4, 3.3, 4.3, 5.3 — re-exports and side-effect imports |
| `src/data/pentatonic.ts` | 4.4 — fix misleading comment |
| `src/data/data.test.ts` | 3.1, 4.1, 7.2 — minor CAGED + pentatonic build-equivalence blocks |
| `src/integration.ts` | 5.3, 5.4, 5.5 — `relabelShapeToScale`, `isShapeCompatible` rewrite, `buildFromScale` relabel |
| `src/integration.test.ts` | 5.1, 7.3 — new describe blocks |
| `src/index.test.ts` | 5.2 — retitles + companion assertions per R5.2 |
| `README.md` | 6.2 |
| `docs/api/*.md` | 6.1 — integration page updates; transform entries |
| `docs/PLAN.md` | 6.3 |
| `CHANGELOG.md` | 6.5 — v0.2.0 behavior-change entry (create if absent) |
| `CLAUDE.md` | 1.5 (transform.ts layout row), 6.4 (data rows, dependency tiers, data/* carve-out) |

## Technical Notes

### Pure-tier dependency boundary

`src/transform.ts` sits in the same tier as `src/build.ts` — it MAY import `@tonaljs/interval` (required peer) and `./shape` (types only) but MUST NOT import `@tonaljs/scale`, `@tonaljs/chord`, `@tonaljs/key`, or `./integration`. This boundary is what allows the two new data files to call `relabelShape` at module load time before optional peers are available. See `CLAUDE.md` §Dependency layers; mirror the import pattern at `src/build.ts:14-17`.

### Empty-result convention (undefined, not sentinel object)

`relabelShape` returns `undefined` (not a `NoScaleShape` sentinel object) when no valid relabeling exists — the caller (data file registration) simply skips registration. `NoFrettedScale` remains the sentinel for build results (`src/build.ts:188,192`).

### rootString and anchor heuristic composition

The `buildFrettedScale` anchor heuristic reads `shape.strings[shape.rootString][0]` (`src/build.ts:112-149`). R2.3 mandates preserving per-string array ordering; combined with R2.7's lowest-string-index rule, the anchor heuristic composes correctly. The `stringOffset` at `src/build.ts:80-82` shifts shape string indices for extended-range tunings; a plain 0-based `rootString` passes through unchanged (R3.4).

### Data file self-registration pattern

Data files register shapes via `[...shapes].forEach(add)` at module top level. See `src/data/caged-scales.ts:86-87` and `src/data/pentatonic.ts:91-92`. Side-effect imports in `src/index.ts` must place derived files AFTER their parents (spec R4.3).

### isShapeCompatible chroma computation

Use the same chroma normalization as `relabelShape`: `((semitones(ivl) % 12) + 12) % 12` (`semitones` from `@tonaljs/interval`, cf. `src/build.ts:198`). The chroma-set subset check is NOT a relative-major geometric comparison — a major-frame shape is still incompatible with a minor scale (chroma 4 ∉ `{0,2,3,5,7,8,10}`). See spec R3.1 semantics note.

### buildFromScale relabel-then-build pattern

The relabel pass must happen BEFORE `buildFrettedScale` because `buildFrettedScale` assigns `FrettedNote.interval` directly from `shape.strings` (`src/build.ts:236`) — there is no post-build relabeling path. The identity-rotation case is handled naturally by `relabelShape` selecting `t = 0`; no special-casing needed. Fallback (non-rotation-compatible shape) preserves existing behavior.
