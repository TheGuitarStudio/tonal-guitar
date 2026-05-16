---
name: implement
description: Layered multi-agent feature implementation. Reads tasks.md from /feature --plan, parses task groups into dependency layers, dispatches parallel agents per layer in isolated worktrees, merges back with verification. Use this skill when implementing a feature with a completed task plan, executing task groups in parallel, or resuming an interrupted implementation.
argument-hint: '[--dry-run] [--checkpoints] [--watch] [--no-watch] [--loop N] [--layer N] [--group <name>] [--resume] [--plan-file <path>]'
---

# Layered Multi-Agent Feature Implementation

Execute a structured task plan with parallel agents, layer-by-layer verification, optional oversight,
and spec compliance loops. Fills Step 6 in the developer pipeline between `/feature --plan` and `/review`.

## Supporting Files

- For agent prompt templates, see [references/agent-prompts.md](references/agent-prompts.md)
- For state management, merge protocol, and naming, see [references/conventions.md](references/conventions.md)
- For the FEATURE.md progress section template, see [templates/progress-template.md](templates/progress-template.md)

## Model Assignment

| Role                                         | Model      | Rationale                                                            |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| Lead agent (orchestration, user interaction) | **opus**   | Complex multi-layer coordination, error analysis, user communication |
| Implementer agents (task group execution)    | **sonnet** | Focused implementation work in isolated worktrees                    |
| Oversight agent (`--watch`)                  | **sonnet** | Diff review against spec — analytical but scoped                     |
| Spec compliance reviewer (`--loop`)          | **sonnet** | Gap analysis between spec and implementation                         |
| Gap-fix agents (`--loop` dispatches)         | **sonnet** | Targeted fixes from clear gap descriptions                           |

## Arguments

| Flag                 | Description                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| _(none)_             | Execute all layers to completion. `--watch` is default-on. Reads tasks.md from feature directory.     |
| `--dry-run`          | Parse input, build execution plan, display it without running. No branches, worktrees, or agents.     |
| `--checkpoints`      | Pause after each layer's merge/verification/oversight for user confirmation before next layer.        |
| `--watch`            | Explicitly enable oversight agent after each layer. Redundant in v1 (default-on), forward-compatible. |
| `--no-watch`         | Disable oversight agent. Layers execute without post-merge spec review.                               |
| `--loop N`           | After all layers complete, run spec compliance reviewer + gap-fix cycle up to N times (1-10).         |
| `--layer N`          | Execute only layer N (0-indexed). Requires all prior layers complete.                                 |
| `--group <name>`     | Execute a single task group by name (case-insensitive partial match). Requires dependencies complete. |
| `--resume`           | Resume from last incomplete task group. Skips complete groups, retries failed, leaves skipped.        |
| `--plan-file <path>` | Use a Claude Code plan file as input. Disables `--watch`, `--loop`, FEATURE.md, GitHub Project.       |

### Invalid Flag Combinations

| Combination                           | Error                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `--plan-file` with `--loop`/`--watch` | "Warning: --watch and --loop require spec.md and are disabled in --plan-file mode." |
| `--layer` with `--group`              | "Error: Use --layer or --group, not both."                                          |
| `--dry-run` with `--resume`           | "Error: Nothing to resume in dry-run mode."                                         |

---

## Execution

### Step 0: Config and Guards

Perform these checks in order before any execution:

1. **Config check**: Verify `.tonal-guitar/project-config.json` exists. If not, auto-detect using
   the procedure from [feature conventions](../feature/references/conventions.md) (Config Check section).

2. **Branch guard** (skip for `--plan-file` mode):
   - Read `.tonal-guitar/features/{slug}/FEATURE.md` and extract the `Branch` field.
   - Check current branch: `git branch --show-current`
   - If mismatch, block with error:

     ```
     This feature lives on branch `feat/{slug}`.
     You are on `{current-branch}`.

     Switch to the feature worktree or create one with /tree.
     ```

3. **Prerequisites check** (print specific error and exit if unmet):
   - **Default mode**: `.tonal-guitar/features/{slug}/tasks.md` must exist AND FEATURE.md Phase 3
     must show `[x]`.
     ```
     Error: Phase 3 (Plan) must be complete before running /implement.
     Run `/feature --plan` first.
     ```
   - **`--plan-file`**: The specified file path must exist and be readable.
     ```
     Error: Plan file not found: {path}
     ```
   - **`--layer N`**: All task groups in layers 0 through N-1 must have `complete` status in Phase 4.
     ```
     Error: Cannot run layer {N}. Incomplete prerequisites:
       - TG{X}: {name} (status: {status})
       - TG{Y}: {name} (status: {status})
     Run /implement --resume to complete earlier layers first.
     ```
   - **`--group <name>`**: All dependency task groups must have `complete` status (see Step 11 for error format).
   - **`--resume`**: FEATURE.md must contain a `## Phase 4: Implement` section.
     ```
     Error: No Phase 4 section found in FEATURE.md. Run /implement first (without --resume).
     ```

4. **Clean working tree**: Run `git status --porcelain`. If uncommitted changes exist:
   "Working tree has uncommitted changes. Commit or stash them before running /implement."

5. **GitHub Project transition** (non-dry-run, non-plan-file):
   - Read `.tonal-guitar/project-config.json` for project IDs and field IDs.
   - Find the feature's project item by issue number.
   - Update status: Ready → In Progress:
     ```bash
     gh project item-edit --project-id {projectId} --id {itemId} \
       --field-id {statusFieldId} --single-select-option-id {inProgressOptionId}
     ```

### Step 1: Parse Arguments

Determine the run mode:

- **No flags** → `mode = "full"`
- **`--dry-run`** → `mode = "dry-run"`
- **`--checkpoints`** → modifier on current mode
- **`--watch` / `--no-watch`** → toggle oversight (default: on)
- **`--loop N`** → `loopCount = N` (applied after all layers complete)
- **`--layer N`** → `mode = "single-layer"`, `targetLayer = N`
- **`--group <name>`** → `mode = "single-group"`, `targetGroup = name`
- **`--resume`** → `mode = "resume"`
- **`--plan-file <path>`** → `mode = "plan-file"`, disables watch/loop/FEATURE.md/GitHub

Validate flag combinations (see Invalid Flag Combinations table). Exit with error on invalid combos.

### Step 2: Input Parsing

#### Primary: tasks.md

Read `.tonal-guitar/features/{slug}/tasks.md` and extract:

1. **Task groups**: Each `#### Task Group N: {Name}` heading → capture integer N and Name.
2. **Dependencies**: `**Dependencies:**` line → parse `None` or comma-separated list (e.g., `Task Groups 1, 2` → `[1, 2]`).
3. **Subtasks**: Checkbox items (`- [ ] N.M ...`) under each task group.
4. **Acceptance criteria**: `**Acceptance Criteria:**` block under each task group.
5. **Layer headings**: `### {Layer Name}` headings — captured for display only. Dependency graph drives layer assignment.

**Topological sort for layer assignment:**

```
Layer 0: All task groups with Dependencies: None
Layer 1: All task groups whose dependencies are entirely in Layer 0
Layer N: All task groups whose dependencies are entirely in Layers 0..N-1
```

**Parsing validation** (fail-fast — exit without executing on ANY parse error):

- **Missing task group numbers**: A `#### Task Group` heading without a valid integer N.
  ```
  Parse error at line {L}: Task group heading missing number.
  Expected format: #### Task Group N: {Name}
  ```
- **Duplicate task group numbers**: Two headings with the same N.
  ```
  Parse error: Duplicate task group number {N} (lines {L1} and {L2}).
  ```
- **Dangling dependency references**: A dependency references a task group number that doesn't exist.
  ```
  Parse error at line {L}: TG{N} depends on TG{X}, which does not exist.
  ```
- **Malformed dependency lines**: Cannot parse the `**Dependencies:**` value.
  ```
  Parse error at line {L}: Cannot parse dependencies.
  Expected: "None" or "Task Groups 1, 2, 3"
  ```
- **Circular dependencies**: Topological sort detects a cycle.
  ```
  Circular dependency detected: TG{A} → TG{B} → ... → TG{A}
  ```

#### Alternative: --plan-file

Parse a Claude Code plan file using heuristics:

1. Each top-level numbered item → task group.
2. Sub-items → subtasks.
3. Dependencies inferred from sequential ordering (group N depends on N-1).
4. `--watch` and `--loop` auto-disabled (no spec to check against).
5. Progress tracked in `.tonal-guitar/impl-progress-{timestamp}.md` instead of FEATURE.md.

### Step 3: Dry Run (`--dry-run`)

If `mode = "dry-run"`, display the execution plan and exit:

```
Execution Plan: {Feature Name}

Layers: {N}
Total Task Groups: {N}

Layer 0:
  - TG{N}: {name} [impl/{slug}/tg{N}-{group-slug}]
  - TG{N}: {name} [impl/{slug}/tg{N}-{group-slug}]

Layer 1:
  - TG{N}: {name} [impl/{slug}/tg{N}-{group-slug}]
    Depends on: TG{N}

...

Agents per layer: {N}, {N}, ...
Max concurrent: 5
```

Exit without creating any branches, worktrees, or agents.

### Step 4: Initialize Progress

If this is the first `/implement` run (no `## Phase 4: Implement` in FEATURE.md):

1. Add `- [ ] Phase 4: Implement` to the `## Pipeline Progress` section.
2. Append the Phase 4 section using [templates/progress-template.md](templates/progress-template.md).
3. Populate the progress table with all task groups (status: `pending`).
4. Commit:
   ```bash
   git add .tonal-guitar/features/{slug}/FEATURE.md
   git commit -m "docs(tooling): implement init - {feature-name}"
   ```

If `--resume`, read existing Phase 4 section and rebuild execution graph with only non-complete groups.

### Step 5: Layer Execution Engine

For each layer (sequentially), execute the 12-step lifecycle:

**Step 5.1 — Pre-layer logging**: Log the layer number, task groups, and sub-branch names.

**Step 5.2 — Worktree creation**: For each task group in this layer, create a worktree with workmux:

```bash
workmux add impl/{slug}/tg{N}-{group-name-slug} --base feat/{slug} -b -C --name impl-{slug}-tg{N}
```

`-C` (no pane commands) suppresses auto-launching Claude because `/implement` manages its own agents via the `Task` tool. `-b` keeps it in background. The tmux window still opens (useful for monitoring) but with a plain shell.

Sub-branch convention: `impl/{slug}/tg{N}-{group-name-slug}` where `{group-name-slug}` is the
task group name slugified (lowercase, hyphens, no special chars, max 30 chars).
See [references/conventions.md](references/conventions.md) for slugification rules.

**Step 5.3 — Agent dispatch**: Spawn one implementer agent per task group:

- Tool: `Task` with `run_in_background: true`
- Model: `sonnet`
- Agent type: `general-purpose`
- Max 5 concurrent. Queue extras, dispatch as slots open.
- Use the Implementer Agent prompt from [references/agent-prompts.md](references/agent-prompts.md).
- Provide: task group section, spec.md content, research.md content, worktree path, sub-branch name, affected packages.

Update each task group status to `in-progress` in FEATURE.md.

**Step 5.4 — Wait for completion**: Monitor background agents. Log each completion. If any report failure,
apply the retry policy (see Step 6: Error Handling).

**Step 5.5 — Merge**: After ALL agents in the layer complete successfully:

```bash
git checkout feat/{slug}
git merge impl/{slug}/tg{N}-{group-name-slug} --no-edit
```

Merge each sub-branch sequentially. Order within a layer is arbitrary (same-layer groups modify
independent code by design).

**Step 5.6 — Cleanup**: Remove worktrees and sub-branches:

```bash
workmux remove impl-{slug}-tg{N}
```

**Step 5.7 — Setup verification**: Re-run setup on the merged feature branch.

Always run dependency install (agents may have added packages):

```bash
pnpm install
```

Additionally, if this layer contained database or validation task groups, run DB setup:

```bash
pnpm db:generate
dotenv -e .env -- pnpm db:push
```

See [references/conventions.md](references/conventions.md) (Setup Re-Run Triggers) for how to detect DB/validation layers.

**Step 5.8 — Post-merge verification**: Run verification on the merged feature branch:

```bash
turbo run lint typecheck test --affected
```

If verification fails, apply the post-merge error handling policy (see Step 6).

**Step 5.9 — Oversight** (if `--watch` active, which is default-on in v1):

Spawn the oversight agent using the Oversight Agent prompt from [references/agent-prompts.md](references/agent-prompts.md).

- Tool: `Task` (foreground — lead waits for result)
- Model: `sonnet`
- Input: `git diff HEAD~{N}..HEAD` (N = merge commits in this layer), spec.md, task group acceptance criteria
- Output: Alignment (Yes/Concerns), Concerns list, Recommendation (Continue/Pause)

**Lead behavior**:

- "Continue" → proceed to next layer silently.
- "Pause for review" → present concerns to user. User decides: continue anyway or manual fix + `--resume`.

Disabled when `--plan-file` or `--no-watch`.

**Step 5.10 — Checkpoint** (if `--checkpoints` active):

Present layer summary table and ask user to confirm before proceeding to the next layer.

**Step 5.11 — Progress update**: Update FEATURE.md Phase 4 table — mark completed task groups as `complete`.
Add oversight report bullet if applicable.

**Step 5.12 — Progress commit**:

```bash
git add .tonal-guitar/features/{slug}/FEATURE.md
git commit -m "docs(tooling): implement progress - layer {N} complete"
```

### Step 6: Error Handling

#### Agent Verification Failure

1. Agent runs verification in its worktree: `turbo run lint typecheck test --filter=<packages>`
2. If failure, agent retries once — attempts to fix issues and re-runs verification.
3. If second attempt fails, agent reports failure with details.
4. Lead pauses the layer and presents error to user:
   - **retry**: Re-dispatch a new agent for this task group (fresh attempt).
   - **skip**: Mark task group as `skipped` in FEATURE.md. Warning: downstream groups may fail.
   - **manual**: User fixes manually, then runs `/implement --resume`.

#### Post-Merge Verification Failure

1. After merging all sub-branches, `turbo run lint typecheck test --affected` fails.
2. Lead analyzes failure output to identify the likely cause.
3. Lead attempts one direct fix (lint fixes, import corrections, etc.).
4. If fix succeeds, continue. If fails, present retry/skip/manual options to user.

#### Merge Conflicts

1. `git merge` produces a conflict → do NOT attempt automatic resolution.
2. Abort: `git merge --abort`
3. Present conflicting files and diff context to user.
4. User resolves manually, then runs `/implement --resume`.

#### Circular Dependencies

Detected during parsing (Step 2). Print the cycle and exit without executing:

```
Circular dependency detected: TG{A} → TG{B} → TG{A}
```

### Step 7: Spec Compliance (`--loop N`)

Runs after ALL layers complete successfully and the final full verification passes.

1. Spawn spec compliance reviewer:
   - Tool: `Task` (foreground)
   - Model: `sonnet`
   - Use the Spec Compliance Reviewer prompt from [references/agent-prompts.md](references/agent-prompts.md).
   - Input: spec.md, tasks.md, `git diff main..feat/{slug}`, test results

2. Reviewer produces a gap report: Requirement, Status (Implemented/Missing/Partial), Details, Suggested fix.

3. **Scope**: Completeness ONLY. Does NOT check code quality, naming, or architecture — that's `/review`'s job.

4. **Gap dispatch**: For each "Missing" or "Partial" gap:

   ```bash
   workmux add impl/{slug}/gap-{N} --base feat/{slug} -b -C --name impl-{slug}-gap-{N}
   ```

   Dispatch a sonnet agent using the Gap-Fix Agent prompt. Merge back, verify.

5. **Iteration**: Repeat the review → gap-dispatch → merge → verify cycle up to N times.
   If gaps remain after N iterations, present them to user and suggest manual resolution.

6. Update FEATURE.md Spec Compliance subsection with loop results.

Disabled when `--plan-file` (no spec to check against).

### Step 8: Completion

When all layers complete (and all `--loop` iterations if applicable):

1. **Final full-suite verification**:

   ```bash
   turbo run lint && turbo run typecheck && turbo run test
   ```

2. **Code simplification pass** (optional): If all verification passes, run `code-simplifier:code-simplifier` on the changed files to clean up implementation artifacts before PR. This is a non-breaking refinement pass that preserves all functionality.

3. **Update FEATURE.md**: Phase 4 checkbox → `[x]`, all task groups → `complete`.

4. **Commit and push**:

   ```bash
   git add .tonal-guitar/features/{slug}/FEATURE.md
   git commit -m "docs(tooling): implement complete - {feature-name}"
   git push origin feat/{slug}
   ```

5. **Print summary**:

   ```
   Implementation Complete: {Feature Name}

   | Layer | Task Group       | Status   | Files Changed |
   | ----- | ---------------- | -------- | ------------- |
   | 0     | TG1: {name}      | complete | {N}           |
   | 1     | TG2: {name}      | complete | {N}           |
   | ...   | ...              | ...      | ...           |

   Verification: lint pass | typecheck pass | tests pass ({N} suites, {M} tests)
   Oversight: {N} layers reviewed, {N} concerns raised
   Spec Compliance: {N} loops, {N} gaps found and fixed

   Next step: Run /review for code review before creating a PR.
   ```

6. Do NOT auto-create a PR.
7. Do NOT auto-trigger `/review`.

### Step 9: Resumption (`--resume`)

1. Read FEATURE.md, find the `## Phase 4: Implement` section.
2. Parse the progress table — identify task groups by status.
3. Skip all `complete` task groups.
4. Rebuild the layer graph with only incomplete task groups.
5. Resume from the first layer containing `pending` or `failed` task groups.
6. Within a partially-complete layer, only dispatch agents for non-complete task groups.
7. `failed` task groups are retried. `skipped` groups remain skipped unless targeted with `--group <name>`.

### Step 10: Single Layer (`--layer N`)

1. Verify prerequisites: all task groups in layers 0 through N-1 must be `complete`.
2. If not met, print error listing each incomplete task group with its status and exit:
   ```
   Error: Cannot run layer {N}. Incomplete prerequisites:
     - TG{X}: {name} (layer {L}, status: {status})
     - TG{Y}: {name} (layer {L}, status: {status})
   Run /implement --resume to complete earlier layers first.
   ```
3. Execute only layer N using the Layer Execution Engine (Step 5).

### Step 11: Single Group (`--group <name>`)

1. Match the provided name against all task group names using **case-insensitive partial matching**:
   - Convert both the input name and all task group names to lowercase before comparison.
   - A match succeeds if the lowercased input is a substring of the lowercased task group name.
   - Example: `--group "schema"` matches "TG1: Database Schema", `--group "SCHEMA"` also matches.

2. **If no matches**: print error and exit:

   ```
   Error: No task group matching "{name}" found.
   Available task groups: TG1: {name}, TG2: {name}, ...
   ```

3. **If multiple matches**: present a disambiguation list and ask the user to choose:

   ```
   Multiple task groups match "{name}":
     1. TG2: Database Schema Migrations
     2. TG4: Validation Schema Updates
   Which task group? (enter number)
   ```

4. **Verify prerequisites**: all dependency task groups for the matched group must have `complete` status.
   If not met, print error and exit:

   ```
   Error: TG{N} depends on TG{X} (status: {status}) and TG{Y} (status: {status}).
   Complete dependencies first, or run /implement --resume to process all pending groups.
   ```

5. Execute only the matched task group using the agent dispatch flow from Step 5.4.
6. Merge the single sub-branch back, run verification, update progress.

---

## Validation Scenarios

Key scenarios to verify when testing `/implement`:

| Scenario                             | Expected Behavior                                             |
| ------------------------------------ | ------------------------------------------------------------- |
| `--dry-run` on valid tasks.md        | Displays execution plan, creates nothing                      |
| `--dry-run` on circular dependencies | Print cycle, exit                                             |
| `--plan-file` with `--watch`         | Print warning, disable watch, proceed                         |
| `--layer 2` with incomplete layer 1  | Print prerequisite error listing incomplete TGs, exit         |
| `--group "nonexistent"`              | Print "no match" error with available TGs                     |
| `--group "schema"` with 2 matches    | Present disambiguation list                                   |
| `--resume` with no Phase 4 section   | Print "no Phase 4" error                                      |
| `--resume` with all TGs complete     | Print "nothing to resume" and suggest --loop or completion    |
| Agent verification failure           | Agent retries once, then escalates to user                    |
| Merge conflict on sub-branch         | Abort, surface conflicting files, instruct --resume           |
| 6+ task groups in one layer          | First 5 dispatch, 6th queued, dispatched when slot opens      |
| Missing `.env` file                  | Workmux handles `.env` copy via config; no manual step needed |

---

## Notes

- Feature artifacts live on the feature branch (`feat/{slug}`), not on main.
- Sub-branches use the `impl/{slug}/` prefix to distinguish from feature branches.
- Worktrees are created via workmux in `../GuitarStudio/` alongside other worktrees.
- The 5-agent concurrency cap matches the `/fix --all` pattern.
- `--watch` is default-on in v1 to build trust in the skill. Can flip to opt-in later.
- `--plan-file` mode disables all pipeline integration (FEATURE.md, GitHub Project, oversight, compliance).
