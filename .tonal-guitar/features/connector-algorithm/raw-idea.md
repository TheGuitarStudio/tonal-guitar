## Problem

Today, chaining two sequences in the lab produces an abrupt seam: shape A's pattern ends, shape B's pattern begins, and any natural musical continuation through the overlap region between the two CAGED shapes is lost. The library's whole purpose is to auto-generate exercises, so a chained exercise that doesn't connect musically is a half-built feature. UI scaffolding (`ChainEntry.connector`, `ConnectorSlot` placeholder) already exists in `site/app/experiments/components/ChainSection.tsx`.

## Proposed Solution

Add a `connectSequences(prev, next, options)` function to the library that returns the bridge `FrettedNote[]` between two chained entries. The connector continues the active sequence pattern (linear, thirds, fourths, etc.) across the seam by treating the two shapes' notes as a single combined diatonic note set in the parent key. For MVP, focus on neighboring same-key CAGED shapes; the four directional cases each produce a slightly different bridge.

## Algorithm — the four MVP cases

Let "higher shape" mean further toward the bridge (higher pitch); "lower shape" toward the nut.

| Case | Previous | Next | Bridge rule |
|------|----------|------|-------------|
| V1 | Ascend G | Descend a **higher** shape (e.g. E) | Extend ascending pattern through the next shape's notes up to its **highest** note, then begin descending the next shape |
| V2 | Ascend G | Descend a **lower** shape (e.g. A) | Start the next descending pattern from the **highest** note of the **previous** shape (reach back into prev's territory) |
| V3 | Descend G | Ascend a **higher** shape (e.g. E) | Start the next ascending pattern from the **lowest** note of the **previous** shape (reach back into prev's territory) |
| V4 | Descend G | Ascend a **lower** shape (e.g. A) | Extend descending pattern through the next shape's notes down to its **lowest** note, then begin ascending the next shape |

Two underlying patterns: **extend-then-flip** (V1, V4) and **reach-back** (V2, V3). Same-direction chains (asc→asc, desc→desc) don't require a bridge.

## User Stories

- As a guitar student, I want chained CAGED-shape exercises to flow musically across positions so the bridge sounds like a real lick instead of a jump cut.
- As an exercise creator, I want `tonal-guitar` to auto-generate connected sequences so I can export tab/AlphaTeX of multi-position runs without hand-stitching them.
- As a developer using the library, I want a pure `connectSequences()` function with the same `SequenceOptions` vocabulary so connector logic is testable and reusable outside the lab.

## Context

- **Roadmap alignment:** Core to the library's stated purpose ("auto-creating exercises"). Unblocks the placeholder `ConnectorSlot` in the lab.
- **Existing infrastructure:** `ChainEntry.connector?: FrettedNote[]` already wired through the lab. Library primitives ready: `walkShape`, `walkShapeMotif`, `walkShapeIntervals`, `walkPattern` (`src/walker.ts`); `applySequence` (`src/sequence.ts`); `findFretInPosition`, `findNearestFret`, `findNote` (`src/fretboard.ts`). Shape data has `intervals` per string from which overlap can be derived.
- **Related features:** None graduated yet.

## Open Questions

- **Same-direction across different shapes** — asc→asc or desc→desc between non-identical shapes: bridge needed or natural? Current thinking says natural; verify with concrete examples.
- **No-overlap fallback** — when shapes don't share notes on the seam string (non-neighboring shapes, key changes), the user proposed walking the scale up/down to the next shape. Out of scope for MVP, but design the function signature so it's a future strategy, not a rewrite.
- **Stop condition for "extend"** — V1/V4 extend the pattern through the next shape's notes. Does it stop at the highest/lowest note in the next shape, or at the first note that matches the next sequence's natural starting note? Pick one and test against real examples.
- **Rhythm / AlphaTeX export** — do connector notes consume time within the seam bar, prepend to bar N+1, or live in their own bar? Affects the `output/alphatex.ts` formatter.
- **API shape** — single `connectSequences(prev, next, opts)` returning notes? Or a `ChainOptions` plumbed through a higher-level `buildChain(entries)` builder?
- **Configurability** — does the lab expose strategy choice (extend vs reach-back is implied by the V1–V4 mapping, so probably not user-facing) or is it fully automatic given prev/next direction + shape ordering?

## Rough Assessment

- **Size:** M — the algorithm itself is well-defined for the four cases, but stop-condition tuning, rhythm/AlphaTeX integration, and shape-overlap detection across CAGED positions need careful design. Expect 1–2 weeks of focused work plus tests.
- **Priority:** P1 — directly serves the library's exercise-generation thesis; the lab UI is already half-wired for it.
- **Depends on:** None. All required library primitives exist.

## Next step

Open questions above need to be explored before implementation begins — particularly stop-condition tuning and the rhythm/AlphaTeX export model. Use `/idea --reflect` again to keep refining, or move to `/feature --from #N` when ready.

---

_Refined via `/idea --reflect` on 2026-05-16_
