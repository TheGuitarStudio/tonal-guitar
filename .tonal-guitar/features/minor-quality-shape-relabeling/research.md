# Research: Minor-Quality Shape Relabeling API

**Date:** 2026-07-12 | **Issue:** #54

---

## Codebase Research

### Relevant Types and Registry

`src/shape.ts:22-28` defines `ScaleShape`:

```typescript
export interface ScaleShape {
  name: string;
  system: string; // "caged" | "3nps" | "pentatonic" | "custom"
  strings: (string[] | null)[]; // per-string intervals, low to high
  rootString: number;
  span?: number;
}
```

- There is **no `quality` or `scaleType` field** — the interval template is the only scale-quality encoding.
- The scale-shape registry API (`src/shape.ts:95-116`) is `get(name)`, `all()`, `names()`, `add()`, `removeAll()` — plain string-name keys, no query by quality/system/mode. The chord-shape registry has a richer `query()` API (`src/shape.ts:144-168`); the scale-shape registry has no equivalent.
- Registry holds **17 scale shapes** at import time: 5 CAGED + 7 3NPS + 5 pentatonic — **all with major-frame interval templates**. Minor intervals (`3m`, `6m`, `7m`) appear nowhere in `src/data/`.

### Shape Data

- `src/data/caged-scales.ts` — all 5 CAGED shapes use Ionian interval spellings (e.g. `CAGED_E` lines 13-25: `["7M","1P","2M"]`, `["3M","4P","5P"]`, …). No "E Shape Minor" exists.
- `src/data/pentatonic.ts:1-16` — boxes are defined as MAJOR pentatonic (`1P, 2M, 3M, 5P, 6M`). The file comment describes an intended `"minor-pent"` mode: *"the build engine then anchors the shape at the relative major's root (e.g. for A minor pent it builds at C, then relabels intervals from A: A=1P, C=3m, D=4P, E=5P, G=7m)."* **This mode was never implemented** — the comment is aspirational design documentation that misleads consumers.
- `src/data/three-nps.ts` — Pattern 6 is labeled "Aeolian" (`NPS_PATTERN_6`, lines 83-96) but uses major-frame intervals. Building it with root `"C"` produces C major starting from A, not A natural minor from its own tonic (see also `docs/QUESTIONS.md` Q4).

### Build Engine — Interval Assignment

`buildFrettedScale` (`src/build.ts:180-263`) works entirely from `shape.strings` + a root pitch class:

1. Collects/dedupes/sorts the shape's intervals into `intervalToIndex` (lines 195-201).
2. `transpose(pc, ivl)` per (string, interval) pair.
3. `FrettedNote.interval` is assigned **directly from the shape template** (line 236); `scaleIndex`/`degree`/`intervalNumber` derive from the shape's own interval set.

There is **no parent-frame vs. target-frame concept and no post-build relabeling path**. To get minor-frame intervals on notes, either the shape template must contain minor intervals, or a relabeling pass must be added.

`buildFromScale` (`src/integration.ts:124-148`) calls `Scale.get(scaleName)`, then `buildFrettedScale(shape, tonic)`. It overwrites `scaleType`/`scaleName` to the requested scale, but each `FrettedNote.interval` stays major-frame (e.g. `3M` where the minor scale needs `3m`). This is the root of the downstream chroma-relabeling workaround.

### The Root Defect: `isShapeCompatible`

`src/integration.ts:314-337`:

```typescript
const shapeIntervals = Array.from(new Set(shape.strings.flatMap((s) => s || [])));
const scaleIntervalSet = new Set(scale.intervals);
return shapeIntervals.every((ivl) => scaleIntervalSet.has(ivl));
```

Strict interval-string subset check. `"3M"` is not in natural minor's `["1P","2M","3m","4P","5P","6m","7m"]`, so **every CAGED shape fails for `"A minor"`** despite identical pitch-class geometry (Aeolian mode of the relative major). Same for pentatonic boxes vs. `"A minor pentatonic"` — confirmed by existing tests at `src/index.test.ts:1598-1609`.

The correct geometric comparison is **chroma-set coverage** (every shape pitch class present in the scale's pitch-class set), not interval-string equality.

### `modeShapes` Failure Matrix

`modeShapes` (`src/integration.ts:350-361`) is a thin filter over `isShapeCompatible`. Current behavior:

| Call | Result |
|------|--------|
| `modeShapes("C major")` | 17 shapes ✓ |
| `modeShapes("A minor")` | `[]` ✗ |
| `modeShapes("A minor pentatonic")` | `[]` ✗ |
| `modeShapes("A dorian")` | `[]` ✗ |

Test coverage (`src/index.test.ts:1616-1642`) only exercises major scales — **zero tests assert the minor-scale behavior**, so the defect is silent.

Once `isShapeCompatible` uses chroma-set comparison, `modeShapes("A minor")` returns all 5 CAGED shapes automatically — no data changes needed.

### Public API Conventions

Exports from integration tier (`src/index.ts:99-115`): `buildFromScale`, `relatedScales`, `identifyChord`, `analyzeInKey`, `isShapeCompatible`, `modeShapes`, `arpeggioFromScale`, `arpeggioFromShape`, `inferShapeContext`. No `relabelShape`/`qualityShapes`/mode-transform function exists.

Conventions: pure functions, named exports, empty-result sentinels (`NoFrettedScale`), registry functions follow Tonal.js `ScaleType`/`ChordType` style, data files self-register via `add()` at import time.

### Suggested Code Placement

| Component | File | Dependency Tier |
|-----------|------|-----------------|
| `relabelShape(shape, …)` / mode-shift primitive | `src/build.ts` or new `src/transform.ts` | Zero-optional-Tonal (only `@tonaljs/interval`) |
| Minor CAGED data (if option (a) chosen) | `src/data/caged-scales-minor.ts` | Zero Tonal deps |
| Minor pentatonic data (if option (a) chosen) | `src/data/pentatonic-minor.ts` | Zero Tonal deps |
| `scaleShapes.query(filter)` (optional) | `src/shape.ts` (mirror `chordShapes.query`) | Zero Tonal deps |
| `isShapeCompatible` chroma-set fix + `modeShapes` + `buildFromScale` relabel pass | `src/integration.ts` | Optional `@tonaljs/scale` |
| Registration side-effects | `src/index.ts` | N/A |

---

## Product Research

### Roadmap Alignment

**Alignment: Strong.** Issue #54 is the anchor issue of the **v0.2.0 milestone "Registry depth"** ("Close the minor-quality gap: shape relabeling API (modeShapes for minor/pentatonic), CAGED minor triads + C/G 7ths, blues shapes, arpeggio seeds, metadata audit, inference perf").

The library's design principle (`docs/design.md`): *"Shapes are interval-based (key-independent) by default"* — the major-only templates violate this promise for minor tonics. `docs/PLAN.md` (Task 6.1 and the "Pentatonic/Modal same-shape relationship" section) already specifies the intended behavior: `buildFromScale(shape, "A minor pentatonic")` and `buildFromScale(shape, "C major pentatonic")` should produce the same frets but different interval/scaleIndex/degree values. This was specified but never implemented — a latent spec defect in v0.1.0.

### Related Specifications

| Document | Relevance |
|----------|-----------|
| `docs/PLAN.md` Task 6.1 + "Pentatonic/Modal same-shape relationship" | Specifies the exact relabeling behavior this feature implements |
| `docs/QUESTIONS.md` Q4 | Same defect class: 3NPS modal names vs. major-frame intervals; keep naming as-is unless spec revisits |
| `src/data/pentatonic.ts:1-16` comment | De-facto spec of the unimplemented "minor-pent" relabel mode |
| `.tonal-guitar/features/*` (existing) | No overlap — connector/arpeggio/extended-chord features are orthogonal |

### User Context

Primary downstream: **BlueVajra/guitar-studio** (issue originates from guitar-studio#204 Tool Lab migration; legacy 65-shape catalog vs `listShapeDefinitions()` coverage diff). Affected workflows:

- `modeShapes("A minor", "caged")` → `[]` (broken for all non-major queries)
- `buildFromScale(CAGED_E, "A minor")` → notes carry `3M` instead of `3m`
- Minor pentatonic boxes 1-5 — "the single most-taught guitar scale" — unavailable with correct intervals
- `inferShapeContext` matches minor grips to the major parent at the major root
- `arpeggioFromScale` / sequence walking over minor scales inherit wrong degrees

Impact of not shipping: every consumer re-implements the chromaOffset → interval lookup table (guitar-studio's `legacy-shape-catalog.ts` technique 1 is the working reference).

### Scope Assessment

**In Scope (option (b) — relabel-to-quality API, recommended):**

1. `relabelShape(shape, scaleName)`-style reusable primitive producing a new `ScaleShape` with intervals mapped to the target scale's frame
2. `buildFromScale` post-build interval relabeling (interval, scaleIndex, degree, intervalNumber follow)
3. `isShapeCompatible` rebuilt on chroma-set coverage instead of interval-string equality
4. `modeShapes("A minor", "caged")` → 5 CAGED shapes; `modeShapes("A minor pentatonic", "pentatonic")` → 5 boxes
5. Natural minor + minor pentatonic as the minimum valuable unit; other modes fall out of the same API

**Out of Scope:**

- CAGED minor triad `ChordShape` entries (#57 — separate registry/data path)
- Blues scale shapes (#56 — new geometry with b5, not a relabel)
- Minor arpeggio registry seeds (#58 — downstream, unblocked by this feature)
- 3NPS modal naming revision (QUESTIONS.md Q4 — intentional pedagogical naming)
- First-class named registry entries for all 7 modes (enabled by the API; consumers can derive)

**Adjacent Features (separate efforts):** #56 blues shapes, #57 CAGED minor triads, #58 arpeggio seeds, #38 inferShapeContext perf, #39 chord-shape metadata audit.

### GitHub Project Context — v0.2.0 milestone

| Issue | Title | Relation to #54 |
|-------|-------|-----------------|
| #54 | Minor-quality shape relabeling API | **This feature** — milestone anchor |
| #55 | Pentatonic Box 1-5 no minor variant (closed Not Planned) | Resolved if #54 ships option (b) |
| #56 | No blues scale shapes | Adjacent — new geometry |
| #57 | CAGED system lacks minor triads | Parallel registry gap, chord shapes |
| #58 | Arpeggio seeds cover only E/A/D major+maj7 | Downstream — needs #54 first |
| #38 | inferShapeContext perf | Independent |
| #39 | Chord-shape metadata cleanup | Independent |

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
|-----------------|----------|------------|
| Changing `isShapeCompatible` semantics (strict interval-set → chroma-set) alters existing documented/tested behavior (`src/index.test.ts:1598-1609` asserts the `false` results) | Medium | Decide in Shape phase: change semantics vs. add a mode/flag vs. new function; update tests and docs deliberately |
| Enharmonic interval spelling when relabeling (e.g. `A4` vs `d5`) | Medium | Derive interval names from the target scale's own `Scale.get().intervals` by chroma match, not raw semitone → interval lookup |
| `buildFromScale` relabel pass changes `FrettedNote` values downstream consumers may already compensate for | Medium | Semver: this is v0.2.0; document as fix of specified-but-unimplemented behavior |
| Where the relabel primitive lives affects the peer-dep boundary (pure tier vs. `integration.ts`) | Low | Pure interval-math version in zero-Tonal tier; scale-name resolution wrapper in `integration.ts` |
| `pentatonic.ts` comment describes nonexistent `"minor-pent"` mode | Low | Update the comment to reference the real API once shipped |

## Open Questions

- Option (a) registered minor data vs. option (b) relabel API vs. both (a-derived-from-b)? Product research strongly favors (b), with option (a) entries derivable if wanted.
- Should `isShapeCompatible` change in place (breaking its documented strict semantics) or gain a flag / companion function (e.g. `isShapeGeometricallyCompatible`)?
- Exact name and signature of the relabel primitive: `relabelShape(shape, scaleName)` (integration tier) vs. `relabelShape(shape, targetIntervals)` (pure tier) vs. both layers?
- Should `buildFromScale` relabel automatically (behavior change) or behind an option (`{ relabel: true }`)?
- Should minor-quality shapes get registry names (e.g. "E Shape Minor") for `get()` discoverability, or is the transform-on-demand API sufficient for guitar-studio's registry-coverage use case? (Issue asks for either.)
- Does `inferShapeContext` need awareness of relabeled shapes in this feature, or is that follow-up?
