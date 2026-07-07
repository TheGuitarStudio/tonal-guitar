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
| `site` (`site/`)                       | vercel-react-best-practices, web-design-guidelines               |
| `fretboard-ui` (`packages/fretboard-ui/`) | vercel-react-best-practices, web-design-guidelines             |
| `docs` (`docs/`)                       | (none — use review-criteria.md)                                  |

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
