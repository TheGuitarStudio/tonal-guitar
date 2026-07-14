# Requirements: Minor-Quality Shape Relabeling API

## Initial Description

From issue #54: The 5 CAGED `ScaleShape`s are fixed to a major-scale-degree interval template. There is no way to `get()` a natural-minor CAGED shape, or to ask the registry to relabel a shape against a minor tonic. Downstream (guitar-studio) derives minor content by building at the relative-major root and relabeling each note's interval from its own pitch-class chroma. Request: (a) first-class minor-quality CAGED entries, or (b) a supported relabel-to-quality API.

## Requirements Discussion

### Round 1 Questions

**Q1:** API strategy — relabel API (b), registered minor data (a), or both?
**Answer:** Both — ship the relabel primitive AND use it to register named minor variants at import time. Covers guitar-studio's `get()`/`listShapeDefinitions()` coverage use case directly.

**Q2:** `isShapeCompatible` — change in place to chroma-set comparison, companion function, or flag?
**Answer:** Change in place to chroma-set (pitch-class-set coverage). The old strict interval-string behavior is the defect; v0.2.0 (0.x semver) allows the change. Update existing tests.

**Q3:** `buildFromScale` relabeling — automatic or opt-in?
**Answer:** Automatic. `buildFromScale` always labels notes in the requested scale's own interval frame — this is the documented PLAN.md behavior ("same frets, different interval labels"); it's a fix of specified-but-unimplemented behavior, not a new option.

**Q4:** Quality/mode coverage scope?
**Answer:** General API, minor validated — the relabel primitive works for any target interval set (all 7 modes, harmonic/melodic minor, etc.), but tests + registered entries + docs focus on natural minor CAGED and minor pentatonic.

### Round 2 Questions

**Q5:** Which derived minor entries registered at import time?
**Answer:** CAGED minor (5) + pentatonic minor (5). Skip 3NPS (modal naming is QUESTIONS.md Q4, separate).

**Q6:** Should `inferShapeContext` learn about minor shapes in this feature?
**Answer:** Follow-up issue. Registered minor entries naturally participate in registry-driven matching; deeper minor-tonic inference gets its own issue (#38 already touches inferShapeContext).

### Round 3 Questions (domain refinement)

**Domain insight raised by user:** Relabeling major→relative minor relocates the tonic, and the CAGED shape identity changes with it. "An E-shape Am barre chord is based off the G-Shape C-major scale." E Shape and G Shape major chords share the same E-string root; A Shape and C Shape share the same A-string root — but one goes up the neck, the other down. The scale/shape/key relationship is therefore not a simple same-name "minor" suffix; the relabel must recompute the root location, and naming must follow the minor form actually seen at that position.

**Q7:** How to name derived minor CAGED entries?
**Answer:** Paired minor-form letters — "Em Shape", "Am Shape", "Dm Shape", "Gm Shape", "Cm Shape" (e.g. relabel(G Shape) registers as "Em Shape"). Metadata records the parent major shape.

**Q8:** Minor pentatonic box numbering?
**Answer:** Boxes are basic and refer to the shape (geometry). Box 1 for "A" serves both A minor and C major — the same major/minor relative relationship as CAGED. So minor pentatonic entries relabel the SAME box number (quality-independent geometry); no renumbering. Root location within the box moves to the minor tonic.

**Q9:** Layering of the relabel primitive?
**Answer:** Pure core + integration wrapper — pure-tier `relabelShape(shape, targetIntervals)` (zero optional deps, recomputes rootString/name) so data files can derive registered minor entries at import time; plus a thin `integration.ts` wrapper resolving scale names (e.g. `relabelShapeToScale(shape, "A minor")`). Mirrors the `buildFrettedScale`/`buildFromScale` split.

### Existing Code to Reference

- `src/build.ts:180-263` — `buildFrettedScale`: interval→note assignment, `intervalToIndex` derivation (relabel pass must recompute the same fields)
- `src/integration.ts:124-148` — `buildFromScale`: where the automatic relabel pass lands
- `src/integration.ts:314-361` — `isShapeCompatible` + `modeShapes`: chroma-set rewrite target
- `src/shape.ts:95-116` — scale-shape registry (`add`/`get`/`all`); `chordShapes.query` (144-168) as pattern if a query API is added
- `src/data/caged-scales.ts`, `src/data/pentatonic.ts` — parent data + the unimplemented "minor-pent" comment (update once shipped)
- `src/data/data.test.ts` — build-equivalence test pattern for derived data

## Visual Assets

No visual assets provided. Library-only feature — no `site/` work unless the Lab picks it up later as a separate effort.

## Requirements Summary

### Functional Requirements

- **Relabel primitive (pure tier):**
  - `relabelShape(shape, targetIntervals, …)` returns a new `ScaleShape` whose per-string interval labels are rewritten to the target quality's frame
  - Geometry (fret/string positions) is unchanged; only labels, `rootString`, and name/metadata change
  - Recomputes `rootString` to the new tonic location (relative minor tonic = old 6M position)
  - Zero optional Tonal deps so `src/data/*` can call it at import time

- **Integration wrapper:**
  - Scale-name-based wrapper in `integration.ts` (resolves `Scale.get(name).intervals` and delegates to the pure primitive)

- **`buildFromScale` fix:**
  - Automatically labels `FrettedNote.interval`/`scaleIndex`/`degree`/`intervalNumber` in the requested scale's own frame (e.g. `3m` not `3M` for minor)

- **`isShapeCompatible` fix:**
  - Chroma-set (pitch-class) coverage comparison replaces strict interval-string subset
  - `modeShapes("A minor", "caged")` returns 5 shapes; `modeShapes("A minor pentatonic", "pentatonic")` returns 5 boxes

- **Registered minor entries (derived via the primitive at import time):**
  - 5 minor CAGED, named by paired minor form: "Em Shape" (from G), "Am Shape" (from C), etc., with parent-shape metadata
  - 5 minor pentatonic, same box numbers as major (geometry-identified), minor-frame labels and relocated root

### Reusability Opportunities

- `chordShapes.query()` filter pattern for any registry query additions
- `data.test.ts` build-equivalence testing pattern for derived shapes
- Existing interval math via `@tonaljs/interval` (already a required peer)

### Scope Boundaries

**In Scope:** relabel primitive + wrapper; `isShapeCompatible`/`modeShapes`/`buildFromScale` fixes; 10 registered minor entries; tests for natural minor + minor pentatonic; docs/api + README updates; fix the `pentatonic.ts` comment.

**Out of Scope:** CAGED minor triad ChordShapes (#57); blues shapes (#56); arpeggio seeds (#58); 3NPS modal naming (QUESTIONS.md Q4); `inferShapeContext` minor-tonic inference (follow-up issue); registered entries for the other 5 modes; `site/` Lab integration.

### Technical Considerations

- `ScaleShape` has no quality/parent metadata field today — the spec must define optional fields (e.g. `quality?`, `parentShape?` or similar) or another traceability mechanism for derived entries
- Enharmonic interval spelling: derive target interval names from the target scale's own interval list by chroma match, not raw semitone lookup
- Existing tests assert the current `false` compatibility results (`src/index.test.ts:1598-1609`) and must be deliberately updated
- CAGED major↔minor pairing to encode: shapes sharing root strings (E↔G on string 6, A↔C on string 5) with relative-minor tonic relocation; exact 5-pair mapping to be verified against the data during spec/implementation
