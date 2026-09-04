# Raw Idea: Shape Workbench

**Captured:** 2026-08-30 · **Source:** design canvas session (2026-08-30) + user direction

## What

A shape-authoring app ("Shape Workbench") for browsing, creating, and editing guitar
shapes — chords first, then arpeggios and scales — with a CAGED board view and an
export flow that produces a JSON changeset merged into `src/data/*` via a terminal
command (`npm run shapes:merge -- .workbench/changeset.json`).

**Design canvas (authoritative for screens/UX):**
https://claude.ai/code/artifact/97d6fbbc-98f3-44be-8670-41aa00ceabcd
Pages: Screens (Board / Editor / Chord / Graph / Export), Arpeggios (derive → core →
override tiers + arpeggio editor), Triads & shells by string set, Data model & export
proposal. Screen 7: "Diatonic arpeggios in one shape" (inverse view).

## New direction from the user (2026-08-30, this session)

The workbench UI should ALSO become the deployed read-only docs Shape Library:

- **Shared UI**: one set of components serves both the deployed docs site (read-only)
  and the local workbench (editing enabled).
- **Docs deployment**: read-only mode — improves/replaces the current site Shape
  Library views.
- **Editing mode**: built to run locally for now; later it may be deployed behind
  some auth. Architecture should not preclude that, but auth itself is out of scope.

## Key design decisions already made (from canvas session, 2026-08-30)

- Separate app package (site is `output: "export"` — cannot write files); extract the
  site's pure `shapeLibraryUtils.ts` / `shapeDetailUtils.ts` into a shared package
  (proposed `packages/shape-catalog`).
- Additive data-model fields: `cagedPosition`, `movable` (default
  `canonicalRoot === undefined`), `parentShape` on ChordShape; `chordType` on
  ScaleShape; `tags`, `tuning`, `overrides`, `notes`; registries gain `remove()` +
  replace-on-add.
- Arpeggios: third registry `arpeggioShapes` (ScaleShape structure, chord-frame
  intervals, `chordType` required). Three tiers per chord-shape slot:
  derived (runtime `arpeggioFromShape`) → core (stored, ★) → teacher override
  (stored, `overrides` + `teacher:` tag); resolution override → core → derive.
- Parent box = **chord-scale rule**: chord type → scale (7 → mixolydian,
  maj7 → major, m7 → minor/aeolian; dorian & relative-major noted as alternates),
  then the box in that scale frame whose rootString matches the chord form's root
  string, via `relabelShapeToScale`. Mode boxes not yet registered get seeded
  (later phase).
- `VoicingFamily` gains `"triad"`; board columns: CAGED position / string set /
  inversion; closed triads generated from [1P 3M 5P] rotations as proposed core set.
- Shells: the traditional 8 only — E-root R·7·3 on strings 6·4·3 and A-root R·3·7 on
  strings 5·4·3; NO R73 on adjacent strings. `jazz-shells.ts`'s 16 generated variants
  to be corrected to those 8.
- Board gets a vertical (chord-box, low E left) vs horizontal diagram toggle.
- `Barre.fret` redefined as offset from `baseFret` (open-chords.ts stores absolute
  today — migration needed).
- Export format: `tonal-guitar/changeset@1` JSON.
- Scope order: CAGED movable shapes in standard tuning first; open strings and
  alternate tunings later.

## Why

Easy shape editing experience whose output feeds the core library data files through
a reviewable terminal merge — and a single UI investment that upgrades the public
docs Shape Library at the same time.

## Related issues

#57 (CAGED minor triads), #66 (chord editor fingering/barre export), #58/#30 (arpeggios)
