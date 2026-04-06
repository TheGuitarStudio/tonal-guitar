# Guitar Shapes Research

## Existing Libraries

| Library | Maintained | Features | Tonal Integration |
|---------|-----------|----------|-------------------|
| @moonwave99/fretboard.js | Semi | SVG viz, CAGED support | Uses Tonal internally |
| SVGuitar | Active (TS) | SVG chord diagrams | None (rendering only) |
| Chordictionary | Moderate | x32010 parsing/rendering | None |
| chord-voicings / harmonical | Low | Voicing algorithms | None |
| radzionc/guitar | Active | CAGED viz, 3NPS, Next.js | None |

**Gap:** No library provides a functional, composable data model for guitar shapes
that works with music theory concepts (intervals, modes, transposition). Everything
is either rendering-only or tightly coupled to a specific UI.

## Tonal Extension Points

- No formal plugin system, but strong composition patterns
- `ChordType.add()` / `ScaleType.add()` — runtime dictionary extension
- `VoicingDictionary` — maps chord symbols to interval-based voicing patterns
- Composable pure functions: `Note.transpose()`, `Interval.distance()`, `Pcset.modes()`
- New packages added to `packages/` and re-exported from `packages/tonal/index.ts`

## Notation Formats

### Chord Notation
- String: `"x32010"` (C major open) — compact, human-readable
- Array: `[null, 3, 2, 0, 1, 0]` — better for computation
- Convention: ordered low E → high E (string 6 → string 1)

### Scale Pattern Notation (Proposed)
- Fret ranges per string: `[5-8, 5-7, 5-7, 5-7, 5-8, 5-8]` (Am pentatonic box 1)
- 3NPS with frets: `[5-7-9, 5-7-9, 6-7-9, ...]` (A major 3NPS)

### Interval-Based Shape Notation (Proposed)
- Per-string intervals from root: `[["1P","m3"], ["4P","5P"], ...]`
- Key-independent — same shape works in any key

## Core Concepts

### CAGED System
- 5 shapes derived from open chords: C, A, G, E, D
- Connect in sequence across the neck: C → A → G → E → D → C (octave higher)
- Each shape has a root string and movable pattern
- Works for chords AND scales (each shape has a corresponding scale box)
- Teachers differ on exact fingerings — must be overridable

### 3NPS (Three Notes Per String)
- 7 patterns for the major scale (one per mode)
- Same physical shape = different mode depending on root designation
- Pattern 1 = Ionian, Pattern 2 = Dorian, ..., Pattern 7 = Locrian
- Uniform fingering enables fast legato playing

### Mode/Shape Relationship
- Same notes, different root = different mode
- Am pentatonic box 1 = C major pentatonic box 6 (same frets, different root)
- A 3NPS "Ionian" pattern starting on the 2nd degree becomes Dorian
- Shape identity depends on which note is designated as root/tonic

### Voicing Types
- Drop 2: 4 adjacent strings, second-highest note dropped an octave
- Drop 3: skip a string, third-highest note dropped an octave
- Inversions: root position, 1st, 2nd, 3rd — which note is in the bass

### Tuning
- Standard: E2-A2-D3-G3-B3-E4 (MIDI: 40-45-50-55-59-64)
- 7-string: B1-E2-A2-D3-G3-B3-E4
- Alt tunings: Drop D, DADGAD, Open G, etc.
- Store as NoteName[] — maps directly to Tonal's Note.get()

## References

- Guitar Tunings Database (GTDB): gtdb.org — 4700+ tunings
- Applied Guitar Theory: CAGED, intervals, modes
- Fret Science: 3NPS one-pattern approach
