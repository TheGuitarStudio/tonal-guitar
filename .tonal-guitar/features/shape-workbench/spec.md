# Specification: Shape Workbench

**Issue:** #161 (absorbs #66, closes #57) | **Phase:** 2 (Shape) | **Date:** 2026-08-30
**Sources:** `research.md`, `requirements.md`, `decisions.md` (D-001…D-012, all binding),
`reviews/research-review.md` (Codex, accepted), `canvas-content.txt` (`Proposal.dc.html` =
verified draft spec).

## Goal

Shape Workbench is a local-only Vite + React authoring app for the `tonal-guitar` shape
registries: it renders the live registry as a CAGED board (gaps included), lets an author
create/edit chord shapes as movable interval templates with fingers and barres under live
audit checks, and exports a reviewable `tonal-guitar/changeset@1` JSON that
`npm run shapes:merge` turns into `src/data/*.ts` source. The same React components ship
read-only as the deployed docs Shape Library, so one UI investment serves both surfaces
(D-001/D-002). The result closes the "hand-edit `src/data/*.ts` then audit afterwards" loop,
closes #66 (chord fingering/barre export) and #57 (CAGED minor triads), and lays the additive
data model for arpeggio registries, triads and string-set families in later phases.

## User Stories

- As an **author/teacher working locally**, I want to see every CAGED chord-type × position
  slot as a grid with its gaps visible, click an empty slot, draw the grip on a fretboard at a
  chosen root, assign fingers and barres, and watch the audit checks pass live — so that I
  create correct library data by seeing it render instead of hand-writing interval arrays and
  discovering defects after the fact.
- As an **author/teacher**, I want my edits collected into a single `changeset@1` file that a
  terminal command merges into `src/data/*.ts` with generated identifiers, formatting and
  registration order — so that I never re-teach myself the TS template and the shape lands in
  the published library exactly the way the existing hand-written data is written.
- As a **docs visitor on the deployed static site**, I want the improved Shape Library (board
  grid, filters, cards, detail panels, vertical/horizontal diagrams) with no edit affordances
  anywhere — so that browsing shapes is better without the site ever implying it can write.
- As a **reviewer/maintainer**, I want `--dry-run` / `--check`, an explicit "what files will
  change" report, fixture-changeset tests, and a refusal on audit errors, version drift or
  computed files — so that I can review a mutation of published npm source data as an ordinary
  git diff before it happens.
- As a **library consumer**, I want the new shape fields, registry `remove()`/replace-on-add,
  the `arpeggioShapes` registry and the override → core → derived resolvers to be additive and
  tier-respecting — so that upgrading to the new version changes nothing about how
  `applyChordShape` / `buildFrettedScale` place notes and pulls in no new optional peers.

## Specific Requirements

There is **no database and no API server** in this repo. Layers below are: library
(`src/`), packages (`packages/`), workbench app, merge script, docs site, testing.

---

### 1. Library data model & registries — `src/shape.ts` (zero-Tonal-dep tier)

All additions are optional and backwards compatible. Nothing here may import any `@tonaljs/*`
module (CLAUDE.md tier contract).

**1.1 New shared type**

- `export type CagedPosition = "C" | "A" | "G" | "E" | "D";`

**1.2 `ChordShape` — additive optional fields**

| Field | Type | Optional | Semantics |
| --- | --- | --- | --- |
| `cagedPosition` | `CagedPosition` | yes | Board/graph column key. Today the letter only exists in the name prefix under two conventions (`"E Shape …"` vs `"E Form … Barre"`). |
| `movable` | `boolean` | yes | Explicit flag. **Default is `canonicalRoot === undefined`** — never written for existing shapes. |
| `parentShape` | `string` | yes | Name of the shape this was derived from (`"E Shape Minor"` ← `"E Shape Major"`). One-way, same semantics as `ScaleShape.parentShape` (which already exists, `src/shape.ts:29`). |
| `tags` | `string[]` | yes | Free-form curation vocabulary (`"core"`, `"jazz"`, `"beginner"`, `"teacher:studio"`). Never part of `name`. |
| `tuning` | `string[]` | yes | Absent ⇒ `STANDARD`. Recorded by the editor at save time. |
| `overrides` | `string` | yes | Name of the core entry this shape replaces (teacher-override mechanism). |
| `notes` | `string` | yes | Authoring notes that survive to runtime. |

**1.3 `ScaleShape` — additive optional fields**

- `cagedPosition?: CagedPosition`, `chordType?: string`, `tags?: string[]`,
  `tuning?: string[]`, `overrides?: string`, `notes?: string`.
- `parentShape?: string` already exists — do not re-add.
- `chordType`, when present, is always the `Chord.get(...).symbol` suffix (e.g. `"m7"`), never
  `detect()` output — same contract as `ChordShape.chordType`.

**1.4 `VoicingFamily`**

- Add `"triad"` to the union. `"extended"` is already present (`src/shape.ts:41`) — no change
  needed there despite the canvas's note.

**1.5 `ArpeggioShape` (new interface, no seeded data in this feature)**

```ts
export interface ArpeggioShape extends ScaleShape {
  chordType: string;                  // REQUIRED here — an arpeggio always outlines a chord
  fingers?: (number | null)[][];      // per-string, parallel to strings[]
  chordShape?: string;                // the grip this arpeggio belongs to, e.g. "E Shape m7"
  cagedPosition?: CagedPosition;
  overrides?: string;                 // core entry replaced by this (teacher) version
}
```

Structurally an `ArpeggioShape` is a `ScaleShape`, so `buildFrettedScale`, `walkShape`,
`inferShapeContext` and `checkScaleBuildLoss` work unchanged.

**1.6 Registry mechanics (documented as the sanctioned mutable seam)**

- **Replace-on-same-name `add()`** for all three registries: if `name` already exists, replace
  the entry **in place** (preserve array index so `all()` ordering and index-based tests stay
  stable) and update the index map; otherwise push. Return value stays the added shape.
  Today `add()` pushes unconditionally (`src/shape.ts:141-145,169-173`), producing duplicates.
- **`remove(name: string): boolean`** on all three registries (module-level `remove` export
  for the scale registry, mirroring `add`/`removeAll`); returns `true` when an entry was
  removed.
- **New `arpeggioShapes` registry** mirroring `chordShapes`:
  `{ get, all, names, add, remove, removeAll, query }` where
  `query(filter: { chordType?, system?, cagedPosition?, tags?, chordShape?, overrides? })`.
  Ships **empty** in this feature (seed data is a later phase).
- `chordShapes.query` gains `cagedPosition?: CagedPosition` and `tags?: string[]`
  (**superset match**: the shape must carry every requested tag). Existing filter semantics
  unchanged.
- A JSDoc block on the registry section must state that registries are the project's one
  sanctioned mutation seam (side-effect imports at import time) and that `remove`/replace
  do not violate the "pure functions only" convention.

**1.7 Arpeggio resolver layer (D-011 — replace-on-add alone is insufficient)**

Pure, registry-only; the *derive* fallback lives in the optional tier (§2.4).

```ts
export interface ArpeggioSlot {
  chordType: string;
  cagedPosition?: CagedPosition;
  system?: string;
  rootString: number;
  chordShapeName?: string;
}
export type ArpeggioTier = "override" | "core" | "derived";
export interface ArpeggioResolution {
  tier: ArpeggioTier;
  shape?: ArpeggioShape;         // set for "override" | "core"
  core?: ArpeggioShape;          // the entry an override replaces, still reachable
  alternatives: ArpeggioShape[]; // other overrides registered for the same slot
  slotKey: string;
}
export function arpeggioSlotKey(slot: ArpeggioSlot): string;      // stable, deterministic
export function slotForChordShape(shape: ChordShape): ArpeggioSlot;
export function resolveArpeggioForSlot(slot: ArpeggioSlot): ArpeggioResolution;
export function visibleArpeggios(options?: { includeOverridden?: boolean }): ArpeggioShape[];
```

- `arpeggioSlotKey` = `` `${system ?? "*"}|${chordType}|${cagedPosition ?? "*"}|${rootString}` ``.
- Resolution order: **override → core → derived**. A candidate is an override iff its
  `overrides` names another registered arpeggio in the same slot. Multiple overrides →
  deterministic pick = **last registered**, the rest returned in `alternatives`.
  Core preference: `featured === true` first, else first registered.
- `visibleArpeggios()` excludes every shape that is the `overrides` target of another
  registered shape; `includeOverridden: true` returns everything (the core must stay
  reachable — raw `all()` cannot express both).

**1.8 New pure helpers (public API)**

```ts
export function isMovable(shape: ChordShape): boolean;            // movable ?? canonicalRoot === undefined
export function playedStringSet(shape: ChordShape): number[];     // indices where strings[i] != null
export function impliedStringSet(shape: ChordShape): number[];    // shape.stringSet ?? playedStringSet(shape)
export function gripBaseFret(frets: (number | null)[]): number;   // min non-null, non-zero fret; 0 if none
export function absoluteBarreFret(barre: Barre, gripBase: number): number;  // gripBase + barre.fret
export function sourceGripBaseFret(shape: ChordShape, sourceFrets: (number|null)[]): number;
export function exportIdentifierFor(kind: "chord"|"scale"|"arpeggio", shape: { name: string }): string;
```

- `isMovable` replaces every open-coded `canonicalRoot === undefined`, including
  `checkFingerZeroOnMovable` (`src/audit.ts:126`). No behavior change today (no shape sets
  `movable`).
- `exportIdentifierFor` is deterministic: uppercase-snake of the name with a kind prefix, e.g.
  `("chord", { name: "E Shape Minor" }) → "CAGED_CHORD_EM"` is **not** derivable from the name
  alone, so the rule is: `<KIND_PREFIX>_<NAME_UPPER_SNAKE>` (`CHORD_E_SHAPE_MINOR`), with an
  explicit `ident` override allowed in the changeset for authored constants that want the
  project's existing shorthand (`CAGED_CHORD_EM`). Collisions are detected, never guessed.

**1.9 Barre fret origin (D-010, definition change)**

- `Barre.fret` is redefined as **an offset in frets from the grip base**, where grip base =
  the lowest *fretted* (non-null, non-zero) fret of the shape as placed. Open strings never
  set the grip base.
- Absolute fret for a built grip: `absoluteBarreFret(barre, gripBaseFret(fingering.frets))`.
- Absolute fret for an authored source diagram: `absoluteBarreFret(barre,
  sourceGripBaseFret(shape, chordShapeGeometry(shape).sourceFrets))`.
- The type doc on `Barre` must state the convention; `src/data/open-chords.ts`'s header
  comment about `absFret` must be updated in the same change.

**1.10 Chord-scale rule (D-009) — new pure module `src/chord-scale.ts`**

Stored explicitly and versioned so it can evolve without changing authored data. Zero Tonal
deps (the table is data; name resolution happens in the integration tier).

```ts
export const CHORD_SCALE_RULE_VERSION = 1;
export interface ChordScaleEntry { scaleType: string; alternates?: string[]; }
export const CHORD_SCALE_RULE: Record<string, ChordScaleEntry>;
export function scaleTypeForChordType(chordType: string): ChordScaleEntry | undefined;
```

v1 table (exact): `M` → `major`; `maj7` → `major`; `m` → `aeolian` (alternates
`["dorian", "major"]`); `m7` → `aeolian` (alternates `["dorian", "major"]`); `7` →
`mixolydian`; `m7b5` → `locrian`. `dim`, `dim7`, `aug` are intentionally **absent**
(`undefined` = "no box system yet; derive from grip only"). Alternates are exposed but not
user-selectable in this feature.

**1.11 `src/index.ts` exports**

Add: `CagedPosition`, `ArpeggioShape`, `arpeggioShapes`, `remove`, `isMovable`,
`playedStringSet`, `impliedStringSet`, `gripBaseFret`, `absoluteBarreFret`,
`sourceGripBaseFret`, `exportIdentifierFor`, `arpeggioSlotKey`, `slotForChordShape`,
`resolveArpeggioForSlot`, `visibleArpeggios`, `ArpeggioSlot`, `ArpeggioResolution`,
`ArpeggioTier`, `CHORD_SCALE_RULE`, `CHORD_SCALE_RULE_VERSION`, `scaleTypeForChordType`,
`ChordScaleEntry`, plus everything from §3 and §5.4.

---

### 2. Library helpers & fingering — `src/build.ts`, `src/integration.ts`

**2.1 `Fingering` carries fingers and barres (closes #66)** — `src/build.ts:270-276`

```ts
export interface Fingering {
  positions: FrettedNote[];
  frets: (number | null)[];
  root: string;
  shapeName: string;
  startFret: number;
  fingers: (number | null)[];  // NEW — passed through from shape.fingers, length = tuning.length
  barres: Barre[];             // NEW — barre.fret resolved to ABSOLUTE for this build
}
```

- `fingers` is a copy of `shape.fingers` (never mutated, never re-derived).
- `barres` preserves `fromString`/`toString`/`finger` and sets
  `fret = gripBaseFret(frets) + shape.barres[i].fret`.
- Additive only: `applyChordShape`'s signature, note placement and `startFret` are unchanged.
- Required-peer tier — no new imports beyond `./shape`.

**2.2 Auto-fingering helper (workbench starting point)** — `src/build.ts`

```ts
export function autoFingering(shape: Omit<ChordShape, "fingers"|"barres">, root: string,
                              tuning?: string[]): { fingers: (number|null)[]; barres: Barre[] };
```

Rule (documented, deterministic): lowest fretted fret → finger 1, then increasing fret →
increasing finger, capped at 4; equal frets on ≥2 adjacent strings collapse into a `Barre`
with the shared finger; open strings → `0`; muted → `null`. The editor seeds from this and
the author may override; the audit runs the same checks either way.

**2.3 Parent-box selection for a chord grip** — `src/integration.ts` (optional tier)

```ts
export function parentBoxForChordShape(shape: ChordShape, root: string, tuning?: string[]):
  { box: ScaleShape; scaleName: string; ruleVersion: number } | undefined;
```

Implements §1.10: `scaleTypeForChordType(shape.chordType)` picks the scale, then the box is
the registered scale shape whose **`rootString` equals the grip's `rootString`** after
`relabelShapeToScale(box, `${root} ${scaleType}`)` (`src/integration.ts:200`). Returns
`undefined` when the chord type has no rule entry or no rotation-compatible box exists.
Mode boxes that are not registered today (mixolydian, dorian, locrian) are **derived on
demand** via `relabelShapeToScale`; seeding them as first-class entries with
`cagedPosition` + `quality`, following the `relabelOrThrow` precedent in
`src/data/caged-scales-minor.ts:30-42`, is a later phase.

**2.4 `arpeggioFor` (derive fallback wiring)** — `src/integration.ts`

```ts
export function arpeggioFor(shape: ChordShape, root: string, tuning?: string[]):
  { resolution: ArpeggioResolution; fretted: FrettedScale };
```

Calls `resolveArpeggioForSlot(slotForChordShape(shape))`; for tier `"override"`/`"core"`
builds the stored shape with `buildFrettedScale`; for `"derived"` uses
`parentBoxForChordShape` + the already-shipped `arpeggioFromShape`
(`src/integration.ts:118-128`) — **zero new arpeggio primitives are required**. Lives in the
optional tier because it needs `@tonaljs/scale`/`@tonaljs/chord`; `src/shape.ts` stays pure.

---

### 3. Audit — `src/audit.ts` (required tier) + new `src/audit-integration.ts` (optional tier)

**3.1 New required-tier checks in `src/audit.ts`** (imports stay limited to `./build`,
`./shape`, `./tuning`, `@tonaljs/note` — CLAUDE.md)

| Constant | id | Severity | Flags |
| --- | --- | --- | --- |
| `CHECK_STRINGSET_MISMATCH` | `stringset-mismatch` | warning | `shape.stringSet` is defined and does not deep-equal `playedStringSet(shape)`. |
| `CHECK_TUNING_MISMATCH` | `tuning-mismatch` | warning | `shape.tuning` is defined and does not deep-equal the tuning the shape is being built against. |
| `CHECK_BARRE_FRET_ORIGIN` | `barre-fret-origin` | warning | A `barre.fret` that cannot be an offset: `< 0`, or `>` the shape's fretted span, or (for `baseFret`-carrying shapes) equal to an absolute source-diagram fret while a valid offset exists. Details carry `{ barreIndex, fret, span, gripBase, suggestedOffset }`. |
| `CHECK_NAME_UNIQUE` | `name-unique` | **error** | The shape's `name` is already registered in the target registry, or its export identifier already exists in `src/data`. Signature: `checkNameUnique(shape, kind, options?: { knownNames?: Set<string>; knownIdentifiers?: Set<string> })` so the merge script can pass merge-time sets without touching the live registry. |

- `checkFingerZeroOnMovable` switches to `isMovable(shape)`.
- `auditChordShape` composes the new chord checks alongside the existing six, reusing the
  single hoisted `applyChordShape` build (existing CR-001 optimisation preserved).
- New `auditArpeggioShape(shape: ArpeggioShape, options?)` running only the tier-safe checks:
  build-loss (`checkScaleBuildLoss`), `position-span`, `fingering-complete`,
  `overrides-target` (the named core exists). Chord-tone checks are optional tier (§3.2).

**3.2 New module `src/audit-integration.ts` (D-006)**

- Imports only `./audit`, `./build`, `./shape`, `./tuning`, `@tonaljs/chord`, `@tonaljs/note`.
  It MUST NOT be imported by `src/audit.ts`.
- `CHECK_IDENTIFY_MISMATCH = "identify-mismatch"` (warning): Tonal `detect()` on the built
  grip's pitch classes at the build root does not include `shape.chordType`. Details:
  `{ detected: string[], expected: string, root: string }`. Skipped (returns `[]`) when
  `chordType` is undefined.
- `CHECK_CHORD_TONES_ONLY` (warning), `CHECK_COVERS_CHORD` (warning),
  `CHECK_CONTAINS_CHORD_GRIP` (warning) for arpeggio shapes — all need
  `Chord.get(chordType).intervals`.
- Aggregates: `auditChordShapeIntegration(shape, options)`,
  `auditArpeggioShapeIntegration(shape, options)`, `auditAllShapesIntegration(options)`, and a
  composer `auditChordShapeFull(shape, options)` = base ++ integration.
- Exported from `src/index.ts` (which already pulls the optional tier via `./integration`).
- The workbench composes both check sets; `auditAllShapes` in `audit.ts` is unchanged and
  never gains an optional-peer flag.

**3.3 Rule: the app never reimplements a check.** Every entry in the editor's "Checks" card
maps 1:1 to an exported check function id.

---

### 4. Data corrections & new data — `src/data/*`

**4.1 Barre-fret migration (D-010) — its own PR/task, gated**

- Scope: `src/data/open-chords.ts` — **70 chord shapes, 35 `barres` entries** (verified).
  Of those, **10 entries already store `fret: 0`** (the movable `"* Form * Barre"` shapes,
  `baseFret: 1`) and **25 store absolute frets 1–3**.
- Transform: `newFret = absoluteFret − sourceGripBase`, where `sourceGripBase` is the minimum
  **non-zero** fret of the shape's source diagram. Worked examples that must appear as
  fixtures:
  - **Open shape with open strings** — `"A Major Open"` (`x02220`, `baseFret: 1`,
    barre `fret: 2`, strings 2–4): grip base 2 → **offset 0**.
  - **Open shape whose barre sits above the grip base** — `"C Sus2 Open"` (`baseFret: 1`,
    barre `fret: 3`): offset = 3 − grip base.
  - **Fixed barre shape** — `"C Minor Open"` (`x35543`, `baseFret: 3`, barre `fret: 3`):
    grip base 3 → **offset 0**.
  - **Movable barre form** — `"E Form Major Barre"` (`baseFret: 1`, barre `fret: 0`):
    **already an offset, must stay `0`**. A blanket `fret − baseFret` transform would yield
    `-1`; this is the trap the task exists to avoid.
- Blast radius (verified): `applyChordShape` never reads `barres`; `checkRepeatedFingerNoBarre`
  (`src/audit.ts:147`) reads `finger`/`fromString`/`toString` but **not** `fret`, so the change
  is behaviour-neutral there; the display consumer is
  `site/app/shapes/components/ShapeCardChordTable.tsx:43-45` (`barreLabel`), which must be
  updated to render `offset N (fret M at <root>)` using `absoluteBarreFret`.
  Tests that encode literal barre values must be updated in the same commit.
- Regression gates: the `barre-fret-origin` check must report zero issues across the registry
  after migration; a before/after fixture test asserts the three classes above.

**4.2 Jazz shells 16 → the traditional 8 (D-012)** — `src/data/jazz-shells.ts`

- Today `SHELL_DICTIONARY` × 2 string sets × 2 orderings generates **16** shapes.
- Correction: pair each ordering with exactly one string set instead of taking the cross
  product:
  - **E-root, R·x·7·3** on strings 6·4·3 → `stringSet [0, 2, 3]`, using the `R-7-3` pattern
    (`"1P 7M 10M"` etc.): `strings[0] = "1P"`, `strings[2] = <7th>`, `strings[3] = <3rd>`.
  - **A-root, R·3·7** on strings 5·4·3 → `stringSet [1, 2, 3]`, using the `R-3-7` pattern.
  - 4 chord types × 2 root strings = **8 shapes**.
- Names: `"Shell <type> E-root"` / `"Shell <type> A-root"` (replacing
  `"Shell <type> R37 012"` etc.).
- `SHELL_DICTIONARY` (public API, exported from `src/index.ts:173`) keeps its
  `VoicingPatternDictionary` shape and values — only the generation pairing changes. This is
  a non-breaking data fix.
- `omittedIntervals`, `voicingFamily: "shell"`, `system: "shell"`, `inversion: 0`,
  `rootString` semantics all unchanged. m7 and m7b5 keep sharing geometry (differing only in
  `omittedIntervals`: `5P` vs `5d`).
- **Deliberate test rewrite in the same task** (`src/data/data.test.ts`):
  `:683` `toHaveLength(16)` → `8`; `:897` `shellCount` `16` → `8`; the shape-finding tests at
  `:667-755` switch from `name.includes("R37")` / `"R73"` + `stringSet` matching to the new
  `E-root`/`A-root` names and `[0,2,3]`/`[1,2,3]` string sets; total chord-shape count moves
  132 → 124. Re-verify `:1289` (`featured` chord count `32`) is unaffected — no shell shape
  currently sets `featured` — and update it only if that changes.

**4.3 CAGED minor triad row (closes #57)** — new `src/data/caged-chords-minor.ts`

- 5 movable minor triad chord shapes: `"C Shape Minor"`, `"A Shape Minor"`,
  `"G Shape Minor"`, `"E Shape Minor"`, `"D Shape Minor"`.
- Each carries: `system: "caged"`, `cagedPosition`, `chordType: "m"`,
  `voicingFamily: "caged"`, `inversion: 0`, `stringSet`, `rootString`, `fingers`, `barres`
  (offset convention), `parentShape: "<X> Shape Major"`, `tags: ["caged","triad","core"]`.
- **Authored in the workbench and landed via `npm run shapes:merge`** — this is the feature's
  dogfooding acceptance criterion, not a hand-written file.
- Registered in `src/index.ts` immediately after `./data/caged-chords`.
- `src/data/data.test.ts` / `src/index.test.ts` count assertions updated deliberately.

**4.4 Metadata backfill on the CAGED majors** — `src/data/caged-chords.ts`

- The 5 constants lack `chordType`/`voicingFamily`/`cagedPosition` entirely
  (`src/data/caged-chords.ts:11-67`). Backfill `chordType: "M"`,
  `voicingFamily: "caged"`, `cagedPosition: "E"|"A"|"D"|"C"|"G"` as `update` ops in the same
  changeset (the canvas's worked `"A Shape Major"` example).
- **Edge case — this changes audit expectations.** `src/audit.ts`'s
  `checkChordMetadataCompleteness` docstring and `src/audit.test.ts:714-770` explicitly encode
  that these 5 shapes surface one metadata-completeness warning each. Both the docstring and
  those assertions must be rewritten in the same commit, with the warning count going to zero
  for these shapes.
- `cagedPosition` backfill on `src/data/caged-chords-7th.ts` (11 shapes) is in scope for the
  same changeset if the merge script's owned-block coverage includes that file; otherwise it
  is deferred and tracked.

**4.5 No silent auto-fixing.** Any other pre-existing data debt surfaced visually by the
workbench (span issues, mistagged `OPEN_G_DIM`/`OPEN_G_M7B5` from #97) is **reported and
tracked as separate issues**, never fixed as a side effect of this feature.

---

### 5. Packages

No npm workspaces. Every new package follows the existing plain `file:` convention used by
`packages/fretboard-ui` (`site/package.json:20`, `"tonal-guitar": "file:../.."`).

**5.1 `packages/fretboard-ui` — additive extensions only**

- `EditorCell` gains `finger?: number | null` and `muted?: boolean`
  (`packages/fretboard-ui/src/FretboardEditor.tsx:14-18`).
- `FretboardEditorProps` gains `tool?: "select"|"note"|"root"|"finger"|"barre"|"mute"`,
  `activeFinger?: 1|2|3|4`, `barres?: { fret: number; fromString: number; toString: number; finger: number }[]`,
  `onBarresChange?`, `ghostMarkers?: FretMarker[]` (for "show core as ghost" /
  "show parent box" later).
- `cellsToScaleShapeStrings` gains an optional companion
  `cellsToChordShape(cells, tuning, rootPitchClass)` returning
  `{ strings: (string|null)[]; fingers: (number|null)[]; barres: Barre[]; rootString: number } | null`
  (one interval per string; returns `null` when no root is marked).
- `Orientation` (`horizontal` | `vertical`) and `FretboardLayout.orientation` already exist
  (`packages/fretboard-ui/src/types.ts:8,72`) — the diagram toggle uses them, nothing new.
- All existing exports and behaviour are preserved; `site/app/shapes` must build unchanged
  after these additions.

**5.2 `packages/shape-catalog` (new, pure — zero React, zero DOM)**

- `package.json`: `"name": "shape-catalog"`, `private: true`, `main`/`types` →
  `src/index.ts`, peer deps `tonal-guitar` + the Tonal peers. `devDependencies` mirror
  `fretboard-ui`'s (`"tonal-guitar": "file:../.."`).
- **Move-only extraction** of `site/app/shapes/components/shapeLibraryUtils.ts` (1010 lines) →
  `src/catalog.ts` and `shapeDetailUtils.ts` (350 lines) → `src/detail.ts`. Both are already
  zero-React and import only `"tonal-guitar"`.
- The single site coupling is `REPO_SLUG` (`shapeLibraryUtils.ts:28`, used only by
  `REPORT_ISSUE_BASE_URL`/`buildReportUrl`). Replace with injected config:
  `export interface CatalogConfig { repoSlug: string }` and
  `buildReportUrl(entry: ShapeCatalogEntry, config: CatalogConfig): string`. The site passes
  `{ repoSlug: REPO_SLUG }` from `site/lib/repo.ts`; the workbench passes the same.
- New pure models added here (not in the site):
  - `boardModel(catalog, options)` where
    `options = { kind: "chord"|"scale"|"arpeggio"; axis: "cagedPosition"|"stringSet"|"inversion"; rowGrouping: "chordType"|"stringSet"; typeFilter?: ChordQualityGroup[]; search?: string; drafts?: Map<string, DraftBadge> }`
    returning `{ columns: BoardColumn[]; rows: BoardRow[]; cells: Map<string, BoardCell>; counts: { shown: number; total: number; gaps: number } }` with
    `BoardCell = { key: string; rowKey: string; columnKey: string; state: "filled"|"gap"|"draft"; entry?: ShapeCatalogEntry; slot: ArpeggioSlot | ChordSlot }`.
  - `renderShapeTs(kind, shape, options?)` — re-export of the single TS printer (§6.5) so the
    editor's "Output preview / Copy TS" and the merge script emit byte-identical code.
  - `draftToChange(draft)` / `buildChangeset(state)` — pure construction of a `Changeset`
    (§6.1) from workbench draft state, including `exportIdentifierFor` and collision checks.
  - `diffShape(before, after)` → `{ added: string[]; removed: string[]; changed: {field,before,after}[]; geometryChanged: boolean }` for the Export screen's per-change diff.
- Colocated vitest tests (`packages/shape-catalog/src/**/*.test.ts`).

**5.3 `packages/shape-library-ui` (new, framework-neutral React)**

- `package.json`: `"name": "shape-library-ui"`, `private: true`, `main`/`types` →
  `src/index.ts`; peer deps `react`, `react-dom`, `tonal-guitar`; `file:` deps
  `fretboard-ui`, `shape-catalog`.
- **Hard constraints:** no `next/*` imports; no Tailwind/Fumadocs class names; no `window`
  access during render (must prerender under Next `output: "export"`); no top-level import of
  any editor-only module.
- **Styling strategy:** one plain stylesheet `src/styles.css` with `tg-`-prefixed class names
  driven by CSS custom properties (`--tg-surface`, `--tg-border`, `--tg-fg`, `--tg-muted`,
  `--tg-accent`, `--tg-warn`, `--tg-error`, `--tg-gap`). Consumers import the stylesheet and
  map their theme onto the variables (the site maps Fumadocs `--fd-*` tokens; the workbench
  ships its own defaults). Fretboard rendering itself keeps `fretboard-ui`'s existing
  theme-object approach — no change.
- **Components** (all read-only unless capabilities are injected):
  `ShapeBoard`, `BoardCellCard`, `ShapeCard`, `ShapeCardDiagram`, `ShapeCardChordTable`,
  `IssueBadges`, `FilterBar`, `ShapeDetailPanel`, `ChordDetailView`, `ScaleDetailView`,
  `ShapeDiagram` (orientation-aware wrapper over `fretboard-ui`'s `Fretboard`),
  `DiagramOrientationToggle`, `ColumnsToggle`.
- **Capability props (D-002)** — the single read-only/editing switch:

```ts
export interface EditCapabilities {
  onCreateShape?(slot: BoardSlot): void;
  onEditShape?(entry: ShapeCatalogEntry): void;
  onDuplicateToPosition?(entry: ShapeCatalogEntry, position: CagedPosition): void;
  onAddTag?(entry: ShapeCatalogEntry, tag: string): void;
  draftFor?(slotKey: string): { label: string; status: "draft"|"in-changeset" } | undefined;
  exportState?: { pendingCount: number; onExport(): void };
}
export interface LibraryCapabilities {
  edit?: EditCapabilities;
  reportIssueUrl?(entry: ShapeCatalogEntry): string;
}
export const ShapeLibraryProvider: React.FC<{ capabilities?: LibraryCapabilities; children }>;
export function useLibraryCapabilities(): LibraryCapabilities;  // defaults to {}
```

  - The site never passes `edit`; the workbench always does. No runtime dev-server sniffing,
    no separate entry points.
  - **Testable invariant:** rendering any component without a provider (or with
    `capabilities.edit === undefined`) produces markup containing **zero** elements with
    `data-tg-edit`; gap cells render as inert `<div data-tg-gap>` instead of
    `<button>Create …</button>`.
  - A future auth'd deployment only decides which capabilities to inject — the architecture
    must not preclude it, but auth itself is out of scope.

**5.4 `packages/shape-workbench` (new, Vite + React — the first Vite consumer in the repo)**

- Vite 5 + React 18 + TypeScript. `file:` deps: `tonal-guitar` (`file:../..`),
  `fretboard-ui`, `shape-catalog`, `shape-library-ui`; devDeps `vite`,
  `@vitejs/plugin-react`, `typescript`. Root convenience script:
  `"workbench": "npm --prefix packages/shape-workbench run dev"`.
- **Routing:** hash-based, no router dependency — `#/board` (default),
  `#/editor/<slotKey|shapeName>`, `#/export`. Unknown hash → `#/board`.
- **MVP screens (D-004): Board + Editor + Export only.** Graph and the standalone Chords page
  are deferred; the data model above (`chordType`, `parentShape`, `cagedPosition`,
  `arpeggioShapes`, resolvers, chord-scale rule) is specified now so they need no model
  changes later.
- **State:** one `WorkbenchStore` (React context + `useReducer`), shape:

```ts
interface WorkbenchState {
  tuning: string[];               // STANDARD in MVP; picker locked
  authorRoot: string;             // default "A"
  orientation: Orientation;       // "vertical" | "horizontal"
  columnAxis: "cagedPosition" | "stringSet" | "inversion";
  drafts: Record<string, DraftShape>;   // keyed by slotKey or shape name
  changes: ChangesetChange[];           // the pending changeset
  lastWrittenAt?: string;
}
```
  Persisted to `localStorage` on every change (crash resilience) and to
  `.workbench/changeset.json` only on explicit "Write changeset.json".
- **Dev-server plugin** `src/plugins/workbench-io.ts` (`apply: "serve"` — never in `build`):
  - `GET  /__workbench/status` → `{ writable: true, repoRoot, libraryVersion }`
  - `GET  /__workbench/changeset` → current `.workbench/changeset.json` or `404`
  - `POST /__workbench/changeset` → validates the payload against the schema, writes
    `<repoRoot>/.workbench/changeset.json` (creating the dir), returns
    `{ path, bytes, changeCount }`.
  - **Path containment:** every write target is resolved and asserted to live under
    `<repoRoot>/.workbench/`; anything else is a 400. The plugin writes nowhere else, ever.
- **Editor requirements:**
  - Tools: Select / Note / Root / Finger (1–4) / Barre (drag across strings) / Mute.
  - "Author at root" selector; shape is **stored as intervals**, never frets
    (`cellsToChordShape`); the lowest string carrying `1P` becomes `rootString`.
  - **Refuses to save without a `1P`** ("marking a root is what makes the shape movable").
  - Labels toggle: intervals / notes / fingers. Frets window 0–12. Diagram
    horizontal/vertical. Open strings toggle present but **disabled in MVP** (phase 4).
  - Live Checks card = `auditChordShape` + `auditChordShapeIntegration` results, one row per
    check id, updated on every edit.
  - Identify row: Tonal `detect` of the built grip vs declared `chordType`.
  - "At other roots" strip: `applyChordShape` at C/D/E/G/A with open strings disabled.
  - Output preview: TS (via `renderShapeTs`) and JSON (the `changeset@1` change object), with
    "Copy" — the TS must be byte-identical to what `shapes:merge` writes.
  - Properties panel exposes every field in §1.2 plus `featured`, and shows the derived
    `movable` reason ("no open strings; canonicalRoot unset").
- **Board requirements:** CAGED grid (chord type rows × C·A·G·E·D columns) from
  `boardModel`; family/type filters and search from `shape-catalog`; per-cell state
  filled / gap / draft; "Create <X> Shape <type>" on gaps; header shows
  `Showing N of M · K gaps` and the pending-changes count.
- **Export requirements:** list of pending changes with op glyph, target file, and check
  status; per-change diff (TS diff / JSON / before-after) from `diffShape`; "what test counts
  are touched" summary; conflicts summary (name/identifier collisions); "Write
  changeset.json" button; the exact merge command to copy.

---

### 6. Merge script — `scripts/shapes-merge.mjs` + `changeset@1` schema (D-005)

**6.1 `tonal-guitar/changeset@1` schema (public type, exported from the library)**

```ts
export interface Changeset {
  $schema: "tonal-guitar/changeset@1";       // exact string, required
  version: string;                            // registry VERSION the edits were made against
  tuning: string[];                           // authoring tuning; MVP must equal STANDARD
  generator?: string;                         // e.g. "shape-workbench@0.1.0"
  createdAt?: string;                         // ISO 8601
  changes: ChangesetChange[];                 // required, non-empty
}
export type ChangesetKind = "chord" | "arpeggio" | "scale";
export type ChangesetChange = AddChange | UpdateChange | RemoveChange;

export interface AddChange {
  op: "add";
  kind: ChangesetKind;
  file: string;            // data-file basename, no path/extension, /^[a-z0-9-]+$/
  ident?: string;          // export identifier; generated via exportIdentifierFor when absent
  after?: string;          // registration-order anchor: another data-file basename
  shape: ChordShape | ScaleShape | ArpeggioShape;   // per `kind`
}
export interface UpdateChange {
  op: "update";
  kind: ChangesetKind;
  name: string;            // must resolve to exactly one registered shape
  patch: Record<string, unknown>;   // partial of the shape type
}
export interface RemoveChange {
  op: "remove";
  kind: ChangesetKind;
  name: string;
}
```

Exported as types from `src/index.ts` (`Changeset`, `ChangesetChange`, `AddChange`,
`UpdateChange`, `RemoveChange`, `ChangesetKind`) even though the merge script itself is
internal.

**6.2 Validation (refusals, all before any write)**

1. `$schema !== "tonal-guitar/changeset@1"` → refuse.
2. `version !== VERSION` (`src/version.ts`) → refuse unless `--force` (version drift).
3. `tuning` not deep-equal `STANDARD` → refuse unless `--force` (alternate tunings are out of
   scope).
4. Per-kind required fields: **chord** → `name`, `system`, `strings` (length ===
   `tuning.length`), `fingers` (same length), `barres` (array), `rootString` (integer within
   range); **scale** → `name`, `system`, `strings` as `(string[]|null)[]`, `rootString`;
   **arpeggio** → scale fields **plus** required `chordType`.
5. `file` must match `/^[a-z0-9-]+$/` and must not be in the **computed-file deny list**
   (`caged-scales-minor`, `pentatonic-minor` — they call `relabelShape` at import time).
6. `name-unique` (§3.1) against the live registry **and** within the changeset; export
   identifier unique across all of `src/data`.
7. `overrides` targets must exist in the registry or in the same changeset.
8. Every added/updated shape is audited (`auditChordShapeFull` / `auditArpeggioShape*` /
   `auditScaleShape`): any **error** refuses the merge; warnings print and continue.
9. `update`/`remove` targets must live inside a generator-owned region (§6.3) — otherwise
   refuse with a message naming the file and the constant.

**6.3 Generator-owned blocks (never text-patch hand-written code)**

- **New files** created by the script are entirely generated and carry the header
  `// GENERATED FILE — managed by \`npm run shapes:merge\`. Edit via the Shape Workbench.`
- **Existing files** are only writable inside per-constant markers, which are added as a
  one-time, human-reviewed prep step (Phase 1) to the files on the write allow-list:

```ts
// shapes-merge:begin CAGED_CHORD_A
export const CAGED_CHORD_A: ChordShape = { … };
// shapes-merge:end CAGED_CHORD_A
```

- **Write allow-list for this feature:** `src/data/caged-chords.ts` (5 constants) plus any
  file the script itself created. `open-chords.ts`, `extended-chords.ts`,
  `caged-chords-7th.ts` and `jazz-shells.ts` stay unmanaged in MVP; updates targeting them
  refuse with an explanatory message. (The barre migration and the shells fix are
  hand-authored commits, not merge-script operations.)
- **Registration order** in `src/index.ts` is a single owned block:

```ts
// shapes-merge:begin data-imports
import "./data/caged-scales";
…
// shapes-merge:end data-imports
```
  A new file is inserted after its `after` anchor; default anchor is the file declaring the
  shape's `parentShape`, else the end of the block.
- The block is regenerated **whole**; content outside markers is byte-preserved.

**6.4 Test-count assertions (never incidental)**

- Hard-coded counts live at `src/data/data.test.ts:683,891,897,1111,1289,1355` and
  `src/index.test.ts:388,393,398,402`.
- Default behaviour: the script **reports** every count it would invalidate
  (`test counts touched: data.test.ts:897 shellCount 16 → 8`) and **does not edit tests**.
- `--update-counts` (explicit opt-in) rewrites only lines annotated with a
  `// shapes-merge:count <name>` marker, added during Phase 1 next to each registry-count
  assertion. Anything unannotated is reported, never edited.

**6.5 Single TS printer, shared with the browser**

- `scripts/lib/render-shape.mjs` (plus `render-shape.d.ts`) owns identifier naming, key order,
  quoting and formatting for chord/scale/arpeggio constants. `packages/shape-catalog`
  re-exports it (`src/render.ts`) so the workbench's "Copy TS" and the merge script's output
  are byte-identical — a test asserts this.
- Output is deterministic. If `prettier` (already a devDependency) is resolvable, the script
  formats through the repo config; otherwise it falls back to the printer's own stable
  formatting. **No new runtime dependencies** — node builtins only.

**6.6 CLI**

```
npm run shapes:merge -- <changeset.json> [--dry-run] [--check] [--force]
                        [--update-counts] [--out <ident>] [--root <dir>] [--json]
```

- `--dry-run`: validate, compute, print a unified diff of every file that would change and a
  "files that will change" summary; **write nothing**; exit 0.
- `--check`: validate + assert the working tree already reflects the changeset (merge would be
  a no-op); exit 1 with the diff otherwise. This is the CI-safe gate.
- `--force`: bypasses only version-drift and tuning-mismatch refusals — never audit errors,
  never the computed-file deny list, never collision checks.
- `--out <ident>`: print the generated TS for one change to stdout.
- `--root <dir>`: operate on an alternate repo root — required so fixture tests never touch
  real `src/data`.
- `--json`: machine-readable summary `{ added, updated, removed, filesWritten, warnings, countsTouched }`.
- Human output mirrors the canvas Export screen: `✔ N shapes added, M updated`, per-file
  lines, `✔ audit: X errors, Y warnings in changed shapes`,
  `→ review with: git diff --stat`, `Undo: git checkout -- src/data`.
- **Idempotent:** re-running the same changeset produces zero diff.
- `package.json` gains `"shapes:merge": "node scripts/shapes-merge.mjs"`.

**6.7 Changeset file location (D-008)**

- `.workbench/` added to `.gitignore`; `.workbench/changeset.json` is a gitignored working
  file.
- Committed sample changesets live at `scripts/__fixtures__/changesets/*.json` with expected
  output trees under `scripts/__fixtures__/expected/`.

---

### 7. Docs site migration — `site/app/shapes` (D-003, vertical slice then incremental)

- **Vertical slice (gate for everything else):** one shared `ShapeCard` + `ShapeBoard` from
  `shape-library-ui`, backed by `shape-catalog`, rendering identically in the Next
  `output: "export"` build and in the Vite workbench — plus one chord edited → `changeset@1`
  written → `shapes:merge --dry-run` clean → merged → the same component renders it read-only
  in docs.
- **Then incremental migration inside this feature**, in this order:
  1. `shapeLibraryUtils.ts` / `shapeDetailUtils.ts` deleted; imports repointed to
     `shape-catalog` (`REPO_SLUG` passed in from `site/lib/repo.ts`).
  2. `ShapeCard`, `ShapeCardDiagram`, `ShapeCardChordTable`, `IssueBadges`,
     `CompactFretboard` replaced by `shape-library-ui` equivalents.
  3. `FilterBar` replaced.
  4. `ShapeDetailPanel` / `ChordDetailView` / `ScaleDetailView` replaced (the site keeps its
     `next/dynamic({ ssr: false })` code-split of the panel — `ShapeLibrary.tsx:34-37` — by
     dynamically importing the shared component).
  5. `ShapeLibrary.tsx` reduced to a thin Next adapter owning **only** URL state
     (`parseShapesUrlState`/`serializeShapesUrlState`), the mobile-breakpoint media query, and
     the dynamic import; `LazyShapeCard`'s IntersectionObserver behaviour moves into
     `shape-library-ui` behind a prop and stays SSR-safe.
- The read-only Board view (columns toggle + diagram orientation toggle) is added to
  `/shapes`; gap cells render inert, never "Create" buttons.
- `site/package.json` gains `"shape-catalog": "file:../packages/shape-catalog"` and
  `"shape-library-ui": "file:../packages/shape-library-ui"`; `site/next.config.mjs`
  `transpilePackages` becomes `["fretboard-ui", "shape-catalog", "shape-library-ui"]`.
- The site stays `output: "export"` with `basePath` under `DEPLOY` — unchanged; it never
  passes capability props, so no editing code paths exist in the static bundle.
- **`/admin` retired** once the workbench editor covers both `ScaleShape` and `ChordShape`
  export: delete `site/app/admin/page.tsx`, `layout.tsx`, `components/ShapeEditor.tsx`
  (which today exports ScaleShape only — `ShapeEditor.tsx:409-414`, exactly #66's gap) and
  document `npm run workbench` in its place.

---

### 8. Testing, tooling & CI

- **Vitest include** (`vitest.config.ts:5`) extended to
  `["src/**/*.test.ts", "scripts/**/*.test.mjs", "packages/*/src/**/*.test.{ts,tsx}"]`.
- **New/updated test files:**
  - `src/shape.test.ts` — replace-on-add position stability, `remove`, `arpeggioShapes`
    CRUD + `query` tag-superset matching, `isMovable` default, `playedStringSet`/
    `impliedStringSet`, `arpeggioSlotKey` stability, `resolveArpeggioForSlot` override→core→
    derived precedence + `alternatives` on duplicate overrides, `visibleArpeggios`
    include/exclude.
  - `src/build.test.ts` (or existing suite) — `Fingering.fingers`/`barres` pass-through with
    absolute barre frets; `autoFingering` determinism.
  - `src/audit.test.ts` — the four new checks incl. their zero-issue registry sweep; rewritten
    CAGED-major metadata assertions (`:714-770`) after the §4.4 backfill.
  - `src/audit-integration.test.ts` (new) — `identify-mismatch` positive/negative, and an
    import-graph assertion that `src/audit.ts` never reaches `@tonaljs/chord`.
  - `src/chord-scale.test.ts` (new) — the v1 mapping table and `scaleTypeForChordType`
    fallbacks.
  - `src/data/data.test.ts` — shells 16→8 rewrite (§4.2), CAGED minor row counts, barre
    offset fixtures for open / fixed-barre / movable-barre shapes.
  - `scripts/shapes-merge.test.mjs` (new) — fixture changesets covering: new-file add,
    owned-block update, remove, identifier collision, name collision, version drift,
    non-standard tuning, computed-file refusal, audit-error refusal, unmanaged-file refusal,
    `--dry-run` writes nothing, `--check` no-op detection, idempotence (run twice → zero
    diff), `--update-counts` touching only annotated lines, printer parity with
    `shape-catalog`'s `renderShapeTs`. All run against a temp copy via `--root`.
  - `packages/shape-catalog/src/*.test.ts` — `boardModel` gaps/counts, `buildChangeset`,
    `diffShape`, `buildReportUrl` config injection.
  - `packages/shape-library-ui/src/*.test.tsx` — the capability invariant (no `data-tg-edit`
    without capabilities; gaps inert), SSR-safety (renders under `renderToString` with no
    `window` access).
- **Lint** globs extended from `src/**/*.ts` to include `packages/*/src/**/*.{ts,tsx}` and
  `scripts/**/*.mjs`.
- **CI** (`.github/workflows/ci.yml`) gains, after the existing lint/test/build steps:
  `npm --prefix packages/shape-workbench run build` (typecheck + bundle) and
  `npm --prefix site run build` (static-export smoke, now that the site consumes the shared
  packages). The merge-script fixture tests run inside `npm test`.
- `src/version.ts` `VERSION` and `package.json` version are bumped together per CLAUDE.md when
  this ships.

---

### 9. Edge cases that must be explicitly handled

1. **Registry override resolution.** Replace-on-add solves *same-name* duplicates only.
   Overriding a *differently named* core requires the resolver layer (§1.7): `all()` cannot
   simultaneously hide the core and keep it reachable. Two overrides for one slot resolve
   deterministically (last registered) with the others exposed as `alternatives`.
2. **Barre-fret migration fixtures.** Three classes with different transforms:
   open-with-open-strings (grip base = lowest non-zero fret, not `baseFret`), fixed-barre
   (`baseFret: 3`, offset 0), movable barre form (`fret: 0` already an offset — a blanket
   `fret − baseFret` yields `-1` and must not be applied).
3. **`data.test.ts` hard-coded counts.** Shells (16), open+barre (70), scale names (27),
   featured chord (32), featured scale (5), CAGED sevenths (11). Every one that a change
   invalidates is updated in the same commit; the merge script reports but never silently
   edits them.
4. **Audit expectations encoded in prose.** `checkChordMetadataCompleteness`'s docstring and
   `audit.test.ts:714-770` assert the 5 CAGED majors are incomplete. The §4.4 backfill
   invalidates both and must rewrite them together.
5. **Static-export constraints.** `shape-library-ui` must render without `window` during
   prerender and must never import the dev-server client; the site never passes capabilities,
   so no editing code reaches the static bundle. The workbench dev-server plugin is
   `apply: "serve"` only and confines writes to `<repoRoot>/.workbench/`.
6. **Dependency tiers.** `src/shape.ts` (fields, registries, resolvers, helpers) and
   `src/chord-scale.ts` stay zero-Tonal; `src/build.ts`/`src/audit.ts` stay required-peer;
   `identify-mismatch`, chord-tone arpeggio checks, `arpeggioFor` and `parentBoxForChordShape`
   live in the optional tier (`audit-integration.ts` / `integration.ts`). An import-graph test
   enforces the `audit.ts` boundary.
7. **`SHELL_DICTIONARY` is public API.** The shells fix changes generation pairing only; the
   exported dictionary's shape and values are preserved.
8. **Computed data files.** `caged-scales-minor.ts` and `pentatonic-minor.ts` call
   `relabelShape` at import time; the merge script's deny list refuses them unconditionally
   (not even `--force`).
9. **No `1P`, no save.** The editor refuses to persist a shape without a marked root — that is
   what makes a template movable; `rootString` is derived from it, never guessed.
10. **Mode boxes not yet registered.** `parentBoxForChordShape` derives mixolydian/locrian/
    dorian boxes on demand via `relabelShapeToScale` and returns `undefined` rather than
    guessing when no rotation-compatible box exists.

---

### 10. Build sequence (phased, D-003 vertical slice first)

- [ ] **Phase 1 — Library foundations (no UI).** §1 data model, registries, resolvers,
      helpers; §1.10 chord-scale rule; §2.1–2.2 `Fingering` + `autoFingering`; §3 audit checks
      and `audit-integration.ts`; `src/index.ts` exports; `shapes-merge:begin/end` markers on
      `caged-chords.ts` + `src/index.ts` data-imports block; `shapes-merge:count` markers on
      the registry-count assertions; tests. **No data changes, no behaviour changes.**
- [ ] **Phase 2 — Vertical slice.** `packages/shape-catalog` move-only extraction;
      `packages/shape-library-ui` with `ShapeCard` + `ShapeBoard` + capability contract;
      `packages/shape-workbench` skeleton (Board + Editor + Export) with the dev-server
      plugin; `scripts/shapes-merge.mjs` with `--dry-run`/`--check` and fixture tests; site
      renders the shared `ShapeCard`. **Acceptance: one chord authored in the workbench →
      `.workbench/changeset.json` → `shapes:merge --dry-run` → merge → tests pass → the same
      component renders it read-only in the static site.**
- [ ] **Phase 3 — Barre-fret migration (own PR, gated).** `open-chords.ts` 35 entries,
      `barreLabel` update, before/after fixtures for the three classes, `barre-fret-origin`
      zero-issue sweep.
- [ ] **Phase 4 — Data.** Shells 16→8 with the deliberate `data.test.ts` rewrite; CAGED minor
      triad row authored through the workbench (closes **#57**); CAGED-major metadata backfill
      with the audit-test rewrite; fingering/barre export verified end-to-end (closes **#66**).
- [ ] **Phase 5 — Site migration completion.** FilterBar → detail panels → `ShapeLibrary`
      adapter; read-only Board on `/shapes`; delete the extracted site utils; retire `/admin`;
      CI gains the workbench and site build steps.
- [ ] **Later (specified, not built here):** arpeggio seed data and the Arpeggios/promote/
      override screens (#58), the standalone Chords page, the Graph screen, `"triad"` closed
      triad core set and string-set/inversion column modes, open strings and alternate
      tunings, mode-box seeding.

## Visual Design

Authority: the design canvas (`canvas-content.txt`; `Proposal.dc.html` is the verified draft
spec) — https://claude.ai/code/artifact/97d6fbbc-98f3-44be-8670-41aa00ceabcd. MVP renders the
Board, Editor and Export screens; Chord, Graph, Arpeggios, Diatonic and StringSets artboards
are reference for later phases.

- **Board (`#/board`, and read-only on `/shapes`).** Header: tuning summary, pending-changes
  count, "Export changeset" (workbench only). Kind tabs (Chords / Arpeggios / Scales),
  quality-group chips (All / Triads / Sevenths / Extended / Sus-Add), search with alias
  awareness (`ø` → half-dim, already in `shapeLibraryUtils`), family facet counts, a
  **Columns** control (CAGED position · String set · Inversion) and a **Diagrams** control
  (Vertical · Horizontal). Grid reads `type ↓ · position →` with a per-row count
  (`Minor m · 1/5`) and a header summary (`Showing 46 of 132 · 14 gaps`). Filled cells are
  cards with a diagram + `<root> · fr <n>`; gaps are dashed placeholders — a
  `Create <X> Shape <type>` button when `capabilities.edit` is injected, an inert
  `gap` marker otherwise; drafts get a `draft` chip.
- **Detail panel.** Read-only on both surfaces: preview line
  (`preview at A · frets 5 7 5 5 5 5 · identified Am7`), Links (`chordType`,
  `cagedPosition`, `parentShape`, arpeggio tier, scale box), Tags, and a Checks list rendering
  one row per audit check id with severity styling. `Edit` / `Duplicate to position` /
  `Add tag` appear only with capabilities; `Report problem` uses the injected
  `reportIssueUrl`.
- **Editor (`#/editor/*`, workbench only).** Breadcrumb + draft status
  (`draft · not in changeset`) and Discard / Run checks / Save to changeset. Left: tool
  palette (Select · Note · Root · Finger 1-4 · Barre · Mute), Author-at-root picker, Labels
  toggle (intervals / notes / fingers), fret window, Open-strings toggle (disabled in MVP),
  diagram orientation, legend, and the editing fretboard. Below: the interval / finger /
  fret / note table plus a barre summary line reading
  `barre · finger 1: strings 0–5 @ offset 0 (fret 5 at A)`. Right: Identify (Tonal detect),
  "At other roots" strip, Output preview (TS / JSON / Copy) with the target file line, the
  Properties form (every field in §1.2), and the Checks card.
- **Export (`#/export`, workbench only).** Change list with op glyph (`+`/`~`/`−`), shape
  name, target file, and check status; the written-file path; "Test counts touched"; a
  conflicts row; Copy-TS / Write-changeset.json buttons; the exact
  `npm run shapes:merge -- .workbench/changeset.json` command with a sample transcript, plus
  `Dry run: --check` and `Undo: git checkout -- src/data` hints. Per-change diff view with
  TS-diff / JSON / before-after tabs and a "geometry unchanged" badge for metadata-only edits.
- **Fretboard rendering is never reimplemented** — every diagram delegates to
  `packages/fretboard-ui` (`Fretboard`, `FretboardEditor`), using its existing
  `FretboardLayout.orientation` for the vertical (chord-box, low E left) / horizontal toggle
  and its `FretboardTheme.intervalColors` for the Root/3rd/5th/7th/9th legend.
- **Styling.** `shape-library-ui` ships plain CSS with `tg-` classes driven by CSS custom
  properties; the site maps Fumadocs `--fd-*` tokens onto them so `/shapes` keeps its current
  look, and the workbench supplies its own dark-first defaults. No Tailwind dependency inside
  the shared package.
- **Responsive.** The board grid collapses to a single column below the existing 768px
  breakpoint (`ShapeLibrary.tsx:52`), and the detail panel switches from docked sidebar to
  full-height bottom sheet — behaviour preserved from the current site and moved into the
  shared component behind a prop, with no `window` access during render.

## Existing Code to Leverage

**Shared React package precedent**
- `packages/fretboard-ui/` — private, unbuilt, `file:`-linked, `main`/`types` pointing at
  `src/index.ts`; consumed by the site via `transpilePackages`
  (`site/next.config.mjs:13`, `site/package.json:20`). Copy this exact packaging shape for
  `shape-catalog`, `shape-library-ui` and `shape-workbench`.
- `packages/fretboard-ui/src/FretboardEditor.tsx:14-33,217-251` — `EditorCell`,
  `cellsToScaleShapeStrings`, `frettedNotesToCells`, `pcAt`, `intervalFromTo`: the
  cells↔intervals round-trip the chord editor extends.
- `packages/fretboard-ui/src/types.ts:8,71-88` — `Orientation`, `FretboardLayout`,
  `FretMarker`, `FretboardTheme.intervalColors`: the diagram toggle and legend already exist.

**Pure catalog logic (direct move targets)**
- `site/app/shapes/components/shapeLibraryUtils.ts` (1010 lines) — `buildCatalog`,
  `ShapeCatalogEntry`, facet counts, grouping, sorting, alias-aware search, URL state
  serialization, `buildReportUrl`. Zero React; only site coupling is `REPO_SLUG` at line 28.
- `site/app/shapes/components/shapeDetailUtils.ts` (350 lines) — `chordDetailFor`,
  `inversionGroups`, `siblingStepper`, `relatedScalesForEntry`, `compatibleShapesForEntry`.

**Presentational components to promote**
- `site/app/shapes/components/`: `ShapeCard.tsx`, `ShapeCardDiagram.tsx`,
  `ShapeCardChordTable.tsx`, `IssueBadges.tsx`, `FilterBar.tsx`, `CompactFretboard.tsx`,
  `LazyShapeCard.tsx`, `ShapeDetailPanel.tsx`, `ChordDetailView.tsx`, `ScaleDetailView.tsx` —
  already delegate all fretboard drawing to `fretboard-ui`.
- `site/app/shapes/components/ShapeLibrary.tsx:34-37,52,66-71` — the `next/dynamic` code-split,
  mobile breakpoint and one-shot `auditAllShapes()`/`buildCatalog()` memo the Next adapter
  keeps.

**Library primitives**
- `src/integration.ts:67-128` — `arpeggioFromScale`/`arpeggioFromShape` already shipped; the
  derived arpeggio tier needs **zero** new library code.
- `src/integration.ts:200-211` — `relabelShapeToScale`, the chord-scale rule's engine.
- `src/transform.ts:15-19,44+` — `relabelShape`/`RelabelOptions` (pure tier).
- `src/data/caged-scales-minor.ts:30-42` — `relabelOrThrow`: the precedent for seeding
  relabeled data at import time with zero optional peers (mode-box seeding later).
- `src/shape.ts:141-145,159-202` — the `add`/`removeAll`/`query` registry pattern
  `arpeggioShapes` mirrors and that `remove`/replace-on-add extends.
- `src/audit.ts:341-451,476-550` — `gripRootFor`, `sourceFrets`, `chordShapeGeometry`,
  `auditChordShape`, `auditAllShapes`: the engine the editor's live Checks card reuses, and
  the source of the migration's `sourceGripBaseFret`.
- `src/data/extended-chords.test.ts:84-89` — the local `impliedStringSet` test helper to
  **promote** to production (`src/shape.ts`) and reuse in `stringset-mismatch`.
- `src/data/caged-chords.ts:11-67` — the 5 CAGED majors: the metadata-backfill targets and the
  `parentShape` anchors for the new minor row.
- `src/data/open-chords.ts:17-26` — the `baseFret` / `absFret` header comment that the barre
  migration must rewrite.

**Prior feature specs**
- `.tonal-guitar/features/shape-visual-audit-library/` (#97) — audit engine + documented data
  debt (not to be auto-fixed).
- `.tonal-guitar/features/shape-detail-panel/` (#139) — the read-only library this absorbs.
- `.tonal-guitar/features/minor-quality-shape-relabeling/` (#54) — relabel semantics.
- `.tonal-guitar/features/arpeggio-chord-shapes-detection-and-fingerings/` (#16) — shipped
  arpeggio primitives and the deferred #28-#37 backlog.

## Out of Scope

- **Auth'd deployment of edit mode.** The capability-prop architecture must not preclude it
  (an auth layer would only decide which capabilities to inject), but no auth is built.
- **Open-string shapes and alternate-tuning authoring.** The `tuning` field and the
  Open-strings toggle exist; the toggle is disabled and the tuning picker is locked to
  `STANDARD` in MVP (phase 4 / later).
- **Sweep arpeggios (#30)** — needs its own design decision first.
- **Full mode-box seeding** beyond what the chord-scale rule derives on demand.
- **Graph screen and the standalone Chords page** (D-004) — deferred past MVP; the data model
  that enables them is specified here.
- **Arpeggio seed data, promote-derived flow, teacher-override editor, Arpeggios tab** (#58) —
  the `ArpeggioShape` type, `arpeggioShapes` registry and resolvers ship empty and unused.
- **`"triad"` closed-triad core set, string-set/inversion column data** — the
  `VoicingFamily` value and the Columns control ship; the 12-per-type generated triad data
  does not.
- **Lab v2 items #64/#65/#67** (they touch `site/app/experiments/`, not `shapes/`/`admin/`)
  and adjacent library-API work **#34-#37**.
- **Blues scales (#56)** — the workbench makes the data entry easy; the data entry is its own
  task.
- **Silently auto-fixing pre-existing data debt** surfaced visually. The shells fix (§4.2) and
  the barre migration (§4.1) are the only explicit in-scope corrections; everything else is
  tracked as a new issue.
- **npm workspaces / tooling migration** — plain `file:` deps only.
- **Committed changeset history** — `.workbench/` is gitignored; the reviewable artifact is
  the generated `src/data` diff (D-008).

## Quality Criteria

- All requirements specific and testable — every check, refusal, transform and capability
  invariant above maps to a named test in §8.
- Data models specify all fields with types, optionality and defaults: §1.2 (`ChordShape`),
  §1.3 (`ScaleShape`), §1.5 (`ArpeggioShape`), §1.7 (resolver types), §2.1 (`Fingering`),
  §6.1 (`changeset@1`).
- UI requirements reference existing component patterns: `packages/fretboard-ui` for all
  fretboard rendering, the `site/app/shapes/components/*` tree as the extraction source, and
  the capability-prop contract (§5.3) as the single read-only/editing switch.
- Edge cases identified and addressed in §9: registry override resolution (resolver layer, not
  replace-on-add), barre-fret migration fixtures for open / fixed / movable shapes,
  `data.test.ts` hard-coded counts (report-by-default, opt-in `--update-counts`), and
  static-export constraints (SSR-safe shared components, `apply: "serve"` dev plugin,
  path-confined writes).
