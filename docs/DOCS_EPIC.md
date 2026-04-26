# Epic 8: Documentation (Expanded)

## Context

The tonal-guitar package is feature-complete and needs three documentation deliverables:
1. **Package README** — lives at root `README.md`
2. **API docs pages** — markdown docs under `docs/api/` for a future documentation site
3. **Interactive experiments page** — browser-based playground at `site/` using Next.js + Fumadocs

The site will deploy to GitHub Pages via `gh-pages` as a static Next.js export.

---

## Task 8.1 — Package README (`README.md`) -- DONE

Full API documentation with install instructions, quick start, all function signatures with examples, types reference, and related packages.

---

## Task 8.2 — API Documentation Pages (`docs/api/`)

Standalone markdown API docs, one per category. These can serve as source content for a documentation site or be read directly on GitHub.

Pages:
- `index.md` — Overview & Quick Start
- `fretboard.md` — Fretboard Math (tunings, noteAt, fretFor, findNote, fretboard)
- `shapes.md` — Shape System (types, registry, build engine)
- `patterns.md` — Pattern Generators & Walker
- `sequences.md` — Sequence Engine
- `output.md` — AlphaTeX and ASCII Tab Formatters + Notation Parsing
- `integration.md` — Tonal.js Integration (buildFromScale, relatedScales, identifyChord, analyzeInKey)

---

## Task 8.3 — Interactive Experiments Page (`site/`)

### Architecture

Next.js + Fumadocs + Tailwind site deployed to GitHub Pages as a static export.

**Standalone app route** at `site/app/experiments/page.tsx`.

### Page Design: Pipeline Builder

A step-by-step pipeline builder where users compose guitar functions visually and see results at each stage.

**Layout:** Vertical pipeline — each step is a card. Output flows downward. Each card shows its result.

**Step types (pipeline stages):**

1. **Tuning** — Button group to select tuning (STANDARD, DROP_D, etc.)
2. **Shape** — Grouped buttons for scale/chord shapes (CAGED, 3NPS, Pentatonic)
3. **Root** — Note selector grid (C, C#, D, ... B)
4. **Build** — Auto-runs `buildFrettedScale(shape, root, tuning)` — shows FrettedScale as an SVG fretboard diagram + note table
5. **Pattern** (optional) — Dropdown to select pattern type (thirds, fourths, custom degrees)
6. **Sequence** (optional) — Configure `applySequence` with incremental/bounded options
7. **Output** — Format toggle (ASCII Tab, AlphaTeX, JSON) with copy button

**Key UX features:**
- **Presets** — Load common workflows with one click
- **Live updates** — Changing any upstream parameter re-runs all downstream stages
- **Fretboard visualization** — SVG fretboard with color-coded interval dots (root=red, 3rd=blue, 5th=green)
- **Copy buttons** — Copy output to clipboard

### Component Structure

```
site/app/experiments/
├── page.tsx                  # Main page
├── layout.tsx                # Shared nav layout
└── components/
    ├── PipelineBuilder.tsx    # Main orchestrator (use client)
    ├── StepCard.tsx           # Collapsible step wrapper
    ├── TuningStep.tsx         # Tuning selector
    ├── ShapeStep.tsx          # Shape selector with system grouping
    ├── RootStep.tsx           # Note picker
    ├── BuildResult.tsx        # FrettedScale note table
    ├── PatternStep.tsx        # Pattern type + custom input
    ├── SequenceStep.tsx       # Sequence config
    ├── OutputStep.tsx         # Format toggle + formatted output + copy
    ├── FretboardDiagram.tsx   # SVG fretboard visualization
    └── PresetLoader.tsx       # Preset workflow buttons
```

### Implementation Notes

- Import `tonal-guitar` directly
- All computation is client-side (static export compatible)
- Fretboard diagram: SVG with circles on fret positions, color-coded by interval
- Tailwind CSS with Fumadocs theme tokens for dark mode support

---

## Task 8.4 — Deploy Setup

- Configure GitHub Pages deployment via `gh-pages` package
- Ensure `next build` with `output: "export"` generates all pages
- Add deploy scripts to `site/package.json`

---

## Build Sequence

```
Task 8.1 (README) ──────────────────────┐
Task 8.2 (API docs pages) ──────────────┤  (all three can be parallel)
Task 8.3 (Experiments page) ─────────────┤
                                         ▼
                                   Task 8.4 (Deploy verification)
```

---

## Verification

1. **README**: Renders correctly on GitHub — check badge links, code block formatting
2. **API docs**: All 7 markdown files readable on GitHub with proper formatting
3. **Experiments page**: `cd site && npm run dev` → `/experiments` loads, presets work
4. **Static export**: `npm run build` in site/ succeeds, `out/` contains experiments/index.html
