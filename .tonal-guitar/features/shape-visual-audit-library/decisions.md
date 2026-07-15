# Decisions: Shape Visual Audit Library

Technical decisions made during the Shape phase. Sequential IDs (D-001, D-002, …).

---

## D-001: Visual source of truth — build-engine geometry + geometry-mismatch check

**Context:** `applyChordShape` rebuilds shapes from intervals and ignores `baseFret`/`fingers`/`barres`, so its output can disagree with the curated source diagram for `baseFret > 1` open-chords entries. The adversarial research review named this the single biggest risk: the page could render a mathematically transposed shape while hiding the actual source-data defect.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Build-engine geometry + mismatch audit check | Shows what the library actually produces; disagreement becomes a first-class detector instead of a hidden failure mode | Needs a baseFret→absolute-frets conversion helper and a comparison spike |
| Build-engine only | Simplest | Hides exactly the defect class (#94/#96) this feature exists to expose |
| Source-diagram only | Matches curated data | Hides what consumers of the library actually get |
| Both diagrams side-by-side | Most explicit | Heaviest UI; 159 cards × 2 diagrams |

**Decision:** Render build-engine geometry on the diagram; show source-diagram frets in the property table; add a `geometry-mismatch` audit check comparing the two. An early implementation spike validates the comparison against representative shapes (canonical open, baseFret>1 barre, #96 known-bad, shell, extended E/A).

**Rationale:** Converts the biggest identified risk into a feature. The page's job is exposing data defects; a divergence between built and intended geometry *is* a defect signal, not a rendering choice to paper over. Reversible — the check can be tuned or the table column dropped without rework.

---

## D-002: v1 badge set — six checks, voicingFamily/baseFret deferred

**Context:** The raw-idea listed four checks, but research found the "voicingFamily/baseFret consistency" check underspecified (baseFret data exists on open-chords but no code consumes it, and no precise rule was ever written). The review recommended adding build-loss and metadata-completeness checks.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Six: fret-span, finger-0-on-movable, repeated-finger-no-barre, build-loss, metadata-completeness, geometry-mismatch | All precisely definable today; three have existing test reference implementations; covers the review's additions | voicingFamily mistag class (CR-009) not directly detected |
| Original four incl. voicingFamily/baseFret | Matches raw-idea | Fourth check's semantics undefined; risks encoding accidental naming assumptions |
| Minimal three | Least work | Misses silent build-loss and the geometry risk |

**Decision:** Six checks: `fret-span`, `finger-zero-on-movable`, `repeated-finger-no-barre`, `build-loss`, `metadata-completeness`, `geometry-mismatch`. voicingFamily/baseFret consistency deferred to a follow-up once rules are made precise.

**Rationale:** Ship only checks with precise, defensible semantics. The review explicitly warned against a vague "consistency" badge; geometry-mismatch and metadata-completeness together catch much of the CR-009 class anyway.

---

## D-003: Invariant logic lives in the library (`src/audit.ts`)

**Context:** Checks could live site-only (no library change) or in the library. Three checks already exist as test-only assertions in `data.test.ts`/`extended-chords.test.ts`; the site has no test infrastructure at all.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Library `src/audit.ts`, exported, reused by tests, consumed by site | Single source of truth; vitest coverage; closes raw-idea's deferred "codify as library tests" item; site stays a thin untested view layer | New public API surface to document |
| Site-only utils | No library change | Duplicates test logic (two sources of truth); zero test coverage (site has none) |

**Decision:** Library `src/audit.ts` in the required-peer-deps tier (imports `./build`, `./shape`, `./tuning`; MUST NOT import `./integration` or optional Tonal peers). Structured results: `ShapeAuditIssue { id, severity: "error" | "warning" | "info", message, details }`. `data.test.ts` refactors to call the exported functions. Re-exported from `src/index.ts`, documented in `docs/api/`.

**Rationale:** The review called site-only "a mistake" and the research independently reached the same conclusion. Badge correctness is the feature's core value; it must be testable, and the site cannot test it.

---

## D-004: Page structure — failures-first flat grid at `site/app/shapes/`

**Context:** ~159 cards; the review warned that "a wall of cards with badges" is a catalog, not an audit tool — the maintainer workflow is finding anomalies.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Flat grid, failures-first default sort, filters | Audit-first workflow; one mental model; filters cover browsing | Long page |
| Grouped by system sections | Familiar taxonomy | Failures buried mid-page |
| Failures-only landing + browse tab | Strongest triage focus | Hides the full catalog from the guitar-expert browse workflow |

**Decision:** One public `/shapes` page: type toggle (scale/chord), filters (system, voicingFamily/quality, name search), default sort with badge-failing shapes first. Cards memoized; lazy rendering via CSS (`content-visibility`) rather than a virtualization dependency.

**Rationale:** Serves both user stories (maintainer triage first, expert browsing via filters) with the least UI machinery. No new dependencies, consistent with site conventions.

---

## D-005: Deterministic render root — `canonicalRoot ?? "C"`

**Context:** Movable shapes need a concrete root to render. Research initially suggested parsing form letters from names; the review called that brittle (e.g. `C Minor Open` is barre-tagged with no canonicalRoot).

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| `canonicalRoot ?? "C"` fixed | One deterministic rule for both registries; trivially testable | E-form barres render around fret 8 |
| Form-aware low-position roots | Grips near the nut like test fixtures | Needs per-form lookup; brittle heuristics |
| Per-card root selector | Flexible | More UI surface; audit doesn't need it |

**Decision:** A tested pure helper (`displayRootFor(shape)`) returning `canonicalRoot ?? "C"`, with the rendered root shown on every card ("rendered at C").

**Rationale:** Geometry is root-invariant for movable shapes, so a higher fret window costs nothing for audit purposes; determinism and simplicity win. Reversible — the helper is the single place to change policy.

---

## D-006: Report-problem issue body — full structured payload as the `/fix` input contract

**Context:** Reports feed the `/fix #<id>` pipeline (expects `bug` label). The review pushed for a stable, designed input contract rather than an ad-hoc prefilled link; no `.github/ISSUE_TEMPLATE/` exists.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Full structured payload + free-text section | Fix agents get complete context without repo spelunking; reports from non-devs stay actionable | Long URLs (within GitHub's ~8k limit) |
| Identity + badge list only | Short URLs | Agent must re-derive everything; non-dev reports stay vague |
| Minimal title-only | Trivial | Useless as a contract |

**Decision:** Prefilled `issues/new` URL with `bug` label. Body sections: shape identity (kind + name), registry metadata (system, voicingFamily/quality, chordType, canonicalRoot, baseFret, parentShape), render context (root, tuning), built frets, raw `strings`/`fingers`/`barres`, failing audit check IDs with details, library version, and an empty "What's wrong" section for the reporter.

**Rationale:** The issue body is an API between the page and the `/fix` pipeline; designing it as a contract is exactly what made #94/#96 fixes fast. Includes `kind` because names alone aren't unique across the two registries.
