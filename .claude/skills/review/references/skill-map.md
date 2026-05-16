# Skill Map

Maps packages to skills that review agents should reference. The lead agent reads
the listed skill files and includes relevant content in each agent's prompt.

## How to Add Skills

Add a row to the relevant table. The lead agent will read each skill's content
and include it when spawning agents for that package.

## Architecture Review (Phase 3) — Structural Patterns

| Package                 | Skills to Reference                                                         |
| ----------------------- | --------------------------------------------------------------------------- |
| `apps/web`              | frontend-components, frontend-ui-library, testing-test-writing              |
| `apps/server`           | backend-api, global-error-handling, testing-test-writing                    |
| `apps/audio-playground` | global-code-quality                                                         |
| `apps/tool-lab`         | global-code-quality                                                         |
| `packages/api`          | backend-api, global-validation, global-error-handling, testing-test-writing |
| `packages/db`           | backend-models, backend-queries, db-migrate, backend-migrations             |
| `packages/validation`   | global-validation, testing-test-writing                                     |
| `packages/ui`           | frontend-ui-library, frontend-components, frontend-css, storybook           |
| `packages/storage`      | global-code-quality                                                         |
| `packages/types`        | global-conventions                                                          |
| `packages/theory`       | global-code-quality                                                         |
| `packages/audio-core`   | global-code-quality                                                         |
| `packages/audio-web`    | global-code-quality, frontend-components                                    |
| _(all)_                 | global-tech-stack                                                           |

## Code Simplification / Refactor Review (Phase 5) — Code Patterns

| Package               | Skills to Reference                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/web`            | vercel-react-best-practices, frontend-components, frontend-design:frontend-design               |
| `apps/server`         | backend-api, global-error-handling                                                              |
| `packages/ui`         | vercel-react-best-practices, frontend-ui-library, frontend-css, frontend-design:frontend-design |
| `packages/api`        | backend-api, backend-queries                                                                    |
| `packages/audio-core` | global-code-quality                                                                             |
| `packages/audio-web`  | global-code-quality                                                                             |
| _(all)_               | global-code-quality, global-conventions, testing-test-writing                                   |

## Specialized Reviews (Phase 7)

| Review Type   | Skills to Reference                                   |
| ------------- | ----------------------------------------------------- |
| Security      | backend-api, global-validation, global-error-handling |
| Accessibility | frontend-accessibility, frontend-responsive           |
| Type Safety   | global-validation, global-conventions                 |

## Refactor Variants

| Variant            | Additional Skills                                   |
| ------------------ | --------------------------------------------------- |
| `--refactor react` | vercel-react-best-practices                         |
| `--refactor api`   | backend-api, backend-queries, backend-models        |
| `--refactor audio` | _(none currently — add audio-specific skills here)_ |
