# Tab Output Formats — Research

## Recommendation: AlphaTeX (primary), with MusicXML as interchange

We already use AlphaTab in the main app, so AlphaTeX is the natural output format.

## AlphaTeX Quick Reference

### Note syntax
```
fret.string          # single note: 5.3 = fret 5, string 3
(5.6 7.5 7.4 6.3)   # chord: multiple notes in parentheses
r                    # rest
x.3                  # dead/muted note on string 3
```

### Duration
```
:1   whole    :2   half    :4   quarter
:8   eighth   :16  sixteenth   :32  thirty-second
```

Duration prefix applies to all following notes until changed:
```
:8 5.3 7.2 9.1 |    # all eighth notes
```

### Effects (curly braces after note)
```
{h}    hammer-on       {p}    pull-off
{s}    slide           {b(0 4)}  bend
{v}    vibrato         {pm}   palm mute
{lr}   let ring        {nh}   natural harmonic
{ah}   artificial harmonic
```

### Metadata
```
\title "Exercise"
\tempo 120
\ts 4 4                          # time signature
\ks A                            # key signature
\track "Guitar" "Gtr"
\staff {tabs}                    # tablature staff
\tuning E4 B3 G3 D3 A2 E2       # standard (high to low!)
```

### Bars
Separated by `|` pipes.

## Example: A Major Barre Chord (577655)
```
\title "A Major"
\track "Guitar" "Gtr"
\staff {tabs}
\tuning E4 B3 G3 D3 A2 E2
| (5.6 7.5 7.4 6.3 5.2 5.1):1 |
```

## Example: A Major Scale Ascending (E-shape, frets 4-9)
```
\title "A Major Scale"
\tempo 120
\track "Guitar" "Gtr"
\staff {tabs}
\tuning E4 B3 G3 D3 A2 E2
\ts 4 4 \ks A
| :8 5.6 7.6 5.5 7.5 6.4 7.4 9.4 6.3 |
  7.3 9.3 7.2 9.2 5.1 7.1 9.1 r |
```

## IMPORTANT: String numbering
AlphaTeX numbers strings **high to low**: string 1 = high E, string 6 = low E.
This is the opposite of our internal convention (0 = low E).
Conversion: `alphaTexString = totalStrings - internalString`

## Other Formats (Secondary)

### LilyPond
- Professional typesetting, `TabStaff` for guitar
- String specified with `\N` suffix: `c'4\5` = C on string 5
- Good for print output, overkill for interactive apps

### ABC Notation
- No native tab support — pitch-based, not fret-based
- Good for folk/traditional music, poor for guitar-specific work

### MusicXML
- XML-based interchange format
- `<frame-note>` with `<string>` and `<fret>` elements
- Verbose but universal — good for import/export between apps
- Both AlphaTab and TuxGuitar can import MusicXML

### Guitar Pro (.gpx)
- Binary/XML container format
- AlphaTab reads .gpx natively (99% feature support)
- TuxGuitar reads .gp3/.gp4/.gp5, limited .gpx support
