# Spec Review: Curated Extended Chord Shapes Import

## Summary

The feature is well scoped as additive TypeScript data plus tests. The `ChordShape` contract is correctly understood: interval-per-string rows, exact-string `chordType` registry queries, and build-time fret derivation through `applyChordShape` (`src/shape.ts:42-57`, `src/shape.ts:124-167`, `src/build.ts:253-283`). The Tonal-first naming direction is also the right default for this library.

I would approve the direction after tightening three things:

1. Correct the count and `aug7` normalization language.
2. Replace or fix the A-form 13 worked example.
3. Make the `identifyChord` acceptance tests resilient to omitted-tone partials that Tonal cannot detect as the full chord.

## Music-Theory / Domain Correctness

### Chord-Tone Sets

The listed full chord-tone sets in the spec are correct for the 15 canonical registered suffixes in the table (`spec.md:41-57`):

| `chordType` | Assessment |
| --- | --- |
| `6`, `m6` | Correct: major/minor triad plus `6M`. |
| `9`, `maj9`, `m9` | Correct: triad plus 7th plus `9M`. |
| `add9` | Correct: major triad plus `9M`, no 7th. |
| `13` | Correct for Tonal and common dominant 13 shorthand: `1P 3M 5P 7m 9M 13M`, omitting 11. |
| `dim7` | Correct: `1P 3m 5d 7d`. |
| `mMaj7` | Correct: `1P 3m 5P 7M`. |
| `7sus4` | Correct: `1P 4P 5P 7m`. |
| `6/9` | Correct: `1P 3M 5P 6M 9M`. |
| `7b9`, `7#9` | Correct dominant altered ninth formulas. |
| `7#5`, `7b5` | Correct altered fifth dominant seventh formulas. |

The only terminology issue is count. The spec says "16 `chordType`s" (`spec.md:36`) and "all 16 `chordType`s are present" (`spec.md:169`, `spec.md:215`), but the canonical registered set is 15 if `aug7` is intentionally not registered (`spec.md:59-62`, `decisions.md:100-106`). The research table includes `aug7` as a Tonal probe alias (`research.md:144-161`), not as a separate registry key. The spec should consistently say "15 canonical registered chordTypes, with `aug7` documented as an alias of `7#5`."

### Omission Policy

The omission policy is musically sound for this feature's constraints: drop the fifth first, then the ninth for `13`, and preserve root/third/seventh/characteristic extension (`spec.md:75-77`, `decisions.md:74-91`). That matches common shell/extension practice and keeps the chord identity queryable through `omittedIntervals`.

Two caveats:

- Some five-tone chords can still be represented as practical five-string grips, so the spec should not force partial voicings for every `9`/`maj9`/`m9`/`6/9` just because they have five tones. It currently labels them as "5 tones" and "partial grip" for `9` (`spec.md:45-53`), but a five-string voicing can be complete.
- The acceptance tests should validate that omitted tones follow the policy, but should not assume omitted-tone partials will round-trip through `detect` as the full chord. More on this below.

### Worked Examples

The E Shape 6 example is harmonically correct: `["1P", "5P", "1P", "3M", "6M", null]` contains exactly `1P 3M 5P 6M` (`spec.md:82-96`). Applied to F in standard tuning, it yields `1 3 3 2 3 x`, which is a plausible movable F6 grip. The written fingering/barre, however, is suspect: `fingers: [1, 3, 1, 1, 1, null]` with a first-finger barre across strings 0-4 (`spec.md:88-89`) does not match the actual frets, because string 4 is at the third fret above the open string, not the barre fret. The interval row is fine; the fingering should be corrected during implementation.

The A Shape 13 example is not playable as encoded. For C, the row `[null, "1P", "7m", "3M", "13M", null]` (`spec.md:102`) builds to `x 3 8 9 10 x` in standard tuning: root on A string, then b7 on D string, 3rd on G string, 13th on B string. That is not a usable A-form grip. A common practical C13 A-root shape is closer to `x 3 2 3 3 5`, with row `[null, "1P", "3M", "7m", "9M", "13M"]`, or a four/five-string subset derived from it. If the goal is to omit both fifth and ninth, the row still needs to be re-derived from actual fretboard geometry, not from desired chord-tone order.

### `7#5` vs `aug7`

Choosing `7#5` as the registered key is defensible. It is the clearer altered-dominant symbol and Tonal `detect` prefers `C7#5` for the pitch set. It also avoids registering two shapes with identical intervals under two names.

But the spec/research rationale has one factual mismatch with the installed Tonal package. The docs claim `Chord.get("Caug7").symbol === "C7#5"` (`decisions.md:44-45`, `research.md:159-160`). In this workspace, `Chord.get("Caug7").symbol` returns `Caug7`, while `Chord.get("C7#5").symbol` returns `C7#5`; both share `1P 3M 5A 7m` and `detect` returns `C7#5`. The recommendation remains "register `7#5` only," but the reason should be "chosen canonical project key and detect-preferred alias," not "`Chord.get` normalizes `aug7` to `7#5`."

Other canonical suffix choices look reasonable. `mMaj7` is better than Tonal's detect alias `m/ma7` as a registry key because `Chord.get("CmMaj7")` is stable and readable (`research.md:154`). `6/9` is also a good key despite detect returning `6add9` (`research.md:156`), because it is the common guitarist suffix and Tonal accepts it.

### CAGED vs Drop Voicings

The E-form/A-form boundary is defensible for this issue. The decision explicitly acknowledges that drop2/drop3 is the more idiomatic jazz vocabulary, but keeps this feature additive and aligned with existing CAGED data (`decisions.md:8-27`). That is the right boundary if the goal is to enrich the existing registry without creating a new voicing-family convention.

I would not expand this feature to drop2/drop3. I would, however, make the data comments honest: many of these are CAGED-family movable chord shapes or shell/extension grips, not comprehensive jazz comping voicings. Drop2/drop3 should stay separate.

## Tonal.js Interop / Schema Correctness

### `chordType = Chord.get` Symbol

Using `chordType` as the Tonal suffix is the right schema choice. The registry query is exact-string based (`src/shape.ts:143-167`), and `arpeggioFromScale`/`arpeggioFromShape` call Tonal directly with the chord name (`src/integration.ts:60-118`). A translation-free join only works if the stored key is already a Tonal-accepted suffix.

Compound intervals are safe in the current build path. `applyChordShape` wraps each chord interval into a one-interval scale row and delegates to `buildFrettedScale` (`src/build.ts:253-283`), while the builder transposes intervals to pitch classes and places them chromatically. `9M` and `13M` therefore place like `2M` and `6M` on the fretboard, while preserving correct degree metadata.

### Detect Divergences

The documented divergence strategy is directionally correct: assert chroma membership rather than exact string equality where `detect` uses aliases (`spec.md:128-143`, `decisions.md:53-70`).

The divergence catalog should be revised slightly:

- `add9 -> CMadd9`, `mMaj7 -> Cm/ma7`, and `6/9 -> C6add9` are real and should stay documented (`spec.md:140-142`, `research.md:151-156`).
- `aug7 -> 7#5` is a detect-preference divergence, not a `Chord.get` symbol normalization in the installed package.
- `7#5` may also detect as `C7b13` after `C7#5` (`research.md:159`), and `dim7` has multiple symmetric-root detections (`research.md:153`). If tests inspect only `detect(notes)[0]`, this is probably fine; if tests inspect "contains expected," document the alternate results.

The bigger missed edge case is omitted-tone detection. Chroma membership does not help if `detect` returns `[]` or a different incomplete-chord label for a partial grip. For example, a root-3-b7-13 C13 shell (`C E Bb A`) returns no detected chord in the installed Tonal package, and `C E Bb D` returns `C9no5`, not `C9`. The spec currently says `identifyChord(frets)` returns a chord whose tones are consistent with the type (`spec.md:128-130`) and requires divergence assertions (`spec.md:167`). That is too strong for partial voicings.

Suggested test shape:

- For full voicings, `identifyChord` should return a non-empty result whose first result is exact or documented alias.
- For partial voicings, assert the built notes are a subset of `Chord.get(root + chordType).intervals`, and optionally assert any non-empty `detect` result has chromas that are also a subset/superset-compatible. Do not require `detect` to name the intended full chord when fifth/ninth tones are omitted.

### Future Query Layer

The schema is close to sufficient for future chord-scale-arpeggio joins without a translation step:

- `chordType` is a Tonal-accepted suffix.
- `strings` use Tonal interval vocabulary.
- `omittedIntervals` exposes partial-voicing completeness.
- `voicingFamily`, `stringSet`, and `inversion` provide useful query filters (`src/shape.ts:50-54`, `src/shape.ts:143-167`).

The main gap is aliases. Since `chordShapes.query({ chordType })` is exact-string only, a future consumer querying `"aug7"` will not find `"7#5"` unless it knows the alias. That is acceptable for this feature if documented, but the review should not claim every future cross-library query can join without any alias handling. It can join cleanly on canonical Tonal suffixes.

## Scope, Testability, Risk

### Should the Spec Freeze All Grips?

Leaving exact frets/fingers to implementation is mostly the right level of detail. The current infrastructure stores interval rows, not absolute fret arrays (`src/shape.ts:42-57`), and the feature intentionally avoids a new voicing engine (`spec.md:201-211`). Freezing all ~30 grips in the spec would make the spec noisy and harder to correct.

However, the spec should require an implementation-side source table or per-shape derivation comment that includes the concrete prototype fret shape. This is already implied by the "named open/movable voicing" JSDoc requirement (`spec.md:30-34`, `research.md:53-96`), but the A13 example shows why it matters. Each shape should be derivable from a real six-string fret pattern before it is converted into intervals.

### Acceptance Criteria

Most acceptance criteria are verifiable (`spec.md:153-169`, `spec.md:213-224`):

- File exists and side-effect import is added.
- Shape count/name uniqueness is checkable.
- Tonal resolution/subset checks are checkable.
- Build count vs `stringSet.length` is checkable.
- Omission integrity is checkable.
- Build/test/lint are checkable.

Items to tighten:

- Replace "all 16 chordTypes" with the corrected canonical count.
- Define the representative roots/tunings for build tests. At minimum, test standard tuning and one root that avoids open-string special cases, such as F or C depending on form.
- For alternate tunings/7-string/8-string behavior, state the expectation explicitly. Because `applyChordShape` sizes `frets` from the provided tuning and iterates over the shorter of shape strings and tuning (`src/build.ts:179-184`, `src/build.ts:267-270`), six-string shapes on 7/8-string tunings will map to the lowest six strings, not the usual guitar's top six strings. That may be acceptable, but it should be documented as "standard six-string shapes; alternate and extended-range tunings are best-effort/out of scope."
- Do not require `identifyChord` to return the intended full chord for partial voicings.

### Consumer Expectations

Likely consumer questions that should be handled in the data header or tests:

- Canonical names and aliases: especially `7#5`/`aug7`, `6/9`/`6add9`, `mMaj7`/`m/ma7`.
- Standard tuning assumption for curated grips.
- Exact-string registry behavior for `chordType`, since `chordShapes.query({ chordType: "aug7" })` will not find `7#5` (`src/shape.ts:150-151`).
- Six-string shape assumption on 7/8-string tunings.

### Single Biggest Risk

The biggest risk is shipping mathematically valid interval rows that are not real guitar grips. The data type makes this easy: any interval row can build to frets, but that does not mean the resulting fret spread matches the intended CAGED form or is playable. The A Shape 13 example is already an instance of this risk (`spec.md:98-110`).

I would push back on implementation until every shape is backed by a concrete prototype grip and tested by fret span/finger plausibility, not only by Tonal interval membership.

## Recommended Changes

1. Correct the spec count from "16 registered chordTypes" to "15 canonical registered chordTypes plus `aug7` alias documentation" (`spec.md:36`, `spec.md:169`, `spec.md:215`).
2. Replace the A Shape 13 worked example; the current interval row builds to an unplayable `x 3 8 9 10 x` for C.
3. Fix the E Shape 6 fingering/barre metadata or mark the example as interval-only; the current fingering does not match the built frets.
4. Revise the `aug7` rationale: choose `7#5` as project canonical/detect-preferred, but do not claim `Chord.get("Caug7")` normalizes to `C7#5` unless the package version actually does.
5. Split identification tests into full-voicing and partial-voicing expectations; for omitted-tone grips, require Tonal resolution and shape-note subset checks, not full `detect` naming.
6. Add explicit standard six-string tuning scope and document best-effort behavior for alternate tunings and 7/8-string tunings.
