# Decisions: Shape Workbench

Technical decisions made during the Shape phase (2026-08-30). D-001–D-008 were decided
interactively this session; D-009–D-012 were decided in the 2026-08-30 design-canvas
session and hardened by the external research review (Codex), recorded here for
traceability.

---

## D-001: Shared UI as a 4-package split

**Context:** The user's direction "reuse all the UI" between the deployed docs Shape
Library and the local workbench. Current site components are coupled to Next
(`next/dynamic`, URL state, Tailwind/Fumadocs classes); only `packages/fretboard-ui` is
truly shared React today.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| 4-package split (`shape-catalog` pure model, `shape-library-ui` framework-neutral React, thin Next adapter, `shape-workbench` Vite) | Clean tiers; zero-React catalog consumable standalone; matches fretboard-ui precedent | Most up-front extraction work |
| `shape-catalog` grows components | Fewer packages | Mixes pure/React tiers; catalog no longer framework-free |
| Utils-only sharing (canvas original) | Least extraction risk | Duplicates UI; abandons "one investment upgrades docs" goal |

**Decision:** 4-package split.

**Rationale:** Codex review's high-severity finding; the only option that delivers the
shared-UI goal without collapsing the pure/React boundary. Reversible only at high cost
once components land — decided deliberately up front.

---

## D-002: Read-only vs editing via capability props

**Context:** Shared components must render read-only on the static docs site and
editable in the workbench.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Capability props (injected edit/export handlers or context) | Single component tree; tree-shakeable; no environment sniffing | Discipline needed so editor-only deps stay out of read-only paths |
| Separate entry points (`/read-only`, `/editor`) | Hard guarantee no editor code in static site | Duplicated wiring per entry |
| Runtime dev-server detection | Zero config | Core rendering depends on runtime probing; flicker, test complexity, static-export hazards |

**Decision:** Capability props.

**Rationale:** Codex's preferred variant of "capabilities injected"; simplest model that
keeps one component tree and doesn't preclude a future auth'd deployment (auth layer
just decides which capabilities to inject).

---

## D-003: Site swap via vertical slice, then incremental migration

**Context:** `site/app/shapes` works today with tests; when does it move to the shared
packages?

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Vertical slice first, then incremental swap in this feature | Package boundary proven before mass migration; site never big-bang rewritten | Short dual-UI window during migration |
| Full swap in one phase | No transition period | Big-bang risk on a working site |
| Swap in a later feature | Lowest immediate site risk | Two UIs drift; payoff deferred indefinitely |

**Decision:** Vertical slice (shared chord card/board in both Next static export and
Vite, plus edit → changeset → merge end-to-end), then migrate the rest of
`site/app/shapes` incrementally within this feature.

**Rationale:** Codex's "biggest early validation" — proves package boundaries, file-link
ergonomics, static/Vite compatibility, and merge safety before committing the site.

---

## D-004: MVP screens = Board + Editor + Export

**Context:** Canvas designs five screens (Board / Editor / Chord / Graph / Export) plus
arpeggio screens.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Board + Editor + Export | Fastest end-to-end proof; closes #66/#57 | Less browsing surface initially |
| + Chords page | More gap-finding surface | Bigger first milestone |
| All canvas screens | Full vision at once | Largest scope; slowest first proof |

**Decision:** Board + Editor + Export; Graph and standalone Chords page deferred.

**Rationale:** Codex product review: Graph/Chords are useful but not MVP-critical. The
first milestone must prove browse → edit → check → export → merge → docs render.

---

## D-005: Merge script uses generator-owned blocks

**Context:** `scripts/shapes-merge.mjs` rewrites published npm source data
(`src/data/*.ts`, `src/index.ts` registration order) — the riskiest code path.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Generator-owned blocks (regenerate whole delimited regions/files) | No new deps; never text-patches hand-written code; deterministic output | Requires marking/structuring owned regions |
| TypeScript AST (ts-morph) | Surgical edits anywhere | New dev dep; formatting stability work |
| Hybrid (generator writes, TS compiler API validates) | Most safety | Most machinery |

**Decision:** Generator-owned blocks, with identifier-collision checks, `--dry-run` /
`--check`, stable formatting, schema validation, computed-file refusal, and fixture-
changeset tests. Type-check via the existing build remains the backstop.

**Rationale:** Codex rejected ad-hoc text replacement; owned-block generation gets the
safety without a new dependency, honoring the proposal's no-new-deps constraint.

---

## D-006: `identify-mismatch` lives in `src/audit-integration.ts`

**Context:** The check needs `@tonaljs/chord` (optional peer); `audit.ts` is
required-peer tier and CLAUDE.md forbids it importing optional peers.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Optional-tier sibling `audit-integration.ts` | `audit.ts` stays clean; mirrors `integration.ts` precedent | Two audit entry points to compose |
| Flag on `auditAllShapes` + dynamic import | One entry point | Optional-peer awareness leaks into base module |
| Workbench-only check | No tier question | Library consumers/CI can't run it |

**Decision:** New optional-tier sibling module `src/audit-integration.ts`; the
workbench composes both check sets.

**Rationale:** Preserves the tier contract that the whole codebase is organized around.

---

## D-007: Absorb and close #66

**Context:** #66 (chord editor finger/barre export) is exactly this feature's
chord-editor deliverable.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Absorb & close now with linking comment | One source of truth | History lives on #161 |
| Keep as Phase-3 sub-issue | Auto-closes with PR | Duplicate tracking until then |

**Decision:** Close #66 now, commenting that it's absorbed into #161 (Shape Workbench
spec); Phase 3 sub-issues cover the work.

---

## D-008: Changeset is a gitignored working file; fixtures are committed

**Context:** Where `.workbench/changeset.json` lives relative to git.

**Options Considered:**

| Option | Pros | Cons |
| --- | --- | --- |
| Gitignored working file + committed fixtures elsewhere | Authoring stays ephemeral; tests reproducible | No durable changeset history |
| Committed changesets dir | Durable record | Duplicates the generated `src/data` diff already in the PR |

**Decision:** `.workbench/` is gitignored; committed sample changesets live under the
merge script's test fixtures path.

**Rationale:** The reviewable artifact is the generated source diff, not the changeset.

---

## D-009: m7 chord-scale frame is aeolian; alternates deferred; rule stored explicitly

**Context:** The chord-scale rule maps chord type → scale frame (7 → mixolydian,
maj7 → major). For m7, dorian and relative-major are viable alternates.

**Decision:** Aeolian is the v1 default (user, canvas session 2026-08-30);
dorian/relative-major become user-selectable alternates later. The mapping is stored as
an explicit, versionable rule (per Codex) so it can evolve without changing authored
data. Mode boxes not yet registered are derived on demand first, seeded in a later
phase following the `relabelOrThrow` precedent.

---

## D-010: `Barre.fret` becomes offset-from-`baseFret`; migration is its own gated task

**Context:** Canvas decision; `open-chords.ts` stores absolute frets today (70 shapes,
35 barre entries). Codex corrected the research's "display-only" blast radius:
`audit.ts:147` consumes barre ranges/fingers for repeated-finger validation, and tests
encode current values. Movable forms (`baseFret: 1`) already look offset-like; open/
fixed shapes are the inconsistent part.

**Decision:** Migrate to offset-from-`baseFret`, isolated as its own task with
before/after fixtures for open, fixed-barre, and movable-barre shapes; add an
`absoluteBarreFret(shape, barre)` helper and a `barre-fret-origin` audit check as
regression gates; update `ShapeCardChordTable.tsx` label and affected tests
deliberately.

---

## D-011: Arpeggio overrides resolve through an explicit resolver layer

**Context:** Three tiers per chord-shape slot: derived (runtime `arpeggioFromShape`) →
core (stored, ★) → teacher override (stored, `overrides` + `teacher:` tag). Codex:
replace-on-add solves duplicate names only; raw `all()` cannot both hide core entries
and keep them reachable.

**Decision:** Add resolver APIs (e.g. `resolveArpeggioForSlot()` and a visibility-aware
listing such as `visibleAll({ includeOverridden })`) implementing override → core →
derive as explicit policy. Registry `remove()`/replace-on-same-name-add remains the
low-level mechanism; consumers use the resolvers.

---

## D-012: Shells corrected to the traditional 8

**Context:** Canvas decision (user, 2026-08-30): shells are E-root R·7·3 on strings
6·4·3 and A-root R·3·7 on strings 5·4·3 — no R73 on adjacent strings. `jazz-shells.ts`
generates 16 variants.

**Decision:** Correct `jazz-shells.ts` to the 8 traditional shells, rewriting the
`data.test.ts` assertions (`:683`, `:667-755`, counts at `:1111,1289,1355`)
deliberately in the same task.
