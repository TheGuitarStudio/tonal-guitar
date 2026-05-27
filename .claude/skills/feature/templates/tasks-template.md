# Tasks Template

Template for the Phase 3 task breakdown output. Adapted to `tonal-guitar`'s stack: a
pure-TypeScript library (`src/`) with an optional Next.js docs/lab site (`site/`).
There is **no database, no API server, no Zod/tRPC** — do not include those layers.

Tasks are grouped by layer in dependency order. Use only the layers that apply to the
feature; skip the rest (a pure library feature won't touch `site/`; a docs-only feature
won't touch `src/`).

---

```markdown
# Task Breakdown: {Feature Name}

## Overview

Total Tasks: {N} Task Groups

{1-2 sentence summary of what this feature implements and its scope. Include whether the
feature touches the library (`src/`), the lab/site (`site/`), or both.}

## Task List

### Module / Types Layer

#### Task Group 1: {Group Name}

**Dependencies:** None

- [ ] 1.0 {Top-level task — e.g. "create the new module shell, define exported types, and wire public re-exports"}
  - [ ] 1.1 Write {N} focused tests for the scaffolding contract
    - Import smoke (new exports resolve from `src/index`)
    - Type exports compile
    - Create test file: `src/{module}.test.ts`
  - [ ] 1.2 Create `src/{module}.ts` with type definitions
    - Export the types specified in spec §{N}
    - Stub any public function (throw `not implemented`) so downstream groups replace it
    - Import only from peer modules in the same dependency tier (see CLAUDE.md §Dependency layers)
  - [ ] 1.3 Wire re-exports in `src/index.ts`
    - Add `export { ... } from "./{module}"` and `export type { ... }`
    - Preserve the existing export-block ordering in `src/index.ts`
  - [ ] 1.4 Ensure tests pass
    - Run ONLY the tests written in 1.1: `npx vitest run src/{module}.test.ts`

**Acceptance Criteria:**

- `src/{module}.ts` and `src/{module}.test.ts` exist; `npm run build` passes
- All declared types and the stub function are importable from `src/index`
- The {N} tests written in 1.1 pass

---

### Core Logic Layer

#### Task Group 2: {Strategy / Algorithm / Helper Name}

**Dependencies:** Task Group 1

- [ ] 2.0 {Top-level task — implement the pure logic}
  - [ ] 2.1 Write {N} focused tests for the logic
    - Reference specific spec scenario numbers when applicable
    - File: `src/{module}.test.ts`
  - [ ] 2.2 Implement helper(s) in `src/{module}.ts`
    - Internal (non-exported) helpers; keep the public API surface narrow
    - Pure functions — no mutation, no side effects (CLAUDE.md §Design conventions)
  - [ ] 2.3 Ensure tests pass

**Acceptance Criteria:**

- {Behavior matches spec §{N} for every input combination listed}
- Helpers are not exported from `src/index.ts` (internal only)
- The {N} tests written in 2.1 pass

---

### Integration Layer

#### Task Group 3: {Public Function Wiring + Edge Cases}

**Dependencies:** Task Group 2 (and any sibling Core Logic groups)

- [ ] 3.0 Wire helpers behind the public function and handle degenerate inputs
  - [ ] 3.1 Write {N} focused tests
    - Edge cases (empty inputs, sentinel `NoFrettedScale`, etc.)
    - Smoke tests for non-CAGED systems if applicable (3NPS, pentatonic)
    - Spec scenario fingerprints
  - [ ] 3.2 Replace the stub from 1.2 with the dispatch implementation
    - Guard degenerate inputs first; return sentinels per spec
    - Dispatch to the appropriate Core Logic helper
  - [ ] 3.3 Ensure tests pass + `npm run build`

**Acceptance Criteria:**

- Public function never throws for valid-typed inputs (matches CLAUDE.md error-handling convention)
- All spec scenario fingerprints assert exact output
- The {N} tests written in 3.1 pass

---

### Output / Formatter Layer (optional)

#### Task Group 4: {AlphaTeX / ASCII-tab integration}

**Dependencies:** Task Group 3

> Only include if the feature changes `src/output/`. Most library features just produce
> `FrettedNote[]` and rely on existing formatters to render them unchanged.

- [ ] 4.0 {Update formatter to handle new note metadata, bar layout, etc.}
  - [ ] 4.1 Write {N} focused tests
  - [ ] 4.2 {Formatter changes}
  - [ ] 4.3 Ensure tests pass

**Acceptance Criteria:**

- {Criteria}

---

### Lab / Site Layer (optional)

#### Task Group 5: {Lab UI integration}

**Dependencies:** {Library task groups complete}

> Only include if the feature touches `site/`. Tonal Guitar's site is a Next.js app with
> the `experiments/` lab as the primary surface. There is no API server — components read
> the library directly.

- [ ] 5.0 {Wire the new library function into the lab}
  - [ ] 5.1 Write {N} focused tests for the component(s) — if a meaningful test target exists
    - File: `site/app/experiments/components/{Component}.test.tsx`
  - [ ] 5.2 {Component / page changes}
    - File: `site/app/experiments/components/{Component}.tsx`
  - [ ] 5.3 {Code-preview / codeGen updates if applicable}
  - [ ] 5.4 Verify in browser
    - Run `npm run dev` in `site/` and exercise the golden path manually
    - Capture any regressions in chained features

**Acceptance Criteria:**

- The new functionality is accessible from the lab without crashes
- Existing lab flows (preset loading, chain entries, output formatters) still work
- The {N} tests written in 5.1 pass

---

### Docs Layer (optional)

#### Task Group 6: {API docs + README updates}

**Dependencies:** {Library task groups complete}

> Only include if the feature changes the public library API. The library's docs live in
> `docs/api/*.md` (consumed by the Fumadocs site at `site/app/docs/`) and `README.md`.

- [ ] 6.0 Document the new public surface
  - [ ] 6.1 Add or update `docs/api/{file}.md` with signature, parameters, return shape, and an example
  - [ ] 6.2 Update `README.md` API table if a new function is exported
  - [ ] 6.3 Confirm the docs render in the site (`cd site && npm run dev`, open the API section)

**Acceptance Criteria:**

- The new function appears in the rendered API docs
- README accurately reflects the current export surface

---

### Testing Layer

#### Task Group N: Test Review and Gap Analysis

**Dependencies:** All earlier task groups

- [ ] N.0 Review existing tests and fill critical gaps only
  - [ ] N.1 Audit coverage against the spec's test categories (spec §{N})
  - [ ] N.2 Identify gaps in scenario fingerprints, direction invariants, or edge cases
  - [ ] N.3 Write up to 8 additional strategic tests maximum
  - [ ] N.4 Run feature-specific tests + full suite
    - `npx vitest run src/{module}.test.ts`
    - `npm test` — confirm no regressions in the pre-existing test suite

**Acceptance Criteria:**

- All spec test categories have coverage
- All scenario fingerprints have corresponding assertions
- `npm test` passes with no regressions
- No unrelated test files are modified

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Module / Types** — Foundation for downstream groups
2. **Task Group 2: Core Logic** — Pure helpers (can split into multiple parallel groups if independent)
3. **Task Group 3: Integration** — Wire helpers behind the public API
4. **Task Group 4: Output** — Only if formatter changes are needed
5. **Task Group 5: Lab / Site** — Only if `site/` integration is in scope
6. **Task Group 6: Docs** — Only if public API changed
7. **Task Group N: Test Review** — Final verification

Identify any task groups that can run in parallel (independent helpers, decoupled
formatters) and call them out explicitly.

## Files to Create

| File Path | Task          |
| --------- | ------------- |
| `{path}`  | {task number} |

## Files to Modify

| File Path | Task          |
| --------- | ------------- |
| `{path}`  | {task number} |

## Technical Notes

### {Pattern Category — e.g. Dependency layers, Walker conventions, Empty-scale guards}

{Relevant patterns to follow from existing code:}

- {Convention or pattern with file path reference, e.g. `src/walker.ts:51`}
- {Reference CLAUDE.md §{section} for project-wide conventions}
```

---

## Task Breakdown Quality Criteria

1. **Layer ordering** — Module/Types → Core Logic → Integration → (Output / Lab / Docs) → Testing
2. **Test-first** — Each group starts with writing tests against the spec's scenario fingerprints
3. **Specific files** — Every subtask references exact file paths (relative to repo root, not the worktree)
4. **Dependencies are correct** — Lower-tier modules complete before higher-tier wrappers
5. **Groups are right-sized** — Completable in one focused session (3-8 subtasks); split if larger
6. **Acceptance criteria are testable** — Can verify pass/fail objectively via `npm test` / `npm run build`
7. **Patterns referenced** — Technical notes cite specific files in `src/` and `CLAUDE.md` sections
8. **Optional layers are explicitly opt-in** — Don't fabricate Site / Docs / Output groups if the feature is library-only
