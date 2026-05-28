# Spec — Connector algorithm

**Phase:** 2 (Shape) | **Loop:** 1 | **Date:** 2026-05-16
**Builds on:** [research.md](./research.md)

This spec is the contract Phase 3 (Plan) and Phase 4 (Implement) work
against. Anything not specified here is undefined behavior.

---

## 1. Goal & non-goals

**Goal.** Add a pure library function that, given two adjacent chain entries,
returns the bridge phrase that musically connects them across the seam, so
that the lab's `ConnectorSlot` placeholder can be filled and exercises chained
across CAGED (or any compatible) shapes play as one continuous run.

**Non-goals (out of MVP scope).**

- Cross-key / cross-scale chaining (e.g. A major → E minor pent). Function may
  emit garbage or empty in this case; not promised.
- Rhythm-aware bar alignment (snap connector to fill the seam bar). The
  connector adds notes; AlphaTeX re-flows bars automatically — that's enough.
- "No-overlap fallback" (connecting non-neighboring shapes via scale walks).
  Reserved for a future strategy enum value.
- Higher-level `buildChain(entries)` builder. The lab composes the per-pair
  function itself; the library stays single-purpose.

---

## 2. Resolved design decisions

| # | Question (from research §7)                                            | Decision                                  |
|---|------------------------------------------------------------------------|-------------------------------------------|
| 1 | Bridge style for extend cases — linear vs. motif-extend?              | **Linear** (diatonic scale walk)          |
| 2 | Reach-back: return override or leave to caller?                        | **Return `nextNotes` always**             |
| 3 | Same-direction chains — default-on bridging?                           | **No bridge** (beginner: restart fresh)   |
| 4 | Direction inference vs. require as input?                              | **Require as input**                      |
| 5 | Different motifs across entries?                                       | **Bridge is motif-agnostic** (linear); reach-back uses **next's** motif |
| 6 | No-overlap fallback (non-neighboring shapes)?                          | **Out of MVP** (strategy enum reserved)   |
| 7 | AlphaTeX bar alignment for connector notes?                            | **Out of MVP** (document caveat in JSDoc) |
| 8 | Empty / degenerate inputs?                                             | **Return `{ connector: [], nextNotes: walkedNext, strategy: "none" }`** |

**Rationale for #3 (per user, 2026-05-16):** Same-direction chains express
"do the exercise again in another position" — a beginner repetition. Adding
a bridge would muddle the restart. Bridging is reserved for the
intermediate use case where the student ascends one shape and descends
another to create a continuous melodic arc.

---

## 3. Strategy taxonomy

The function classifies the transition into one of three strategies based on
two signals: **direction pair** (prev → next) and **next's pitch position
relative to prev**.

### 3.1 Direction-pair × pitch-position truth table

`prev.direction → next.direction`, with `nextSide ∈ {higher, lower, same}`
where "higher" means `next.scale` covers higher pitches than `prev.scale`,
"lower" the opposite, and "same" means significant overlap with no clear
ordering (e.g. identical shape).

|       | next higher | next lower | next same  |
|-------|-------------|------------|------------|
| asc → asc   | none  | none  | none  |
| desc → desc | none  | none  | none  |
| asc → desc  | **extend**    | **reach-back** | reach-back |
| desc → asc  | **reach-back** | **extend**     | reach-back |

### 3.2 `nextSide` resolution

```
nextSide(prev, next):
  prevTop    = max(prev.scale.notes[*].midi)
  prevBottom = min(prev.scale.notes[*].midi)
  nextTop    = max(next.scale.notes[*].midi)
  nextBottom = min(next.scale.notes[*].midi)

  if nextTop    > prevTop    AND nextBottom > prevBottom  → "higher"
  if nextTop    < prevTop    AND nextBottom < prevBottom  → "lower"
  otherwise                                               → "same"
```

The conjunction guards against pathological overlaps where one shape strictly
contains the other (treated as "same" since neither end is clearly ahead).

### 3.3 Strategy semantics

> **Superseded 2026-05-28 by the same-string bridge model** (see
> `../connector-lab-integration/decisions.md` and the
> `refactor(connect): same-string bridge model` commit on `feat/connector-lab-integration`).
>
> Both `extend` and `reach-back` now build the connector by walking only the
> notes on `prev.lastNote.string` from the combined prev∪next scale, in the
> direction that reaches next's natural starting pitch. `nextNotes` is the
> unmodified natural walk of `next.scale`, with an overlap dedup that drops
> the first pair when it duplicates the bridge's final pair note-for-note.
> The original MVP semantics below are kept as historical context.

#### `none`

```
connector = []
nextNotes = walkShapeMotif(next.scale, next.motif, { direction: next.direction })
```

Caller plays `prev.notes` then `nextNotes` back-to-back with no insertion.
This is the same-direction "beginner restart" behavior and the fallback for
all degenerate inputs.

#### `extend`

```
seam     = prev.lastNote.midi
target   = (prev.direction == "ascending") ? nextTop : nextBottom
combined = sort(prev.scale.notes ∪ next.scale.notes by midi)

connector =
  if prev.direction == "ascending":
    combined.filter(n => n.midi >  seam AND n.midi <= target)
            .sortedAscending()
  else:
    combined.filter(n => n.midi <  seam AND n.midi >= target)
            .sortedDescending()

nextNotes = walkShapeMotif(next.scale, next.motif, { direction: next.direction })

if dedupSeam (default true) AND nextNotes[0] EXISTS AND
   nextNotes[0].midi == connector.at(-1).midi AND
   nextNotes[0].string == connector.at(-1).string AND
   nextNotes[0].fret == connector.at(-1).fret:
  nextNotes = nextNotes.slice(1)
```

Key points:

- **Connector is linear**, motif-agnostic. The seam-walking diatonic notes
  form a "scalar pickup" into the next phrase regardless of either entry's
  motif.
- **Connector excludes `prev.lastNote` (strict `>` / `<`)** — prev already
  emitted that pitch.
- **Connector includes `target`** (next's extreme). This is the pivot — the
  highest/lowest note of the combined range.
- **`dedupSeam`** drops the first note of `nextNotes` if it duplicates the
  connector's last note (same physical position). For V1 (asc→desc-higher),
  next-desc naturally starts at `nextTop`, which is also the connector's
  last note — so dedup removes the would-be double-hit.

#### `reach-back`

```
seamMidi = prev.lastNote.midi
combined = build a synthetic FrettedScale of (prev.scale.notes ∪ next.scale.notes),
           deduped by (string, fret), inheriting next.scale's root/scaleType
           metadata for walker compatibility.

walked = walkShapeMotif(combined, next.motif, { direction: next.direction })

// "Reach back" by trimming the walk to start at (or just past) seam, then
// continuing through next's territory. The exact slice point depends on
// direction:
//   ascending  → drop notes whose midi <  seamMidi
//   descending → drop notes whose midi >  seamMidi

connector = []
nextNotes = trim(walked, seamMidi, next.direction)

if dedupSeam (default true) AND nextNotes[0] EXISTS AND
   nextNotes[0] occupies the same (string, fret) as prev.lastNote:
  nextNotes = nextNotes.slice(1)
```

Key points:

- **No connector notes** — the bridge is implicit in `nextNotes` being
  re-walked over the combined scale starting at the seam pitch.
- **Combined-scale synthesis**: dedup by `(string, fret)` so the same
  physical position isn't double-counted. Sort by midi. Carry over
  `next.scale`'s root/scaleType for any downstream callers that read those
  fields (the walker itself only touches `notes`).
- **`scaleIndex` / `degree` fields** on combined notes retain whatever they
  had in their source scale. `walkShapeMotif` relies on midi ordering for
  motif emission — it doesn't re-derive degrees — so the existing fields
  carry through unmodified. (If we later add a motif walker that does use
  degree fields, the combined scale needs degree re-derivation.)

### 3.4 Worked examples (A major, motif `[1,3]`, STANDARD tuning)

These mirror research §8. **Expected values are committed contract** —
Phase 4 tests assert on them.

#### Scenario 1 — V1 extend (E asc → D desc, next higher)

```
prev.lastNote = B4   (s5f7, midi 71)
target        = nextTop = D5 (midi 74)

connector = [C#5 (s5f9), D5 (s5f10)]
nextNotes = walkShapeMotif(D Shape, [1,3], desc).slice(1)
          = [B4(s5f7), C#5(s5f9), A4(s4f10), …]     // D5 head dropped
strategy  = "extend"
```

#### Scenario 2 — V2 reach-back (E asc → G desc, next lower)

```
prev.lastNote = B4   (s5f7, midi 71)
combined      = sort(E ∪ G) by midi  (25 notes, midi 42-71)
walked        = walkShapeMotif(combined, [1,3], desc)  // starts at top of combined = B4
nextNotes     = walked (all of it — B4 is at the top)

if walked[0] == B4 (s5f7) → dedup → nextNotes = walked.slice(1)

strategy = "reach-back"
connector = []
```

#### Scenario 3 — V3 reach-back (E desc → D asc, next higher)

```
prev.lastNote = G#2  (s0f4, midi 44)
combined      = sort(E ∪ D) by midi  (26 notes, midi 44-74)
walked        = walkShapeMotif(combined, [1,3], asc)   // starts at bottom of combined = G#2
nextNotes     = walked

if walked[0] == G#2 (s0f4) → dedup → nextNotes = walked.slice(1)

strategy = "reach-back"
connector = []
```

#### Scenario 4 — V4 extend (E desc → G asc, next lower)

```
prev.lastNote = G#2  (s0f4, midi 44)
target        = nextBottom = F#2 (midi 42)

connector = [F#2 (s0f2)]
nextNotes = walkShapeMotif(G Shape, [1,3], asc).slice(1)
          = [A2(s0f5), G#2(s0f4), B2(s1f2), …]   // F#2 head dropped
strategy  = "extend"
```

#### Scenarios 5–6 — Same-direction (asc→asc, desc→desc)

```
strategy  = "none"
connector = []
nextNotes = walkShapeMotif(next.scale, next.motif, next.direction)  // untouched
```

#### Scenario 7 — Identical shape, asc → desc

```
nextSide = "same" (E ∩ E completely)
strategy = "reach-back"
combined = E.notes  (after dedup, identical to E)
walked   = walkShapeMotif(E, [1,3], desc)
nextNotes = walked.slice(1)  (B4 dedup'd)
connector = []
```

Effect: prev plays asc through E shape, ends at B4. Next plays desc through
E shape, starting at G#4 (skipping the duplicated B4). The exercise is a
clean "up-then-down through one shape".

#### Scenario 8 — Empty inputs

```
if prev.lastNote is null OR prev.scale.empty OR next.scale.empty:
  return { connector: [], nextNotes: [], strategy: "none" }
```

If `next.scale.empty` but the caller wants to honor an arbitrary
`next.motif` anyway, they should pre-walk and pass valid scales. The
function does not invent notes.

---

## 4. API contract

### 4.1 Types (added to `src/shape.ts` or a new `src/connect.ts`)

```ts
export type ChainDirection = "ascending" | "descending";

export interface ConnectSequencesInput {
  prev: {
    /** The full fretted scale the previous entry was walked over. */
    scale: FrettedScale;
    /** The actual last note prev emitted (time-order, not pitch-order). */
    lastNote: FrettedNote;
    /** Which way prev's motif was walked. */
    direction: ChainDirection;
  };
  next: {
    /** The full fretted scale the next entry will be walked over. */
    scale: FrettedScale;
    /** Motif used to walk next, e.g. [1] linear, [1,3] thirds, [1,2,3,4] groups. */
    motif: number[];
    /** Which way next's motif is being walked. */
    direction: ChainDirection;
  };
}

export interface ConnectorOptions {
  /**
   * Force a specific strategy. Default "auto" picks via §3.1 truth table.
   * "linear" / "motif-extend" are reserved for future variants and are
   * NOT implemented in MVP — passing them is equivalent to "auto".
   */
  strategy?: "auto" | "linear" | "motif-extend";
  /**
   * Drop next's first note when it duplicates the physical position of the
   * connector's last note (or, in reach-back, of prev's last note).
   * Default: true.
   */
  dedupSeam?: boolean;
}

export type ConnectorStrategy = "none" | "extend" | "reach-back";

export interface ConnectSequencesResult {
  /** Bridge notes to play between prev's last and next's first. May be empty. */
  connector: FrettedNote[];
  /**
   * Notes to play for the next entry, post-connector. In "none" this is the
   * natural walk of next; in "extend" it's the natural walk minus the dedup'd
   * head; in "reach-back" it's a re-walk over the combined scale starting at
   * prev's seam.
   */
  nextNotes: FrettedNote[];
  /** Strategy actually used (for debugging / lab UI display). */
  strategy: ConnectorStrategy;
}

export function connectSequences(
  input: ConnectSequencesInput,
  options?: ConnectorOptions,
): ConnectSequencesResult;
```

### 4.2 Public surface

Added to `src/index.ts` re-exports:

```ts
export { connectSequences } from "./connect";
export type {
  ChainDirection,
  ConnectSequencesInput,
  ConnectorOptions,
  ConnectorStrategy,
  ConnectSequencesResult,
} from "./connect";
```

### 4.3 Caller pattern (lab)

The lab composes per-pair:

```ts
// In PipelineBuilder, compute connectors when chain changes.
const connectorsAndNextNotes = useMemo(() => {
  const result: Array<{ connector: FrettedNote[]; nextNotes: FrettedNote[] }> = [];
  for (let i = 1; i < chain.length; i++) {
    const prevEntry = chain[i - 1];
    const nextEntry = chain[i];
    const r = connectSequences({
      prev: {
        scale: rebuildScale(prevEntry.recipe),
        lastNote: prevEntry.notes.at(-1)!,
        direction: prevEntry.recipe.direction,
      },
      next: {
        scale: rebuildScale(nextEntry.recipe),
        motif: nextEntry.recipe.motif,
        direction: nextEntry.recipe.direction,
      },
    });
    result.push(r);
  }
  return result;
}, [chain]);

// Flatten for "whole chain" playback selection:
const wholeChainNotes = useMemo(() => {
  if (chain.length === 0) return [];
  const out = [...chain[0].notes];
  for (let i = 1; i < chain.length; i++) {
    out.push(...connectorsAndNextNotes[i - 1].connector);
    out.push(...connectorsAndNextNotes[i - 1].nextNotes);
  }
  return out;
}, [chain, connectorsAndNextNotes]);
```

`rebuildScale(recipe)` is a tiny helper in the lab that re-runs
`buildFrettedScale(get(recipe.shapeName), buildRoot, tuning, ...)` from the
frozen recipe. This already exists implicitly in `currentNotes` derivation —
factor it out into `codeGen.ts` or a sibling util.

The `ChainEntry.connector` field is filled from
`connectorsAndNextNotes[i - 1].connector` so `ConnectorSlot` shows the
real count and (eventually) a preview.

---

## 5. Edge cases & error handling

| Case                                                        | Behavior                                                                 |
|-------------------------------------------------------------|--------------------------------------------------------------------------|
| `prev.scale.empty` or `next.scale.empty`                    | Return `{ connector: [], nextNotes: [], strategy: "none" }`              |
| `prev.lastNote` `midi` outside `prev.scale` range           | Trust the caller; use the supplied midi as the seam                      |
| `prev.scale` and `next.scale` use different tunings         | Function ignores tuning; walks notes purely by midi. May produce surprising bridge if tunings differ — caller's problem |
| `next.motif` empty                                          | Treat as `[1]` (linear); `nextNotes` becomes a plain scale walk          |
| Direction-pair flips but combined scale is empty            | `strategy: "none"`, `nextNotes` is empty                                 |
| `extend` target equals seam (already at top/bottom)         | `connector: []`, `dedupSeam` may still trim `nextNotes` head             |
| `reach-back` produces zero notes after trim                 | `nextNotes: []`. (Edge: prev's seam is far above next's range.)          |
| Cross-key / different scale roots                           | No special handling. Function walks midi, doesn't validate harmonic compatibility. |
| `options.strategy` ∈ `{"linear", "motif-extend"}`           | Treated as `"auto"` in MVP. Reserved for future expansion.               |

The function **never throws**. All error states resolve to a degenerate
return.

---

## 6. Test plan (input to Phase 3)

Tests live in `src/connect.test.ts` (new file). Vitest, no mocks — all
behavior is pure.

### 6.1 Strategy classification (table-driven)

For each row in the §3.1 truth table × pitch-side combination, assert
`result.strategy` matches expectation. 12 cases total (3 directions × 3
pitch sides + edge: identical shapes).

### 6.2 Worked-scenario fingerprints

Each of §3.4 scenarios 1–8 gets a test that asserts:

- `result.strategy`
- `result.connector.map(n => n.note)` — note name sequence
- `result.connector.map(n => [n.string, n.fret])` — fret positions
- `result.nextNotes.length` and `result.nextNotes[0]` — head check

Scenarios 1–4 are the V1–V4 happy paths. Scenarios 5–6 lock in "no bridge"
for same-direction. Scenario 7 covers identical shapes. Scenario 8 covers
empty input.

### 6.3 Dedup behavior

- `dedupSeam: true` (default) drops a duplicate head in extend.
- `dedupSeam: false` keeps it.
- Reach-back dedup against `prev.lastNote` (not connector tail).

### 6.4 Direction invariants

- Extend connector is strictly ascending when `prev.direction === "ascending"`,
  strictly descending otherwise.
- Reach-back `nextNotes` first note is at or past the seam in the matching
  direction.

### 6.5 Non-CAGED systems

One smoke test each:
- 3NPS Pattern 1 → 3NPS Pattern 2 (asc → desc, A major): should classify as
  extend or reach-back depending on midi ordering; bridge is non-empty.
- Pentatonic Box 1 → Box 2 (asc → desc, A minor pent): same.

These don't assert specific bridge contents (pattern data may evolve) — just
that the function doesn't crash and `strategy !== "none"`.

### 6.6 Empty / degenerate

- Empty prev scale → `{[], [], "none"}`.
- Empty next scale → `{[], [], "none"}`.
- Empty next motif → treated as `[1]`.

---

## 7. Implementation notes (input to Phase 3 Plan)

- **File:** new `src/connect.ts`. ~150 lines including the strategy
  classifier, the two walkers (extend, reach-back), the dedup helper, and
  the combined-scale synthesizer.
- **Dependencies:** `walker.walkShapeMotif`, `shape.FrettedScale`,
  `shape.FrettedNote`. No new tonal-js deps; midi-only logic.
- **Index hookup:** add re-exports per §4.2.
- **No data changes** to `src/data/*` (the function reads existing shape data
  via passed-in scales).
- **AlphaTeX:** no changes. Bars re-flow naturally.

**Estimated implementation time:** ~3 hours including tests, given research
already nailed down the algorithm.

---

## 8. Lab integration plan (separate, post-library)

Not part of the library task. Tracked as a follow-up:

- Factor `buildFrettedScale(get(name), root, tuning, opts)` out of
  `PipelineBuilder` into a helper used by both `currentNotes` and the new
  connector recompute.
- Add `connectorsAndNextNotes` memo (see §4.3).
- Wire `connector` into each `ChainEntry` so `ConnectorSlot` can display
  the real preview.
- Replace `chain.flatMap((e) => e.notes)` in the `selectedNotes` derivation
  with the chained-connector flatten.
- Update `codeGen.ts` to emit `connectSequences()` calls between segments.
- Add a "bridge" toggle to `ChainSection` (header switch) — off by default to
  preserve the current beginner-friendly restart behavior; on enables the
  intermediate continuous-arc behavior.

---

## 9. Phase 2 outcome

- All 8 research-open questions resolved with explicit decisions.
- Strategy taxonomy collapsed to 3 cases (`none` / `extend` / `reach-back`)
  with a deterministic classifier.
- Same-direction chains stay un-bridged per user direction (beginner restart
  semantics).
- API signature and edge-case behavior locked.
- 6 test categories defined with fingerprintable expected outputs for
  scenarios 1–8.

**Recommend graduating to Phase 3 (Plan).** Plan should produce the file
breakdown, test ordering, and any pre-flight library work (none expected).
