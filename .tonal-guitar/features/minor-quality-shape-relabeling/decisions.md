# Decisions: Minor-Quality Shape Relabeling API

Technical decisions made during the Shape phase.

---

## D-001: Ship both the relabel API and registered minor entries

**Context:** Issue #54 offers option (a) first-class minor registry entries or (b) a relabel-to-quality API.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Relabel API only (b) | Smallest surface; minor data derivable | guitar-studio's `get()`/coverage use case unserved; every consumer derives by hand |
| Registered data only (a) | Direct lookup works | No transform for other qualities/modes; duplicated hand-authored data |
| Both (b primitive, a derived from it) | One source of truth; lookup AND transform both work | Slightly larger surface |

**Decision:** Both — the primitive is the source of truth; registered minor entries are derived from it at import time.

**Rationale:** Registration answers the coverage-diff use case that motivated the issue; the primitive prevents data duplication and enables other modes for free. Reversible: entries can be unregistered without touching the API.

---

## D-002: Rewrite `isShapeCompatible` in place on chroma-set coverage

**Context:** The strict interval-string subset check rejects geometrically-compatible shapes for minor/modal scales; existing tests assert the rejections.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Change in place | One function, correct default; fixes `modeShapes` transitively | Breaking change to documented/tested behavior |
| Companion function | No breakage | Two near-identical functions; `modeShapes` switches anyway |
| Options flag | Backward compatible | Broken default remains the headline behavior |

**Decision:** Change in place to pitch-class-set coverage.

**Rationale:** The old behavior is the defect, not a feature; 0.x semver permits it; tests updated deliberately. Not easily reversible after consumers adopt — document in changelog.

---

## D-003: `buildFromScale` relabels automatically

**Context:** `buildFromScale(CAGED_E, "A minor")` returns major-frame intervals (`3M` for what is `3m` in the requested scale).

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Automatic relabel | Matches PLAN.md's specified behavior; correct by default | Output change for consumers who compensated downstream |
| Opt-in `{ relabel: true }` | Preserves current output | Wrong-by-spec default persists |

**Decision:** Automatic.

**Rationale:** PLAN.md already specifies "same frets, different interval labels" for relative pairs; this is a bug fix of unimplemented spec, shipped in v0.2.0.

---

## D-004: General relabel API; natural minor + minor pentatonic validated

**Context:** How much modal coverage to build and test now.

**Decision:** The primitive accepts any target interval set (modes, harmonic/melodic minor work by construction), but registered entries, tests, and docs target natural minor CAGED and minor pentatonic only.

**Rationale:** Minimum valuable unit per the issue; other modes have no named demand yet but come free via the same API.

---

## D-005: Pure-tier primitive + integration-tier scale-name wrapper

**Context:** Where the relabel function lives relative to the optional peer-dep boundary.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Pure core + wrapper | Data files can derive entries at import time with zero optional deps; mirrors `buildFrettedScale`/`buildFromScale` split | Two entry points |
| Integration only | One function | Data files can't use it; drags optional deps into the data tier |

**Decision:** Pure-tier `relabelShape(shape, targetIntervals, …)` + `integration.ts` wrapper (e.g. `relabelShapeToScale(shape, "A minor")`).

**Rationale:** Registration at import time (D-001) requires the zero-dep tier; the split is the established pattern.

---

## D-006: Derived minor CAGED entries named by paired minor form, with parent metadata

**Context:** Relabeling major→relative minor relocates the tonic, changing the CAGED identity: an E-shape Am barre chord sits inside the G-Shape C-major scale box. E/G major forms share the string-6 root; A/C share the string-5 root — but run in opposite directions along the neck. "G Shape Minor" would contradict what a guitarist sees at that position.

**Options Considered:**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Paired minor-form letters ("Em Shape" from G Shape, "Am Shape" from C Shape, …) | Matches barre-chord/pedagogical reality | Parent linkage needs metadata |
| Same-letter suffix ("G Shape Minor") | Mechanically traceable | Musically wrong at the position |

**Decision:** Paired minor-form letters; each derived entry carries metadata identifying its parent major shape. `relabelShape` recomputes `rootString` to the new tonic location.

**Rationale:** Registry names are the user-facing pedagogy surface; correctness there is the point of the feature. The exact 5-pair mapping is verified against the shape data during implementation.

---

## D-007: Pentatonic boxes are quality-independent geometry; minor entries keep the same box numbers

**Context:** Whether minor pentatonic entries renumber (conventional "minor box 1" anchoring) or reuse the major box numbers.

**Decision:** Boxes refer to the shape (geometry). Box 1 serves both A minor and C major — the same relative-pair relationship as CAGED. Minor entries relabel the same box number; the root location within the box moves to the minor tonic.

**Rationale:** Per user: "boxes are basic and refer to the shape." Numbering is a geometry identity, not a quality identity; this also matches the existing `pentatonic.ts` design comment.

---

## D-008: `inferShapeContext` minor awareness is a follow-up issue

**Context:** Whether grip→shape inference should prefer minor-tonic labeling in this feature.

**Decision:** Out of scope; file a follow-up issue. Registered minor entries participate in registry-driven matching for free.

**Rationale:** Keeps this feature bounded; #38 already has open work on `inferShapeContext`.
