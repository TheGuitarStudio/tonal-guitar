# Open Questions

Questions that came up during implementation. Non-blocking unless marked CRITICAL.

---

## Q1: CAGED_G shape drops 1P from string 1 for key of G

The G shape has `rootString: 0` (low E), which anchors at fret 3 for key of G. The 1P interval on string 1 (A string) would be at fret 10, which falls outside the `findFretInPosition` window [0, 8]. The root still appears on string 3 (G string at fret 0), so all 7 degrees are present.

This is consistent with the experiment code. The question is whether `rootString` should be changed to better center the position window, or if the current behavior (root present on other strings) is acceptable.

## Q2: ASCII tab column alignment with multi-digit frets

When notes have different fret widths (e.g., fret 5 vs fret 10), the tab lines can become misaligned. A pre-calculated column width approach would fix this but adds complexity. Current output is functional but not pixel-perfect.

## Q3: `analyzeInKey` chord matching limitations

Uses exact string match between `detectChord()` output and `majorKey().chords`. Enharmonic equivalents (C#maj7 vs Dbmaj7) or slash chords won't match. Consider normalizing chord names before comparison in a future iteration.

## Q4: 3NPS pattern names vs mode compatibility

3NPS patterns are labeled "Dorian", "Phrygian" etc. but use major scale intervals (starting from different degrees). `isShapeCompatible("C dorian")` returns false for these since dorian has different intervals. The naming reflects traditional guitar pedagogy (pattern 2 = Dorian starting position) rather than strict modal compatibility. Consider adding a note to the README about this.
