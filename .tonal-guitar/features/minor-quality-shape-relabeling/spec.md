# Specification: Minor-Quality Shape Relabeling API

## Goal

The 5 CAGED and 5 pentatonic `ScaleShape`s in `src/data/` are hard-coded to a major (Ionian) interval frame, so there is no supported way to obtain a natural-minor or minor-pentatonic labeling of a shape, `isShapeCompatible`/`modeShapes` return nothing useful for a minor tonic, and `buildFromScale(shape, "A minor")` silently builds the wrong pitch classes (it applies the major-frame shape at the minor tonic, producing A-major notes tagged as a minor scale). This feature adds a pure-tier `relabelShape` primitive (plus an integration-tier scale-name wrapper) that rewrites a shape's per-string interval labels, `rootString`, name, and quality metadata into any rotation-compatible target interval frame; uses it to register 5 minor CAGED and 5 minor pentatonic entries at import time; rebuilds `isShapeCompatible` on interval-chroma coverage (enharmonic-safe); and makes `buildFromScale` relabel the shape into the requested scale's frame before building. This closes the v0.2.0 "minor-quality gap" (issue #54) and unblocks downstream consumers (guitar-studio) that currently re-implement the relabel table by hand.

## User Stories

- As a library consumer, I want `modeShapes("A minor", "caged")` to return the 5 registered minor CAGED shapes (and `modeShapes("A minor pentatonic", "pentatonic")` the 5 minor boxes) so that minor-tonic scale rendering works without a hand-rolled catalog.
- As a library consumer, I want `buildFromScale(shape, "A minor")` to produce the correct A-natural-minor notes with minor-frame labels (`A=1P`, `C=3m`) so that scale-degree overlays, arpeggio extraction, and sequence walking are correct for minor tonics.
- As a registry/coverage consumer (guitar-studio `listShapeDefinitions()`), I want `get("Em Shape")`, `get("Am Shape")`, and minor-pentatonic entries to resolve to first-class registered `ScaleShape`s with parent/quality metadata so that my catalog-coverage diff closes without re-deriving data.
- As a library author, I want a reusable pure-tier `relabelShape(shape, targetIntervals)` primitive that works for any rotation-compatible interval set (all 7 modes, harmonic/melodic minor) so that additional qualities can be derived later without new bespoke code.
- As a library consumer, I want `relabelShape` to return a clear empty/sentinel result when a shape cannot be relabeled into the target frame so that misuse fails predictably instead of producing garbage labels.

## Specific Requirements

### Semantics note (governs R3.x)

`isShapeCompatible(shape, scaleName)` semantics are **root-relative**: the shape's interval frame (from its own root) is compared against the scale's interval frame (from its tonic). A major-frame shape is therefore NOT compatible with "A minor" — anchoring it at A would produce A major. The relative-major/minor geometric identity is expressed through the **registered minor entries** (same geometry, minor frame) and through `relabelShape`, not by loosening compatibility.

### Layer 1 — Types & Registry (`src/shape.ts`)

**R1.1 — `ScaleShape` metadata additions (backward-compatible, all optional).** Extend the `ScaleShape` interface (`src/shape.ts:22-28`):

```typescript
export interface ScaleShape {
  name: string;
  system: string;
  strings: (string[] | null)[];
  rootString: number;
  span?: number;
  quality?: string;      // NEW: interval-frame quality tag, e.g. "major" | "minor" | "minor-pentatonic"
  parentShape?: string;  // NEW: name of the source shape a relabeled entry was derived from, e.g. "G Shape"
}
```

- `quality` is the registry-facing quality label of the interval frame. Existing major source shapes MAY be left without `quality`; derived minor entries MUST set it (`"minor"` for CAGED-minor, `"minor-pentatonic"` for pentatonic-minor).
- `parentShape` MUST be set on derived entries to the `name` of the shape they were relabeled from; undefined on hand-authored source shapes.
- No changes to the registry functions `get`/`all`/`names`/`add`/`removeAll` (`src/shape.ts:95-116`). A `scaleShapes.query()` API is out of scope.

### Layer 2 — Core / Pure tier (`src/transform.ts`, new file)

**R2.1 — File placement and dependency tier.** New pure-tier module `src/transform.ts`. MAY import `@tonaljs/interval` (required peer, already used in `build.ts:14-17`) and `./shape` (types only). MUST NOT import `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key` or `./integration`, so `src/data/*` can call it at import time with zero optional peers. Update `CLAUDE.md`'s dependency-tier lists to include `transform.ts`.

**R2.2 — `relabelShape` signature.**

```typescript
export interface RelabelOptions {
  name?: string;        // override the derived name
  quality?: string;     // value written to result.quality
  parentShape?: string; // value written to result.parentShape (defaults to input shape.name)
}

export function relabelShape(
  shape: ScaleShape,
  targetIntervals: string[],   // target frame, e.g. ["1P","2M","3m","4P","5P","6m","7m"]
  options?: RelabelOptions,
): ScaleShape | undefined;
```

- Returns a NEW `ScaleShape` (no mutation). Geometry (which string/fret each note lands on) is unchanged — only interval labels, `rootString`, `name`, `quality`, `parentShape` change.
- Returns `undefined` (no throw — consistent with the project's empty-result convention, cf. `src/build.ts:188,192`) when no valid relabeling exists (R2.6). Rationale for `undefined` over a `NoScaleShape` sentinel object: failure means "no valid relabeling exists," callers in `src/data/*` register only successful results, and a nullable return is the smallest correct surface. `NoFrettedScale` remains the sentinel for build results.

**R2.3 — Relabel algorithm (chroma-anchored, enharmonic-safe).** The parent-frame → target-frame interval mapping MUST be computed by chroma, not string identity:

1. `targetChromas = targetIntervals.map(i => ((semitones(i) % 12) + 12) % 12)` via `@tonaljs/interval` `semitones`, building a `Map<chroma → targetInterval>`. If two target intervals share a chroma, the first wins (deterministic).
2. Determine the tonic offset `t` per R2.6. For each parent interval `p` on each string, `newChroma = (((semitones(p) - t) % 12) + 12) % 12`.
3. Rewrite each per-string interval `p` to `targetByChroma.get(newChroma)`. Preserve per-string array ordering (do not re-sort) — the anchor heuristic (`src/build.ts:112-149`) reads `strings[rootString][0]`, and `buildFrettedScale` re-derives `scaleIndex` from `semitones` anyway (`src/build.ts:196-201`).

**R2.4 — Natural-minor mapping (verified).** For `targetIntervals = ["1P","2M","3m","4P","5P","6m","7m"]` (`Scale.get("A minor").intervals`), tonic offset `t = 9` (parent `6M`), and the rewrite MUST be:

| Parent (major frame) | Chroma | −9 mod 12 | Target (natural-minor frame) |
| --- | --- | --- | --- |
| 6M | 9 | 0 | 1P |
| 7M | 11 | 2 | 2M |
| 1P | 0 | 3 | 3m |
| 2M | 2 | 5 | 4P |
| 3M | 4 | 7 | 5P |
| 4P | 5 | 8 | 6m |
| 5P | 7 | 10 | 7m |

**R2.5 — Minor-pentatonic mapping (verified).** For `targetIntervals = ["1P","3m","4P","5P","7m"]` (`Scale.get("A minor pentatonic").intervals`), `t = 9`:

| Parent (major-pent frame) | Chroma | −9 mod 12 | Target (minor-pent frame) |
| --- | --- | --- | --- |
| 6M | 9 | 0 | 1P |
| 1P | 0 | 3 | 3m |
| 2M | 2 | 5 | 4P |
| 3M | 4 | 7 | 5P |
| 5P | 7 | 10 | 7m |

**R2.6 — Tonic-offset selection and subset guard (edge case: non-subset chroma).** Let `parentChromas` be the set of chromas of all intervals used by the shape. The tonic offset `t` is chosen deterministically: iterate candidate offsets in ascending chroma order starting at 0 (`t ∈ {0, 1, …, 11}` restricted to `t ∈ parentChromas`), and select the FIRST `t` for which every remapped chroma `((c − t) mod 12)` is present in `targetChromas`. Identity (`t = 0`) therefore takes precedence when the shape already fits the target frame (relabeling `"Em Shape"` to natural minor is a no-op relabel). If NO candidate `t` satisfies the subset condition, return `undefined`. This covers "relabel a 7-note major shape into a 5-note pentatonic frame" and any target where no rotation aligns. For the shipped minor derivations `t = 9` (parent `6M`) is the unique non-identity solution.

**R2.7 — `rootString` recomputation.** The result `rootString` MUST be the string index of the new tonic (the parent interval whose chroma equals `t`). Selection rule when the new tonic appears on multiple strings: **choose the lowest string index (lowest-pitched string)**, matching existing `rootString` conventions in `caged-scales.ts` and the anchor heuristic in `build.ts:112-149`. This rule is verified to produce the canonical minor-form root strings for all 5 CAGED and all 5 pentatonic derivations (R4.1, R4.2). If the shape's original `strings[rootString]` is null/empty, R2.7 still applies — the root follows the new tonic, not the old `rootString`.

**R2.8 — Name derivation.** If `options.name` is provided, use it; otherwise keep the input shape's name unchanged (the data files supply explicit names per R4.1/R4.2 — the primitive does not know CAGED minor-form nomenclature). `quality`/`parentShape` come from `options`, with `parentShape` defaulting to `shape.name` when omitted.

**R2.9 — `system` preservation.** The result `system` equals the input `system` (`"caged"` stays `"caged"`, `"pentatonic"` stays `"pentatonic"`), so `modeShapes(..., "caged")` system filtering buckets minor entries correctly.

### Layer 3 — Integration tier (`src/integration.ts`)

**R3.0 — `relabelShapeToScale` wrapper.**

```typescript
export function relabelShapeToScale(
  shape: ScaleShape,
  scaleName: string,          // e.g. "A minor", "A minor pentatonic"
  options?: RelabelOptions,
): ScaleShape | undefined;
```

Resolves `getScale(scaleName)` (existing wrapper, `integration.ts:137,318`); if non-empty, delegates to `relabelShape(shape, scale.intervals, options)`. Returns `undefined` for unknown scales or when the primitive returns `undefined`. Enharmonic spelling is inherited from the target scale's own `scale.intervals` — never a raw semitone→interval lookup.

**R3.1 — `isShapeCompatible` rewrite (interval-chroma coverage, root-relative).** Replace the strict interval-string subset check (`src/integration.ts:314-337`) with chroma-set coverage **of interval frames**:

- Shape chroma set: for each unique interval in `shape.strings.flatMap(...)`, `((semitones(ivl) % 12) + 12) % 12`.
- Scale chroma set: same computation over `scale.intervals`.
- Return `true` iff the shape chroma set is non-empty AND is a subset of the scale chroma set. Return `false` for an empty/unknown scale and for a shape with no intervals (preserving the guards at `integration.ts:319-331`).
- This is an **enharmonic-robustness** fix (e.g. `4A` vs `5d` spellings across Tonal scale types), NOT a relative-major loosening. Behavior table:

| Call | Result | Why |
| --- | --- | --- |
| `isShapeCompatible(CAGED_E, "C major")` | `true` | unchanged |
| `isShapeCompatible(CAGED_E, "A minor")` | `false` | major frame ⊄ minor frame (root-relative) |
| `isShapeCompatible(get("Em Shape"), "A minor")` | `true` | minor frame ⊆ minor frame |
| `isShapeCompatible(get("Em Shape"), "A dorian")` | `false` | `6m` (chroma 8) ∉ dorian |
| `isShapeCompatible(PENTA_BOX_1, "A minor pentatonic")` | `false` | major-pent frame ⊄ minor-pent frame |
| `isShapeCompatible(get("Pentatonic Box 1 Minor"), "A minor pentatonic")` | `true` | — |
| `isShapeCompatible(get("Pentatonic Box 1 Minor"), "A minor")` | `true` | minor-pent chromas ⊆ natural-minor chromas |

**R3.2 — `modeShapes` (no logic change; behavior improves via registered entries).** `modeShapes` (`src/integration.ts:350-361`) stays a filter over `isShapeCompatible` + optional system filter. Post-feature behavior (MUST be asserted with exact counts):

| Call | Before | After |
| --- | --- | --- |
| `modeShapes("C major", "caged")` | 5 | 5 (minor entries are NOT compatible with a major frame) |
| `modeShapes("A minor", "caged")` | 0 | **5** — exactly {Em, Am, Dm, Gm, Cm} Shape |
| `modeShapes("A minor pentatonic", "pentatonic")` | 0 | **5** — the five "Pentatonic Box N Minor" entries |
| `modeShapes("A major pentatonic", "pentatonic")` | 5 | 5 (unchanged) |
| `modeShapes("A minor")` (no system filter) | 0 | 10 (5 minor CAGED + 5 minor pentatonic; minor-pent frame ⊆ natural-minor frame) |
| `modeShapes("A dorian")` | 0 | 0 (no dorian-frame entries registered; consumers derive via `relabelShape`) |

**R3.3 — `buildFromScale` automatic relabel (D-003) — pitch-correctness bug fix.** Current behavior (`integration.ts:132-148`): builds the shape as-is at `result.tonic`, so `buildFromScale(CAGED_E, "A minor")` produces **A-major pitch classes** tagged `scaleType: "aeolian"` — wrong notes, not merely wrong labels. Required behavior:

- After resolving `result = getScale(scaleName)`, relabel the shape via `relabelShape(shape, result.intervals)`; if it returns a shape, call `buildFrettedScale(relabeled, result.tonic, tuning)`. If the relabel returns `undefined` (shape not rotation-compatible with the scale), fall back to building the original shape at `result.tonic` (current behavior) so no previously-working call regresses to empty.
- Because `buildFrettedScale` derives `interval`, `scaleIndex`, `degree`, `intervalNumber` from the (now relabeled) template (`src/build.ts:196-201, 234-247`), all four `FrettedNote` fields follow automatically — no post-build pass needed. `FrettedScale.root`/`scaleType`/`scaleName` semantics unchanged.
- Verified consequence: `buildFromScale(CAGED_E, "A minor")` now produces A-natural-minor notes (A=`1P`, C=`3m`, E=`5P`) laid out in the relabeled (Dm-form) geometry anchored at A. When the shape already matches the scale frame (`buildFromScale(CAGED_E, "C major")`, `buildFromScale(get("Em Shape"), "A minor")`), the identity rotation applies and output is unchanged from building the shape directly.
- Changelog MUST flag this as a v0.2.0 behavior fix (previous minor-scale builds returned incorrect pitch content).

**R3.4 — Extended-range tuning interaction (edge case — Task 2.5 rootString auto-adjust).** `buildFrettedScale` applies `stringOffset` and anchors on `shape.rootString` (`src/build.ts:80-82, 133-149`). A relabeled shape's recomputed `rootString` (R2.7) is a plain 0-based low-to-high index and flows through `stringOffset`/`adjustedRootString` unchanged. REQUIRED regression test: `buildFromScale(get("Em Shape"), "A minor", <7-string tuning>)` builds non-empty and places the A tonic on the auto-adjusted root string (no double-offset, no off-by-one).

### Layer 4 — Data (registered minor entries, derived at import time)

**R4.1 — Minor CAGED entries (`src/data/caged-scales-minor.ts`, new file).** Import `relabelShape` from `../transform`, `add` from `../shape`, and the 5 source shape consts. Register 5 derived entries at import time. `targetIntervals` is a module constant `["1P","2M","3m","4P","5P","6m","7m"]` (zero-optional-dep tier; MUST equal `Scale.get("A minor").intervals`, asserted in tests). Each call passes `options.name`, `options.quality = "minor"`, `options.parentShape = <source name>`.

**Verified CAGED major → minor mapping** (names follow the paired minor barre form per D-006; both user anchors G→Em and C→Am satisfied; mapping is the CAGED cycle E-D-C-A-G paired to the minor cycle Dm-Cm-Am-Gm-Em; result `rootString` = lowest parent string carrying `6M`, which coincides with the paired minor form's canonical root string in every case):

| Parent (source const) | Parent rootString | 6M strings in parent | Registered minor name | Result rootString | quality / parentShape |
| --- | --- | --- | --- | --- | --- |
| `CAGED_E` ("E Shape") | 0 | 2, 4 | **"Dm Shape"** | 2 | minor / "E Shape" |
| `CAGED_D` ("D Shape") | 2 | 1, 4 | **"Cm Shape"** | 1 | minor / "D Shape" |
| `CAGED_C` ("C Shape") | 1 | 1, 3 | **"Am Shape"** | 1 | minor / "C Shape" |
| `CAGED_A` ("A Shape") | 1 | 0, 3, 5 | **"Gm Shape"** | 0 | minor / "A Shape" |
| `CAGED_G` ("G Shape") | 0 | 0, 2, 5 | **"Em Shape"** | 0 | minor / "G Shape" |

The per-string relabeled interval arrays are produced by R2.3/R2.4 at import time and MUST NOT be hand-authored.

**R4.2 — Minor pentatonic entries (`src/data/pentatonic-minor.ts`, new file).** Same box numbers as the major boxes (D-007 — box number is geometry identity, not quality identity). `targetIntervals = ["1P","3m","4P","5P","7m"]` (MUST equal `Scale.get("A minor pentatonic").intervals`). Each entry: `quality = "minor-pentatonic"`, `parentShape = <major box name>`, `system` stays `"pentatonic"`.

**Verified pentatonic mapping** (`rootString` = lowest string carrying `6M`):

| Parent (source const) | Registered minor name | Result rootString |
| --- | --- | --- |
| `PENTA_BOX_1` | **"Pentatonic Box 1 Minor"** | 0 |
| `PENTA_BOX_2` | **"Pentatonic Box 2 Minor"** | 2 |
| `PENTA_BOX_3` | **"Pentatonic Box 3 Minor"** | 1 |
| `PENTA_BOX_4` | **"Pentatonic Box 4 Minor"** | 1 |
| `PENTA_BOX_5` | **"Pentatonic Box 5 Minor"** | 0 |

**R4.3 — Registration side-effects (`src/index.ts`).** Add two side-effect imports ORDERED AFTER their parents:

```typescript
import "./data/caged-scales-minor";   // NEW — depends on caged-scales
import "./data/pentatonic-minor";     // NEW — depends on pentatonic
```

**R4.4 — Exports (`src/index.ts`).** Export `relabelShape` + `RelabelOptions` from the pure tier and `relabelShapeToScale` from the integration block (`src/index.ts:99-115`). Update `CLAUDE.md` source-layout and dependency-layer sections for `transform.ts` and the two new data files.

**R4.5 — Fix the misleading `pentatonic.ts` comment.** Replace the aspirational `"minor-pent"` build-engine comment (`src/data/pentatonic.ts:1-16`) with an accurate note pointing to `relabelShape`/`relabelShapeToScale` and the registered `"Pentatonic Box N Minor"` entries. No interval data changes.

### Layer 5 — Docs & Tests

**R5.1 — Docs.** Update `README.md` and the relevant `docs/api/` page(s): `relabelShape`, `relabelShapeToScale`, the new `ScaleShape.quality`/`parentShape` fields, corrected `isShapeCompatible`/`buildFromScale` semantics (call out the `buildFromScale` pitch-correctness fix as v0.2.0 behavior change), and the 10 new registered entries with the mapping tables. Update `docs/PLAN.md` (Task 6.1 / "Pentatonic-Modal same-shape relationship") and note `docs/QUESTIONS.md` Q4 (3NPS modal naming) remains deferred.

**R5.2 — Existing tests to revisit** (`src/index.test.ts:1587-1642`):
- `"CAGED_E is not compatible with 'A minor pentatonic'"` (≈1598) — outcome unchanged (`false`); update the title/comment to chroma-set reasoning (7-note frame ⊄ 5-note frame).
- `PENTA_BOX_1` vs `"A minor pentatonic"` → `false` (≈1603-1609) — outcome unchanged under root-relative chroma semantics (major-pent frame ⊄ minor-pent frame); keep, retitle, and add the companion `true` assertion for `get("Pentatonic Box 1 Minor")`.
- `modeShapes("C major", "caged")` `=== 5` (≈1622-1628) — outcome unchanged; keep as regression that minor entries do NOT leak into major queries.
- `modeShapes("A major pentatonic", "pentatonic")` `=== 5` (≈1630-1636) — outcome unchanged.
- Any registry-count assertions over `names()`/`all()` — update for +10 entries.

**R5.3 — New tests required** (`src/transform.test.ts` new file; additions to `src/data/data.test.ts` and `src/integration.test.ts`):

- **relabelShape (pure):** natural-minor rewrite of `CAGED_G` matches R2.4 cell-by-cell; `name === "Em Shape"` (via options), `rootString === 0`, `quality === "minor"`, `parentShape === "G Shape"`; input shape deep-unchanged (no mutation).
- **relabelShape identity:** relabeling a minor-frame shape to the same minor frame selects `t = 0` and returns an interval-identical shape.
- **relabelShape edge — non-subset chroma:** 7-note CAGED shape → 5-note minor-pentatonic frame returns `undefined` (R2.6).
- **relabelShape edge — null string:** `null` string entries are preserved at the same index; non-null strings relabel.
- **relabelShape edge — empty shape:** all-null/empty `strings` → `undefined`.
- **relabelShape general-API validation:** relabel `CAGED_G` to the dorian frame (`["1P","2M","3m","4P","5P","6M","7m"]`) succeeds with `t = 2` — validates modes beyond minor per D-004.
- **relabelShapeToScale:** `relabelShapeToScale(CAGED_G, "A minor")` equals the pure result; unknown scale name → `undefined`.
- **Build equivalence — CAGED (data.test.ts pattern):** for each of the 5 pairs, `buildFrettedScale(get("<minor name>"), "A")` yields the SAME `{string, fret}` position set as `buildFrettedScale(<source>, "C")` (relative-pair geometric identity), with minor-frame labels: the A note carries `1P`, the C note `3m`.
- **Build equivalence — pentatonic:** for each box, positions of `buildFrettedScale(get("Pentatonic Box N Minor"), "A")` equal `buildFrettedScale(PENTA_BOX_N, "C")`; A=`1P`, C=`3m`.
- **buildFromScale relabel (R3.3):** `buildFromScale(CAGED_E, "A minor")` → root `A`, pitch classes = {A,B,C,D,E,F,G}, C note = `3m`; `buildFromScale(PENTA_BOX_1, "A minor pentatonic")` → A=`1P`, C=`3m`. Identity path: `buildFromScale(CAGED_E, "C major")` output unchanged from pre-fix behavior.
- **buildFromScale fallback:** a shape not rotation-compatible with the requested scale still builds via the original shape (non-empty), not `NoFrettedScale`.
- **isShapeCompatible (R3.1):** the full behavior table in R3.1 asserted case-by-case, plus unknown scale → `false` and empty-interval shape → `false`.
- **modeShapes (R3.2):** `modeShapes("A minor", "caged")` returns exactly 5 with names {Em, Am, Dm, Gm, Cm} Shape; `modeShapes("A minor pentatonic", "pentatonic")` exactly the 5 minor boxes; `modeShapes("A minor")` (no filter) exactly 10; `modeShapes("A dorian")` → `[]`.
- **Registry (R4.1/R4.2):** all 10 `get()` lookups defined with correct `parentShape`/`rootString`/`quality`; `names()` length increases by exactly 10.
- **Extended-range interaction (R3.4):** `buildFromScale(get("Em Shape"), "A minor", <7-string tuning>)` non-empty; tonic A on the auto-adjusted root string.
- **Target-frame constants sanity (integration.test.ts, optional-dep guarded):** the literal frames in the data files equal `Scale.get("A minor").intervals` / `Scale.get("A minor pentatonic").intervals`.

**R5.4 — Non-regression.** All 845 existing tests pass apart from deliberate retitles/count updates in R5.2. `npm test`, `npm run lint`, `npm run build` (ESM+CJS+types) succeed. The new `transform.ts` and data files respect the dependency-layer boundaries (no optional-peer imports in pure/data tiers).

## Visual Design

N/A — library-only feature. No DB, HTTP API, or UI layer; no `site/` Guitar Lab work in scope (a future Lab surface for minor shapes is a separate effort).

## Existing Code to Leverage

**Pure interval math & empty-result convention**
- `src/build.ts:14-17, 196-201` — `@tonaljs/interval` `semitones` usage and the interval→scaleIndex derivation the relabeled template feeds into; `src/build.ts:188,192` — the `undefined`/empty return convention `relabelShape` mirrors.

**Anchor/rootString and Task 2.5 extended-range logic**
- `src/build.ts:80-82` (`stringOffset`), `112-166` (anchor heuristic reading `strings[rootString][0]`) — why relabeled `rootString` stays a plain low-to-high index and per-string ordering must be preserved (R2.3, R3.4).

**Integration wrapper split pattern**
- `src/integration.ts:132-148` (`buildFromScale` over `buildFrettedScale`) — the pure-primitive + scale-name-wrapper split to mirror for `relabelShape`/`relabelShapeToScale`; `getScale` at `integration.ts:137,318`.
- `src/integration.ts:314-361` — `isShapeCompatible`/`modeShapes` bodies to rewrite (R3.1) / leave structurally intact (R3.2).

**Registry & data-file self-registration pattern**
- `src/shape.ts:22-28` (type to extend), `95-116` (`add`/`get`/`all`/`names`).
- `src/data/caged-scales.ts:86-87`, `src/data/pentatonic.ts:91-92` — the `[...].forEach(add)` import-time registration pattern; the source consts to relabel.

**Test patterns**
- `src/data/data.test.ts` — build-equivalence pattern for derived shapes (R5.3).
- `src/index.test.ts:1587-1642` — the compatibility/modeShapes assertions to revisit (R5.2).

## Out of Scope

- CAGED minor **triad `ChordShape`** entries (issue #57 — separate chord registry/data path).
- Blues scale shapes (issue #56 — new geometry with `b5`, not a relabel).
- Minor **arpeggio** registry seeds (issue #58 — downstream; unblocked but not implemented here).
- 3NPS modal-name revision (`docs/QUESTIONS.md` Q4 — `NPS_PATTERN_6` "Aeolian" naming stays as-is; no 3NPS minor entries registered).
- `inferShapeContext` minor-tonic inference (D-008 — follow-up issue; registered entries participate in registry matching passively, no inference logic changes).
- First-class registered entries for the other 5 diatonic modes and harmonic/melodic minor (supported by `relabelShape`; not registered/tested now).
- A `scaleShapes.query()` filter API mirroring `chordShapes.query()` — deferred; consumers filter `all()` by `quality`/`system`.
- `site/` Guitar Lab integration and any visual rendering.
- Changes to `buildFrettedScale` core geometry, the anchor heuristic, or Task 2.5 `stringOffset` logic beyond verifying composition with relabeled `rootString`.
