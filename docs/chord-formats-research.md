# Chord Fingering Data Formats — Research

## Format Comparison

| Library/Standard | Finger Numbers | Barre Info | Muted Strings | Position | Format |
|-----------------|---------------|------------|---------------|----------|--------|
| **SVGuitar** | Yes (per-finger text) | Explicit `barres[]` with span | `'x'` | Yes | JS object |
| **chords-db** | Yes (parallel array) | Explicit `barres[]` with fromString/toString | `-1` | Yes + capo flag | JSON |
| **chord-collection** | Yes (parallel array) | Implicit (not stored) | String value | No | JSON |
| **chord-fingering** | Computed | Explicit `barre` object | Omitted | Yes + difficulty score | JS object |
| **VexChords** | No | Optional barre array | `'x'` | Yes | Simple array |
| **ChordPro** | Yes (optional) | `base-fret` keyword | `'x'` | Yes | Text directive |
| **Guitar Pro** | Yes | Barre array (up to 5) | Custom value | Yes | Binary/XML |
| **MusicXML 4.0** | Yes (1-5) | Implicit (computed) | Omitted | Yes (`first-fret`) | XML |

## F Major Barre (133211) in Each Format

### SVGuitar
```javascript
{
  fingers: [
    [1, 1, '1'], [2, 3, '3'], [3, 3, '3'],
    [4, 2, '2'], [5, 1, '1'], [6, 1, '1']
  ],
  barres: [{ fromString: 6, toString: 1, fret: 1, text: '1' }],
  title: 'F major',
  position: 1
}
```

### chords-db (tombatossals/chords-db)
```json
{
  "frets": [1, 3, 3, 2, 1, 1],
  "fingers": [1, 3, 3, 2, 1, 1],
  "barres": [{ "fret": 1, "fromString": 6, "toString": 1, "finger": 1 }],
  "capo": false
}
```

### ChordPro
```
{define: F base-fret 1 frets 1 3 3 2 1 1 fingers 1 3 3 2 1 1}
```

### MusicXML
```xml
<first-fret>1</first-fret>
<frame-note><string>6</string><fret>1</fret><fingering>1</fingering></frame-note>
...
```

### Compact text (de facto)
```
frets:   133211
fingers: 133211
barre:   @1 (fret 1, strings 6-1)
```

## Key Takeaways

1. **Parallel arrays** are the most common pattern: `frets[]` + `fingers[]` as same-length arrays
2. **Barres are always separate** — no format encodes barre info inline with fret numbers
3. **chords-db format** is the most practical JSON format — structured, clear, extensible
4. **Muted strings**: `null`, `-1`, or `'x'` depending on format — we should use `null`
5. **Finger numbering**: 1=index, 2=middle, 3=ring, 4=pinky (universal)
6. **Multiple voicings**: chords-db and chord-collection store arrays of positions per chord

## Sources

- [SVGuitar](https://github.com/omnibrain/svguitar)
- [chords-db](https://github.com/tombatossals/chords-db)
- [chord-collection](https://github.com/T-vK/chord-collection)
- [chord-fingering](https://github.com/hyvyys/chord-fingering)
- [ChordPro spec](https://www.chordpro.org/)
- [MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/)
