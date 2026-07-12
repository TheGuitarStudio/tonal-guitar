# Shared Skill Conventions

Shared patterns for `/task` and `/fix` skills.

---

## Config Check (Step 0)

Same as `/idea` and `/feature` — verify `.tonal-guitar/project-config.json` exists, auto-detect if not.
See `.claude/skills/feature/references/conventions.md` for the full procedure.

---

## Scope Assessment

Used by `/task` and `/fix` to determine how much ceremony a task needs.

### Assessment Process

1. Read the issue body or user description
2. Explore relevant code: grep for key terms, read affected files
3. Count the number of files that will likely need changes
4. Classify:

| Size | Files Changed | Gate Behavior                                                   | Isolation                  |
| ---- | ------------- | --------------------------------------------------------------- | -------------------------- |
| S    | 1-3           | Proceed immediately, no plan shown                              | Branch in current checkout |
| M    | 4-8           | Show plan, create TASK.md, wait for approval                    | Worktree via `/tree`       |
| L    | 9+            | Show plan, create TASK.md + tasks.md, present execution options | Worktree via `/tree`       |

### Assessment Heuristic

When reading the issue/description, look for scope signals:

- **S signals:** "typo", "rename", single component/file mentioned, "add X to Y"
- **M signals:** "refactor", multiple components mentioned, "update the flow", spans two areas (e.g., library `src/` + `site/`)
- **L signals:** "redesign", "new system", "add auth", touches all three areas (library `src/`, `site/`, `packages/fretboard-ui`), major dependency upgrades

---

## Branch Naming

| Skill   | Prefix                                                                    | Example                                            |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `/task` | Inferred from intent using `/tree` prefix rules                           | `feat/add-loading-spinner`                         |
| `/fix`  | `fix/` for bugs; auto-detected for `--cr` (`fix/`, `refactor/`, `chore/`) | `fix/alphatab-timing`, `refactor/extract-svg-icon` |

### Slug Derivation

1. Take the issue title or first few words of the description
2. Convert to lowercase
3. Replace spaces with hyphens
4. Remove special characters (keep alphanumeric and hyphens)
5. Collapse multiple consecutive hyphens
6. Truncate to 50 characters
7. Trim trailing hyphens

---

## GitHub Project Status Updates

Skills update project item status at key lifecycle points.

### Reading Config

```bash
cat .tonal-guitar/project-config.json
```

### Updating Status

```bash
gh project item-edit --project-id {projectId} --id {itemId} \
  --field-id {statusFieldId} --single-select-option-id {optionId}
```

### Finding an Item by Issue Number

```bash
gh project item-list {projectNumber} --owner {owner} --format json --limit 100
```

Filter the JSON response for the matching issue number.

### Status Transitions

| Event          | New Status  | Set By                                 |
| -------------- | ----------- | -------------------------------------- |
| Branch created | In Progress | `/task`, `/fix`                        |
| PR created     | In Review   | PostToolUse hook (`post-pr-create.sh`) |
| PR merged      | Done        | GitHub Action (`pr-merged.yml`)        |

> **Note:** The "In Review" and "Done" transitions are fully automated.
> The PostToolUse hook fires after any `gh pr create` command (from `/review`, `/fix`, `/task`, etc.).
> The GitHub Action fires when a PR is merged to main — it also closes `task-group` sub-issues.

---

## PR Format

Draft PRs created by `/task` and `/fix` follow this template.

**Important:** PR bodies must include `Closes #{issueNumber}` referencing the parent issue. This is how both the PostToolUse hook and the GitHub Action find the linked project item for automated status updates.

```markdown
## Summary

[What was done and why — 2-3 sentences]

Closes #{issueNumber}

## Root Cause

[Bugs only — what caused the issue]

## Changes

- `path/to/file.ts` — [brief explanation]
- `path/to/other.ts` — [brief explanation]

## Verification

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` in `site/` passes (only if site files changed)
- [Additional verification specific to the change]

## Confidence

[For `/fix --all` batch agents only: High / Medium / Low with notes]
```

---

## Verification Checklist

Before shipping (commit + push + PR), always run at the repo root:

```bash
npm run lint && npm test
```

If files under `site/` changed, also run (from `site/`):

```bash
npx tsc --noEmit
```

There is no root `typecheck` script — `npm run build` (tsup + dts) covers type emission, and `site/` has no test script.

If any check fails:

1. Attempt to fix the issue
2. Re-run verification
3. If still failing, flag in the PR description with details

---

## Commit Protocol

- Use conventional commit format: `type(scope): subject`
- Stage specific files — never use `git add -A`
- Commit after each logical unit of work
- Push the branch after committing
- Create the PR after pushing

---

## Release Conventions

- Publish with `npm run release` — it sources the gitignored `.env` (`NPM_TOKEN`, a granular npm publish token; stub committed as `.env.example`). The gitignored `.npmrc` maps `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`. `prepublishOnly` runs the build.
- The git tag `vX.Y.Z` MUST point at the exact commit the npm tarball was built from.
- Every published version gets a corresponding GitHub release.
- Version bumps land via PR before publishing — never bump directly on main.

---

## Task Artifact Directory

M/L-sized tasks store persistent state in `.tonal-guitar/tasks/{slug}/`:

```
.tonal-guitar/tasks/{slug}/
  TASK.md         # State tracking (always present for M/L)
  tasks.md        # Optional: /implement-compatible plan (L-sized only)
```

This parallels the feature pattern (`.tonal-guitar/features/{slug}/`) but is intentionally lighter.
Artifacts live on the task branch and merge to main with the PR.

### GitHub Issue Creation (Ad Hoc M/L Tasks)

When `/task` creates an M or L-sized task from an ad hoc description (not an existing issue),
it creates a GitHub issue with the `task` label and adds it to the GitHub Project.
S-sized ad hoc tasks skip issue creation — the PR is the sole tracking artifact.
