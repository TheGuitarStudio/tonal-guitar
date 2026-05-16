---
name: review
description: Run a phased, multi-agent code review pipeline on the current branch. Use this skill when reviewing code changes before merge, when running automated code quality checks, when performing architecture or security reviews, or when applying automated fixes to review findings. Supports full review, refactoring-only, and skip-fix modes.
argument-hint: '[--loop N] [--refactor [react|api|audio]] [--focus <path>] [--skip-fix]'
---

# Code Review Pipeline

Phased, multi-agent code review and fix workflow. Each phase follows: **Review -> Document -> Fix -> Verify -> Commit -> Push**.

## Supporting Files

- For the REVIEW.md template, see [templates/review-template.md](templates/review-template.md)
- For agent prompt templates, see [references/agent-prompts.md](references/agent-prompts.md)
- For finding format, triage rules, dependency order, and commit protocol, see [references/conventions.md](references/conventions.md)
- For review criteria by domain, see [references/review-criteria.md](references/review-criteria.md)
- For package-to-skill mappings, see [references/skill-map.md](references/skill-map.md)

## Model Assignment

Use different models for different roles to balance capability and cost:

| Role                                     | Model      | Rationale                                                                                                      |
| ---------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Lead agent (orchestration)               | **opus**   | Complex multi-phase coordination                                                                               |
| Architecture review agents (Phase 3)     | **opus**   | Subtle architectural issues need deep holistic reasoning — catching these early prevents expensive refactoring |
| Architecture fix agents (Phase 4)        | **sonnet** | Targeted fixes from clear findings                                                                             |
| Code simplification agents (Phase 5)     | **sonnet** | Dead code/complexity detection                                                                                 |
| Code simplification fix agents (Phase 6) | **sonnet** | Apply simplification changes                                                                                   |
| Specialized review agents (Phase 7)      | **sonnet** | Security/type-safety/a11y analysis                                                                             |
| Specialized fix agents (Phase 8)         | **sonnet** | Targeted fixes from clear findings                                                                             |

When spawning background agents via the `Task` tool, set the `model` parameter to `"sonnet"`.

---

## Arguments

| Flag               | Description                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| _(none)_           | Full 9-phase pipeline: current branch vs main                                                        |
| `--loop N`         | Run entire pipeline N times (catches issues introduced by previous fixes)                            |
| `--refactor`       | Simplification focus only (phases 1, 2, 5, 6, 9)                                                     |
| `--refactor react` | React-specific refactoring scoped to `apps/web` + `packages/ui`                                      |
| `--refactor api`   | Backend refactoring scoped to `packages/api` + `apps/server` + `packages/db` + `packages/validation` |
| `--refactor audio` | Audio packages scoped to `packages/audio-core` + `packages/audio-web`                                |
| `--focus <path>`   | Narrow all phases to one package (e.g., `--focus apps/web`)                                          |
| `--skip-fix`       | Review only — produce checklist, no fixes applied                                                    |
| `--update`         | **Moved to `/reflect --update`.** Use `/reflect --update` to update the skill map.                   |

---

## Execution

### Step 1: Parse Arguments

Determine the run mode from the arguments:

- **No args** → `mode = "full"`, `scope = "all"`, `loop = 1`
- **`--loop N`** → `mode = "full"`, `scope = "all"`, `loop = N`
- **`--refactor`** → `mode = "refactor"`, `scope = "all"`
- **`--refactor react`** → `mode = "refactor"`, `scope = "react"` (apps/web, packages/ui)
- **`--refactor api`** → `mode = "refactor"`, `scope = "api"` (packages/api, apps/server, packages/db, packages/validation)
- **`--refactor audio`** → `mode = "refactor"`, `scope = "audio"` (packages/audio-core, packages/audio-web)
- **`--focus <path>`** → `mode = "full"`, `scope = "<path>"`
- **`--skip-fix`** → `mode = "skip-fix"`, `scope = "all"`
- **`--update`** → Inform user: "The `--update` mode has moved to `/reflect --update`. Run that instead." Then stop.

### Active Phases by Mode

| Phase                          | Full | Refactor | Skip-Fix |
| ------------------------------ | ---- | -------- | -------- |
| 1 - Setup                      | Y    | Y        | Y        |
| 2 - Lint/Test Fix              | Y    | Y        | -        |
| 3 - Architecture Review        | Y    | -        | Y        |
| 4 - Architecture Fix           | Y    | -        | -        |
| 5 - Code Simplification Review | Y    | Y        | Y        |
| 6 - Code Simplification Fix    | Y    | Y        | -        |
| 7 - Specialized Reviews        | Y    | -        | Y        |
| 8 - Specialized Fixes          | Y    | -        | -        |
| 9 - Final Verification         | Y    | Y        | Y        |

---

### Step 2: Phase 1 — Setup (Lead Agent)

1. Get the current branch name:

   ```bash
   git rev-parse --abbrev-ref HEAD
   ```

2. Get the diff stats against main:

   ```bash
   git diff main...HEAD --stat
   ```

3. Get the list of changed files:

   ```bash
   git diff main...HEAD --name-only
   ```

4. Get commit count:

   ```bash
   git rev-list main..HEAD --count
   ```

5. Determine **affected packages** by mapping changed file paths to packages:
   - `apps/web/` → `apps/web`
   - `apps/server/` → `apps/server`
   - `apps/audio-playground/` → `apps/audio-playground`
   - `apps/tool-lab/` → `apps/tool-lab`
   - `packages/api/` → `packages/api`
   - `packages/db/` → `packages/db`
   - `packages/ui/` → `packages/ui`
   - `packages/validation/` → `packages/validation`
   - `packages/storage/` → `packages/storage`
   - `packages/audio-core/` → `packages/audio-core`
   - `packages/audio-web/` → `packages/audio-web`
   - `packages/types/` → `packages/types`
   - `packages/theory/` → `packages/theory`

6. If `scope` is not `"all"`, filter affected packages to only those in scope.

7. Check for existing REVIEW.md at `.tonal-guitar/features/{BRANCH_NAME}/REVIEW.md`.
   - If it exists, parse `## Review Progress` for the first unchecked phase and resume from there (see [Resumption](#resumption)).
   - If `--loop N` and current loop < N and all phases complete, archive the loop summary and restart from Phase 2.
   - If it doesn't exist, create it using [templates/review-template.md](templates/review-template.md).

8. Update REVIEW.md: mark Phase 1 as complete.

---

### Step 3: Phase 2 — Lint/Test Fix (Lead Agent)

**Skip if:** mode is `skip-fix`

1. Update REVIEW.md: Phase 2 → in-progress.

2. Run lint, typecheck, and tests (capture output):

   ```bash
   turbo run lint --affected 2>&1 || true
   turbo run typecheck --affected 2>&1 || true
   turbo run test --affected 2>&1 || true
   ```

3. If all pass, update REVIEW.md: Phase 2 → complete (0 issues), skip to next phase.

4. If there are failures, fix them directly:
   - Lint: `turbo run lint -- --fix`, then manually fix remaining
   - Type errors: read failing files and fix
   - Test failures: read test files and fix

5. Re-run verification:

   ```bash
   turbo run lint --affected && turbo run typecheck --affected && turbo run test --affected
   ```

6. Assign CR-NNN IDs to each fixed issue. Record in REVIEW.md under `## Phase 2: Lint/Test Results`. See [conventions.md](references/conventions.md) for finding format.

7. Update REVIEW.md: Phase 2 → complete. Commit and push per [commit protocol](references/conventions.md#commit-protocol).

---

### Step 4: Phase 3 — Architecture Review (Multi-Agent)

**Skip if:** mode is `refactor`

1. Update REVIEW.md: Phase 3 → in-progress.

2. Read [references/skill-map.md](references/skill-map.md) for Architecture Review mappings.

3. For each affected package, read the mapped skill content:
   - Local skills: read `.claude/skills/{skill-name}/references/standards.md`
   - Plugin skills: note the skill name for the agent prompt

4. Read [references/review-criteria.md](references/review-criteria.md) sections: **Architecture**, **Database Patterns**, **Performance**.

5. Create team `review-phase-3`. Create one task per affected package with `blockedBy` per [dependency order](references/conventions.md#package-dependency-order).

6. Spawn a `feature-dev:code-architect` agent per package using the [review agent prompt template](references/agent-prompts.md). Include the diff, criteria, and skill content. Set `run_in_background: true`.

7. Collect findings, assign CR-NNN IDs, write to REVIEW.md under `## Phase 3: Architecture Review` grouped by package.

8. Shut down the team (shutdown requests → TeamDelete).

9. Update REVIEW.md: Phase 3 → complete. Commit and push.

---

### Step 5: Phase 4 — Architecture Fix (Multi-Agent)

**Skip if:** mode is `refactor` or `skip-fix`

1. Update REVIEW.md: Phase 4 → in-progress.

2. Triage Phase 3 findings per [triage rules](references/conventions.md#triage-rules). Create GitHub issues for deferred items.

3. Create team `review-phase-4`. Group fixable findings by [domain](references/conventions.md#domain-grouping). Create one task per domain with dependency ordering.

4. Spawn `general-purpose` agents per domain using the [fix agent prompt template](references/agent-prompts.md). Set `run_in_background: true`.

5. Collect results. Update finding statuses in REVIEW.md.

6. Verify:

   ```bash
   turbo run lint --affected && turbo run typecheck --affected && turbo run test --affected
   ```

   Fix regressions before proceeding.

7. Shut down the team. Update REVIEW.md: Phase 4 → complete. Commit and push.

---

### Step 6: Phase 5 — Code Simplification Review (Multi-Agent)

1. Update REVIEW.md: Phase 5 → in-progress.

2. Read [references/skill-map.md](references/skill-map.md) for Code Simplification mappings.

3. Read [references/review-criteria.md](references/review-criteria.md) sections: **Code Quality**, **React Patterns**, **API Patterns**, **Testing**, **Performance**.

4. Create team `review-phase-5`. Create one task per affected package with dependency ordering.

5. Spawn a `code-simplifier:code-simplifier` agent per package. Focus on: dead code, complexity (>50 lines, >3 nesting), DRY violations, naming, React anti-patterns. Set `run_in_background: true`.

6. Collect findings, assign CR-NNN IDs, write to REVIEW.md under `## Phase 5: Code Simplification Review`.

7. Shut down the team. Update REVIEW.md: Phase 5 → complete. Commit and push.

---

### Step 7: Phase 6 — Code Simplification Fix (Multi-Agent)

**Skip if:** mode is `skip-fix`

1. Update REVIEW.md: Phase 6 → in-progress.

2. Triage Phase 5 findings. Create GitHub issues for deferred items.

3. Create team `review-phase-6`. Group by domain, spawn `general-purpose` fix agents.

4. Collect results. Verify. Shut down the team.

5. Update REVIEW.md: Phase 6 → complete. Commit and push.

---

### Step 8: Phase 7 — Specialized Reviews (Multi-Agent)

**Skip if:** mode is `refactor`

1. Update REVIEW.md: Phase 7 → in-progress.

2. Read [references/skill-map.md](references/skill-map.md) for Specialized Review mappings.

3. Read [references/review-criteria.md](references/review-criteria.md) sections: **Type Safety**, **Security**, **Accessibility**.

4. Create team `review-phase-7`. Create three review tasks:

   **Security Review** — `feature-dev:code-reviewer` agent:
   - Scope: affected backend packages + apps/web (for XSS)
   - Criteria: SQL injection, auth/authz, XSS, sensitive data, input validation

   **Type Safety Review** — `feature-dev:code-reviewer` agent:
   - Scope: all affected packages
   - Criteria: No `any`, Zod/TS alignment, return types, null safety, type assertions

   **Accessibility Review** — `superpowers:code-reviewer` agent:
   - Scope: apps/web, packages/ui (only if affected)
   - Criteria: Semantic HTML, keyboard nav, ARIA labels, color contrast, screen reader

5. Collect findings, assign CR-NNN IDs, write to REVIEW.md grouped by review type.

6. Shut down the team. Update REVIEW.md: Phase 7 → complete. Commit and push.

---

### Step 9: Phase 8 — Specialized Fixes (Multi-Agent)

**Skip if:** mode is `refactor` or `skip-fix`

1. Update REVIEW.md: Phase 8 → in-progress.

2. Triage Phase 7 findings. Create GitHub issues for deferred items.

3. Create team `review-phase-8`. Group by domain, spawn `general-purpose` fix agents.

4. Collect results. Verify. Shut down the team.

5. Update REVIEW.md: Phase 8 → complete. Commit and push.

---

### Step 10: Phase 9 — Final Verification (Lead Agent)

1. Update REVIEW.md: Phase 9 → in-progress.

2. Run full verification:

   ```bash
   turbo run lint && turbo run typecheck && turbo run test
   ```

3. If any failures, fix them and re-verify.

4. Compile final statistics in REVIEW.md `## Statistics`:
   - Findings by severity and status (Fixed, Deferred, Won't Fix, Open)
   - GitHub issues created
   - Total commits during review
   - Final status: **PASS** (all Critical fixed, no test failures) or **FAIL** (explain why)

5. Update REVIEW.md: Phase 9 → complete. Commit and push.

6. Check for existing PR:

   ```bash
   gh pr view --json number 2>/dev/null
   ```

   - No PR + not `skip-fix`: create with `gh pr create`. The PR body **must** include `Closes #{issueNumber}` (read the `issue:` field from FEATURE.md). This is required for the `pr-merged.yml` workflow to move the project item to "Done" and close task-group sub-issues.
   - PR exists: add a comment with the review summary

7. If `--loop N` and current loop < N: archive loop, reset progress, go back to Phase 2.

8. **Capture conventions** (optional): If the review discovered new patterns or conventions worth preserving, suggest running `/claude-md-management:revise-claude-md` to capture them in CLAUDE.md.

9. Output final summary to the user.

---

## Resumption

When `/review` is invoked on a branch that already has a REVIEW.md:

1. Read `.tonal-guitar/features/{BRANCH_NAME}/REVIEW.md`
2. Parse `## Review Progress` checkboxes
3. Find the first unchecked `[ ]` phase
4. Resume execution from that phase
5. All previously-assigned CR-NNN IDs are preserved — continue from the highest existing ID

---

## Skill Map Integration

Before spawning review agents, read [references/skill-map.md](references/skill-map.md) to determine which skills each agent should reference. For each mapped skill:

1. **Local skills** (e.g., `frontend-components`): Read `.claude/skills/{skill-name}/references/standards.md` and include relevant content in the agent's prompt.
2. **Plugin skills** (e.g., `vercel-react-best-practices`): Note the skill name in the agent's prompt so the agent can invoke the Skill tool itself if needed.
3. Include relevant sections from [references/review-criteria.md](references/review-criteria.md) as the primary review checklist.

---

## Update Workflow

> **Moved:** The `--update` mode has been relocated to `/reflect --update`. Use that skill to update the review skill-map.
