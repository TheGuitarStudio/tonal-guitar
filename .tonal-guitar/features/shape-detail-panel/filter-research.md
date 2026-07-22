# Filter/Sort UX Research — Chord Library Survey

Supporting research for D-006 (filtering/sorting model). Produced 2026-07-21 by a web
research agent surveying live chord-library tools. Method: direct fetches of live pages
plus app-store/release-note descriptions; unverifiable items marked uncertain.
Scales-chords.com, Chordify's diagram library, and Songsterr/Guitar Pro chord tools
returned 403/no useful content and are omitted rather than guessed at.

## 1. Tool-by-tool findings

### Oolimo (web chord finder/analyzer + app)
- **Primary taxonomy:** chord entity first (root + type), then voicings within it,
  arranged in curated named groups: "MUST-KNOW chord shapes," "OPEN CHORDS," "MOVEABLE
  chords," open chords with "CAPODASTER" — voicing-family grouping with an explicit
  most-important-first tier. Positions itself as "musically meaningful chords instead
  of random guitar shapes," "hand-curated database... intelligently transposed by an
  algorithm" (curation + algorithmic transposition hybrid — our architecture too).
- **Type selection:** "Filter Chords": All / Major (aug,6,7,maj7) / Minor / Sus /
  Slash, with a Basic / 6 / 7 / maj7 sub-filter — small grouped families.
- **Voicing navigation:** Prev/Next stepper + audio Play.
- **Notation:** symbol style is a display *setting* (shorthand vs didactic; "m maj dim
  aug" vs "− Δ ° +"), not a filter.
- **Clever:** analyzer (tap frets → possible names), color-coded intervals,
  side-by-side comparison of up to 9 saved analyses.

### JGuitar
- Generator, not catalog. Chromatic root strip (12 buttons, sharps). One long
  chord-type dropdown + bass-note selector. Playability constraints as filters
  ("Max Gaps Between Strings", "Fingers", "Always use open Strings").
- **Cautionary example:** exhaustive generation + constraint filters = huge low-signal
  result sets; curated competitors position against this.

### ChordBank (iOS)
- **Standout pattern — "voicing chooser":** browse one fret at a time; "most
  important, spotlight voicings visible, and even more ways to play available with a
  tap." Primary axis = fret position; curated spotlight tier + disclosure.
- Chord aliases in search ("G2 or Gsus2"). "Layers" educational overlay
  (root/third/fifth building blocks); reverse chord finder; global left-handed flip.

### fachords.com
- Root note first (12 buttons incl. both sharp and flat spellings), then quality
  families (major, minor, dominant, diminished, augmented, suspended, sixth, extended).
- Multiple positions per chord; colored interval circles on diagrams; "Easy Version"
  beginner alternatives; Open/Bar/Power tiers; capo, tuning, left-handed options.
- Separate analyzer browses voicings by key, type, **and position**.

### JamPlay chord charts
- URL-hierarchical: Tuning → Root → Type. ~20 voicings per chord in a grid **ordered
  by fret position ascending**, each with a one-line descriptive caption (genre/
  context). Alias list at top ("CMA7, CMAJ7, CM7"). Links to same chord in 30+
  tunings. "950,000 voicings" behind membership — volume-vs-curation tension.

### Jazz chord dictionaries (jazz-guitar-licks.com, jazzguitar.be)
- Quality first (page per quality), then **voicing construction family** as section
  headings (Drop 2, Drop 3, Drop 2-4), then organized by **inversion** (root, 1st,
  2nd, 3rd) and **string set** (6th/5th/4th-string bass). Color-coded diagrams relate
  the four inversions of one voicing up the neck. No filter UI — fixed pedagogical
  ordering. jazzguitar.be ≈ 244 shapes (comparable scale to ours).

### GtrLib Chords
- Web: root → flat type list per root; voicings as bracketed fret strings. App: all
  positions per chord, audio per position, filter by type within root. VoiceOver
  accessibility called out.

### Uberchord
- Entry via audio recognition → shows "all the alternative voicings, finger positions,
  and inversions." Identify-then-explore flow; 19 tunings.

### all-guitar-chords.com
- Two-step: root buttons → type. Default short type list with **"Advanced" option for
  the full list** — beginner-safe default, expert expansion. "Popular Chords"
  shortcut section. Left-handed / vertical-fretboard settings.

### tombatossals/chords-db (open-source; basis of our open-chords data)
- Data model: `key` (root) + `suffix` (type) → `positions[]` with frets/fingers/
  barres/capo/baseFret. Confirms root/suffix/positions as the community taxonomy.

### guitar-chord.org
- Dual taxonomy: skill/format categories (Beginner / Open / Power / Major / Minor)
  and root letters; confirms "open vs barre vs power" as a user-recognized category.

## 2. Pattern synthesis

**Three taxonomy models, correlated with audience:**
1. **Root → Type → Voicings** (fachords, GtrLib, all-guitar-chords, JamPlay,
   chords-db). Universal consumer default. Root = chromatic button strip, never a
   dropdown; type = grouped or progressively-disclosed list.
2. **Quality → Voicing-family → String-set/Inversion** (jazz dictionaries, Oolimo's
   groups). Preferred when the value is shape pedagogy. Family names (drop 2, shell,
   open, moveable) are first-class labels.
3. **Generator/search with constraint filters** (JGuitar). Least curated-feeling.

Our Shape Library is closest to model 2 with model-1 users arriving anyway; winning
designs (Oolimo, ChordBank) blend both.

**Voicing-variant presentation — strongest convergent finding:**
- Order variants by **fret position ascending** (JamPlay, ChordBank). No tool defaults
  to difficulty or finger-count ordering.
- **Tier the variants:** spotlight/must-know curated tier first, exhaustive set behind
  a disclosure.
- Steppers in single-chord detail contexts; grids in catalogs; family sections in
  pedagogical contexts.

**Other recurring patterns:**
- Enharmonics/aliases via display settings or alias lists, not duplicate entries.
- Types always grouped into a handful of families with progressive disclosure.
- Interval color-coding on diagrams recurs (Oolimo, fachords, jazz-licks).
- Nobody shows facet counts or greys out empty combos — a gap, not a norm; generic
  faceted-browse best practice supports doing it.
- Deep-linkable URL hierarchy (JamPlay) — we already ship deep-linkable filter state.
- Left-handed flip and audio playback are the two most-expected extras.

## 3. Proposals for our page

Per-shape data available: root, chordType, voicingFamily (open/barre/caged/jazz-shell/
extended), stringSet, baseFret, inversion, audit pass/fail.

### Proposal A (recommended): "Curated catalog with faceted chips"
1. **Quality group chips** (single-select group → expands to multi-select type chips):
   Triads (maj, min, dim, aug) | Sevenths (maj7, 7, m7, m7b5, dim7, mMaj7) |
   Extended | Sus/Add. Ambiguous symbols get dual labels ("m7b5 (ø7)").
2. **Voicing family — multi-select toggle chips with counts:** Open (12) | Barre (18)
   | CAGED (25) | Jazz shell (16) | Extended (30). All on by default; zero-result
   chips grey out (don't hide). Counts = cheap differentiation no surveyed tool has.
3. **Root — chromatic strip of 12 buttons, default "Any".** For movable families root
   acts as transposition/preview; true filter only for open shapes. Sharps on
   buttons, flats honored in diagrams via Tonal. No duplicate C#/Db entries.
4. **More-filters popover:** string set, position band (Open 0–3 / Low 1–5 / Mid 5–9 /
   High 9+ from baseFret), inversion, audit-flagged toggle.
- **Sort:** default base fret ascending; alternatives by type order or family. Skip
  difficulty/popularity until we have data.
- **Grid:** grouped by chordType ("maj7 — 14 shapes"), baseFret ascending inside,
  family badge colors; **spotlight tier** via a small curated `featured` flag (1–3
  essential shapes per type rendered first, rest behind "Show all N").
- **Cards:** ~110–140px diagrams, chord symbol + family badge + "fr N" badge,
  interval color-coded dots, click → non-modal panel (D-005) with Prev/Next stepper
  through sibling voicings.

### Proposal B: "Two-mode page"
"Find a chord" mode (root strip → type → voicings by fret) vs "Study shapes" mode
(family sections → quality → inversion → string set, movable shapes with interval
labels). More work; only if one grid can't serve both intents.

### Proposal C: minimal increment
Current layout + family chips with counts, grouped quality chips, baseFret default
sort, grey-out-at-zero. No new data needed.

**Cross-cutting (any proposal):** keep/extend deep-linkable state (add sort + expanded
groups); alias-aware search ("ø", "half-dim" → m7b5); left-handed flip toggle; never
present uncurated results — audit system is the natural enforcement layer.

**Sources:** oolimo.com (find/analyze/app) · jguitar.com (chordsearch, chord/C/maj7) ·
chordbank.com (4.0 release notes, support) · fachords.com/guitar-chord · jamplay.com
chord charts · jazz-guitar-licks.com maj7 diagrams · jazzguitar.be chord dictionary ·
gtrlib.com · uberchord.com · all-guitar-chords.com · github.com/tombatossals/chords-db
· guitar-chord.org
