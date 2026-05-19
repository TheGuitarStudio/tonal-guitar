# Research: Connector lab integration — wire connectSequences into Guitar Lab

**Date:** 2026-05-18 | **Issue:** #5

This research grounds the 5 scope items from `.tonal-guitar/features/connector-algorithm/spec.md` §8 in the current `site/app/experiments/` code and the library's new `src/connect.ts` API. The lab is a verification harness for the connector algorithm; the bridge toggle is the first lab control that materially changes the musical output (not just formatting).

---

## Codebase Research

### Library API surface (`src/connect.ts`) — stable, no changes needed

`connectSequences` and all five associated types are already re-exported from `src/index.ts:72–79`. The lab will import from `"tonal-guitar"` (the package name, matching every other `site/` component).

**Signature** (`src/connect.ts:19–69`):

```ts
export function connectSequences(
  input: ConnectSequencesInput,
  options?: ConnectorOptions,
): ConnectSequencesResult
```

- **Input** (`src/connect.ts:19–36`):
  - `prev.scale: FrettedScale`, `prev.lastNote: FrettedNote`, `prev.direction: ChainDirection`
  - `next.scale: FrettedScale`, `next.motif: number[]`, `next.direction: ChainDirection`
- **Output** (`src/connect.ts:57–69`):
  - `connector: FrettedNote[]` (may be empty)
  - `nextNotes: FrettedNote[]` (head dedup / reach-back already applied)
  - `strategy: ConnectorStrategy` — `"none" | "extend" | "reach-back"`
- **Options** (`src/connect.ts:38–53`): `strategy?: "auto"` (only `"auto"` implemented), `dedupSeam?: boolean` (default `true`).

`connectSequences` returns both the connector and the post-connector `nextNotes` in one call — no separate preview helper is needed. Dependency tier: zero-Tonal-deps (imports only from `./shape` and `./walker`). The library is fully tested in `src/connect.test.ts`.

**Recommendation:** No library changes. Wire the existing public API into the lab.

### Lab `PipelineBuilder` and chain state

**File:** `site/app/experiments/components/PipelineBuilder.tsx`

**Inline `buildFrettedScale` call** (`PipelineBuilder.tsx:146–152`):

```ts
const scale: FrettedScale | null = useMemo(() => {
  if (!shape) return null;
  const result = buildFrettedScale(shape, buildRoot, tuning, {
    allowOpenStrings: showOpenStrings,
  });
  return result.empty ? null : result;
}, [shape, buildRoot, tuning, showOpenStrings]);
```

This is the only `buildFrettedScale` call in `PipelineBuilder.tsx`. `buildRoot` is derived from `parentRoot(root, effectiveMode) ?? root` (`PipelineBuilder.tsx:137–140`). The `codeGen.ts` emitter independently re-constructs the same logic as source text inside `emitSegment` (`codeGen.ts:74–103`).

**`currentNotes` memo** (`PipelineBuilder.tsx:165–180`) — consumes `scale`; will keep delegating to the new helper.

**`chain` state** (`PipelineBuilder.tsx:127`): `useState<ChainEntry[]>([])`. `addToChain` (`PipelineBuilder.tsx:288–295`) freezes `{ label, notes, recipe }` at add-time. `ChainEntry.connector` is always `undefined` today.

**`selectedNotes` derivation** (`PipelineBuilder.tsx:209–213`):

```ts
const selectedNotes: FrettedNote[] | null = useMemo(() => {
  if (selection.kind === "current") return currentNotes;
  if (selection.kind === "chainEntry") return chain[selection.index]?.notes ?? null;
  return chain.flatMap((e) => e.notes); // line 212 — target for scope item 3
}, [selection, currentNotes, chain]);
```

Line 212 is the precise target of scope item 3. When the bridge toggle is off it stays unchanged; when on, it becomes the spec §4.3 connector-interleaved flatten.

**Memoization pattern:** every derived value uses `useMemo`; handlers use `useCallback`. The new `connectorsAndNextNotes` memo must follow the same pattern.

### `ChainSection` and `ConnectorSlot`

**File:** `site/app/experiments/components/ChainSection.tsx`

`ChainEntry` is defined here (`ChainSection.tsx:6–23`) and already has the optional `connector?: FrettedNote[]` field with the JSDoc "Empty until the connector algorithm lands; the UI shows a placeholder slot." This scaffolding pre-dates the connector-algorithm branch.

**`ConnectorSlot` render** (`ChainSection.tsx:199–222`):

```ts
function ConnectorSlot({ connector }: ConnectorSlotProps) {
  return (
    <div className="my-1 ml-8 flex items-center gap-2 text-xs text-fd-muted-foreground">
      <span className="h-px flex-1 bg-fd-border" />
      {connector && connector.length > 0 ? (
        <span>
          connector · {connector.length} note{connector.length === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="italic">no connector (TODO)</span>
      )}
      <span className="h-px flex-1 bg-fd-border" />
    </div>
  );
}
```

The slot is wired into the list at `ChainSection.tsx:110` via `connector={e.connector}`. UI is ready; only data needs to flow.

**Existing toggle precedent:** `SequenceStep.tsx:56–65` uses `<label>` + `<input type="checkbox">` ("Walk full shape"). The bridge toggle should match this pattern. The natural header location is the flex row at `ChainSection.tsx:62–83` (currently: "+ Add current to chain", "Clear chain", note count).

### `codeGen.ts`

**File:** `site/app/experiments/components/codeGen.ts`

**Current chain emission** (`codeGen.ts:177–205`):

```ts
input.chain.forEach((entry, i) => {
  const suffix = String(i + 1);
  if (i > 0) lines.push("");
  lines.push(`// ${i + 1}. ${entry.label}`);
  const seg = emitSegment(entry.recipe, suffix, tonal, fretboardUi);
  lines.push(...seg.lines);
  segmentVars.push(seg.notesVar);
});
lines.push("");
lines.push(`const chain = [${segmentVars.map((v) => `...${v}`).join(", ")}];`);
```

Today the final concat is a dumb flat spread.

**`emitSegment` return type** (`codeGen.ts:74–103`) currently returns `{ lines, notesVar }` — does NOT expose the `scale{suffix}` var. To emit `connectSequences()` calls, the previous segment's scale variable is needed; the return type must be extended to `{ lines, notesVar, scaleVar }` (and a `motif{suffix}` var must always be emitted, even when `recipe.motif.length === 0`).

**Imports:** `codeGen.ts` only imports from `"fretboard-ui"` (`codeGen.ts:1`); it does not import from `"tonal-guitar"` at runtime. The `tonal` Set tracks symbols to emit in the generated `import { ... } from "tonal-guitar";` line — adding `tonal.add("connectSequences")` is the correct mechanism.

### Suggested code placement

| New file | Package / dir | Rationale |
| -------- | ------------- | --------- |
| `site/app/experiments/components/chainUtils.ts` | `site/` | Holds `rebuildScale(recipe: PipelineRecipe): FrettedScale \| null`. Keeps `PipelineBuilder.tsx` (already 467 lines) from growing further, and isolates the parent-root / mode / open-strings derivation so it can be reused by both the `scale` memo and the new `connectorsAndNextNotes` memo. Imports from `"tonal-guitar"`, matches existing site conventions. |

No new files in `src/`. No changes to library exports.

### Related code

- **`PipelineRecipe`** (`codeGen.ts:7–22`) — already the canonical recipe shape; `rebuildScale` accepts it as its sole input.
- **`Selection`** is duplicated in `codeGen.ts:24–27` and `PipelineBuilder.tsx:98–101` — pre-existing minor smell, out of scope to fix here.
- **`output` memo** (`PipelineBuilder.tsx:225–240`) consumes `selectedNotes` for ASCII tab / AlphaTeX / JSON. Signature is `FrettedNote[]` — changing the flatten does NOT break it.
- **`AlphaTabPlayer`** and **`OutputStep.tsx:93`** receive formatted strings, not `FrettedNote[]` — no break.
- **`StepCard` subtitle** for "7. Output" (`PipelineBuilder.tsx:432`) shows `selectedNotes?.length ?? 0` — value will increase when bridge is on (expected).

---

## Product Research

### Roadmap alignment

There is no `docs/product/mission.md` or `docs/product/roadmap.md` — the product narrative is reconstructed from `docs/DOCS_EPIC.md` and `CLAUDE.md`. The Guitar Lab is **Task 8.3** of the documentation epic, "a step-by-step pipeline builder where users compose guitar functions visually and see results at each stage." Not marketed as a standalone product; it is the documentation / experiments layer.

connector-algorithm (issue [#2](https://github.com/TheGuitarStudio/tonal-guitar/issues/2), PR [#4](https://github.com/TheGuitarStudio/tonal-guitar/pull/4)) is complete and pending merge. This feature (issue [#5](https://github.com/TheGuitarStudio/tonal-guitar/issues/5)) is the explicit post-library follow-up, scoped out of the library MVP in `.tonal-guitar/features/connector-algorithm/tasks.md:248–263`. No other roadmap milestones block on it.

**Alignment:** Moderate. Direct architectural lineage from connector-algorithm spec §8 and a clear verification-harness role, but no formal mission docs or user research to substantiate stronger product alignment.

### Related specifications

| Document | Relevance |
| -------- | --------- |
| `.tonal-guitar/features/connector-algorithm/spec.md` §1, §2, §4.3, §8 | Goal/non-goals; constraining decisions (same-direction no-bridge default, return-`nextNotes`-always); the caller pattern this feature implements verbatim. |
| `.tonal-guitar/features/connector-algorithm/spec.md` §5 | Cross-tuning explicitly "caller's problem" — confirms out-of-scope here. |
| `.tonal-guitar/features/connector-algorithm/tasks.md` §"Out of MVP Scope / Lab Integration" (lines 248–263) | Confirms lab integration is the explicit follow-up to the library MVP. |
| `.tonal-guitar/features/connector-algorithm/research.md` §5 | Line-by-line trace of the lab integration surface. |
| `docs/DOCS_EPIC.md` §Task 8.3 | UX framing for the lab: vertical pipeline, live updates, copy buttons, presets. Mentions `ChainSection` as "6. Chain" step but not the bridge concept. |
| `CLAUDE.md` "Remaining work" | Lists deploy-to-GitHub-Pages (independent), Task 2.5, and `analyzeInKey` follow-ups — all unrelated to this feature. |

### User context

**Primary user:** an intermediate guitarist using the Guitar Lab to build practice exercises. The bridge toggle is the first lab control that produces a qualitatively different musical output (continuous melodic arc vs. position repetition), not just a different rendering of the same notes.

**Secondary user:** the library maintainer, who exercises the lab as a visual verification harness for `connectSequences`.

**Before / after the bridge toggle:**

- **Off (today, beginner):** Chain `E Shape · Thirds ↑` then `D Shape · Thirds ↓`. "Whole chain" plays all notes from entry 1, then jumps straight to the first note of entry 2 — a noticeable pitch leap. `ConnectorSlot` reads `"no connector (TODO)"`.
- **On (intermediate):** Same chain, but `connectSequences` inserts a short bridge (e.g. `[C#5, D5]` for an E→D `extend` case). `ConnectorSlot` reads `"connector · 2 notes"`. Whole-chain output sounds like one continuous run. `codeGen` emits a `connectSequences(...)` call that a library consumer can copy verbatim.

Decision #3 of the connector-algorithm spec (`.tonal-guitar/features/connector-algorithm/spec.md:43–48`) governs the default: same-direction chains express "do the exercise again in another position" — a beginner repetition. Bridging is reserved for intermediate users chaining asc → desc into a melodic arc. The toggle defaults to off to preserve the beginner framing.

### Scope assessment

**In scope** (mapped 1:1 to spec §8):

1. **Factor out `rebuildScale(recipe)` helper** — Extract the inline `buildFrettedScale(...)` call at `PipelineBuilder.tsx:146–152` into a standalone function in `chainUtils.ts`, used by both `currentNotes` and the new connector memo.
2. **`connectorsAndNextNotes` memo** — `useMemo` in `PipelineBuilder.tsx` that iterates `chain` pairwise, calls `connectSequences({ prev, next })`, returns `Array<{ connector, nextNotes, strategy }>`. Should run regardless of toggle state (cheap; avoids stale data on enable); only the flatten branches and codeGen branch on the toggle.
3. **Connector data to `ConnectorSlot`** — pass `connectorsAndNextNotes[i-1].connector` into the slot. The `ChainEntry.connector` field already exists; we can populate it on a derived view of the chain or pass via a parallel array. (Open question O-1 below.)
4. **Bridge-aware `selectedNotes` flatten** — when toggle is on, use the spec §4.3 pattern: `chain[0].notes`, then for each `i ≥ 1` push `connectorsAndNextNotes[i-1].connector` and `connectorsAndNextNotes[i-1].nextNotes` in place of `chain[i].notes`. When off, leave `chain.flatMap((e) => e.notes)` unchanged.
5. **codeGen emits `connectSequences()`** — when toggle is on, extend `emitSegment` to return `scaleVar`, emit `motif{suffix}` unconditionally, insert `connectSequences(...)` between segments, and assemble the final `chain` from `notes1 + connector2 + nextNotes2 + …`. Add `connectSequences` to the tonal import set.
6. **Bridge toggle in `ChainSection` header** — `<label>` + `<input type="checkbox">` modeled on `SequenceStep.tsx:56–65`. State owned by `PipelineBuilder` (default `false`); passed to `ChainSection` as `bridgeEnabled` + `onBridgeChange`; also passed into `CodeGenInput` so `CodePreview` matches.

**Out of scope:**

- Cross-tuning bridging (spec §5: caller's problem).
- Cross-key / cross-scale chaining (spec §1 non-goal).
- AlphaTeX bar-alignment / snap-to-bar (spec §1 non-goal; bars re-flow).
- Rhythm-aware connector duration.
- AlphaTab playback component changes beyond what `selectedNotes` already drives.
- `ConnectorStrategy` display in the slot beyond the existing note count.
- Per-entry / mixed-tuning rendering in codeGen.
- `applySequence` integration (lab does not use `applySequence` today).
- Adding test infrastructure to `site/` (none exists today — verification is manual).

**Adjacent features (separate efforts):**

- `ConnectorSlot` preview panel (mini-fretboard or note-name preview) — spec §8 hints at "eventually a preview"; current work shows count only.
- Beat-alignment / snap-to-bar for connector notes.
- Strategy display ("extend" / "reach-back" / "none") in the slot for educational transparency.
- GitHub Pages deploy (Task 8.4 — quality improves post-connector but deploy itself is independent).

---

## Risks & Dependencies

| Risk / Dependency | Severity | Mitigation |
| ----------------- | -------- | ---------- |
| `ChainEntry` has no `scale` field; the connector memo must rebuild scales from `recipe` on every chain change. | Low | `rebuildScale(recipe)` is pure and memoizable; cost is comparable to one `buildFrettedScale` call per entry. Keep the memo dependency array on `chain` only. |
| `emitSegment` currently returns `{ lines, notesVar }`; it must be extended to expose `scaleVar` (and always emit a `motif{suffix}` var) to support `connectSequences()` emission. | Low | Internal API only; the return type change is local to `codeGen.ts`. |
| Toggle state needs to flow to TWO consumers: `ChainSection` (UI) and `CodeGenInput` (codeGen). Not a purely local concern of `ChainSection`. | Low | State lives in `PipelineBuilder`; both pathways already exist (props for `ChainSection`, `CodeGenInput` for `CodePreview`). Add one field to `CodeGenInput`. |
| `selectedNotes` length changes when bridge is on — the "7. Output" `StepCard` subtitle (`PipelineBuilder.tsx:432`) shows a different number. | Low | Expected; the count change reflects real musical content. No code change needed. |
| Base branch `feat/connector-algorithm` (PR #4) has not merged to `main`. Rebase will be required before merging this feature. | Medium | Standard rebase; planned per FEATURE.md context. Until then, develop and verify against the `feat/connector-algorithm` base. |
| Site has no test infrastructure; verification of the lab integration is entirely manual. Library-side `connectSequences` is already covered by `src/connect.test.ts`. | Medium | Document a manual verification script in the spec (e.g., "chain `E Shape · Thirds ↑` then `D Shape · Thirds ↓`, toggle bridge on, expect non-empty `ConnectorSlot` and `connectSequences(...)` in code preview"). Adding `site/` test infrastructure is a separate, larger effort. |
| Connector memo running even when bridge is off costs a `rebuildScale + connectSequences` call per pair on every chain change. | Low | Acceptable for typical chain sizes (≤ 5 entries). If problematic, gate the memo on `bridgeEnabled` and accept a one-frame stale state when toggling on. (Open question O-2 below.) |

## Open Questions

- **O-1.** Should the connector be stored on `ChainEntry.connector` (mutating chain entries on every recompute) or kept as a parallel `connectorsAndNextNotes` array passed to `ChainSection` alongside `chain`? The codebase research recommends the parallel array to avoid re-creating frozen entries on every recompute; needs user confirmation in shaping.
- **O-2.** Should `connectorsAndNextNotes` run unconditionally (always-fresh) or gate on `bridgeEnabled` (cheaper)? Trade-off: snappiness on toggle-on vs. wasted work when off.
- **O-3.** Header toggle copy + placement: label text ("Bridge", "Bridge shapes", "Continuous arc"?), position in the header row, and whether it appears only when `chain.length ≥ 2` (no seams = no relevance) or always (discoverability).
- **O-4.** Should `ConnectorSlot` display strategy in addition to count (e.g., `"connector · 2 notes (extend)"`)? Currently flagged out-of-scope but it's a cheap addition.
- **O-5.** Manual verification scenarios — which specific chains should the spec list as "must-verify" cases? Candidates: `E↑ → D↓` (extend), `E↓ → A↑` (reach-back), same-direction with bridge on (expect empty connector), single-entry chain with bridge on (no seams, no change).
- **O-6.** `codeGen` when bridge is on but the chain has only one entry: emit unchanged, or still wrap in a `connectSequences`-aware shape? Probably emit unchanged (no seams).
