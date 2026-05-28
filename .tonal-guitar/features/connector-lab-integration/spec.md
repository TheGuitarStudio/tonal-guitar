# Specification: Connector lab integration — wire connectSequences into Guitar Lab

## Goal

Wire the already-shipped `connectSequences` library API (`src/connect.ts`, re-exported from `src/index.ts:72-79`) into the Guitar Lab (`site/app/experiments/`) so the lab acts as a verification harness for the connector algorithm. The integration introduces a `Bridge` toggle in the chain header; when on, adjacent chain entries are joined by computed connector notes (a continuous melodic arc) instead of jumping between positions, both in the in-app output and in the copy-pasteable code preview. No library code changes are made — this is a pure consumer-side wiring task.

## User Stories

- As an intermediate guitarist using the Guitar Lab, I want to enable a `Bridge` toggle on a multi-entry chain so that the chain plays as one continuous melodic arc (e.g., E shape ascending → D shape descending becomes a single smooth run) instead of a position jump, so I can practice phrases that span CAGED positions.
- As an intermediate guitarist, I want the chain UI to show me exactly which notes the algorithm inserted and which strategy it used (`extend` / `reach-back` / `none`), so I understand and trust the bridge it picked.
- As a library maintainer, I want the lab to call `connectSequences` with realistic inputs and surface its outputs verbatim, so I can use the lab as a manual verification harness for the algorithm against the four canonical scenarios in §Acceptance Criteria.
- As a library consumer reading the `8. Code preview`, I want the generated TypeScript to include the exact `connectSequences(...)` calls that produced the on-screen output, so I can copy a runnable example into my own code.

## Specific Requirements

### Library API (consumed)

- The lab consumes `connectSequences`, `ConnectSequencesInput`, `ConnectSequencesResult`, `ConnectorOptions`, `ConnectorStrategy`, and `ChainDirection` from the `"tonal-guitar"` package (signature at `src/connect.ts:19-69`; types at `src/connect.ts:17,55-69`). No library files change.
- Calls use the default options — `strategy: "auto"`, `dedupSeam: true` (defaults at `src/connect.ts:38-53`). The lab does not pass an explicit options argument.
- `ConnectSequencesResult.strategy` is one of `"none" | "extend" | "reach-back"` (`src/connect.ts:55`). When `strategy === "none"`, `connector` is always empty (`[]`) and `nextNotes` equals the natural walk of `next`. The lab MUST treat `"none"` identically to a zero-length connector when rendering and when assembling the bridge-on flatten.

### Shared helpers (new module): `site/app/experiments/components/chainUtils.ts`

- New file. Pure functions only. No React imports. Imports `buildFrettedScale`, `FrettedScale` from `"tonal-guitar"`, `effectiveModeForSystem` and `parentRoot` from `"fretboard-ui"`, and the `PipelineRecipe` type from `"./codeGen"`.
- Exports `rebuildScale(recipe: PipelineRecipe, tuning: string[]): FrettedScale | null`. The body reproduces the logic at `PipelineBuilder.tsx:137-152` exactly:
  1. Resolve `shape = get(recipe.shapeName)`. If `!shape`, return `null`.
  2. Compute `compatible = isModeCompatibleWithSystem(recipe.modeId, recipe.shapeSystem)` (import from `"fretboard-ui"`). Compute `effectiveMode = effectiveModeForSystem(recipe.modeId, recipe.shapeSystem) ?? recipe.modeId`. Compute `buildRoot = compatible ? (parentRoot(recipe.root, effectiveMode) ?? recipe.root) : recipe.root`.
  3. Call `buildFrettedScale(shape, buildRoot, tuning, { allowOpenStrings: recipe.showOpenStrings })`. If `result.empty` is true, return `null`. Otherwise return `result`.
- `rebuildScale` is used by both the refactored `scale` memo (replacing the inline body at `PipelineBuilder.tsx:146-152`) and the new `connectorsAndNextNotes` memo (D-001, D-002).

### State & memos (`PipelineBuilder.tsx`)

- **New state:** Add `const [bridgeEnabled, setBridgeEnabled] = useState(false);` adjacent to the existing `chain`/`selection` state declarations (after `PipelineBuilder.tsx:128`). Default `false` (D-003 — beginner framing per connector-algorithm spec Decision #3).
- **Refactor `scale` memo (`PipelineBuilder.tsx:146-152`):** Replace the inline `buildFrettedScale(...)` body with `rebuildScale(currentRecipe, tuning)`. The dep array stays equivalent to today (`[shape, buildRoot, tuning, showOpenStrings]`) — `rebuildScale` is referentially stable (module-level function).
- **New `connectorsAndNextNotes` memo** (placed immediately after the `currentNotes` memo, around `PipelineBuilder.tsx:180`):
  ```ts
  const connectorsAndNextNotes: Array<{
    connector: FrettedNote[];
    nextNotes: FrettedNote[];
    strategy: ConnectorStrategy;
  }> = useMemo(() => {
    const out: Array<{ connector: FrettedNote[]; nextNotes: FrettedNote[]; strategy: ConnectorStrategy }> = [];
    for (let i = 1; i < chain.length; i++) {
      const prevEntry = chain[i - 1];
      const nextEntry = chain[i];
      const prevTuning = TUNINGS[prevEntry.recipe.tuningName] ?? STANDARD;
      const nextTuning = TUNINGS[nextEntry.recipe.tuningName] ?? STANDARD;
      const prevScale = rebuildScale(prevEntry.recipe, prevTuning);
      const nextScale = rebuildScale(nextEntry.recipe, nextTuning);
      if (!prevScale || !nextScale || prevEntry.notes.length === 0) {
        out.push({ connector: [], nextNotes: nextEntry.notes, strategy: "none" });
        continue;
      }
      const result = connectSequences({
        prev: {
          scale: prevScale,
          lastNote: prevEntry.notes[prevEntry.notes.length - 1],
          direction: prevEntry.recipe.direction,
        },
        next: {
          scale: nextScale,
          motif: nextEntry.recipe.motif,
          direction: nextEntry.recipe.direction,
        },
      });
      out.push({ connector: result.connector, nextNotes: result.nextNotes, strategy: result.strategy });
    }
    return out;
  }, [chain]);
  ```
  - **Dep array:** `[chain]` only. Runs unconditionally regardless of `bridgeEnabled` (D-002 — freshness on toggle-on is preferred over saving one `rebuildScale + connectSequences` per pair).
  - Returns a parallel array indexed `0..chain.length-2`; entry `[i-1]` corresponds to the seam *before* `chain[i]` (D-001).
  - On any guard failure (missing scale, empty `prev.notes`) the seam falls back to `{ connector: [], nextNotes: nextEntry.notes, strategy: "none" }` so downstream code never crashes.
- **Modify `selectedNotes` memo (`PipelineBuilder.tsx:209-213`):**
  ```ts
  const selectedNotes: FrettedNote[] | null = useMemo(() => {
    if (selection.kind === "current") return currentNotes;
    if (selection.kind === "chainEntry") return chain[selection.index]?.notes ?? null;
    if (!bridgeEnabled || chain.length < 2) return chain.flatMap((e) => e.notes);
    const out: FrettedNote[] = [...chain[0].notes];
    for (let i = 1; i < chain.length; i++) {
      const seam = connectorsAndNextNotes[i - 1];
      if (seam) {
        out.push(...seam.connector, ...seam.nextNotes);
      } else {
        out.push(...chain[i].notes);
      }
    }
    return out;
  }, [selection, currentNotes, chain, bridgeEnabled, connectorsAndNextNotes]);
  ```
  - **Dep array:** `[selection, currentNotes, chain, bridgeEnabled, connectorsAndNextNotes]`.
  - Bridge-off branch is byte-for-byte the current behavior (`chain.flatMap((e) => e.notes)`).
  - Bridge-on branch implements the connector-algorithm spec §4.3 interleave: `chain[0].notes`, then for each `i ≥ 1` push `connectorsAndNextNotes[i-1].connector` followed by `connectorsAndNextNotes[i-1].nextNotes` (not `chain[i].notes` — `nextNotes` already encodes the head-dedup / reach-back rewrite).
  - When `bridgeEnabled && chain.length < 2`, fall through to the bridge-off branch identically (no seams to bridge — matches D-005).
- **`PipelineBuilder` plumbing:** Pass `bridgeEnabled`, `setBridgeEnabled` (as `onBridgeChange`), and `connectorsAndNextNotes` into `ChainSection` (modify the `<ChainSection ... />` element at `PipelineBuilder.tsx:411-425`). Pass `bridgeEnabled` and `connectorsAndNextNotes` into the `<CodePreview ... />` element at `PipelineBuilder.tsx:456-463` so the code preview matches the on-screen output.
- **Imports:** Add `connectSequences` and the type `ConnectorStrategy` to the existing `"tonal-guitar"` import at `PipelineBuilder.tsx:23-37`. Add `rebuildScale` import from `"./chainUtils"`.

### Components (`ChainSection.tsx`, `ConnectorSlot`)

- **`ChainSectionProps`** (`ChainSection.tsx:30-43`) gains three new fields:
  ```ts
  bridgeEnabled: boolean;
  onBridgeChange: (next: boolean) => void;
  connectorsAndNextNotes: Array<{
    connector: FrettedNote[];
    nextNotes: FrettedNote[];
    strategy: ConnectorStrategy;
  }>;
  ```
  Import `ConnectorStrategy` from `"tonal-guitar"`.
- **Bridge toggle:** In the header flex row at `ChainSection.tsx:62-83`, add a new element AFTER the existing note-count span (`ChainSection.tsx:79-82`) but INSIDE the same `<div className="flex flex-wrap items-center gap-2">`. Render conditionally on `entries.length >= 2`:
  ```tsx
  {entries.length >= 2 && (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={bridgeEnabled}
        onChange={(e) => onBridgeChange(e.target.checked)}
        className="accent-fd-primary"
      />
      Bridge
    </label>
  )}
  ```
  This mirrors `SequenceStep.tsx:57-65` markup verbatim. Label text is exactly `"Bridge"` (D-003). When `entries.length < 2`, the toggle is not rendered at all (no no-op control on empty / single-entry chains).
- **`ConnectorSlot` props & render** (`ChainSection.tsx:199-222`):
  - Extend `ConnectorSlotProps` to:
    ```ts
    interface ConnectorSlotProps {
      connector?: FrettedNote[];
      strategy?: ConnectorStrategy;
    }
    ```
  - Update the slot wiring at `ChainSection.tsx:110` from `<ConnectorSlot connector={e.connector} />` to:
    ```tsx
    <ConnectorSlot
      connector={connectorsAndNextNotes[i - 1]?.connector}
      strategy={connectorsAndNextNotes[i - 1]?.strategy}
    />
    ```
    The slot ignores `e.connector` from now on (the field on `ChainEntry` remains for backward compatibility; removing it is out of scope per D-001).
  - Update the rendered text. When `connector && connector.length > 0` (strategy is `"extend"` or `"reach-back"`), render:
    ```tsx
    <span>
      connector · {connector.length} note{connector.length === 1 ? "" : "s"} ({strategy})
    </span>
    ```
    String format exactly: `connector · {N} note{s} ({strategy})` where the `s` is omitted for `N === 1` and `{strategy}` is the literal `extend` or `reach-back` (D-004).
  - When `connector` is empty/missing OR `strategy === "none"`, render the existing italic fallback unchanged: `<span className="italic">no connector (TODO)</span>`. The `(TODO)` suffix is retained because the fallback also fires when scale rebuilding fails; the wording is unchanged to avoid scope creep.
- The horizontal-rule layout (`<span className="h-px flex-1 bg-fd-border" />` on either side) and outer `<div>` class string are unchanged.

### Code generation (`codeGen.ts`)

- **`CodeGenInput` extension** (`codeGen.ts:29-36`): add two fields:
  ```ts
  bridgeEnabled: boolean;
  connectorsAndNextNotes: Array<{
    connector: unknown[]; // FrettedNote[]; widened to avoid a tonal-guitar import for type-only use
    nextNotes: unknown[];
    strategy: "none" | "extend" | "reach-back";
  }>;
  ```
  The `connectorsAndNextNotes` array is forwarded by `PipelineBuilder` so codeGen knows the per-seam strategy for the emitted comment.
- **`emitSegment` return-type extension** (`codeGen.ts:59-138`): change return type to `{ lines: string[]; notesVar: string; scaleVar: string; motifVar: string }`. Both `scaleVar` (`scale${suffix}`) and `motifVar` (`motif${suffix}`) MUST be returned in every branch including the `recipe.motif.length === 0` early-return path at `codeGen.ts:107-117`.
  - In the `motif.length === 0` branch, ALWAYS emit `const motif${suffix} = [];` immediately before the `notesVar` assignment so a downstream `connectSequences` call can reference `motifVar` uniformly.
  - The non-empty-motif branches (`codeGen.ts:119-135`) already emit `const ${motifVar} = ${motifLiteral};` — leave them, and ensure the return includes `motifVar`.
- **`generateCode` chain branch** (`codeGen.ts:177-205`): when `input.selection.kind === "chain" && input.chain.length > 0`, after the existing per-segment emission loop and before the final assembly line, branch on `input.bridgeEnabled && input.chain.length >= 2`:
  - **Bridge OFF path (existing behavior preserved):** emit `const chain = [${segmentVars.map((v) => "..." + v).join(", ")}];` exactly as today (`codeGen.ts:189-191`).
  - **Bridge ON path:** for each `i` in `1..chain.length-1`:
    1. Add `tonal.add("connectSequences")` once.
    2. Capture each segment emission's `{ scaleVar, motifVar, notesVar }` (return-type change above). Track them as `scaleVars[i]`, `motifVars[i]`, `notesVars[i]` (1-indexed to match `suffix = String(i+1)`).
    3. Between segment `i` and segment `i+1` (i.e. after emitting segment `i+1`'s lines), emit:
       ```ts
       // seam i+1: ${strategy}
       const seam${i+1} = connectSequences({
         prev: { scale: ${scaleVars[i]}, lastNote: ${notesVars[i]}[${notesVars[i]}.length - 1], direction: ${JSON.stringify(chain[i-1].recipe.direction)} },
         next: { scale: ${scaleVars[i+1]}, motif: ${motifVars[i+1]}, direction: ${JSON.stringify(chain[i].recipe.direction)} },
       });
       const connector${i+1} = seam${i+1}.connector;
       const nextNotes${i+1} = seam${i+1}.nextNotes;
       ```
    4. The final concat replaces `notes{i}` with `nextNotes{i}` for every `i >= 2`:
       ```ts
       const chain = [...notes1, ...connector2, ...nextNotes2, ...connector3, ...nextNotes3, ...];
       ```
       Concretely: emit `[...notesVars[1]]`, then for each `i in 2..N` push `...connectorVars[i], ...nextNotesVars[i]`.
    5. The strategy comment is taken from `input.connectorsAndNextNotes[i-1].strategy`. If `strategy === "none"`, still emit the `connectSequences` line — the runtime call returns `connector: []` and a correctly-deduped `nextNotes`, so the generated code remains faithful.
- **Bridge ON + chain.length < 2 (D-005):** Emit identical output to `bridgeEnabled === false`. The bridge-on emission path is gated on `input.bridgeEnabled && input.chain.length >= 2`. With a single entry, `generateCode` reaches the `else` branch at `codeGen.ts:206` and emits a one-shot segment, exactly as today. Do NOT add `connectSequences` to `tonal` in this case (the import would be unused).
- The bridge-on path applies ONLY to `selection.kind === "chain"`. For `selection.kind === "current"` or `"chainEntry"`, codeGen emits one segment unchanged — there are no seams in a single segment.
- **`CodePreview`** (consumer of `generateCode`) MUST be updated to forward the new `bridgeEnabled` and `connectorsAndNextNotes` props from `PipelineBuilder` into `CodeGenInput`. Existing call site at `PipelineBuilder.tsx:456-463` is the only edit point.

### Acceptance / verification

See §Acceptance Criteria. Verification is fully manual (D-006) — `site/` has no test infrastructure and adding it is out of scope.

## Visual Design

- **Bridge toggle markup** matches `SequenceStep.tsx:57-65` verbatim (`<label class="inline-flex items-center gap-1.5 text-xs">` containing `<input type="checkbox" class="accent-fd-primary">` and the label text). The label text is exactly `"Bridge"` — no period, no parenthetical.
- **Toggle placement:** appended as the final child of the existing header flex row at `ChainSection.tsx:62-83`, after the note-count `<span>` at `ChainSection.tsx:79-82`. The header row already has `className="flex flex-wrap items-center gap-2"`; the toggle inherits the row's wrap behavior on narrow viewports.
- **Conditional render:** the toggle is wrapped in `{entries.length >= 2 && ( ... )}`. On chains of 0 or 1 entries, the toggle is absent from the DOM (not just visually hidden).
- **`ConnectorSlot` text format:** when a non-empty connector exists, exactly `connector · {N} note{s} ({strategy})` where:
  - `·` is the existing middle-dot character already used in the slot (`ChainSection.tsx:214`).
  - `{N}` is `connector.length`.
  - `{s}` is the literal `s` when `N !== 1`, omitted when `N === 1`.
  - `{strategy}` is the literal `extend` or `reach-back` — never `none` (when strategy is `none`, the fallback branch renders instead).
- **Fallback text** is unchanged: `<span className="italic">no connector (TODO)</span>`.
- **Surrounding layout** (`<div className="my-1 ml-8 flex items-center gap-2 text-xs text-fd-muted-foreground">` with two `<span className="h-px flex-1 bg-fd-border" />` rules) is unchanged.
- No new Tailwind classes, no new colors, no new fumadocs (`fd-*`) tokens, no new icons. All styling reuses existing tokens already present in `ChainSection.tsx` and `SequenceStep.tsx`.

## Existing Code to Leverage

- **`connectSequences` library API** — `src/connect.ts:19-69` (function), `src/connect.ts:55` (`ConnectorStrategy` type), re-exported from `src/index.ts:72-79`.
- **`buildFrettedScale` and `parentRoot` / `effectiveModeForSystem` derivation** — `PipelineBuilder.tsx:137-152` is the exact logic `rebuildScale` extracts.
- **`PipelineRecipe`** — `codeGen.ts:7-22` is the canonical recipe shape and the input to `rebuildScale`.
- **`ChainEntry`** — `ChainSection.tsx:6-23`; `ChainEntry.connector` field is now ignored (parallel-array approach per D-001) but left in place for backward compatibility.
- **`ConnectorSlot` scaffolding** — `ChainSection.tsx:199-222` renders the seam; wire in the parallel-array data only.
- **`<ConnectorSlot>` placement** — `ChainSection.tsx:110` already renders the slot for each entry at `i > 0`; the prop wiring changes but the placement does not.
- **`SequenceStep` toggle pattern** — `SequenceStep.tsx:57-65` is the verbatim template for the Bridge toggle markup.
- **`PipelineBuilder` memoization conventions** — every derived value uses `useMemo`; every handler uses `useCallback`. `connectorsAndNextNotes` follows the pattern (`useMemo` with explicit deps).
- **`codeGen.ts` import-tracking sets** — `codeGen.ts:172-173` (the `tonal` and `fretboardUi` `Set<string>`) and `codeGen.ts:42-49` (`buildImportBlock`) are the canonical way to inject `connectSequences` into the generated import line. Use `tonal.add("connectSequences")`.
- **`generateCode` chain emission loop** — `codeGen.ts:177-205` is the exact insertion point for the bridge-on seam emission.

## Out of Scope

- Cross-tuning bridging (connector-algorithm spec §5: explicitly caller's problem).
- Cross-key / cross-scale chaining (connector-algorithm spec §1 non-goal).
- AlphaTeX bar-alignment / snap-to-bar (bars re-flow when connectors are inserted; not addressed here).
- Rhythm-aware connector duration.
- AlphaTab playback component changes beyond what the modified `selectedNotes` already drives.
- `ConnectorSlot` mini-fretboard or note-name preview panel (count + strategy text only).
- Per-entry / mixed-tuning rendering in codeGen (single-tuning chain remains the rendered model).
- `applySequence` integration (the lab does not use `applySequence` today).
- Adding `site/` test infrastructure (separate, larger effort).
- Removing the now-unused `ChainEntry.connector` field from `ChainSection.tsx:17-22` (follow-up cleanup; harmless noop).
- Custom `ConnectorOptions` (the lab always uses defaults: `strategy: "auto"`, `dedupSeam: true`).

## Acceptance Criteria

The implementer MUST manually verify all four scenarios below before merging (D-006). For each, perform the chain setup in the lab UI, toggle Bridge to `on`, then to `off`, and confirm the listed expectations in `ConnectorSlot`, the `7. Output` section (ASCII tab / AlphaTeX), and the `8. Code preview`.

**Scenario 1 — extend strategy (`E↑ → D↓`):**

- Chain setup: entry 1 = `E Shape · Thirds (1,3)` ascending, root `A`, standard tuning. Entry 2 = `D Shape · Thirds (1,3)` descending, root `A`, standard tuning.
- Expected `ConnectorSlot` text (bridge ON, seam before entry 2): `connector · {N} notes (extend)` (note count varies by shape geometry; the strategy must be `extend` and the count must be ≥ 1).
- Expected `codeGen` (bridge ON): generated code includes one `connectSequences({ prev: { scale: scale1, lastNote: notes1[notes1.length - 1], direction: "ascending" }, next: { scale: scale2, motif: motif2, direction: "descending" } })` call, destructured into `connector2` and `nextNotes2`, with final `const chain = [...notes1, ...connector2, ...nextNotes2];`. The `tonal-guitar` import line includes `connectSequences`.
- Expected `selectedNotes` content (bridge ON, `selection.kind === "chain"`): `[...chain[0].notes, ...connectorsAndNextNotes[0].connector, ...connectorsAndNextNotes[0].nextNotes]`. `connectorsAndNextNotes[0].strategy === "extend"`.
- Bridge OFF: slot reads `no connector (TODO)`; `selectedNotes` equals `chain.flatMap((e) => e.notes)`; codeGen emits `const chain = [...notes1, ...notes2];` with no `connectSequences` import.

**Scenario 2 — reach-back strategy (`E↓ → A↑`):**

- Chain setup: entry 1 = `E Shape · Thirds (1,3)` descending, root `A`, standard tuning. Entry 2 = `A Shape · Thirds (1,3)` ascending, root `A`, standard tuning.
- Expected `ConnectorSlot` text (bridge ON): `connector · {N} note{s} (reach-back)` where `N ≥ 1`. Strategy must be exactly `reach-back`.
- Expected `codeGen`: same shape as Scenario 1 but the emitted comment reads `// seam 2: reach-back`. `direction` literals reflect entry 1 (`"descending"`) and entry 2 (`"ascending"`).
- Expected `selectedNotes` content: as Scenario 1 with `strategy === "reach-back"`. Critically, `nextNotes` is the re-walk over the combined seam (per `src/connect.ts:60-65`), not a trim of the natural walk.
- Bridge OFF: as Scenario 1's OFF case.

**Scenario 3 — same direction, empty connector (Decision #3 default):**

- Chain setup: entry 1 = `E Shape · Thirds (1,3)` ascending, root `A`. Entry 2 = `D Shape · Thirds (1,3)` ascending, root `A`. Both same direction.
- Expected `ConnectorSlot` text (bridge ON): `no connector (TODO)` (fallback branch — strategy is `"none"`, connector is empty).
- Expected `codeGen` (bridge ON): the `connectSequences(...)` line IS still emitted with `strategy: "none"` runtime behavior; `connector2` evaluates to `[]` at runtime; `nextNotes2` equals the natural walk of entry 2. The seam comment reads `// seam 2: none`. (Decision #3 of connector-algorithm spec holds at the algorithm level — same-direction is not bridged — but the lab still emits a faithful call.)
- Expected `selectedNotes` content (bridge ON): `[...chain[0].notes, ...[], ...chain[1].notes]` — functionally identical to bridge-OFF because `connector` is `[]` and `nextNotes` is the natural walk.
- Bridge OFF: identical output to bridge ON in this scenario (musically the same notes). Slot reads `no connector (TODO)` in both states.

**Scenario 4 — single-entry chain, bridge toggle on (D-005 edge case):**

- Chain setup: entry 1 = any single sequence. Toggle Bridge ON.
- Expected: the Bridge toggle is NOT rendered (per `entries.length >= 2` guard) — the user cannot reach this state through the UI. If `bridgeEnabled === true` is reached programmatically (e.g., a stale state from a prior multi-entry chain), the system behaves identically to `bridgeEnabled === false`.
- Expected `ConnectorSlot`: not rendered (no seam — `ChainSection.tsx:110` already gates on `i > 0`).
- Expected `codeGen`: identical output to `bridgeEnabled === false` (D-005). No `connectSequences` in the import line, no `seam`/`connector`/`nextNotes` variables. Generated code is the same single-segment one-shot the lab emits today.
- Expected `selectedNotes` content: `chain[0].notes` for `selection.kind === "chain"` (the `bridgeEnabled && chain.length >= 2` guard falls through to the bridge-off branch which returns `chain.flatMap((e) => e.notes)` — equivalent for `chain.length === 1`).

A scenario passes when ALL three surfaces (`ConnectorSlot` text, `selectedNotes`-derived output, `codeGen` text) match the expectations above with the Bridge toggle ON, and the bridge-OFF surface returns to the pre-feature state byte-for-byte.
