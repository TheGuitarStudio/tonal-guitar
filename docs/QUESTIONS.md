# Open Questions

Questions that came up during implementation. Non-blocking unless marked CRITICAL.

---

## Q1: CAGED_G shape drops 1P from string 1 for key of G

The G shape has `rootString: 0` (low E), which anchors at fret 3 for key of G. The 1P interval on string 1 (A string) would be at fret 10, which falls outside the `findFretInPosition` window [0, 8]. The root still appears on string 3 (G string at fret 0), so all 7 degrees are present.

This is consistent with the experiment code. The question is whether `rootString` should be changed to better center the position window, or if the current behavior (root present on other strings) is acceptable.

## Q2: ASCII tab column alignment with multi-digit frets

**Status (chord-column path): RESOLVED (R-5.4)**. `toAsciiTab` now accepts `FrettedNote[][]` (grouped input). In the grouped path, each beat occupies one column whose width is `Math.max(1, max fret digit width in the group)`, so multi-digit frets (e.g. fret 10 alongside fret 5) align correctly across all string rows.

**Status (sequential path): unchanged**. When a flat `FrettedNote[]` is passed and notes across different strings have different fret widths, the tab lines can still be misaligned because each note is emitted as its own column without cross-string width coordination. This case is uncommon in practice (sequential runs rarely span fret 10+ positions mid-phrase) and remains tracked for a future iteration.

## Q3: `analyzeInKey` chord matching limitations

**Status: RESOLVED (Issue #61).** `findChordIndex` now compares by `(tonic chroma, chord type)` when exact string match fails, catching enharmonic pairs like `Abm7` / `G#m7` (same chroma 8, same type `minor seventh`). Triad-vs-seventh mismatches (different types) and genuinely out-of-key chords (different chromas) correctly return no match. Slash-chord normalization and triad-subset matching remain out of scope.

## Q4: 3NPS pattern names vs mode compatibility

3NPS patterns are labeled "Dorian", "Phrygian" etc. but use major scale intervals (starting from different degrees). `isShapeCompatible("C dorian")` returns false for these since dorian has different intervals. The naming reflects traditional guitar pedagogy (pattern 2 = Dorian starting position) rather than strict modal compatibility. Consider adding a note to the README about this.
