# Specification: Shape Visual Audit Library

## Goal

Add a public, read-only "Shape Library" page to the deployed tonal-guitar docs site that renders every registered scale (27) and chord (132) shape as a fretboard diagram with full property display, surfaces likely-broken shapes first via client-side invariant badges, and offers a prefilled "report problem" GitHub link that feeds the `/fix` pipeline. The invariant logic ships as a pure, vitest-covered library module (`src/audit.ts`) that both `data.test.ts` and the site consume, so badge correctness is a single, testable source of truth. This continues the #39/#94/#96 data-quality lineage and gives non-developer guitar experts the first-ever path to review the shape catalog.

## User Stories

- As a **maintainer triaging shape data**, I want the `/shapes` page to sort badge-failing shapes to the top so that I can immediately see anomalies (e.g. the open `#96` `OPEN_G_AUG`/`OPEN_G_M7B5` span defects) without scrolling a wall of cards.
- As a **maintainer**, I want the invariant checks to live in `src/audit.ts` with vitest coverage and be reused by `data.test.ts` so that the badges and the CI gate can never drift apart.
- As a **guitar-expert reviewer without a dev environment**, I want to browse the full catalog with filters (type, system, voicingFamily/quality, name) and see each shape's rendered diagram, intervals, fingers, barres, and source frets so that I can visually judge whether a grip is wrong.
- As a **guitar-expert reviewer**, I want a "report problem" link that opens a prefilled GitHub issue carrying the shape's full identity and metadata so that I can flag a defect without spelunking the repo.
- As a **`/fix` agent consuming a report**, I want the issue body to be a stable structured payload (kind, name, metadata, render root/tuning, built frets, raw strings/fingers/barres, failing check IDs + details, library version) so that I can act without re-deriving context.

## Specific Requirements

### Library: Audit Module (`src/audit.ts` + `src/audit.test.ts`)

**Dependency tier (hard constraint).** `src/audit.ts` sits in the required-peer-deps tier alongside `build.ts`. It imports **only** `./build` (`applyChordShape`, `buildFrettedScale`), `./shape` (types + `chordShapes`/`all` if needed by aggregate helpers), `./tuning` (`STANDARD`), and may import `@tonaljs/note`/`@tonaljs/interval` (already required peers). It MUST NOT import `./integration` or reference `@tonaljs/scale`/`@tonaljs/chord`/`@tonaljs/key`. Verify with the existing dependency-layer discipline in CLAUDE.md.

**Core types (exported):**

```ts
export type AuditSeverity = "error" | "warning" | "info";

export interface ShapeAuditIssue {
  id: string;                          // one of the CHECK_* constants
  severity: AuditSeverity;
  message: string;                     // human-readable, for tooltips only
  details?: Record<string, unknown>;   // structured data (frets, strings, span, etc.)
}

export interface ShapeAuditOptions {
  root?: string;      // default: displayRootFor(shape)
  tuning?: string[];  // default: STANDARD
  maxFretSpan?: number; // default: 4
}
```

The site MUST branch on `issue.id`/`issue.severity`, never parse `message`.

**Check-ID constants (exported, string literals):**

```ts
export const CHECK_FRET_SPAN = "fret-span";
export const CHECK_FINGER_ZERO_ON_MOVABLE = "finger-zero-on-movable";
export const CHECK_REPEATED_FINGER_NO_BARRE = "repeated-finger-no-barre";
export const CHECK_BUILD_LOSS = "build-loss";
export const CHECK_METADATA_COMPLETENESS = "metadata-completeness";
export const CHECK_GEOMETRY_MISMATCH = "geometry-mismatch";
```

**Root helper (exported, pure, tested — D-005):**

```ts
export function displayRootFor(shape: { canonicalRoot?: string }): string {
  return shape.canonicalRoot ?? "C";
}
```

Scale shapes have no `canonicalRoot`, so they always render at `"C"`; open chord shapes render at their `canonicalRoot`; movable/barre shapes without `canonicalRoot` render at `"C"`.

**The six checks — precise semantics and severity:**

1. **`checkFretSpan(shape: ChordShape, root: string, tuning = STANDARD, maxSpan = 4): ShapeAuditIssue[]`** — `severity: "error"`.
   Build via `applyChordShape(shape, root, tuning)`. Compute `span` using the `data.test.ts:477` `maxSpan` variant that **excludes open strings**: `fretted = frets.filter(f => f !== null && f > 0)`, `span = fretted.length ? max - min : 0`. Emit an issue when `span > maxSpan`. `details: { span, frets, maxSpan }`. This is the canonical variant (supersedes the `extended-chords.test.ts:141` variant that does not exclude open strings). Catches the live `#96` defects.

2. **`checkFingerZeroOnMovable(shape: ChordShape): ShapeAuditIssue[]`** — `severity: "error"`.
   Static. Promote `data.test.ts:826-836`: a movable shape (`shape.canonicalRoot === undefined`) must never assert `fingers.includes(0)`. `details: { fingers }`.

3. **`checkRepeatedFingerNoBarre(shape: ChordShape): ShapeAuditIssue[]`** — `severity: "error"`.
   Static. Promote `data.test.ts:839-855`: for each adjacent pair `i, i+1` where `fingers[i] === fingers[i+1]`, `finger !== null && finger !== 0`, require a `barres` entry with `b.finger === finger && i >= b.fromString && i+1 <= b.toString`. Emit one issue per uncovered pair (or one aggregate issue listing pairs). `details: { finger, strings: [i, i+1] }`.

4. **`checkChordBuildLoss(shape, root, tuning): ShapeAuditIssue[]`** + **`checkScaleBuildLoss(shape, root, tuning): ShapeAuditIssue[]`** — `severity: "error"`.
   - Chord: build via `applyChordShape`. `playedCount = shape.strings.filter(s => s != null).length`; `builtCount = frets.filter(f => f != null).length`. Emit when `builtCount < playedCount` (the fret window silently dropped notes). Mirrors `extended-chords.test.ts:128-129`. `details: { playedCount, builtCount, frets }`.
   - Scale: build via `buildFrettedScale`. If result is the `NoFrettedScale` sentinel (`empty === true`), emit build-loss (nothing placed). Else `slotCount = sum of strings[i].length over non-null entries`; `builtCount = result.notes.length`. Emit when `builtCount < slotCount`. `details: { slotCount, builtCount }`.

5. **`checkChordMetadataCompleteness(shape): ShapeAuditIssue[]`** + **`checkScaleMetadataCompleteness(shape): ShapeAuditIssue[]`** — `severity: "warning"`.
   Rules pinned against actual data:
   - Chord: warn when `chordType` is missing OR `voicingFamily` is missing. (The 5 base CAGED majors in `caged-chords.ts` lack both — these are legitimately incomplete metadata and SHOULD surface as warnings, not errors.) Do **not** require `stringSet`/`canonicalRoot`/`baseFret` (many valid shapes omit them). `details: { missing: string[] }`.
   - Scale: the derived-shape invariant is **both-or-neither** — `quality` present iff `parentShape` present. `caged-scales-minor.ts`/`pentatonic-minor.ts` carry both; base shapes carry neither. Emit when exactly one is present. `details: { quality, parentShape }`.

6. **`checkGeometryMismatch(shape: ChordShape, tuning = STANDARD): ShapeAuditIssue[]`** — `severity: "warning"`.
   Applies **only** when `shape.baseFret != null` (i.e. the 70 `open-chords.ts` shapes); returns `[]` (skipped) otherwise — including all shell/extended/caged-7th shapes, which have no `baseFret`.

   Grip root (internal helper `gripRootFor(shape): string | undefined`): `shape.canonicalRoot ?? parseRootFromName(shape.name)`, where `parseRootFromName` matches a leading `/^[A-G](#|b)?/` token (e.g. `"G m7b5 Open"` → `"G"`, `"C Minor Open"` → `"C"`). All `baseFret`-carrying shapes follow `"<Root> … Open"` naming. If neither yields a root, skip the check.

   Source-diagram frets `sourceFrets(shape, gr, tuning)` — for each string `i`:
   - `strings[i] == null` → `null` (muted);
   - `fingers[i] === 0` → `0` (open);
   - else `raw = (((chroma(transpose(gr, strings[i])) - chroma(tuning[i])) % 12) + 12) % 12`, then lift into the diagram window: `let f = raw; while (f < shape.baseFret) f += 12;` → `f`.

   Built frets: `applyChordShape(shape, gr, tuning).frets`. Emit a mismatch when built and source frets differ on any non-muted string. `details: { gripRoot, builtFrets, sourceFrets, mismatchedStrings }`. This converts D-001's risk into a detector: misordered-interval defects (`#94`/`#96`) produce a build window that diverges from the compact source grip.

**Aggregate helpers (exported):**

```ts
export function auditChordShape(shape: ChordShape, options?: ShapeAuditOptions): ShapeAuditIssue[];
export function auditScaleShape(shape: ScaleShape, options?: ShapeAuditOptions): ShapeAuditIssue[];
export function auditAllShapes(options?: ShapeAuditOptions): {
  chord: Map<string, ShapeAuditIssue[]>;  // keyed by shape.name
  scale: Map<string, ShapeAuditIssue[]>;
};
```

`auditChordShape` runs checks 1–6 with `root = options.root ?? displayRootFor(shape)`; `auditScaleShape` runs build-loss + metadata-completeness. `auditAllShapes` iterates `chordShapes.all()` and `all()`.

**`src/audit.test.ts`** covers: each check green/red against fixtures — `OPEN_C_MAJOR` (clean), `OPEN_C_MINOR` (clean, baseFret 3), `OPEN_G_AUG`/`OPEN_G_M7B5` (fret-span error + geometry-mismatch warning), a shell + extended E/A form (geometry-mismatch skipped, build-loss clean), a movable shape with an injected finger 0, a scale derived shape with `parentShape` stripped of `quality`, and `displayRootFor`/`gripRootFor` unit cases.

**`data.test.ts` refactor (single source of truth).** Replace the inline reference implementations by calling the exported functions:

- The aug-span tests (`:482-507`) call `checkFretSpan(shape, root)` and assert `[]`.
- The fingering/barre invariant block (`:825-857`) iterates `chordShapes.all()` and asserts `checkFingerZeroOnMovable(s)` and `checkRepeatedFingerNoBarre(s)` each return `[]`.
- Keep the inline `maxSpan` only if still referenced elsewhere; otherwise delete it.
- Do **not** add a registry-wide "zero errors" gate while `#96` is open, or add one with an explicit `KNOWN_ISSUES` allowlist referencing `OPEN_G_AUG`/`OPEN_G_M7B5` (#96) so CI stays green until `/fix` lands.

**Early spike (BEFORE building the UI — D-001 mitigation).** Author `checkGeometryMismatch` + `sourceFrets`/`gripRootFor` first and validate via a temporary `src/audit.spike.test.ts` (or scratch script) against the representative fixtures: `OPEN_C_MAJOR` (canonical open, baseFret 1), `OPEN_C_MINOR` (baseFret 3, no canonicalRoot), `OPEN_G_AUG` + `OPEN_G_M7B5` (#96 known-bad), one jazz shell, one extended E-form, one extended A-form. Confirm: (a) `sourceFrets` reproduces `baseFret` as the minimum fretted (>0) fret for well-formed open shapes; (b) built == source for well-formed shapes; (c) built diverges from source for the #96 shapes; (d) geometry-mismatch returns `[]` for shell/extended (no `baseFret`). Tune the lift rule if any well-formed shape falsely mismatches, then delete/fold the spike into `audit.test.ts`.

### Library: Public API (`src/index.ts`, docs)

- Re-export from `src/index.ts`: `displayRootFor`, `auditChordShape`, `auditScaleShape`, `auditAllShapes`, all six `checkX` functions, all `CHECK_*` constants, and types `AuditSeverity`, `ShapeAuditIssue`, `ShapeAuditOptions`. Place after the Build-engine block.
- Add `export const VERSION = "0.1.0";` in a new `src/version.ts`, re-exported from `src/index.ts`, documented to be bumped alongside `package.json` version (the site reads it for report bodies; the package `exports` map only exposes `.`, so importing `package.json` from the site is not viable). Add a note to the release ritual to keep it in sync.
- Add `docs/api/audit.md` documenting the types, the six checks (semantics + severity), the aggregate helpers, and `displayRootFor`, following the style of `docs/api/shapes.md`/`docs/api/transform.md`.
- README: add a one-line mention under the features/API list linking to the audit doc and the `/shapes` page. No deep API dump in README.

### Site: Shape Library page (`site/app/shapes/`)

Static-export-compatible, public (no `NODE_ENV` gating — do NOT copy `site/app/admin/page.tsx:9-11`). All shape counts computed from registries at render time, never hardcoded.

**File structure (mirrors `experiments/` convention: page + `components/*.tsx` + pure-helper `*Utils.ts`):**

- `site/app/shapes/layout.tsx` — wraps children in `<HomeLayout {...baseOptions}>` (copy `experiments/layout.tsx`).
- `site/app/shapes/page.tsx` — server component: `metadata` (`title: "Shape Library - Tonal"`), renders `<ShapeLibrary />` inside the standard `<main className="container mx-auto max-w-5xl px-4 py-8">` header block.
- `site/app/shapes/components/ShapeLibrary.tsx` — `"use client"`. Owns filter state; runs `auditAllShapes()` **once** in `useMemo(() => …, [])`; builds the catalog, applies filters + failures-first sort, renders the grid.
- `site/app/shapes/components/ShapeCard.tsx` — `React.memo`'d card.
- `site/app/shapes/components/ShapeCardDiagram.tsx` — a trimmed, controls-less adapter (not the full `FretboardDiagram`, which carries per-instance `useState` × 159): maps `FrettedNote[]` → `FretMarker[]` (reuse the mapping in `FretboardDiagram.tsx:63-82`) and renders `<Fretboard>` with fixed `labelMode="intervals"`, `orientation="horizontal"`, shape-fit `fretRange` (`[max(0, minFret-1), maxFret+1]`).
- `site/app/shapes/components/FilterBar.tsx` — filter controls (reuse `ToggleGroup` pattern from `FretboardDiagram.tsx:165-194`).
- `site/app/shapes/components/shapeLibraryUtils.ts` — pure helpers (see below).

**`shapeLibraryUtils.ts` pure helpers:**

- `type ShapeKind = "scale" | "chord"`.
- `interface ShapeCatalogEntry { kind: ShapeKind; name: string; shape: ScaleShape | ChordShape; index: number; renderRoot: string; frettedScale: FrettedScale; builtFrets: (number|null)[]; sourceFrets?: (number|null)[]; issues: ShapeAuditIssue[]; }`.
- `buildCatalog(auditResult): ShapeCatalogEntry[]` — for each registered shape: `renderRoot = displayRootFor(shape)`; scale → `buildFrettedScale(shape, renderRoot)`; chord → `chordFingeringToFrettedScale(shape, renderRoot)` (below) + `builtFrets` from `applyChordShape(...).frets`; `sourceFrets` for chord shapes with `baseFret` (computed at `gripRootFor`, labeled with grip root when it differs from `renderRoot`); `issues` from the audit map. `index` = registry insertion order.
- `chordFingeringToFrettedScale(shape, root, tuning = STANDARD): FrettedScale` — call `applyChordShape`, wrap `positions` as `{ empty: positions.length === 0, root, scaleType: "", scaleName: "", shapeName: shape.name, tuning, notes: positions }`. (`FretboardDiagram`/`ShapeCardDiagram` only read `notes`.)
- `filterCatalog(entries, filters): ShapeCatalogEntry[]` — pure; type toggle, system, voicingFamily/quality, case-insensitive name substring, optional "failing only".
- `sortFailuresFirst(entries): ShapeCatalogEntry[]` — precise: `rank = hasError ? 0 : hasWarning ? 1 : 2` where `hasError = issues.some(i => i.severity === "error")`, `hasWarning = issues.some(i => i.severity === "warning")`; sort by `rank` asc, then by `entry.index` asc (stable secondary order = registry insertion order).
- `distinctSystems(entries)`, `distinctVoicingFamilies(entries)`, `distinctQualities(entries)` — derive filter options from data, never hardcode.
- `buildReportUrl(entry): string` (see report flow).
- Re-export `displayRootFor` from `tonal-guitar` for convenience.

**Filters (FilterBar):**

- Type toggle: `scale` | `chord` (mutually exclusive — the two registries are separate). Default `chord` (where the live #96 defects are). Switching type resets system/family/quality filters.
- System dropdown: options from `distinctSystems` for the current type (scale: caged/3nps/pentatonic; chord: caged/open/barre/shell/extended). "All" default.
- voicingFamily dropdown (chord) / quality dropdown (scale): from data; "All" default.
- Name search: text input, case-insensitive substring on `name`.
- "Failing only" checkbox (recommended convenience filter for triage).
- A shape-count readout ("Showing N of M") computed live.

**Sort:** failures-first is the default and always applied after filtering (per D-004).

**Card contents (`ShapeCard`):**

- Header: `name`, a kind badge (`scale`/`chord`), `system`.
- Diagram via `ShapeCardDiagram` (build-engine geometry). If `frettedScale.notes.length === 0` (build produced nothing / `NoFrettedScale`), render a `"Failed to build at {renderRoot}"` placeholder instead of the diagram — the `build-loss` error badge will be present.
- `"Rendered at {renderRoot}"` caption.
- Badge strip: one badge per issue, error (red) before warning (amber); if no issues, a subtle `"OK"` / clean indicator. Badge label = `issue.id`; `title`/tooltip = `issue.message`.
- Properties list: `system`, `voicingFamily`/`quality`, `chordType`, `inversion`, `canonicalRoot`, `baseFret`, `rootString`, `stringSet`, `parentShape` — omit undefined fields.
- Fingers/barres table (chord only, since `fretboard-ui` cannot render them): one column per string index (0=low), rows for interval (`strings[i]`), finger, built fret. Muted (`strings[i] === null`) → `"x"`; open (`fingers[i] === 0`) → `"0"`; `fingers[i] === null` → blank. Below the table, list `barres` as `finger N: frets fromString–toString @ fret F`.
- Source-frets row (chord with `baseFret`): show `builtFrets` and `sourceFrets` side by side, highlighting mismatched string cells; when `gripRootFor(shape) !== renderRoot`, label the source row `"(source at {gripRoot})"`.
- Report-problem link (button styled anchor, `target="_blank" rel="noopener"`).

**Client-side audit + performance:** `auditAllShapes()` runs once via `useMemo`. `ShapeCard` is `React.memo`. Card wrappers use CSS `content-visibility: auto` + `contain-intrinsic-size` (approx card height) for lazy rendering of ~159 diagrams — no virtualization dependency, no new deps.

**Navigation:** add a link to `site/app/layout.config.tsx` `links` array: `{ text: "Shapes", icon: <LayoutGridIcon />, url: "/shapes" }` (lucide icon). This makes it reachable in all `HomeLayout` pages.

**Static-export + basePath constraints:** the page is fully client-side/static (no server routes). Internal nav uses the app-router `url` (basePath applied automatically). The report link is an absolute `github.com` URL (unaffected by basePath). Verify under both `npm run build` and `DEPLOY=true npm run build` in `site/`. No `NODE_ENV` gating anywhere.

### Site: Report-problem flow (`buildReportUrl` in `shapeLibraryUtils.ts`)

- Repo slug constant: `const REPO = "TheGuitarStudio/tonal-guitar";` (where #96/#97 and the project board live per research/decisions; note `layout.config.tsx:22`'s `coryleistikow/tonal-guitar` link appears stale — confirm the correct issues repo before shipping and align both).
- URL: `https://github.com/${REPO}/issues/new?labels=bug&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`.
- Title: `[shape-audit] ${kind}: ${name}${failing.length ? " — " + failing.join(", ") : ""}` where `failing` = distinct failing `issue.id`s. Includes `kind` because names are not unique across the two registries.
- Body (markdown; D-006 full payload):
  - `## Shape` — `kind`, `name`.
  - `## Metadata` — `system`, `voicingFamily`/`quality`, `chordType`, `inversion`, `canonicalRoot`, `baseFret`, `parentShape`, `stringSet`, `omittedIntervals` (omit undefined).
  - `## Render context` — render root (`displayRootFor`), tuning (STANDARD note list).
  - `## Built frets` — `builtFrets` array.
  - `## Source frets` — `sourceFrets` (+ grip root) when present.
  - `## Raw shape data` — fenced JSON of `strings`, `fingers`, `barres`.
  - `## Failing checks` — for each failing issue: `- ${id} (${severity}): ${message}` + a fenced JSON of `details`.
  - `## Library version` — `VERSION` from `tonal-guitar`.
  - `## What's wrong` — empty section for the reporter.
- `encodeURIComponent` both title and body; payloads are well within GitHub's ~8k URL limit.

## Visual Design

- Reuse existing `fd-*` Tailwind design tokens and `experiments/` card idioms: card = `rounded-lg border border-fd-border p-4` (cf. `StepCard`), page shell `container mx-auto max-w-5xl px-4 py-8`.
- Responsive grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.
- Badges: error = `bg-red-500/10 text-red-600 border border-red-500/40`; warning = `bg-amber-500/10 text-amber-600 border border-amber-500/40`; info/clean = muted `text-fd-muted-foreground`. Badges must be visually prominent (triage is the page's primary job).
- Diagram reuses `fretboard-ui`'s `<Fretboard>` + the `FrettedNote[] → FretMarker[]` mapping and `LEGEND` from `FretboardDiagram.tsx`.
- Fingers/barres table: compact monospace, muted `"x"` for muted strings.

## Existing Code to Leverage

- `src/data/data.test.ts:474-508` (`maxSpan`, excludes open strings) — promote into `checkFretSpan`.
- `src/data/data.test.ts:825-857` — promote into `checkFingerZeroOnMovable` / `checkRepeatedFingerNoBarre`.
- `src/data/extended-chords.test.ts:121-148` (`assertBuildsPlayable`) — build-loss/span reference.
- `src/build.ts:180-313` — `buildFrettedScale`, `applyChordShape`, `NoFrettedScale` sentinel.
- `src/data/open-chords.ts:14-26` — `baseFret` chords-db semantics for `sourceFrets`.
- `site/app/experiments/components/FretboardDiagram.tsx:63-82` — marker mapping + `LEGEND`; `:165-194` — `ToggleGroup`.
- `site/app/experiments/{layout.tsx,page.tsx}` — page/layout scaffold convention.
- `site/app/admin/components/ShapeEditor.tsx` — `get(name)` → build precedent (do NOT copy `admin/page.tsx` NODE_ENV gate).
- `site/app/layout.config.tsx` — nav link registration.
- `site/next.config.mjs` — static-export/basePath constraints.

## Out of Scope

- Editing shapes from the public page (stays in dev-only admin `ShapeEditor` + `/fix`).
- Auth/permissions (public read-only by design).
- Extending `fretboard-ui` to render fingers/barres on the diagram (fingers/barres are a property table in v1).
- The voicingFamily/baseFret consistency badge (deferred until semantics are precise — D-002).
- Adding site-level test infrastructure (library logic covered by vitest; site verified manually, including `DEPLOY=true npm run build` — connector-lab-integration D-006 precedent).
- Fixing the defects the badges find (flows through `/fix`, e.g. the open #96 shapes).

## Quality Criteria

- Every check has a fixed severity, fully specified semantics, and a fixture-backed test in `src/audit.test.ts`.
- `src/audit.ts` imports only `./build`, `./shape`, `./tuning`, and required Tonal peers — never `./integration` or optional peers (verified against CLAUDE.md dependency layers).
- The geometry-mismatch spike is completed and validated BEFORE the UI is built.
- Edge cases handled: empty filtered result set → "No shapes" message; `buildFrettedScale`/`applyChordShape` returning nothing → card renders a build-failure placeholder and the build-loss error badge; scale shapes with `null` string entries → skipped in slot counting; muted strings (`strings[i] === null`) → `"x"` in the fingers/barres table; open strings (`fingers[i] === 0`) → `"0"`; movable shapes without `canonicalRoot` → render at `"C"` with visible "rendered at C".
- Shape counts derived from registries at runtime, never hardcoded in UI copy.
- The site consumes structured `issue.id`/`issue.severity`, never parses `message` strings.
- No contradictions: `data.test.ts` and the site both call the same exported audit functions; `#96` shapes stay green in CI via an explicit allowlist rather than by weakening the check.
