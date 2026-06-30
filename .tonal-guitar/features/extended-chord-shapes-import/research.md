# Research: Curated Extended Chord Shapes Import

**Date:** 2026-06-30 | **Issue:** #31

> Note: Phase 1 ran two parallel `code-architect` research agents (codebase + product).
> Both did the investigation but their large final reports were lost to repeated
> mid-stream connection errors. The lead agent re-gathered the findings directly from
> the source files and a live Tonal probe; this document is that consolidated result.

---

## Codebase Research

### The `ChordShape` type — exact contract the new data must satisfy

`src/shape.ts:42-64`. A chord shape is **one interval per string** (low→high), not a fret array:

```ts
export interface ChordShape {
  name: string;
  system: string;
  strings: (string | null)[]; // one interval per string; null = muted/excluded
  fingers: (number | null)[]; // fretting-hand finger per string; null = muted, 0 = open
  barres: Barre[];            // { fret, fromString, toString, finger }
  rootString: number;         // which string carries "1P"
  // --- optional harmonic metadata (R-1.1) ---
  chordType?: string;         // e.g. "maj7" — the registry/query key + Tonal symbol bridge
  inversion?: number;
  voicingFamily?: VoicingFamily; // "caged" | "shell" | "open" | "barre" | "drop2" | ...
  stringSet?: number[];       // played string indices, e.g. [0,1,2,3,4,5]
  omittedIntervals?: string[];// intervals missing from the full chord quality
  canonicalRoot?: string;     // set only for fixed (non-movable) shapes
  baseFret?: number;
}
```

`Barre` = `{ fret: number; fromString: number; toString: number; finger: number }` (`src/shape.ts:59-64`).

**Critical:** `strings` holds **interval strings** (`"1P"`, `"3M"`, `"7m"`, `"5A"`…), *not* fret
numbers. The build engine derives frets from intervals at apply-time. Intervals follow Tonal's
naming (`@tonaljs/interval` / `@tonaljs/note` transpose vocab).

### Registry + query (`src/shape.ts:121-167`)

- `chordShapes.add(shape)` — registers (push + index by `name`).
- `chordShapes.query({ chordType?, system?, voicingFamily?, stringSet? })` — filters the dictionary.
  `chordType` is an **exact-string** match (`src/shape.ts:150`), so our `chordType` values must be
  the strings consumers will query by.
- `chordShapes.get(name)`, `.all()`, `.names()`, `.removeAll()`.
- Names must be **globally unique** — `add` indexes by `name`, so a duplicate name silently
  overwrites. The 7th file uses names like `"E Shape maj7"`, `"A Shape m7"`.

### Format precedent — `src/data/caged-chords-7th.ts` (the file to mirror)

267 lines, 11 registered shapes. Each entry is a `const` export + a JSDoc block deriving the
voicing from a known open chord, then a single `.forEach(chordShapes.add.bind(chordShapes))` at
the bottom. Verbatim examples to copy the format from:

```ts
// src/data/caged-chords-7th.ts:48-59 — E-shape maj7 (full 6-string barre)
export const CAGED_CHORD_E_MAJ7: ChordShape = {
  name: "E Shape maj7",
  system: "caged",
  strings: ["1P", "5P", "7M", "3M", "5P", "1P"],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 0, fromString: 0, toString: 5, finger: 1 }],
  rootString: 0,
  chordType: "maj7",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3, 4, 5],
};

// src/data/caged-chords-7th.ts:223-234 — E-shape m7b5 (partial 4-string voicing)
export const CAGED_CHORD_E_M7B5: ChordShape = {
  name: "E Shape m7b5",
  system: "caged",
  strings: ["1P", "5d", "7m", "3m", null, null], // null = string not played
  fingers: [0, 1, 3, 2, null, null],
  barres: [],
  rootString: 0,
  chordType: "m7b5",
  voicingFamily: "caged",
  inversion: 0,
  stringSet: [0, 1, 2, 3],
};
```

Conventions observed:
- `strings` listed **low→high pitch**, matching the `fretInWindow` pitch-order convention so
  shapes build correctly (the file's header comment, `src/data/caged-chords-7th.ts:30-32`,
  calls this out explicitly).
- E-form ⇒ `rootString: 0`; A-form ⇒ `rootString: 1`; D-form ⇒ `rootString: 2`.
- Muted/unused strings are `null` in **both** `strings` and `fingers`; open string ⇒ finger `0`.
- Each JSDoc derives the interval row from a concrete open voicing — keep this; it is how
  reviewers verify the intervals are right.

### How shapes become frets — `applyChordShape` (`src/build.ts:253-283`)

`applyChordShape(shape, root, tuning = STANDARD, options)` converts the `ChordShape` to a
single-interval-per-string `ScaleShape` (`strings.map(s => s != null ? [s] : null)`) and delegates
to `buildFrettedScale`. It returns a `Fingering { positions, frets, root, shapeName, startFret }`.

Implications for the new data:
- Every interval string in `strings` is fed to `transpose(pc, ivl)` (`src/build.ts:190`) and
  placed via `fretInWindow` (chroma-based, `src/build.ts:49-73`). **Compound intervals work** —
  `9M`, `13M` transpose to the correct pitch class (chroma), they just resolve to the same
  fret-window slot as their simple counterpart. This is verified below against Tonal.
- The fret window is `[anchor-4, anchor+8]` (`LOOKBACK=4`, `LOOKAHEAD=8`, `src/build.ts:37-42`).
  A movable extended voicing whose notes span more than 12 frets relative to the anchor would
  drop notes. Real E/A-form extension grips stay well within this — low risk, but the spec
  should require an apply-and-count test (built `frets` non-null count == `stringSet` length).
- The anchor is the natural fret of the **first interval on `rootString`** (`src/build.ts:115-129`),
  so `rootString` must point at the string whose listed first interval is `"1P"` (or the lowest
  charted note on that string). The 7th-chord file always puts `"1P"` first on `rootString`.

### Tonal interop bridge — `src/integration.ts` (the hard acceptance criterion)

The whole interop surface lives here and keys off **Tonal chord-symbol strings**, not our
`chordType` directly:

- `identifyChord(frets, tuning)` (`:185-205`) — reads notes off the fretboard, returns
  `@tonaljs/chord` `detect(notes)`. This is what "does the voicing name back to our type" is
  tested against.
- `arpeggioFromScale(parent, chordName)` (`:60-101`) and `arpeggioFromShape(shape, chordName,
  parentRoot, tuning)` (`:111-118`) — call `Chord.get(chordName)` for the chord's intervals,
  then keep parent notes whose **chroma** is in the chord-tone set. So feeding a sixth/ninth/
  altered chord name "just works" **iff `Chord.get(name)` resolves** — verified below for all 16.
- `analyzeInKey(frets, keyName)` (`:233-259`) — `detect` → look up in `majorKey(key).chords`
  (diatonic 7ths). Extended chords are mostly **not** diatonic 7ths, so this returns the chord
  name with empty numeral/degree (the `chordIndex === -1` branch, `:248-251`). Expected limit,
  not a bug — document it.
- `relatedScales(frettedScale)` (`:161-172`) — modal relatives via `Scale.modeNames`; operates on
  scale type, independent of the new chord data.
- There is **no lookup table** translating our `chordType` to a Tonal symbol — the relationship is
  by convention: our `chordType` should equal a string that `Chord.get` accepts. The probe below
  catalogs where that convention is exact vs. where Tonal normalizes the symbol differently.

### Live Tonal interop catalog (ran `@tonaljs/chord` `get`/`detect` on all 16 suffixes)

`Chord.get("C"+suffix)` and `detect(notes)`. **All 16 resolve (none empty).** Intervals shown are
exactly what the `strings` rows must use to round-trip:

| Suffix | `get` symbol | `intervals` | `detect(notes)` first → round-trip | Notes / divergence |
|--------|-------------|-------------|-----------------------------------|--------------------|
| `6`    | `C6`     | 1P 3M 5P 6M       | `C6` (also `Am7/C`) | clean; ambiguous w/ rel. m7 (expected) |
| `m6`   | `Cm6`    | 1P 3m 5P 6M       | `Cm6` (also `Am7b5/C`) | clean |
| `9`    | `C9`     | 1P 3M 5P 7m 9M    | `C9` | clean |
| `maj9` | `Cmaj9`  | 1P 3M 5P 7M 9M    | `Cmaj9` | clean |
| `m9`   | `Cm9`    | 1P 3m 5P 7m 9M    | `Cm9` | clean |
| `add9` | `Cadd9`  | 1P 3M 5P 9M       | **`CMadd9`** | ⚠ `get` symbol=`Cadd9` but `detect`=`CMadd9`; `type`="" |
| `13`   | `C13`    | 1P 3M 5P 7m 9M 13M| `C13` | clean (6 tones — voicing must omit; see below) |
| `dim7` | `Cdim7`  | 1P 3m 5d 7d       | `Cdim7` | clean; symmetric → 4 enharmonic roots in detect |
| `mMaj7`| `CmMaj7` | 1P 3m 5P 7M       | **`Cm/ma7`** | ⚠ `detect` uses alias `m/ma7`, not `mMaj7` |
| `7sus4`| `C7sus4` | 1P 4P 5P 7m       | `C7sus4` | clean |
| `6/9`  | `C6/9`   | 1P 3M 5P 6M 9M    | **`C6add9`** | ⚠ `get` symbol=`C6/9`, `detect`=`C6add9` (alias) |
| `7b9`  | `C7b9`   | 1P 3M 5P 7m 9m    | `C7b9` | clean (5 tones) |
| `7#9`  | `C7#9`   | 1P 3M 5P 7m 9A    | `C7#9` | clean ("Hendrix") |
| `7#5`  | `C7#5`   | 1P 3M 5A 7m       | `C7#5` (also `C7b13`) | `type`=""; alias of `aug7` |
| `aug7` | **`C7#5`** | 1P 3M 5A 7m     | `C7#5` | ⚠ `get("Caug7").symbol` normalizes to `C7#5` |
| `7b5`  | `C7b5`   | 1P 3M 5d 7m       | `C7b5` | `type`="" |

**Interval vocabulary the data must use** (all valid Tonal/`transpose` inputs, all build-engine
safe): `1P 3M 3m 4P 5P 5A 5d 6M 7M 7m 7d 9M 9m 9A 13M`. Extensions are **compound** (`9M`=14
semitones, `13M`=21) — chroma-equivalent to `2M`/`6M` on the fretboard, so the engine places them
correctly; writing them as 9/13 keeps degree/interval metadata honest and matches `Chord.get`.

### Registration & public API (`src/index.ts`)

Data files register via side-effect import. `src/index.ts:117-124` lists them:

```ts
import "./data/caged-chords-7th";
import "./data/open-chords";
import "./data/jazz-shells";
```

A new file needs exactly **one added line**: `import "./data/extended-chords";`. No re-export is
required unless we want to export the shape constants (the 7th file does not re-export them; only
`jazz-shells` re-exports its `SHELL_DICTIONARY`). The public API already exposes everything a
consumer needs (`chordShapes`, `applyChordShape`, `arpeggioFromShape`, `identifyChord`).

### Existing coverage (purely additive — confirmed no overlap)

`grep chordType` across `src/data/*`: the only chord types in the registry today are
**M, m, 7, maj7, m7, m7b5, dim, aug, sus2, sus4** (10 core), spread over `caged-chords.ts`,
`caged-chords-7th.ts`, `open-chords.ts`, and `jazz-shells.ts`. **None** of the 16 proposed
suffixes exist yet → zero collision risk; new names just need to be unique.

### Tests — the precedent to extend (`src/data/data.test.ts`, 27 KB)

Chord-shape data is tested in `src/data/data.test.ts` (not `index.test.ts`). Patterns to mirror
(confirmed by the 7th-chord shapes living there): assert each shape is registered
(`chordShapes.query({ chordType })` non-empty), `applyChordShape(shape, root)` produces the
expected fret count / `startFret`, and — the interop bit this feature adds — that
`identifyChord(applyChordShape(shape, root).frets)` and/or `Chord.get(symbol).intervals` agree
with the shape's interval row.

### Suggested code placement

| New File | Tier | Rationale |
|----------|------|-----------|
| `src/data/extended-chords.ts` | data (zero-Tonal at module load — pure data, like the other `data/*` files) | Mirrors `caged-chords-7th.ts`; registered via side-effect import |
| (edit) `src/index.ts` | public API | Add `import "./data/extended-chords";` after the existing data imports |
| (edit) `src/data/data.test.ts` *or* new `src/data/extended-chords.test.ts` | testing | Per-suffix build + Tonal interop assertions |

---

## Product Research

### Roadmap Alignment

There is no `docs/product/` directory; roadmap/design context lives in `docs/PLAN.md`,
`docs/design.md`, and `docs/chord-formats-research.md`. The library is v0.1.0, "needs README and
docs before publishing" (CLAUDE.md). This feature directly serves the **"credible chord vocabulary
out of the box / publish-ready"** goal and feeds the planned Lab palette.

**Alignment:** Strong — additive vocabulary on shipped infrastructure, no architectural change.

### Related Specifications

| Document | Relevance |
|----------|-----------|
| `.tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/` (#16, **MERGED** as #41) | Direct predecessor — shipped the `ChordShape` format, registry, `applyChordShape`, `arpeggioFromShape`, `identifyChord`. This feature extends exactly that data layer. |
| `docs/chord-formats-research.md` | Documents the `tombatossals/chords-db` JSON format (`frets`/`fingers`/`barres`) the curation draws from, and why chords-db is the chosen source. |
| Issue **#28** (OPEN) — Voicing lookup/generation engine | The derivation engine; **home of the long-tail** chords we are NOT importing. Keep extended-chords as hand-curated data so #28 stays the place for generated/rare voicings. |
| Issue **#29** (OPEN) — Lab integration for arpeggios & chord shapes | **Primary consumer** — the chord palette that will surface these shapes. #29 can start on core types; this feature enriches it. UI work belongs to #29, not here. |

### User Context

Four user stories from the issue: (1) Lab user picks `Cmaj9`/`A7b9` and sees a real fingering;
(2) exercise generator drills sixth/ninth/altered arpeggios via `arpeggioFromShape`;
(3) a developer combining `tonal` + `tonal-guitar` resolves chord↔scale↔arpeggio with **one shared
vocabulary** (no translation layer); (4) a library evaluator sees a credible, publish-ready chord
set. Stories 2–3 are why the Tonal round-trip is a hard acceptance criterion, not polish.

### Scope Assessment

**In Scope:**
- New `src/data/extended-chords.ts` with ~16 curated suffixes × 1–2 movable forms (≈30–35 shapes),
  E-form / A-form (occasionally a C/D form where it voices well — open question Q4).
- Per-suffix Tonal interop verification (symbol resolves, intervals/degrees round-trip, arpeggio
  derivable) baked into tests.
- A documented **schema-compatibility catalog** of where our `chordType` and Tonal's symbol/detect
  vocabulary agree vs. diverge (the table above) so a future query layer needs no translation.

**Out of Scope:**
- The derivation/voicing-generation engine (#28) and the rare long tail (11ths: `11`/`m11`/`maj11`).
- Lab UI / palette wiring (#29).
- A CLI / MCP server / cross-library "everything about this chord" query helper (explicitly future;
  schemas should *allow* it later without reshaping).

**Adjacent Features (separate efforts):** #28 (engine), #29 (Lab), any cross-library query layer.

### Suffix-set product judgment

The proposed tiered set (Tier 1 essential: `6 m6 9 maj9 m9 add9`; Tier 2 jazz: `13 dim7 mMaj7 7sus4
6/9`; Tier 3 altered dom: `7b9 7#9 7#5/aug7 7b5`) is well-targeted: every suffix resolves in Tonal,
each is a real guitar voicing, and they are high-arpeggio-value. Two judgment notes carried to
Shape:
- `aug7` and `7#5` are the **same Tonal chord** (`get("Caug7").symbol === "C7#5"`). Pick **one**
  `chordType` string (recommend `"7#5"` to match Tonal's canonical symbol) and note the alias —
  don't register both as if distinct types.
- `13` is a 6-tone chord; a guitar voicing must omit tones (typically 5th and/or 9th). Use
  `omittedIntervals` so the relationship stays *visible* even though the grip is incomplete — this
  is exactly the "voicings omit/double tones" case the issue flags.

---

## Risks & Dependencies

| Risk/Dependency | Severity | Mitigation |
|-----------------|----------|------------|
| `chordType` string ≠ Tonal `detect` output (`add9`→`CMadd9`, `mMaj7`→`Cm/ma7`, `6/9`→`C6add9`, `aug7`→`7#5`) | Medium | Catalog every mismatch (table above); decide canonical `chordType` per suffix in Shape (prefer the `Chord.get` symbol); add round-trip tests asserting the *chosen* mapping, accepting alias differences explicitly. |
| Incomplete voicings (esp. `13`, shells) make `identifyChord` detect a different/partial chord | Medium | Populate `omittedIntervals`; in tests assert chord-tone **membership** (chroma subset) rather than exact `detect` equality where tones are dropped. |
| Hand-curated fret/finger errors (no `node_modules`-vendored chords-db in repo — frets must be authored by hand from chords-db references) | Medium | Derive each shape's interval row from a named open voicing in JSDoc (as the 7th file does); test `applyChordShape` builds the expected interval set for a sample root. |
| Fret-window (12-fret) note dropping for wide grips | Low | Test built `frets` non-null count == `stringSet` length for each shape at a representative root. |
| Name collisions on `chordShapes.add` (silent overwrite) | Low | Unique, systematic names (e.g. `"E Shape 9"`, `"A Shape maj9"`). |
| `analyzeInKey` returns empty numeral for non-diatonic extended chords | Low (expected) | Document as a known, correct limitation; not a defect to fix here. |

## Open Questions

- **Q1 — Canonical `chordType` per suffix.** For the 4 divergent cases (`add9`, `mMaj7`, `6/9`,
  `aug7`/`7#5`), which string do we register as `chordType` — the `Chord.get` symbol, the `detect`
  alias, or both via documentation? (Recommendation: the `Chord.get` symbol; `7#5` for the aug7.)
- **Q2 — Simple vs compound interval naming in `strings`.** Write extensions as `9M`/`13M`
  (matches `Chord.get`, honest degree) or `2M`/`6M` (matches the simple-interval style of existing
  files)? (Recommendation: compound, to round-trip with Tonal and keep degree metadata correct.)
- **Q3 — Omitted-tone policy for 5+ note chords (`13`, `9`, `maj9`, `6/9`).** Which tones do the
  movable E/A forms omit, and do we always set `omittedIntervals`?
- **Q4 — Forms per type.** Is E-form + A-form enough, or do `6`/`m6`/`6/9`/`add9` warrant a C/D
  open-ish form for the Lab? (Affects shape count: ~16 vs ~30–35.)
- **Q5 — Test home & depth.** Extend `src/data/data.test.ts` or add `extended-chords.test.ts`, and
  how much interop to assert per shape (resolve + intervals + arpeggio membership)?
- **Q6 — Voicing family: E/A-form vs drop2/drop3.** The `VoicingFamily` type already reserves
  `"drop2" | "drop3" | "drop2+4" | "sweep"`, but **zero shapes use them** — registered families are
  only `open` (53), `barre` (25), `caged` (14), `shell` (6) (`src/shape.ts:30-38`; grep of
  `src/data/`). drop2/drop3 are the canonical jazz voicings for exactly these extended chords
  (6ths/9ths/13ths/altered dom on the middle/top 4-string sets) and would activate those dormant
  enum values. The issue scopes #31 to movable **E-form/A-form** (CAGED-family) grips, continuing
  the `caged-chords-7th.ts` precedent. Do we (a) stay E/A-form per the issue and leave drop
  voicings to a separate effort (closer to #28's generation engine), or (b) voice the extensions as
  drop2/drop3 here? (Lead recommendation: **(a)** — keep #31 as additive curation; treat a
  drop2/drop3 set as its own feature.)
