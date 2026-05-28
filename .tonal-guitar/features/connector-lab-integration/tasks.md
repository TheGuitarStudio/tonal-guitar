# Task Breakdown: Connector lab integration

## Overview

Total Tasks: 5 Task Groups (+ in-flight library refinement)

This was planned as a site-only integration feature (`site/app/experiments/components/`). The work wires the already-shipped `connectSequences` API into the Guitar Lab by adding a `Bridge` toggle to the chain section, computing connector phrases between adjacent chain entries, rendering strategy metadata in the `ConnectorSlot`, surfacing the bridged note sequence in the output view, and emitting faithful `connectSequences(...)` calls in the code preview.

> **Scope drift, captured 2026-05-28:** Manual acceptance testing in TG5 revealed
> the library's original `connectSequences` algorithm (combined-walk extend +
> empty-connector reach-back) did not produce the musically-coherent bridges
> the lab needed. The user explicitly authorized expanding scope into the
> library, and `src/connect.ts` was refactored to a same-string bridge model
> shared by both `extend` and `reach-back`. `src/connect.test.ts` was updated
> (8 reach-back assertions rewritten + 4 new tests added) and a new
> `src/connect.examples.test.ts` was added with 12 example-driven scenarios.
> The connector-algorithm spec (`../connector-algorithm/spec.md` §3.3) carries
> a supersession note pointing back here. Task Groups 1–5 remain site-only as
> originally planned; the library work is documented in the commit history
> (`feat(connect): motif-aware extend connector` and
> `refactor(connect): same-string bridge model for extend + reach-back`).

## Task List

---

### Shared Helpers Layer

#### Task Group 1: chainUtils.ts — rebuildScale helper

**Dependencies:** None

- [ ] 1.0 Create `site/app/experiments/components/chainUtils.ts` with the pure `rebuildScale` function that encapsulates the `buildFrettedScale` + modal-root derivation logic
  - [ ] 1.1 Create the new file with the module header (`// Pure helpers — no React imports`)
    - File: `site/app/experiments/components/chainUtils.ts`
    - Add imports: `buildFrettedScale`, `FrettedScale` from `"tonal-guitar"`; `effectiveModeForSystem`, `isModeCompatibleWithSystem`, `parentRoot` from `"fretboard-ui"`; `PipelineRecipe` type from `"./codeGen"` (spec §"Shared helpers", lines 23–24)
  - [ ] 1.2 Implement `rebuildScale(recipe: PipelineRecipe, tuning: string[]): FrettedScale | null`
    - Step 1: resolve `shape = get(recipe.shapeName)`; return `null` if falsy (spec §"Shared helpers", line 26)
    - Step 2: compute `compatible`, `effectiveMode`, `buildRoot` — reproduce exactly `PipelineBuilder.tsx:134–140` (spec §"Shared helpers", lines 27–28)
    - Step 3: call `buildFrettedScale(shape, buildRoot, tuning, { allowOpenStrings: recipe.showOpenStrings })`; return `null` if `result.empty`, else return `result` (spec §"Shared helpers", line 29; mirrors `PipelineBuilder.tsx:147–151`)
    - Export as named export only — no default export (CLAUDE.md §Design conventions)
  - [ ] 1.3 Verify `npm run build` passes with the new file

**Acceptance Criteria:**

- `site/app/experiments/components/chainUtils.ts` exists and exports `rebuildScale`
- `rebuildScale` accepts `(PipelineRecipe, string[])` and returns `FrettedScale | null`
- No React imports in the file — pure TypeScript only
- `npm run build` passes after this group

---

### State & Memos Layer

#### Task Group 2: PipelineBuilder — bridgeEnabled state, connectorsAndNextNotes memo, selectedNotes update

**Dependencies:** Task Group 1

- [ ] 2.0 Add `bridgeEnabled` state, refactor `scale` memo, add `connectorsAndNextNotes` memo, and update `selectedNotes` in `PipelineBuilder.tsx`
  - [ ] 2.1 Extend the `"tonal-guitar"` import at `PipelineBuilder.tsx:23–37` to add `connectSequences` and the type `ConnectorStrategy` (spec §"State & memos", line 97)
  - [ ] 2.2 Add `import { rebuildScale } from "./chainUtils"` adjacent to the existing local imports (spec §"State & memos", line 97)
  - [ ] 2.3 Add `const [bridgeEnabled, setBridgeEnabled] = useState(false)` immediately after the `[chain, setChain]` declaration at `PipelineBuilder.tsx:128` (spec §"State & memos", line 33; default `false` per D-003)
  - [ ] 2.4 Refactor the `scale` memo at `PipelineBuilder.tsx:146–152` — replace the inline `buildFrettedScale(...)` body with a single `rebuildScale(currentRecipe, tuning)` call. **Dep array MUST be `[currentRecipe, tuning]`** — these are the only variables the memo body references after the refactor, and React's `react-hooks/exhaustive-deps` lint would flag the original four-dep form. `currentRecipe` is itself a `useMemo` whose own deps cover `[shape, buildRoot, tuning, showOpenStrings]`, so equivalence holds (spec §"State & memos", lines 34–35)
  - [ ] 2.5 Add the `connectorsAndNextNotes` memo immediately after the `currentNotes` memo at `PipelineBuilder.tsx:180` — implement the full pairwise loop calling `connectSequences({ prev, next })` with the guard fallback `{ connector: [], nextNotes: nextEntry.notes, strategy: "none" }` for missing scales or empty prev notes; dep array is `[chain]` only per D-002 (spec §"State & memos", lines 36–72)
  - [ ] 2.6 Replace `selectedNotes` memo at `PipelineBuilder.tsx:209–213` with the bridge-aware version: bridge-off branch (`!bridgeEnabled || chain.length < 2`) keeps the existing `chain.flatMap((e) => e.notes)` behavior; bridge-on branch interleaves `connector` and `nextNotes` from `connectorsAndNextNotes[i-1]` per spec §4.3; dep array is `[selection, currentNotes, chain, bridgeEnabled, connectorsAndNextNotes]` (spec §"State & memos", lines 74–95)
  - [ ] 2.7 Add `ConnectorStrategy` type import from `"tonal-guitar"` alongside the existing type imports at `PipelineBuilder.tsx:38` if not already included in step 2.1
  - [ ] 2.8 Verify `npm run build` passes — the two new memos, the state declaration, and the import additions must type-check cleanly

**Acceptance Criteria:**

- `PipelineBuilder.tsx` compiles with no TypeScript errors
- `bridgeEnabled` defaults to `false`
- `connectorsAndNextNotes` is a `useMemo` with `[chain]` dep array returning a `Array<{ connector: FrettedNote[]; nextNotes: FrettedNote[]; strategy: ConnectorStrategy }>` of length `chain.length - 1`
- `selectedNotes` bridge-off path is byte-for-byte the pre-feature behavior (`chain.flatMap((e) => e.notes)`)
- `selectedNotes` bridge-on path uses `connectorsAndNextNotes[i-1].connector` and `connectorsAndNextNotes[i-1].nextNotes` — NOT `chain[i].notes`
- `npm run build` passes after this group

---

### Components Layer

#### Task Group 3: ChainSection — Bridge toggle and ConnectorSlot strategy display

**Dependencies:** Task Group 2

- [ ] 3.0 Update `ChainSectionProps`, add the Bridge toggle to the header, and wire `connectorsAndNextNotes` into `ConnectorSlot`
  - [ ] 3.1 Extend `ChainSectionProps` at `ChainSection.tsx:30–43` with three new fields: `bridgeEnabled: boolean`, `onBridgeChange: (next: boolean) => void`, `connectorsAndNextNotes: Array<{ connector: FrettedNote[]; nextNotes: FrettedNote[]; strategy: ConnectorStrategy }>` (spec §"Components", lines 101–110)
  - [ ] 3.2 Add `ConnectorStrategy` to the `"tonal-guitar"` type import at `ChainSection.tsx:3` (spec §"Components", line 111)
  - [ ] 3.3 Destructure the three new props in the `ChainSection` function signature at `ChainSection.tsx:45–57`
  - [ ] 3.4 Insert the Bridge toggle element AFTER the note-count `<span>` at `ChainSection.tsx:79–82`, inside the existing `<div className="flex flex-wrap items-center gap-2">` header row — render conditionally on `entries.length >= 2`; markup verbatim from `SequenceStep.tsx:57–65` with label text `"Bridge"` (spec §"Components", lines 112–126; D-003)
  - [ ] 3.5 Extend `ConnectorSlotProps` at `ChainSection.tsx:199–201` to `{ connector?: FrettedNote[]; strategy?: ConnectorStrategy }` (spec §"Components", lines 128–133)
  - [ ] 3.6 Update the `ConnectorSlot` function signature at `ChainSection.tsx:208` to accept `{ connector, strategy }` (spec §"Components", line 135)
  - [ ] 3.7 Update the `ConnectorSlot` render: when `connector && connector.length > 0`, emit exactly `connector · {N} note{s} ({strategy})` with the middle-dot character already present at `ChainSection.tsx:214`; when empty or `strategy === "none"`, keep the existing `<span className="italic">no connector (TODO)</span>` fallback unchanged (spec §"Components", lines 143–150; D-004)
  - [ ] 3.8 Change the `ConnectorSlot` invocation at `ChainSection.tsx:110` from `connector={e.connector}` to `connector={connectorsAndNextNotes[i - 1]?.connector}` and add `strategy={connectorsAndNextNotes[i - 1]?.strategy}` — the `e.connector` field on `ChainEntry` is now ignored (spec §"Components", lines 135–142; D-001)
  - [ ] 3.9 Pass the three new props into `<ChainSection ... />` at `PipelineBuilder.tsx:411–425`: add `bridgeEnabled={bridgeEnabled}`, `onBridgeChange={setBridgeEnabled}`, `connectorsAndNextNotes={connectorsAndNextNotes}` (spec §"State & memos", line 96)
  - [ ] 3.10 Verify `npm run build` passes

**Acceptance Criteria:**

- `ChainSectionProps` includes `bridgeEnabled`, `onBridgeChange`, and `connectorsAndNextNotes`
- Bridge toggle is absent from the DOM when `entries.length < 2`; present and functional when `entries.length >= 2`
- Bridge toggle markup matches `SequenceStep.tsx:57–65` pattern — `<label className="inline-flex items-center gap-1.5 text-xs">` with `<input type="checkbox" className="accent-fd-primary">` and text `"Bridge"`
- `ConnectorSlot` renders `connector · {N} note{s} ({strategy})` when `connector.length > 0`; fallback when empty or `strategy === "none"`
- The surrounding `ConnectorSlot` layout div and two border-rule spans are unchanged
- No new Tailwind classes beyond `accent-fd-primary` already present in `SequenceStep.tsx`
- `npm run build` passes after this group

---

### Code Generation Layer

#### Task Group 4: codeGen.ts — emit connectSequences calls

**Dependencies:** Task Group 2

- [ ] 4.0 Extend `CodeGenInput`, update `emitSegment` return type, and implement the bridge-on code emission path
  - [ ] 4.1 Add `bridgeEnabled: boolean` and `connectorsAndNextNotes: Array<{ connector: unknown[]; nextNotes: unknown[]; strategy: "none" | "extend" | "reach-back" }>` to `CodeGenInput` at `codeGen.ts:29–36` (spec §"Code generation", lines 155–163; `unknown[]` avoids a runtime `tonal-guitar` import in `codeGen.ts` per the spec annotation)
  - [ ] 4.2 Change `emitSegment` return type at `codeGen.ts:64` from `{ lines: string[]; notesVar: string }` to `{ lines: string[]; notesVar: string; scaleVar: string; motifVar: string }` (spec §"Code generation", line 165)
  - [ ] 4.3 In the `motif.length === 0` early-return branch of `emitSegment` at `codeGen.ts:107–117`: add `const ${motifVar} = [];` immediately before the `notesVar` assignment so all return paths expose `motifVar`; return `{ lines, notesVar, scaleVar, motifVar }` (spec §"Code generation", lines 166–167)
  - [ ] 4.4 In the non-empty motif branches at `codeGen.ts:119–135`: update the return statement to `{ lines, notesVar, scaleVar, motifVar }` — the `scaleVar` and `motifVar` local variables already exist; only the return shape changes (spec §"Code generation", line 168)
  - [ ] 4.5 In `generateCode` at `codeGen.ts:177–205`, update the chain emission loop to capture `{ lines, notesVar, scaleVar, motifVar }` per segment. **Indexing convention (use throughout 4.5–4.6):** store the per-segment vars in 0-indexed arrays `scaleVars`, `motifVars`, `notesVars` of length `chain.length`, so `scaleVars[k]` is the scale var for `chain[k]`. The emitted *variable names* are 1-indexed using the existing `suffix = String(k+1)` convention (e.g., `scale1`, `motif1`, `notes1` for `chain[0]`). Do not confuse the storage index with the suffix value (spec §"Code generation", lines 170–172)
  - [ ] 4.6 After the per-segment loop, branch on `input.bridgeEnabled && input.chain.length >= 2`:
    - **Bridge ON path:** call `tonal.add("connectSequences")` once. Loop `k` from `1` to `chain.length - 1` (i.e., one iteration per seam). For each `k`:
      - The seam joins `chain[k-1]` (prev) and `chain[k]` (next).
      - Emit comment line: `// seam ${k+1}: ${input.connectorsAndNextNotes[k-1].strategy}`.
      - Emit `const seam${k+1} = connectSequences({ prev: { scale: scaleVars[k-1], lastNote: notesVars[k-1][notesVars[k-1].length - 1], direction: ${JSON.stringify(chain[k-1].recipe.direction)} }, next: { scale: scaleVars[k], motif: motifVars[k], direction: ${JSON.stringify(chain[k].recipe.direction)} } });`.
      - Emit `const connector${k+1} = seam${k+1}.connector;` and `const nextNotes${k+1} = seam${k+1}.nextNotes;`.
      - (Note: the *suffix* in the emitted variable name is `k+1`, matching the spec's prose where seam-index 2 corresponds to the seam before entry 2; the *array storage* is 0-indexed.)
    - **Bridge ON final concat:** emit `const chain = [...notes1, ...connector2, ...nextNotes2, ...connector3, ...nextNotes3, ...];` — first spread is `notesVars[0]` (i.e., `notes1`), then for each `k in 1..chain.length-1` append `...connector${k+1}, ...nextNotes${k+1}` (spec §"Code generation", lines 183–187)
    - **Bridge OFF path (existing):** emit `const chain = [${segmentVars.map((v) => "..." + v).join(", ")}]` unchanged (spec §"Code generation", line 169)
    - **Single-entry guard (D-005):** the bridge-on path is only entered when `input.bridgeEnabled && input.chain.length >= 2`; for `chain.length < 2` the bridge-on block is never reached, so no `connectSequences` import is emitted (spec §"Code generation", lines 189–190)
  - [ ] 4.7 Update `CodePreview.tsx`'s caller at `PipelineBuilder.tsx:456–463`: forward `bridgeEnabled={bridgeEnabled}` and `connectorsAndNextNotes={connectorsAndNextNotes}` into the `<CodePreview ... />` element (spec §"Code generation", line 191)
  - [ ] 4.8 Verify `npm run build` passes — `CodeGenInput` must now be satisfied at the `PipelineBuilder.tsx` call site; `CodePreview` passes straight through as `CodePreviewProps = CodeGenInput`

**Acceptance Criteria:**

- `CodeGenInput` has `bridgeEnabled` and `connectorsAndNextNotes` fields
- `emitSegment` returns `{ lines, notesVar, scaleVar, motifVar }` from every code path, including the `motif.length === 0` branch
- Bridge-off chain emission is byte-for-byte the pre-feature `const chain = [...notes1, ...notes2, ...]` output
- Bridge-on chain emission includes one `connectSequences(...)` call per seam, `connector{N}` / `nextNotes{N}` vars, and `const chain = [...notes1, ...connector2, ...nextNotes2, ...]`
- `connectSequences` appears in the `import { ... } from "tonal-guitar"` line if and only if `bridgeEnabled && chain.length >= 2`
- Single-entry bridge-on produces identical output to bridge-off (D-005)
- `npm run build` passes after this group

---

### Acceptance / Verification

#### Task Group 5: Manual acceptance verification (4 scenarios)

**Dependencies:** Task Groups 1, 2, 3, 4

- [ ] 5.0 Run `npm run dev` in `site/` and confirm the Guitar Lab loads without errors; check the browser console for TypeScript/runtime errors
- [ ] 5.1 Verify Scenario 1 — `E↑ → D↓` (extend strategy) (spec §"Acceptance Criteria", lines 242–248):
  - Build chain: entry 1 = E Shape · Thirds (1,3) ascending, root A, Standard tuning; entry 2 = D Shape · Thirds (1,3) descending, root A, Standard tuning
  - Toggle Bridge ON: confirm `ConnectorSlot` text matches `connector · {N} notes (extend)` with `N >= 1` and strategy exactly `extend`
  - Select "Whole chain" output: confirm the ASCII tab / AlphaTeX note count is `chain[0].notes.length + connector.length + nextNotes.length`
  - Open Code preview: confirm one `connectSequences({ prev: { scale: scale1, lastNote: notes1[notes1.length - 1], direction: "ascending" }, next: { scale: scale2, motif: motif2, direction: "descending" } })` call is present; `connector2` and `nextNotes2` vars exist; final `const chain = [...notes1, ...connector2, ...nextNotes2]`; import line includes `connectSequences`
  - Toggle Bridge OFF: `ConnectorSlot` reverts to `no bridge (same direction)`; code preview reverts to `const chain = [...notes1, ...notes2]`; no `connectSequences` in import
- [ ] 5.2 Verify Scenario 2 — `E↓ → A↑` (reach-back strategy) (spec §"Acceptance Criteria", lines 250–255):
  - Build chain: entry 1 = E Shape · Thirds (1,3) descending, root A, Standard tuning; entry 2 = A Shape · Thirds (1,3) ascending, root A, Standard tuning
  - Toggle Bridge ON: confirm `ConnectorSlot` text shows `connector · {N} notes (reach-back)` — same-string bridge model emits a non-empty connector for reach-back (pairs walked along `prev.lastNote.string`)
  - Confirm code preview comment reads `// seam 2: reach-back`; `direction` literals are `"descending"` for entry 1 and `"ascending"` for entry 2
  - Confirm `selectedNotes` (output section note count) reflects the reach-back rewrite — `connector` + `nextNotes` from `connectorsAndNextNotes[0]` are used, NOT the raw `chain[1].notes`
  - Toggle Bridge OFF: identical checks as Scenario 1 OFF case
- [ ] 5.3 Verify Scenario 3 — same-direction empty connector (spec §"Acceptance Criteria", lines 257–264):
  - Build chain: entry 1 = E Shape · Thirds (1,3) ascending, root A; entry 2 = D Shape · Thirds (1,3) ascending, root A
  - Toggle Bridge ON: confirm `ConnectorSlot` renders `no bridge (same direction)` (strategy is `"none"`, connector is `[]`; the `(same direction)` label is reserved for the `"none"` strategy — the empty-`extend` edge case renders `no connector (extend)`)
  - Confirm code preview still emits a `connectSequences(...)` call with `// seam 2: none` comment; `connector2` evaluates to `[]` at runtime
  - Confirm bridge-on and bridge-off produce the same note count in the output (musically identical because connector is empty)
- [ ] 5.4 Verify Scenario 4 — single-entry chain with bridge toggle state (spec §"Acceptance Criteria", lines 266–272):
  - Build chain: add exactly one entry (any sequence)
  - Confirm the Bridge toggle is NOT rendered in the `ChainSection` header (DOM inspection — `entries.length < 2` guard fires)
  - Simulate `bridgeEnabled = true` programmatically if feasible (e.g., add a second entry, toggle on, then remove one); confirm the output and codeGen are identical to the bridge-off single-entry case
  - Confirm code preview shows no `connectSequences` import and no `seam` / `connector` / `nextNotes` variables
- [ ] 5.5 Regression check — confirm that existing chain flows are unaffected:
  - Bridge-off `"Whole chain"` note count equals `chain.flatMap((e) => e.notes).length` (pre-feature behavior)
  - "Current (unsaved)" and "Chain entry" selections produce identical output to pre-feature
  - Preset loading still sets the chain correctly with no console errors
  - ASCII tab, AlphaTeX, and JSON output formats all render without errors for both bridge states

**Acceptance Criteria:**

- All four scenarios from spec §"Acceptance Criteria" (lines 242–273) pass on all three surfaces: `ConnectorSlot` text, `selectedNotes`-derived output, and `CodePreview` generated text
- Bridge OFF always restores the pre-feature state byte-for-byte on each surface
- Scenario 3 (same-direction / `strategy: "none"`) `ConnectorSlot` shows the fallback in both bridge states
- Scenario 4 Bridge toggle is absent from the DOM for a single-entry chain
- No console errors or TypeScript runtime errors in any scenario
- `npm run build` passes cleanly

---

## Execution Order

1. Task Group 1: chainUtils.ts — foundational, no dependencies
2. Task Group 2: PipelineBuilder state and memos — depends on Group 1
3. Task Groups 3 and 4 in parallel — both depend on Group 2, neither depends on the other
4. Task Group 5: Manual acceptance verification — depends on all prior groups

## Files to Create

| File Path | Task |
| --------- | ---- |
| `site/app/experiments/components/chainUtils.ts` | Task Group 1 |

## Files to Modify

| File Path | Task |
| --------- | ---- |
| `site/app/experiments/components/PipelineBuilder.tsx` | Task Groups 2, 3 (prop pass-through), 4 (CodePreview call site) |
| `site/app/experiments/components/ChainSection.tsx` | Task Group 3 |
| `site/app/experiments/components/codeGen.ts` | Task Group 4 |

## Technical Notes

### No library changes

`connectSequences`, `ConnectorStrategy`, `ConnectSequencesInput`, `ConnectSequencesResult`, `ConnectorOptions`, and `ChainDirection` are all already re-exported from `src/index.ts:72–79`. Import them in `site/` via `"tonal-guitar"` — the package name used throughout all existing `site/` components. No edits to `src/`.

### Pure function conventions

`rebuildScale` in `chainUtils.ts` must be a pure function with no React imports (CLAUDE.md §Design conventions: "Pure functions only — no side effects, no mutation, no classes"). This is what makes it safe to call inside both the `scale` memo and the `connectorsAndNextNotes` memo.

### useMemo and useCallback conventions

`connectorsAndNextNotes` follows the pattern of every other derived value in `PipelineBuilder.tsx` — `useMemo` with an explicit dep array. The dep array is `[chain]` only (D-002: runs unconditionally regardless of `bridgeEnabled`). `selectedNotes` dep array expands to `[selection, currentNotes, chain, bridgeEnabled, connectorsAndNextNotes]` (spec §"State & memos", line 90).

### Parallel-array pattern for connector data (D-001)

`ChainEntry` is frozen at add-time (`PipelineBuilder.tsx:288–295`). Connector data flows as a parallel `connectorsAndNextNotes` array, not via mutation of `ChainEntry.connector`. The `connector?` field on `ChainEntry` at `ChainSection.tsx:17–22` remains in place for backward compatibility; the `ConnectorSlot` now reads from the parallel array exclusively.

### ConnectorSlot indexing

`connectorsAndNextNotes[i - 1]` corresponds to the seam *before* `chain[i]` (the seam between entry `i-1` and entry `i`). The slot is rendered for `i > 0` at `ChainSection.tsx:110` — this placement is unchanged; only the data source changes.

### codeGen import-tracking mechanism

`codeGen.ts` uses two `Set<string>` objects (`tonal` and `fretboardUi`, initialized at `codeGen.ts:172–173`) to track which symbols appear in the generated import lines. `tonal.add("connectSequences")` is the canonical way to inject the symbol into the `tonal-guitar` import block (spec §"Existing Code to Leverage", line 221; mirrors the existing `tonal.add("buildFrettedScale")` pattern at `codeGen.ts:74`).

### Bridge toggle markup source

`SequenceStep.tsx:57–65` is the verbatim template for the Bridge toggle. Use `<label className="inline-flex items-center gap-1.5 text-xs">` with `<input type="checkbox" className="accent-fd-primary">`. Label text is exactly `"Bridge"` — no period, no parenthetical (D-003).

### CodePreview is a pass-through

`CodePreview.tsx:6` defines `type CodePreviewProps = CodeGenInput`, so adding `bridgeEnabled` and `connectorsAndNextNotes` to `CodeGenInput` (Task Group 4) automatically makes them required on `<CodePreview ... />` — the only edit is at the call site in `PipelineBuilder.tsx:456–463`.

### build verification cadence

Each group must leave `npm run build` (run from the repo root, which builds both `src/` and `site/`) passing. Groups 1 and 2 add pure TypeScript; Groups 3 and 4 modify React components — each should compile cleanly before proceeding to Group 5.
