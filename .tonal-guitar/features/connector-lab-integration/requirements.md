# Requirements: Connector lab integration

## Initial Description

Wire `connectSequences` (now landed in `tonal-guitar` via PR #4) into the Guitar
Lab (`site/app/experiments/`) so that the lab functions as a verification
harness for the connector algorithm. The integration adds a `Bridge` toggle to
`ChainSection`; when on, segments in the chain are joined by computed connector
notes (continuous melodic arc) instead of jumping between positions. The 6
scope items are mapped 1:1 from connector-algorithm spec §8 and traced to
exact lines in `research.md` §Codebase Research.

## Requirements Discussion

### Round 1 Questions

**Q1 (O-1):** How should connector data reach `ChainSection` — mutate
`ChainEntry.connector` on each recompute, or pass a parallel
`connectorsAndNextNotes` array?

**Answer:** Parallel array. Keep `ChainEntry` frozen at add-time; pass a
separate `connectorsAndNextNotes` array to `ChainSection` alongside `chain`.
Avoids re-creating entries on every recompute and gives a cleaner data flow.

**Q2 (O-2):** Should the `connectorsAndNextNotes` memo always run, or only
when the bridge toggle is on?

**Answer:** Always run. Compute unconditionally so data is fresh the instant
the toggle flips on. Cost is ~1 `rebuildScale + connectSequences` per pair per
chain change — negligible for typical chains (≤5 entries).

**Q3 (O-3):** When should the bridge toggle appear in the `ChainSection`
header, and what label?

**Answer:** Label `"Bridge"`. Only render the toggle once the chain has 2+
entries (seams exist). Avoids a no-op control on empty/single-entry chains.

**Q4 (O-4):** Should `ConnectorSlot` show the strategy alongside the note
count?

**Answer:** Yes. Render e.g. `"connector · 2 notes (extend)"`. Cheap addition;
educational transparency into how the algorithm bridged.

**Q5 (O-5):** Which scenarios should the spec lock in as the must-verify
manual checklist? (These become the acceptance criteria since `site/` has no
automated tests.)

**Answer:** All four candidate scenarios:

1. `E↑ → D↓` — extend strategy
2. `E↓ → A↑` — reach-back strategy
3. Same-direction with bridge on — expects empty connector (Decision #3 holds)
4. Single-entry chain with bridge on — expects no output / codeGen change

**Q6 (O-6):** `codeGen` when bridge is on but the chain has only one entry —
emit unchanged, or wrap in a `connectSequences`-aware shape?

**Answer:** Emit unchanged. No seams = nothing to bridge; emitting the same
output as bridge-off keeps the generated code clean.

### Existing Code to Reference

**Similar Features Identified:**

- Feature: SequenceStep toggle pattern — Path:
  `site/app/experiments/components/SequenceStep.tsx:56–65`
  - Use this exact `<label>` + `<input type="checkbox">` markup for the Bridge
    toggle to match existing lab UI conventions.

- Feature: `PipelineBuilder` memoization conventions — Path:
  `site/app/experiments/components/PipelineBuilder.tsx`
  - Every derived value uses `useMemo`; handlers use `useCallback`. The new
    `connectorsAndNextNotes` memo follows the same pattern.

- Feature: `ChainSection`/`ConnectorSlot` scaffolding — Path:
  `site/app/experiments/components/ChainSection.tsx:6–23, 199–222`
  - `ChainEntry.connector` field and `ConnectorSlot` render are already in
    place from a pre-`feat/connector-algorithm` scaffold. Wire data in; do
    not redesign the slot.

- Feature: `codeGen.ts` `tonal` import-tracking — Path:
  `site/app/experiments/components/codeGen.ts:1, 177–205`
  - Add `tonal.add("connectSequences")` to the existing symbol-tracking set
    rather than creating new import plumbing.

### Follow-up Questions

None — the four AskUserQuestion rounds + the two stated defaults (O-6 emit
unchanged; D-006 verification scenarios) closed the design space without
additional follow-ups.

## Visual Assets

### Files Provided

No visual assets provided. The toggle and slot UI follow existing lab
conventions (see `SequenceStep` and `ChainSection.tsx:199–222`).

### Visual Guidance

- Bridge toggle: `<label>` + `<input type="checkbox">`, in the existing
  `ChainSection` header flex row (currently holding "+ Add current to chain",
  "Clear chain", note count). Conditional render: only when `chain.length ≥ 2`.
- `ConnectorSlot`: keep the existing horizontal-rule + centered label layout.
  Extend the label to include strategy in parentheses:
  `"connector · {N} note(s) ({strategy})"`. No additional UI affordances.
- No new colors, icons, or layout primitives. All styling uses the existing
  Tailwind / fumadocs (`fd-*`) tokens already present in `ChainSection.tsx`.

## Requirements Summary

### Functional Requirements

- **`chainUtils.ts` (new module):**
  - Export `rebuildScale(recipe: PipelineRecipe): FrettedScale | null` that
    reproduces the logic at `PipelineBuilder.tsx:146–152` (parent-root, mode,
    open-strings, tuning all derived from `recipe`).
  - Pure function, no React imports.

- **`PipelineBuilder` state & memos:**
  - Add `bridgeEnabled: boolean` state, default `false`. Owned by
    `PipelineBuilder`.
  - Refactor the `scale` `useMemo` (`PipelineBuilder.tsx:146–152`) to call
    `rebuildScale(recipe)` instead of the inline `buildFrettedScale(...)`.
  - Add `connectorsAndNextNotes: Array<{ connector: FrettedNote[]; nextNotes:
    FrettedNote[]; strategy: ConnectorStrategy }>` memo with deps `[chain]`:
    iterates `chain` pairwise (`i ≥ 1`), rebuilds prev/next scales via
    `rebuildScale`, derives `lastNote` from `prev.notes[prev.notes.length-1]`,
    derives directions from `recipe.sequenceDirection`, and calls
    `connectSequences({ prev, next })`. Runs unconditionally regardless of
    `bridgeEnabled` (D-002).
  - Modify `selectedNotes` memo (`PipelineBuilder.tsx:209–213`): when
    `selection.kind === "all"` and `bridgeEnabled`, return
    `chain[0].notes` plus for each `i ≥ 1`,
    `connectorsAndNextNotes[i-1].connector` followed by
    `connectorsAndNextNotes[i-1].nextNotes`. When `!bridgeEnabled`, retain the
    existing `chain.flatMap((e) => e.notes)`.

- **`ChainSection` (UI):**
  - Accept new props: `bridgeEnabled: boolean`, `onBridgeChange: (next:
    boolean) => void`, `connectorsAndNextNotes: …` (parallel array from D-001).
  - Render a `<label>Bridge<input type="checkbox" /></label>` in the header
    flex row, **only when `chain.length ≥ 2`**.
  - Pass `connectorsAndNextNotes[i-1]` into `ConnectorSlot` for each chain
    entry at index `i ≥ 1`.

- **`ConnectorSlot` (UI):**
  - Accept new prop `strategy?: ConnectorStrategy`.
  - When `connector && connector.length > 0`, render
    `"connector · {N} note{s} ({strategy})"`. When strategy is `"none"` or
    `connector.length === 0`, render existing italic `"no connector (TODO)"`
    fallback (or `"no bridge needed"` — see decisions).

- **`codeGen.ts`:**
  - Extend `CodeGenInput` with `bridgeEnabled: boolean`.
  - Extend `emitSegment` return type to `{ lines, notesVar, scaleVar,
    motifVar }`; always emit a `motif{suffix}` const (even when
    `recipe.motif.length === 0`).
  - When `bridgeEnabled && chain.length ≥ 2`: between segment `i` and `i+1`
    emit `const connector{i+1} = connectSequences({ prev: { scale:
    scale{i}, lastNote: …, direction: … }, next: { scale: scale{i+1},
    motif: motif{i+1}, direction: … } }).connector;` and assemble the final
    `chain` as `[...notes1, ...connector2, ...notes2', ...connector3,
    ...notes3', …]` where `notes{i}'` is the `nextNotes` of the same
    `connectSequences` call (returned via a destructure).
  - Add `tonal.add("connectSequences")` so the generated import line includes
    it.
  - When `bridgeEnabled && chain.length < 2`: emit identical output to
    `bridgeEnabled === false` (D-005).

- **`PipelineBuilder` plumbing:**
  - Pass `bridgeEnabled` + `onBridgeChange` + `connectorsAndNextNotes` into
    `ChainSection`. Pass `bridgeEnabled` into `CodeGenInput` so `CodePreview`
    matches.

### Reusability Opportunities

- `rebuildScale` consolidates the `buildFrettedScale` + parent-root + mode +
  open-strings derivation in one place — used by both the `scale` memo and
  the new `connectorsAndNextNotes` memo. (Spec §8 scope item 1.)
- The existing `ChainEntry.connector` field and `ConnectorSlot` placeholder
  scaffolding ship as-is; only data needs to flow.
- The `tonal` symbol-tracking set in `codeGen.ts` is the canonical mechanism
  for adding `connectSequences` to the generated import.

### Scope Boundaries

**In Scope:**

1. `rebuildScale(recipe)` helper in new `site/app/experiments/components/chainUtils.ts`.
2. `connectorsAndNextNotes` memo in `PipelineBuilder`.
3. Wiring connector + strategy data to `ConnectorSlot` via parallel array.
4. Bridge-aware `selectedNotes` flatten.
5. `codeGen.ts` emits `connectSequences()` calls between segments when bridge
   is on.
6. `Bridge` toggle in `ChainSection` header (conditional on `chain.length ≥ 2`).
7. Manual verification checklist as acceptance criteria (4 scenarios from O-5).

**Out of Scope:**

- Cross-tuning bridging (connector-algorithm spec §5: caller's problem).
- Cross-key / cross-scale chaining (connector-algorithm spec §1 non-goal).
- AlphaTeX bar-alignment / snap-to-bar.
- Rhythm-aware connector duration.
- AlphaTab playback component changes beyond what `selectedNotes` already drives.
- `ConnectorSlot` mini-fretboard preview (count + strategy text only).
- Per-entry / mixed-tuning rendering in codeGen.
- `applySequence` integration (lab does not use `applySequence`).
- Adding `site/` test infrastructure (separate, larger effort).

### Technical Considerations

- `ChainEntry` has no `scale` field; the connector memo must rebuild scales
  from `recipe` on every chain change. Acceptable cost for ≤5 entries.
- `emitSegment` return type change is internal to `codeGen.ts` — no external
  break.
- Toggle state needs to flow to TWO consumers: `ChainSection` (UI) and
  `CodeGenInput` (codeGen). Both pathways already exist.
- `selectedNotes` length changes when bridge is on; "7. Output" `StepCard`
  subtitle count reflects the new content — expected, no code change needed.
- Base branch was `feat/connector-algorithm`; PR #4 merged 2026-05-27 and this
  branch was rebased onto `main` on 2026-05-28. `src/connect.ts` is now
  available unconditionally.
