# Task Breakdown: Connector Algorithm

**Phase:** 3 (Plan) | **Loop:** 1 | **Date:** 2026-05-17
**Builds on:** [research.md](./research.md), [spec.md](./spec.md)

## Overview

Total Task Groups: 6 (library only; lab integration is out of MVP scope and tracked
separately below).

Implements `connectSequences()` as a new pure function in `src/connect.ts` (~150 lines),
exported through `src/index.ts`. The function classifies a transition between two
fretted-scale chain entries into one of three strategies (`none`, `extend`,
`reach-back`) and returns the bridge notes and re-derived next-entry notes needed for
seamless exercise chaining across CAGED or any compatible shapes.

---

## Task List

### Module / Types Layer

#### Task Group 1: Module Scaffolding

**Dependencies:** None

- [ ] 1.0 Create the `src/connect.ts` module shell, define all types, and wire the public re-export into `src/index.ts`
  - [ ] 1.1 Write 4 focused tests for the scaffolding contract
    - `connectSequences` is importable from `src/connect.ts` without throwing
    - All five types (`ChainDirection`, `ConnectSequencesInput`, `ConnectorOptions`, `ConnectorStrategy`, `ConnectSequencesResult`) compile when imported from `src/connect.ts`
    - `connectSequences` is re-exported from `src/index.ts` (smoke import resolves)
    - All five types are re-exported from `src/index.ts`
    - Create test file: `src/connect.test.ts`
  - [ ] 1.2 Create `src/connect.ts` with all type definitions from spec §4.1 and an `Error("not implemented")` stub for `connectSequences`
    - Export `ChainDirection`, `ConnectSequencesInput`, `ConnectorOptions`, `ConnectorStrategy`, `ConnectSequencesResult` exactly as typed in spec §4.1
    - Export `connectSequences` stub (throws `new Error("not implemented")`) — replaced in Group 5
    - Import `FrettedScale`, `FrettedNote` from `./shape`; import `walkShapeMotif` from `./walker`
    - No Tonal.js peer deps; midi-only arithmetic only
  - [ ] 1.3 Add re-exports to `src/index.ts` per spec §4.2
    - `export { connectSequences } from "./connect";`
    - `export type { ChainDirection, ConnectSequencesInput, ConnectorOptions, ConnectorStrategy, ConnectSequencesResult } from "./connect";`
    - Insert after the "Sequence engine" exports block and before the "Notation" block
  - [ ] 1.4 Ensure tests pass
    - Run: `npx vitest run src/connect.test.ts`

**Acceptance Criteria:**

- `src/connect.ts` and `src/connect.test.ts` exist and compile with no TypeScript errors
- `npm run build` passes
- All five types and `connectSequences` are exported from both `src/connect.ts` and `src/index.ts`
- The 4 scaffolding tests written in 1.1 pass

---

### Core Logic Layer

#### Task Group 2: Strategy Classifier

**Dependencies:** Task Group 1

- [ ] 2.0 Implement the `nextSide()` pitch-position resolver and `classifyStrategy()` direction-pair lookup
  - [ ] 2.1 Write 13 focused tests for the strategy classifier (spec §6.1 and §3.1 truth table)
    - File: `src/connect.test.ts`
    - `nextSide` returns `"higher"` when `nextTop > prevTop AND nextBottom > prevBottom` (both strict)
    - `nextSide` returns `"lower"` when `nextTop < prevTop AND nextBottom < prevBottom` (both strict)
    - `nextSide` returns `"same"` when `nextTop > prevTop` but `nextBottom === prevBottom` (conjunction fails)
    - `nextSide` returns `"same"` when `nextBottom < prevBottom` but `nextTop === prevTop` (conjunction fails)
    - `nextSide` returns `"same"` for identical shape scales (E Shape → E Shape)
    - `classifyStrategy("ascending", "descending", "higher")` → `"extend"` (spec §3.1 V1 cell)
    - `classifyStrategy("ascending", "descending", "lower")` → `"reach-back"` (spec §3.1 V2 cell)
    - `classifyStrategy("ascending", "descending", "same")` → `"reach-back"`
    - `classifyStrategy("descending", "ascending", "higher")` → `"reach-back"` (spec §3.1 V3 cell)
    - `classifyStrategy("descending", "ascending", "lower")` → `"extend"` (spec §3.1 V4 cell)
    - `classifyStrategy("descending", "ascending", "same")` → `"reach-back"`
    - `classifyStrategy("ascending", "ascending", <any>)` → `"none"` (all three sides)
    - `classifyStrategy("descending", "descending", <any>)` → `"none"` (all three sides)
    - Note: expose helpers via crafted-input calls through `connectSequences`, OR via a `/** @internal */` direct export from `src/connect.ts`; do not surface them in `src/index.ts`
  - [ ] 2.2 Implement `nextSide(prevScale: FrettedScale, nextScale: FrettedScale): "higher" | "lower" | "same"` internally in `src/connect.ts`
    - Compute `prevTop = Math.max(...prev.notes.map(n => n.midi))`, `prevBottom = Math.min(...)`, same for next
    - Apply spec §3.2 conjunction exactly
    - Guard: empty `notes[]` → `"same"`
  - [ ] 2.3 Implement `classifyStrategy(prevDir, nextDir, side): ConnectorStrategy` internally in `src/connect.ts`
    - Same-direction pairs always return `"none"` regardless of `side`
    - Encode the §3.1 truth table as a simple conditional
  - [ ] 2.4 Ensure tests pass
    - Run: `npx vitest run src/connect.test.ts`

**Acceptance Criteria:**

- All 13 classifier tests pass
- Both functions match the §3.1 and §3.2 truth tables for every combination
- Identical shapes (E Shape asc → E Shape desc, A major) return `"same"` and `"reach-back"`, consistent with spec §3.4 scenario 7
- Both functions are pure with no mutations or side effects

---

#### Task Group 3: Extend Strategy

**Dependencies:** Task Group 2

- [ ] 3.0 Implement the linear bridge connector for the extend strategy
  - [ ] 3.1 Write 8 focused tests covering the extend strategy
    - File: `src/connect.test.ts`
    - **Scenario 1** (spec §3.4): `connectSequences({prev: E-asc-B4, next: D-desc}, motif: [1,3])` → `strategy === "extend"`, connector note names `["C#5", "D5"]`, connector fret positions `[[5,9], [5,10]]`, `nextNotes[0].note !== "D5"`, `nextNotes.length > 0`
    - **Scenario 4** (spec §3.4): `connectSequences({prev: E-desc-G#2, next: G-asc}, motif: [1,3])` → `strategy === "extend"`, connector note names `["F#2"]`, connector fret positions `[[0,2]]`, `nextNotes[0].note !== "F#2"`, `nextNotes.length > 0`
    - `dedupSeam: false` on scenario 1 variant: `nextNotes[0].note === "D5"` (head kept)
    - `dedupSeam: false` on scenario 4 variant: `nextNotes[0].note === "F#2"` (head kept)
    - Ascending extend: connector midi values strictly ascending (spec §6.4)
    - Descending extend: connector midi values strictly descending (spec §6.4)
    - Extend with no gap (prev already at shape top): `connector.length === 0`
    - Empty-connector dedup: when `connector.length === 0` and `nextNotes[0]` physically matches `prev.lastNote`'s `(string, fret)`, `dedupSeam: true` still drops the head (the dedup comparison falls back to `prev.lastNote` when the connector is empty)
    - Extend connector notes are all drawn from actual `(string, fret)` positions present in `prev.scale.notes` or `next.scale.notes`
  - [ ] 3.2 Implement `buildExtend(input, dedupSeam): ConnectSequencesResult` in `src/connect.ts`
    - `seam = prev.lastNote.midi`
    - `target`: ascending → `max(next.scale.notes[*].midi)`; descending → `min(...)`
    - `combined`: concatenate `prev.scale.notes ∪ next.scale.notes`, dedup by `(string, fret)` via `Map<string, FrettedNote>` (first occurrence wins), sort by midi ascending
    - Filter connector: ascending → `combined.filter(n => n.midi > seam && n.midi <= target)`; descending → `.filter(n => n.midi < seam && n.midi >= target).reverse()`
    - `effectiveMotif = next.motif.length > 0 ? next.motif : [1]`
    - `nextNotes = walkShapeMotif(next.scale, effectiveMotif, { direction: next.direction })`
    - Apply dedup: if all three of `midi`, `string`, `fret` match between `nextNotes[0]` and `connector.at(-1)`, drop the head
    - Return `{ connector, nextNotes, strategy: "extend" }`
  - [ ] 3.3 Ensure tests pass
    - Run: `npx vitest run src/connect.test.ts`

**Acceptance Criteria:**

- Scenario 1 fingerprint matches spec §3.4 exactly: connector `[C#5(s5f9), D5(s5f10)]`; `nextNotes[0]` is not D5
- Scenario 4 fingerprint matches spec §3.4 exactly: connector `[F#2(s0f2)]`; `nextNotes[0]` is not F#2
- `dedupSeam: false` preserves the duplicate head in both scenarios
- Connector strictly ascending for asc-extend; strictly descending for desc-extend
- The 8 tests written in 3.1 pass

---

#### Task Group 4: Reach-Back Strategy

**Dependencies:** Task Group 2 (independent of Group 3 — can run in parallel)

- [ ] 4.0 Implement the combined-scale synthesis, re-walk, and seam trim for the reach-back strategy
  - [ ] 4.1 Write 7 focused tests covering the reach-back strategy
    - File: `src/connect.test.ts`
    - **Scenario 2** (spec §3.4): `connectSequences({prev: E-asc-B4, next: G-desc}, motif: [1,3])` → `strategy === "reach-back"`, `connector: []`, `nextNotes[0]` does not occupy `(string: 5, fret: 7)` (B4 at s5f7 deduped), `nextNotes.length > 0`
    - **Scenario 3** (spec §3.4): `connectSequences({prev: E-desc-G#2, next: D-asc}, motif: [1,3])` → `strategy === "reach-back"`, `connector: []`, `nextNotes[0]` does not occupy `(string: 0, fret: 4)` (G#2 deduped), `nextNotes.length > 0`
    - **Scenario 7** (spec §3.4): identical E asc → E desc → `strategy === "reach-back"`, `connector: []`, combined scale after `(string, fret)` dedup has same note count as a single E-shape build, `nextNotes[0].note !== "B4"`
    - `dedupSeam: false` on scenario 2 variant: `nextNotes[0]` occupies `(string: 5, fret: 7)` — locks in that reach-back's dedup target is `prev.lastNote.(string, fret)`, NOT `connector.at(-1)` (which is always undefined in reach-back, since `connector === []`)
    - Descending reach-back: `nextNotes[0].midi <= prev.lastNote.midi` (spec §6.4)
    - Ascending reach-back: `nextNotes[0].midi >= prev.lastNote.midi` (spec §6.4)
    - Reach-back where seam is far outside combined range produces `nextNotes: []`
  - [ ] 4.2 Implement `buildReachBack(input, dedupSeam): ConnectSequencesResult` in `src/connect.ts`
    - Build synthetic combined `FrettedScale`: dedup by `(string, fret)` (Map keyed on `${n.string}:${n.fret}`, iterate prev then next, first occurrence wins), sort by midi ascending; inherit `root`, `scaleType`, `scaleName`, `shapeName`, `tuning` from `next.scale`; `empty: false`
    - `effectiveMotif = next.motif.length > 0 ? next.motif : [1]`
    - `walked = walkShapeMotif(combined, effectiveMotif, { direction: next.direction })`
    - Trim: ascending → `walked.filter(n => n.midi >= seamMidi)`; descending → `walked.filter(n => n.midi <= seamMidi)` where `seamMidi = prev.lastNote.midi`
    - Apply dedup: if `dedupSeam && trimmed[0]?.string === prev.lastNote.string && trimmed[0].fret === prev.lastNote.fret`, drop head
    - Return `{ connector: [], nextNotes, strategy: "reach-back" }`
  - [ ] 4.3 Ensure tests pass
    - Run: `npx vitest run src/connect.test.ts`

**Acceptance Criteria:**

- `connector` is always `[]` for reach-back
- Scenario 2 fingerprint: `nextNotes[0]` is not at `(string: 5, fret: 7)` after dedup
- Scenario 3 fingerprint: `nextNotes[0]` is not at `(string: 0, fret: 4)` after dedup
- Scenario 7: combined dedup produces same note count as a single E-shape scale; `nextNotes[0]` is not B4
- `dedupSeam: false` retains the seam-position note
- The 7 tests written in 4.1 pass

---

### Integration Layer

#### Task Group 5: `connectSequences` Integration and Edge Cases

**Dependencies:** Task Groups 3, 4

- [ ] 5.0 Wire all three strategies behind `connectSequences`, handle degenerate inputs, and run non-CAGED smoke tests
  - [ ] 5.1 Write 11 focused tests for integration and edge cases
    - File: `src/connect.test.ts`
    - **Scenario 5** (asc→asc): `strategy === "none"`, `connector: []`, `nextNotes` equals unmodified `walkShapeMotif(...)`
    - **Scenario 6** (desc→desc): `strategy === "none"`, `connector: []`, `nextNotes` equals natural walk
    - **Scenario 8** (empty prev scale): `{ connector: [], nextNotes: [], strategy: "none" }`
    - Empty next scale: `{ connector: [], nextNotes: [], strategy: "none" }`
    - Empty `next.motif` (`[]`): treated as `[1]`, `nextNotes` non-empty
    - `options.strategy: "linear"` → treated as `"auto"` (no-op in MVP, spec §4.1)
    - `options.strategy: "motif-extend"` → treated as `"auto"`
    - 3NPS smoke: `NPS_PATTERN_1` asc → `NPS_PATTERN_2` desc (A major, motif `[1,3]`): `strategy !== "none"`, no throw, `nextNotes.length > 0`
    - Pentatonic smoke: `PENTA_BOX_1` asc → `PENTA_BOX_2` desc (A major, motif `[1,3]`): `strategy !== "none"`, no throw
    - Out-of-range seam: function does not throw (spec §5)
    - `connectSequences` never throws for valid-typed inputs (cross-key smoke)
  - [ ] 5.2 Replace the stub in `src/connect.ts` with the full `connectSequences` implementation
    - Guard: empty/sentinel scales → return `{ connector: [], nextNotes: [], strategy: "none" }`
    - Normalize: `effectiveMotif = next.motif.length > 0 ? next.motif : [1]`
    - Normalize reserved strategy values: `"linear"` and `"motif-extend"` → treat as `"auto"`
    - `dedupSeam = options?.dedupSeam ?? true`
    - Compute `side`, `strategy`; dispatch on strategy
    - `"none"` returns `walkShapeMotif(next.scale, effectiveMotif, { direction: next.direction })` for `nextNotes`
    - Function body must not throw
  - [ ] 5.3 Ensure tests pass
    - Run: `npx vitest run src/connect.test.ts`
    - Run: `npm run build` — zero TypeScript errors

**Acceptance Criteria:**

- Same-direction chains (scenarios 5, 6) always return `strategy: "none"` with `nextNotes` equal to the unmodified natural walk
- Empty scale inputs return `{ connector: [], nextNotes: [], strategy: "none" }` — not an exception
- Empty `next.motif` produces non-empty `nextNotes` (linear fallback)
- Reserved strategy option values do not alter behavior
- Non-CAGED smoke tests pass without throwing and classify as non-`"none"`
- `connectSequences` never throws for valid-typed inputs
- All 11 tests written in 5.1 pass
- `npm run build` passes

---

### Testing Layer

#### Task Group 6: Test Review and Gap Analysis

**Dependencies:** Task Groups 1–5

- [ ] 6.0 Audit `src/connect.test.ts` against all 6 spec test categories and fill critical gaps
  - [ ] 6.1 Audit coverage against spec §6.1–6.6
    - §6.1 Strategy classification: confirm all 9 truth-table cells plus identical-shapes are present
    - §6.2 Scenario fingerprints: confirm scenarios 1–8 each assert `strategy`, connector note names, fret positions, and `nextNotes[0]` head
    - §6.3 Dedup: confirm `dedupSeam: true` and `false` each have tests for both extend and reach-back; reach-back dedup uses `(string, fret)` of `prev.lastNote`
    - §6.4 Direction invariants: ascending extend strictly ascending; descending strictly descending; reach-back `nextNotes[0]` at/past seam
    - §6.5 Non-CAGED: 3NPS and pentatonic smoke tests present
    - §6.6 Degenerate: empty prev, empty next, empty motif
  - [ ] 6.2 List any missing tests (cap at 8 additional)
  - [ ] 6.3 Write gap-filling tests (up to 8 maximum)
    - File: `src/connect.test.ts`
    - Priority gaps: scenario fingerprint `[n.string, n.fret]` assertions; `result.strategy` literal value check; connector notes traceable to input scale positions
  - [ ] 6.4 Run full test suite
    - Run: `npx vitest run src/connect.test.ts`
    - Run: `npm test` — confirm pre-existing 227 tests still pass

**Acceptance Criteria:**

- All 6 spec test categories (§6.1–6.6) have coverage in `src/connect.test.ts`
- All 8 scenario fingerprints from spec §3.4 have tests
- `npm test` passes: pre-existing 227 tests unaffected; new connector tests all green
- No modifications to `src/index.test.ts`

---

### Out of MVP Scope

#### Lab Integration (spec §8) — separate follow-up

Wires `connectSequences` into the Guitar Lab site at `site/app/experiments/`. Out of
scope for this library feature branch; track as a follow-up after the library ships.

- Factor `buildFrettedScale(get(name), root, tuning, opts)` out of `PipelineBuilder.tsx`
  into a shared `rebuildScale()` helper used by both `currentNotes` derivation and the
  new connector memo
- Add `connectorsAndNextNotes` computed memo to `PipelineBuilder.tsx` per spec §4.3
- Wire `ChainEntry.connector` from `connectorsAndNextNotes[i-1].connector` so
  `ConnectorSlot` shows real count + preview
- Replace `chain.flatMap((e) => e.notes)` in `selectedNotes` with the connector-interleaved flatten
- Update `codeGen.ts` to emit `connectSequences()` calls between segments
- Add a "bridge" toggle to `ChainSection` header (off by default for beginner-friendly
  restart, on for intermediate continuous-arc)

---

## Execution Order

Recommended sequence:

1. **Task Group 1: Module Scaffolding** — creates the file and types; required by all other groups
2. **Task Group 2: Strategy Classifier** — pure decision logic; unblocks Groups 3 and 4
3. **Task Groups 3 and 4: Extend and Reach-Back** — independent of each other; **can run in parallel** after Group 2
4. **Task Group 5: Integration + Edge Cases** — wires everything behind `connectSequences`
5. **Task Group 6: Test Review and Gap Analysis** — final audit

Groups 3 and 4 are the only opportunity for parallel development.

## Files to Create

| File Path             | Task |
| --------------------- | ---- |
| `src/connect.ts`      | 1.2  |
| `src/connect.test.ts` | 1.1  |

## Files to Modify

| File Path             | Task                       |
| --------------------- | -------------------------- |
| `src/index.ts`        | 1.3                        |
| `src/connect.ts`      | 2.2, 2.3, 3.2, 4.2, 5.2    |
| `src/connect.test.ts` | 2.1, 3.1, 4.1, 5.1, 6.3    |

---

## Technical Notes

### Pure function and naming conventions

All code in `src/connect.ts` must follow the zero-side-effects, no-mutation,
named-exports-only conventions from `CLAUDE.md` §Design conventions. Internal helpers
(`nextSide`, `classifyStrategy`, `buildExtend`, `buildReachBack`) are not exported; only
`connectSequences` and the five types appear in `src/index.ts`. The file sits in the
"zero Tonal deps" dependency tier (`CLAUDE.md` §Dependency layers) — it imports from
`./shape` (types only) and `./walker` (`walkShapeMotif`) and nothing else.

### Empty-scale guard

`FrettedScale.empty` (`src/shape.ts:46`) is the established sentinel. The
`NoFrettedScale` constant at `src/shape.ts:57` is the library's null-object for this
type. Guard `connectSequences` using `prev.scale.empty || next.scale.empty` first, then
also guard `notes.length === 0` defensively.

### `walkShapeMotif` calling convention

`walkShapeMotif` (`src/walker.ts:51`) accepts `WalkShapeOptions.direction?: "ascending"
| "descending"`. The spec's `ChainDirection` type is identically `"ascending" |
"descending"` — no translation needed. An empty motif causes `walkShapeMotif` to return
`[]` (guard at `src/walker.ts:56`); `connectSequences` must normalize
`next.motif.length === 0` to `[1]` before any walker call.

### Synthetic `FrettedScale` for reach-back

`buildReachBack` constructs a plain object literal conforming to `FrettedScale` rather
than calling `buildFrettedScale`. `walkShapeMotif` only accesses `scale.notes` (sorted
by midi via internal `walkShape`), so `root`, `scaleType`, `scaleName`, `shapeName`,
`tuning` inherited from `next.scale` are carried for downstream compatibility but not
used during the walk. `scaleIndex` and `degree` fields on combined notes retain their
original source-scale values; acceptable for MVP per spec §3.3.

### Dedup by `(string, fret)` — both strategies

Both strategies must dedup the combined note set by `(string, fret)`. Adjacent CAGED
shapes share 8–9 physical positions (`research.md` §2); without dedup the connector or
re-walked notes would emit duplicates at shared positions. Implementation: `new
Map<string, FrettedNote>()` keyed on `` `${n.string}:${n.fret}` ``, iterate
`prev.scale.notes` then `next.scale.notes`, keep first occurrence.

### Spec ambiguity flagged

Spec §3.3 for the extend strategy writes `combined = sort(prev.scale.notes ∪
next.scale.notes by midi)` but does not explicitly call out the dedup key. Since two
shapes may share physical positions, dedup by `(string, fret)` is the only correct
interpretation (and the output is unambiguous because the two copies are physically
identical). Implementation does this for both strategies consistently.

### Test fixture setup

`src/connect.test.ts` should import `buildFrettedScale`, `STANDARD`, `walkShapeMotif`,
and `NoFrettedScale` from `"./index"`, and import shape constants directly from
`"./data/caged-scales"`, `"./data/three-nps"`, `"./data/pentatonic"` — matching the
pattern in `src/index.test.ts:1–100`. Build scale fixtures at `describe` block scope,
not inside each `test` callback.
