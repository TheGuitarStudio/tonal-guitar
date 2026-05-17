# Research — Connector algorithm

**Phase:** 1 (Research) | **Loop:** 1 | **Date:** 2026-05-16

Source-of-truth probe in `scratch/connector-probe.mjs` (output captured below).
Built against the library's current `dist/` (`npm run build` produced before
the probe).

---

## 1. Primitives inventory

What's already in the library, and how it maps to the connector problem.

### `buildFrettedScale(shape, root, tuning, opts)` — `src/build.ts:160`

Resolves a `ScaleShape` against a root + tuning into a `FrettedScale` with
`notes: FrettedNote[]`. Each `FrettedNote` carries `string`, `fret`, `note`
(with octave), `pc`, `interval`, `scaleIndex`, `degree`, `intervalNumber`, `midi`.

Connector consumes `FrettedScale`s directly — the four MVP cases assume both
entries' scales are already built and chained as `ChainEntry.notes`.

### `walkShape(scale, opts)` — `src/walker.ts:22`

Returns every note in the scale sorted by midi (asc or desc). Useful as a
**linear-walk bridge generator** when the connector wants to play diatonic
passing notes rather than the prev/next motif.

### `walkShapeMotif(scale, motif, opts)` — `src/walker.ts:51`

The workhorse the lab already uses. Given a motif (e.g. `[1,3]` for thirds,
`[1,2,3,4]` for groups), walks the motif at every pitch position in the shape
in pitch order. Outputs `(scale.notes.length - motif.span) * motif.length` notes.

This is the function the connector wants to call against a **combined**
(prev + next) note set when implementing V1/V4 "extend through next" — see §3.

### `walkShapeIntervals(scale, intervalSize, opts)` — `src/walker.ts:82`

Thin wrapper. Not directly needed.

### `walkPattern(scale, pattern, opts)` — `src/walker.ts:103`

Walks a fully-expanded degree sequence (e.g. `ASCENDING_THIRDS = [1,3,2,4,…]`)
through the scale by picking the nearest matching degree to lastMidi, with auto
direction inference. Lower-level than `walkShapeMotif`. Probably **not** the
primitive the connector should call — `walkShapeMotif` over a combined scale
is closer to what the V1/V4 "extend the pattern" rule wants.

### `applySequence(scale, sequence, opts)` — `src/sequence.ts:26`

Builds multi-pass sequences with `incremental`, `boundToShape`, `startDegree`,
`passes`. Currently the lab does NOT use this — it goes through `walkShapeMotif`
or `walkPattern` directly. Not on the connector's critical path.

### `findFretInPosition` / `findNearestFret` / `findNote` — `src/fretboard.ts:82,56,126`

Position-aware pitch-class → fret lookups. The connector may need these if it
wants to re-pick frets for bridge notes that exist in both shapes, but in
practice the bridge notes come from `prev.notes ∪ next.notes` which already
carry concrete `(string, fret)` data. No re-picking needed for the MVP.

### Public surface — `src/index.ts:1`

All of the above are exported. No new exports are required to *use* the
primitives; only the new `connectSequences` function (or `buildChain`,
see §5 API options) needs to be added.

---

## 2. CAGED shape geometry — concrete data

Probe output for **A major** in each CAGED shape using `STANDARD` tuning:

| Shape   | Frets   | MIDI range | Notes |
|---------|---------|------------|-------|
| G Shape | 1–5     | 42–69      | 17    |
| E Shape | 4–7     | 44–71      | 17    |
| D Shape | 6–10    | 47–74      | 17    |
| C Shape | 9–12    | 49–76      | 17    |
| A Shape | 11–15   | 52–78      | 16    |

**Pitch-order:** for A major, low → high = G, E, D, C, A. (Same order as the
CAGED cycle comment in `data/caged-scales.ts`.) Each next shape extends ~3
semitones higher at both ends, with ~22 semitones of overlap.

### Position-exact overlap between adjacent shapes

```
G ∩ E:  G#2 A2 C#3 D3 F#3 B3 E4 G#4 A4    (9 positions)
E ∩ D:  B2 E3 G#3 A3 C#4 D4 F#4 B4        (8 positions)
D ∩ C:  C#3 D3 F#3 B3 E4 G#4 A4 C#5 D5    (9 positions)
C ∩ A:  E3 G#3 A3 C#4 D4 F#4 B4 E5        (8 positions)
```

**Conclusion:** "Neighboring" CAGED shapes for a given key share 8–9 fretted
positions outright (same string, same fret). Detection rule is trivial:
order all shapes by their lowest midi, then two shapes are neighbors iff
they are consecutive in that ordering. **The raw idea's CAGED-cycle
adjacency assumption holds for any key, not just A major** — the cycle is
fixed by the shape geometry, only the absolute fret window shifts.

### What "neighboring" means for the function signature

The connector doesn't need to ask the caller for neighbor metadata. Given
`prev: FrettedScale` and `next: FrettedScale`, it can determine:
- **Direction-of-pitch** of `next` relative to `prev`: compare midi ranges.
- **Overlap region:** `prev.notes ∩ next.notes` keyed by `(string, fret)`.
- **Bridge region:** the gap between prev's last played note and next's
  expected entry point.

This pushes shape-adjacency knowledge out of the API — the function works
on any two `FrettedScale`s, including non-CAGED systems (3NPS, pentatonic,
custom) as long as their `notes` arrays overlap. Non-overlapping shapes
fall under the "no-overlap fallback" open question (still out of scope for
MVP, but the signature is forward-compatible).

---

## 3. V1–V4 validation against concrete data

The raw idea's V1–V4 labels conflate "shape position in CAGED cycle" with
"shape position in pitch". They don't always agree — e.g. for A major, the
"A Shape" sits at the **highest** frets, not the lowest. To avoid confusion,
**research.md re-frames the four cases by pitch**:

- **Case H+** — `next` covers a HIGHER pitch range than `prev`.
- **Case H-** — `next` covers a LOWER pitch range than `prev`.

Cross-product with direction gives:

| Old | Direction      | next pitch | Bridge style    |
|-----|----------------|------------|-----------------|
| V1  | asc → desc     | H+         | Extend + flip   |
| V2  | asc → desc     | H-         | Reach back      |
| V3  | desc → asc     | H+         | Reach back      |
| V4  | desc → asc     | H-         | Extend + flip   |

For each case, probe scenario uses **A major**, motif `[1,3]` (thirds),
prev = E Shape; next = D Shape (H+) or G Shape (H-).

### V1: E Shape asc thirds → D Shape desc thirds (next is higher)

```
prev asc thirds ends at:  B4  (midi 71)
next desc thirds starts:  D5  (midi 74)
Gap:                      +3 semitones (perfect 5th of A → 6th)
```

Combined-shape notes between `prevHighest=71` and `nextHighest=74`:
**C#5 (s5f9), D5 (s5f10)**.

Three plausible bridge interpretations (need to pick one):

- **Linear** — emit every diatonic note in the gap, regardless of motif:
  bridge = `[C#5, D5]`, then next desc plays naturally from D5. (D5 is
  duplicated unless we drop the head of next.)
- **Extend motif** — continue thirds asc from B4 using the combined scale.
  Motif `[1,3]` at the "B4 position" emits pairs `(2,4)=B-D, (3,5)=C#-E`.
  But E5 is outside both shapes, so the second pair fails. Bridge collapses
  to **`[D5]`** (a single 3rd above the prev seam), then next desc plays from D5.
- **Extend + scale tail** — extend the motif through one iteration into next,
  then walk linear up to next's top: `[D5]` (already at top). Same as
  Extend motif in this case.

**Recommendation for MVP:** **Linear bridge** (option A). Reasons:
1. Predictable across all motifs — a third-walker and a 1234-walker produce
   the same bridge given the same shapes.
2. Sounds musical — "scalar run between two motivic phrases" is the standard
   guitarist move.
3. Easy stop condition — "walk linear up to next's highest note", no motif
   evaluation needed.
4. Avoids the duplication problem (just drop the head of next if it
   matches the bridge tail).

The Extend-motif option preserves the texture but is harder to define
(when does the motif "fail"?) and produces bridges that sometimes
collapse to a single note.

### V2: E Shape asc thirds → G Shape desc thirds (next is lower)

```
prev asc thirds ends at:  B4  (midi 71)
next desc thirds starts:  A4  (midi 69)   ← already in prev's territory
Gap:                      -2 semitones — natural seam moves backward
```

Natural transition is **unmusical**: ascending phrase ends at B4, then desc
restarts 2 semitones below at A4. The raw-idea "reach back" rule rewrites:
the next desc should **start from a higher note** to make the desc feel like
a true continuation.

Probe shows that G Shape's highest note is A4 (midi 69) — there is no G-Shape
note above B4. So "reach back into prev's territory" can mean one of:

- **Pivot at prev's last** — re-issue B4 as the first note of the desc leg,
  then walk desc through the combined scale starting from B4. Bridge = `[]`,
  next's notes get replaced with a re-walked desc-thirds over combined(E+G)
  starting at B4.
- **Pivot at next's highest** — start desc at A4 (= next's natural start).
  But this is just the natural seam — no improvement.

Concrete combined-shape desc-thirds at B4 (compute on demand) is the right
behavior. The bridge is conceptually empty; the connector's effect is to
**re-derive next.notes** using the combined-shape scale rather than next
alone.

### V3: E Shape desc thirds → D Shape asc thirds (next is higher)

```
prev desc thirds ends at:  G#2  (midi 44)
next asc thirds starts:    B2   (midi 47)   ← +3 semitones — natural jump up
```

Mirror of V2. Next asc should start lower so the asc feels like a continuation.
But D Shape's lowest note is B2 — no D-Shape note below G#2. Same resolution:
**re-walk next's asc over combined(E+D), starting from G#2**.

### V4: E Shape desc thirds → G Shape asc thirds (next is lower)

```
prev desc thirds ends at:  G#2  (midi 44)
next asc thirds starts:    F#2  (midi 42)   ← already in next's territory
```

Mirror of V1. Bridge candidates between (next's bottom, prev's bottom):
**`[F#2 (s0f2)]`**. Then next asc plays naturally from F#2.

Note: next's natural first note (F#2) coincides with the bridge's tail, so —
as in V1 — drop the head of next or treat the bridge as next's true first
emission.

### Unified algorithm summary

| Case | Direction      | next pitch | Bridge composition                                    | next.notes override  |
|------|----------------|------------|-------------------------------------------------------|----------------------|
| H+   | asc → desc     | higher     | linear notes from prev's last (exclusive) → next's top | drop head if dup     |
| H+   | desc → asc     | higher     | none                                                  | re-walk asc on combined, start at prev's bottom |
| H-   | asc → desc     | lower      | none                                                  | re-walk desc on combined, start at prev's top   |
| H-   | desc → asc     | lower      | linear notes from prev's last (exclusive) → next's bottom (desc) | drop head if dup     |

Two patterns: **extend** (asc→higher-then-desc; desc→lower-then-asc) and
**reach-back** (the other two). The function decides based on prev's
last-note direction and next's pitch range.

### Same-direction chains

Raw idea claims same-direction chains (asc→asc or desc→desc) don't need a
bridge. **Probe confirms partially**: E asc ends at B4 (71), D asc starts at
B2 (47) — that's a *24-semitone drop* before re-ascending. That's musically
jarring. Recommended treatment:

- For same-direction H+ (asc → asc, higher): walk linear from prev's last UP
  to next's start. Bridge bridges the gap; otherwise the listener hears a
  cliff drop.
- For same-direction H- (asc → asc, lower) and similar: same logic, walk
  linear in the direction of motion through the combined scale.

**MVP scope decision:** include same-direction bridging as a default-on
option. It's the same linear-walk machinery, costs nothing extra to
implement, and avoids the "no bridge = jump cut" trap.

---

## 4. AlphaTeX rhythm integration

`src/output/alphatex.ts` is the only renderer to consider. Its model:

- All notes get the same `duration` (default 8 = eighth note), or per-note
  durations via `noteDurations[]` / `rhythmPattern[]`.
- Bars are filled with exactly `notesPerBar` notes (default 8) and broken with
  `|`. There is no concept of bar boundaries tied to musical phrases — bars
  are purely a function of note count.

**Implication for connectors:** As long as the connector returns plain
`FrettedNote[]` and the lab concatenates them with the previous entry's
notes, AlphaTeX rendering Just Works. The connector becomes a few extra
notes in the stream; bars re-flow accordingly.

**The "rhythm" open question is therefore not a blocker for MVP.** Two
follow-up considerations for the Shape phase:

- **Default duration for connector notes**: if the user has a beat-aligned
  exercise (e.g. 8 notes per bar of thirds), the connector's extra notes
  push the next entry off the downbeat. May want a "snap-to-bar" flag that
  pads the connector to fill the seam bar exactly. Punt to post-MVP.
- **Per-segment duration override**: out of scope. Current alphatex doesn't
  support per-segment defaults, so connector notes just inherit the global
  default.

**Recommendation:** No alphatex changes required for MVP. Document the
beat-alignment caveat in the function's JSDoc.

---

## 5. Lab integration surface

Tracing how `ChainEntry` flows in `site/app/experiments/components/`:

1. `PipelineBuilder.tsx:288` (`addToChain`) snapshots `currentNotes` + `currentRecipe`
   into a `ChainEntry` and pushes it onto `chain`.
2. `PipelineBuilder.tsx:209` (`selectedNotes` memo) for `selection.kind === "chain"`
   does `chain.flatMap((e) => e.notes)` — **does NOT include `e.connector`**.
3. `ChainSection.tsx:110` renders `<ConnectorSlot connector={e.connector} />`
   between entries, which only displays metadata; the connector notes never
   reach playback.

**Lab work required:**

- Compute `connector` for each entry when the chain changes (a `useMemo` over
  `chain`).
- Update the `selectedNotes` flat-map to interleave `connector` before each
  entry's `notes`.
- `codeGen.ts:177` (`generateCode` chain branch) needs to emit
  `connectSequences(...)` calls between segments. Each emitted segment
  becomes `[...connectorN, ...notesN]`.

None of this is blocking for the library work — the library function can
ship alone and the lab can pick it up in a follow-up commit.

---

## 6. Recommended API shape (input for §7 open questions)

```ts
export interface ConnectorOptions {
  /** Force a bridge style; otherwise inferred from direction + pitch ordering. */
  strategy?: "auto" | "linear" | "motif-extend" | "reach-back";
  /** Motif used by the previous and next entries. Defaults to [1] (linear). */
  motif?: number[];
  /** True (default): drop next's head if it duplicates the connector's tail. */
  dedupSeam?: boolean;
  /** True (default): also bridge same-direction chains (asc→asc / desc→desc). */
  bridgeSameDirection?: boolean;
}

export interface ConnectorResult {
  /** Notes to play between prev's last and next's first. May be empty. */
  connector: FrettedNote[];
  /** If non-null, replaces next's notes (reach-back case). */
  nextOverride: FrettedNote[] | null;
}

export function connectSequences(
  prev: { scale: FrettedScale; notes: FrettedNote[]; direction: "asc" | "desc" },
  next: { scale: FrettedScale; notes: FrettedNote[]; direction: "asc" | "desc" },
  options?: ConnectorOptions,
): ConnectorResult;
```

Key points:
- Takes **scale + notes + direction** for each entry (the chain currently only
  carries `notes`, but direction is in `ChainEntry.recipe.direction` and
  `scale` can be rebuilt from `recipe`).
- Returns both `connector` (the bridge) and `nextOverride` (for reach-back).
  This handles all four cases with one signature.
- `strategy: "auto"` is the only MVP-required value; the others are forward
  hooks for the post-MVP cases ("no-overlap fallback", "extend motif" variant).

Alternative considered: **`buildChain(entries)` higher-level builder** that
returns the flat note list directly. Cleaner external API, but couples the
library to the lab's `ChainEntry` shape and hides the connector function from
direct testing. **Recommend keeping `connectSequences` low-level and letting
the lab compose `buildChain` itself if needed.**

---

## 7. Refined open questions (input for Phase 2 Shape)

1. **Bridge style for V1/V4 (extend cases) — linear vs. motif-extend?**
   Research recommends linear; needs explicit sign-off in spec.

2. **Override semantics for V2/V3 (reach-back cases) — return `nextOverride` or
   leave it to the caller to re-walk?** Research recommends `nextOverride` for
   one-call simplicity; caller can ignore it if they want manual control.

3. **Same-direction bridging — default on or off?** Research recommends on,
   because the alternative (24-semitone jump cuts) is musically worse than
   the cost of a few extra scalar notes.

4. **Direction inference — derive from `prev.notes` (compare last two midis) or
   require it as input?** Recommend taking it as input — the lab already tracks
   `recipe.direction`, and inference is fragile for short motifs.

5. **Different motifs across entries — what happens?** Probably: use the prev
   entry's motif for the extend case (it's continuing prev's gesture), use
   next entry's motif for the reach-back case (it's continuing next's
   reseeded gesture). Spec phase should pin this down.

6. **No-overlap fallback** — out of MVP, signature is forward-compatible
   (strategy enum extensible).

7. **AlphaTeX bar alignment** — out of MVP, document caveat in JSDoc.

8. **Empty / degenerate inputs** — define behavior for `prev.notes = []` or
   `next.notes = []` (probably return `{ connector: [], nextOverride: null }`).

---

## 8. Suggested test scenarios (for Phase 3 Plan)

Concrete cases the implementation must cover, all in A major, motif `[1,3]`,
STANDARD tuning:

| #  | prev          | next          | dir       | Expected bridge        |
|----|---------------|---------------|-----------|------------------------|
| 1  | E Shape asc   | D Shape desc  | asc→desc  | `[C#5, D5]` then drop head of D-desc |
| 2  | E Shape asc   | G Shape desc  | asc→desc  | `[]`, override G with desc-from-B4   |
| 3  | E Shape desc  | D Shape asc   | desc→asc  | `[]`, override D with asc-from-G#2   |
| 4  | E Shape desc  | G Shape asc   | desc→asc  | `[F#2]` then drop head of G-asc      |
| 5  | E Shape asc   | D Shape asc   | asc→asc   | linear ramp B4 → D-asc start         |
| 6  | E Shape desc  | G Shape desc  | desc→desc | linear ramp G#2 → G-desc start       |
| 7  | E Shape asc   | E Shape desc  | asc→desc  | identical shapes — bridge = `[]`     |
| 8  | empty prev    | anything      | n/a       | `{connector:[], nextOverride:null}`  |
| 9  | 3NPS Pat 1    | 3NPS Pat 2    | asc→desc  | linear bridge (non-CAGED works)      |
| 10 | A maj E shape | E minor pent  | asc→desc  | different scales — define behavior or reject |

Cases #1, #4, #5, #6 are the user-facing happy paths.
Cases #2, #3 exercise the `nextOverride` machinery.
Case #10 is the cross-key edge case — probably out of scope for MVP, spec
should explicitly reject or fall through.

---

## 9. Phase 1 outcome

- Algorithm is well-defined for the four MVP cases; unified by re-framing
  in pitch terms rather than CAGED-cycle position.
- Existing primitives (`walkShape`, `walkShapeMotif`, `FrettedScale`) cover
  100% of what the connector needs — no new library plumbing required.
- AlphaTeX and lab integration are non-blocking; library function can ship
  alone.
- Concrete test scenarios identified, all reproducible from `dist/`.
- One open question (bridge style — linear vs. motif-extend) needs an
  explicit pick in Phase 2 Shape.

**Recommend graduating to Phase 2.**

---

## Appendix — Probe output

Full output of `node scratch/connector-probe.mjs` (truncated to relevant lines).
Re-run after any geometry changes to verify the bridge candidate calculations.

```
G Shape     fret 1-5   midi 42-69   notes=17
E Shape     fret 4-7   midi 44-71   notes=17
D Shape     fret 6-10  midi 47-74   notes=17
C Shape     fret 9-12  midi 49-76   notes=17
A Shape     fret 11-15 midi 52-78   notes=16

V1 (E asc → D desc): bridge = [C#5(s5f9), D5(s5f10)]
V2 (E asc → G desc): prev ends B4(71), G-desc nat A4(69) — gap −2
V3 (E desc → D asc): prev ends G#2(44), D-asc nat B2(47) — gap +3
V4 (E desc → G asc): bridge = [F#2(s0f2)]
```
