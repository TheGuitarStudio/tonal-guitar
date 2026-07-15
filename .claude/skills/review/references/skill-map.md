# Skill Map

Maps areas to skills that review agents should reference. The lead agent reads
the listed skill files and includes relevant content in each agent's prompt.

## How to Add Skills

Add a row to the relevant table. The lead agent will read each skill's content
and include it when spawning agents for that area.

## Architecture Review (Phase 3) — Structural Patterns

| Area                                  | Skills to Reference                                             |
| -------------------------------------- | ---------------------------------------------------------------- |
| `library` (`src/`)                     | (none — use CLAUDE.md Design conventions + review-criteria.md)   |
| `shape data` (`src/data/`)             | (none — but reviews MUST run the `audit()` sweep, see below)     |
| `site` (`site/`)                       | vercel-react-best-practices, web-design-guidelines               |
| `fretboard-ui` (`packages/fretboard-ui/`) | vercel-react-best-practices, web-design-guidelines             |
| `docs` (`docs/`)                       | (none — use review-criteria.md)                                  |

### Shape-data reviews: run the audit() sweep

Any diff touching `src/data/*` chord/scale shapes should be checked with the registry-wide
invariant sweep in `src/audit.ts` instead of eyeballing TS literals — it codifies the defect
classes found in issues #39/#94 (unplayable fret span, finger 0 on movable shapes,
repeated fingers without a barre, voicingFamily/baseFret mismatch, and scale-shape checks):

```bash
npx vitest run src/audit.test.ts   # registry-wide sweeps assert zero violations
```

For ad hoc inspection of a single shape, call `audit()`/the `checkX` functions from
`tonal-guitar` directly in a scratch script.

## Code Simplification / Refactor Review (Phase 5) — Code Patterns

| Area                                  | Skills to Reference                                             |
| -------------------------------------- | ---------------------------------------------------------------- |
| `library` (`src/`)                     | (none — use CLAUDE.md Design conventions + review-criteria.md)   |
| `site` (`site/`)                       | vercel-react-best-practices, web-design-guidelines               |
| `fretboard-ui` (`packages/fretboard-ui/`) | vercel-react-best-practices, web-design-guidelines             |
| `docs` (`docs/`)                       | (none — use review-criteria.md)                                  |

## Specialized Reviews (Phase 7)

| Review Type   | Skills to Reference                                           |
| ------------- | --------------------------------------------------------------- |
| Security      | (none — use review-criteria.md)                                 |
| Accessibility | vercel-react-best-practices, web-design-guidelines (site, fretboard-ui only) |
| Type Safety   | (none — use review-criteria.md)                                 |

## Refactor Variants

| Variant            | Additional Skills                                   |
| ------------------ | --------------------------------------------------- |
| `--refactor react` | vercel-react-best-practices                         |
| `--refactor api`   | backend-api, backend-queries, backend-models        |
| `--refactor audio` | _(none currently — add audio-specific skills here)_ |
