# Implement Conventions

Shared conventions for the `/implement` skill: sub-branch naming, state management, merge
protocol, cleanup procedures, `--plan-file` mode behavior, and concurrency.

---

## Sub-Branch Naming

### Implementer Sub-Branch Pattern

```
impl/{slug}/tg{N}-{group-name-slug}
```

- `{slug}` — the feature slug (from FEATURE.md `Branch` field, e.g., `user-auth`)
- `{N}` — the task group number (integer, no padding)
- `{group-name-slug}` — the task group name slugified (see rules below)

### Gap Sub-Branch Pattern

```
impl/{slug}/gap-{N}
```

- `{N}` — sequential gap number within the `--loop` iteration (1, 2, 3, ...)

### Worktree Naming

Both implementer and gap-fix worktrees are created via `herdr worktree create` — herdr
determines the filesystem path and reports it in the JSON (`result.worktree.path`). Capture
and reuse that path as `<worktree-path>` for any follow-up commands.

| Type        | Branch                                  | Worktree directory (flattened branch)   |
| ----------- | --------------------------------------- | --------------------------------------- |
| Implementer | `impl/{slug}/tg{N}-{group-name-slug}`   | `impl-{slug}-tg{N}-{group-name-slug}/`  |
| Gap-fix     | `impl/{slug}/gap-{N}`                   | `impl-{slug}-gap-{N}/`                   |

The directory name is the branch with slashes flattened to dashes, under herdr's central
worktree tree; read the absolute path from `herdr worktree list --json`
(`result.worktrees[].path`) or the `worktree create` JSON.

### Slugification Rules for `{group-name-slug}`

Apply these transformations to the task group name in order:

1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove all characters that are not alphanumeric or hyphens
4. Collapse multiple consecutive hyphens into one
5. Trim leading and trailing hyphens
6. Truncate to 30 characters

### Worked Example

Feature slug: `implement-skill`
Task Group 3: `"State Management & Conventions"`

Slugification:

1. `state management & conventions`
2. `state-management-&-conventions`
3. `state-management--conventions`
4. `state-management-conventions`
5. `state-management-conventions`
6. `state-management-conventions` (28 chars — no truncation needed)

Results:

- Sub-branch: `impl/implement-skill/tg3-state-management-conventions`
- Worktree directory: `impl-implement-skill-tg3-state-management-conventions/` (herdr reports the full path in the create JSON)

---

## State Management

### Phase 4 Section Format in FEATURE.md

On first `/implement` run, append this section to FEATURE.md:

```markdown
## Phase 4: Implement

| Layer | Task Group  | Status  | Agent | Notes |
| ----- | ----------- | ------- | ----- | ----- |
| 0     | TG1: {name} | pending | -     | -     |
| 0     | TG2: {name} | pending | -     | -     |
| 1     | TG3: {name} | pending | -     | -     |
| 2     | TG4: {name} | pending | -     | -     |

### Oversight Reports

- **Layer 0**: No concerns. Continued.

### Spec Compliance

- **Loop 1**: {N} gaps found, {M} fixed.
```

The `## Phase 4: Implement` heading must be byte-identical to this string — the `--resume`
flow detects the section by this exact heading.

### Status Values

| Status        | Meaning                            |
| ------------- | ---------------------------------- |
| `pending`     | Not yet dispatched                 |
| `in-progress` | Agent running in worktree          |
| `complete`    | Successfully merged and verified   |
| `failed`      | Agent reported failure; not merged |
| `skipped`     | User-initiated skip; not merged    |

### Status Transitions

| Transition                 | When it happens                                          |
| -------------------------- | -------------------------------------------------------- |
| `pending` → `in-progress`  | Agent dispatched (Step 5.4 in layer lifecycle)           |
| `in-progress` → `complete` | Sub-branch successfully merged and verification passes   |
| `in-progress` → `failed`   | Agent reports failure after retry; lead presents options |
| `in-progress` → `skipped`  | User chooses skip after agent failure                    |
| `failed` → `in-progress`   | User chooses retry; new agent dispatched                 |
| `pending` → `skipped`      | User skips a task group before it is dispatched          |

### First-Run Detection vs Resume Detection

**First run**: Check for the `## Phase 4: Implement` heading in FEATURE.md. If absent, this
is a first run — append the full Phase 4 section and populate the table with all task groups
at `pending` status.

**Resume** (`--resume` or subsequent run): If the `## Phase 4: Implement` heading exists,
read the table rows and reconstruct the execution graph from the status column:

1. `complete` rows → skip entirely
2. `failed` rows → retry (dispatch new agent)
3. `skipped` rows → leave as-is (unless targeted with `--group <name>`)
4. `pending` and `in-progress` rows → dispatch agents
5. Rebuild layers from only the non-complete groups, preserving original dependency order

### Progress Commit Messages

| Event               | Commit message                                           |
| ------------------- | -------------------------------------------------------- |
| First run (init)    | `docs(tooling): implement init - {feature-name}`         |
| Layer complete      | `docs(tooling): implement progress - layer {N} complete` |
| All layers complete | `docs(tooling): implement complete - {feature-name}`     |

### Oversight Reports Subsection Format

```markdown
### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: {concern summary, e.g., "2 concerns raised. User chose to continue."}
```

Append one bullet per layer after the oversight agent completes. If `--no-watch`, omit the
subsection entirely.

### Spec Compliance Subsection Format

```markdown
### Spec Compliance

- **Loop 1**: {N} gaps found, {M} fixed.
- **Loop 2**: 0 gaps remaining.
```

Append one bullet per loop iteration. If `--loop` is not used, omit the subsection entirely.

---

## Merge Protocol

### Strategy

Use `git merge` (not `git rebase`). Rationale: merging preserves each implementer agent's
commit history on the feature branch, making it possible to trace which agent introduced
which changes.

### Full Merge Command Sequence

For each sub-branch after all agents in the layer complete successfully:

```bash
# Return to feature branch
git checkout feat/{slug}

# Merge the sub-branch (one at a time, sequentially)
git merge impl/{slug}/tg{N}-{group-name-slug} --no-edit
```

Repeat for each sub-branch in the layer. After all merges succeed, proceed to cleanup
(Step 5.7) and verification (Step 5.8–5.9).

### Merge Order Within a Layer

Sequential, one sub-branch at a time. Order within a layer is arbitrary — same-layer task
groups are designed to modify independent areas of the codebase, so merge order does not
affect correctness. The lead may choose any order.

### Conflict Handling

If `git merge` produces a conflict:

1. Do NOT attempt automatic resolution.
2. Abort immediately:
   ```bash
   git merge --abort
   ```
3. Surface to the user: list the conflicting files and the relevant diff context.
4. Instruct the user to resolve the conflicts manually, commit the resolution, then run
   `/implement --resume` to continue from the failed task group.

### Setup Re-Run Triggers

After merging a layer, **always** run dependency install (agents may have added packages):

```bash
npm install
```

`tonal-guitar` is a single-package library, not a turbo monorepo. There is **no database
layer**, no Prisma, no `db:generate` / `db:push` commands. Skip those steps entirely.

---

## Cleanup Procedures

### Success Path

After a sub-branch is successfully merged, immediately remove its worktree and delete the
branch. Do not defer cleanup to end-of-layer — clean up each sub-branch right after its
individual merge succeeds. Remove by the workspace id recorded when the worktree was created (`$WS`), or look it up by branch:

```bash
WS=$(herdr worktree list --cwd "$(git rev-parse --show-toplevel)" --json \
  | python3 -c 'import sys,json;b="impl/{slug}/tg{N}-{group-name-slug}";print(next((w["open_workspace_id"] for w in json.load(sys.stdin)["result"]["worktrees"] if w["branch"]==b and w.get("open_workspace_id")),""))')
[ -n "$WS" ] && herdr worktree remove --workspace "$WS" --force --json
```

For gap-fix branches (look up by branch `impl/{slug}/gap-{N}`):

```bash
WS=$(herdr worktree list --cwd "$(git rev-parse --show-toplevel)" --json \
  | python3 -c 'import sys,json;b="impl/{slug}/gap-{N}";print(next((w["open_workspace_id"] for w in json.load(sys.stdin)["result"]["worktrees"] if w["branch"]==b and w.get("open_workspace_id")),""))')
[ -n "$WS" ] && herdr worktree remove --workspace "$WS" --force --json
```

### Failure Path

If an agent fails and the sub-branch was not merged:

1. Remove the worktree immediately (it holds no unmerged value):
   ```bash
   WS=$(herdr worktree list --cwd "$(git rev-parse --show-toplevel)" --json \
     | python3 -c 'import sys,json;b="impl/{slug}/tg{N}-{group-name-slug}";print(next((w["open_workspace_id"] for w in json.load(sys.stdin)["result"]["worktrees"] if w["branch"]==b and w.get("open_workspace_id")),""))')
   [ -n "$WS" ] && herdr worktree remove --workspace "$WS" --force --json
   ```
   This removes the worktree but keeps the sub-branch (`impl/{slug}/tg{N}-{group-name-slug}`) — the user may inspect partial work or use it as a reference if they choose the manual fix option.
2. On user-initiated **retry**: delete the old sub-branch and create a fresh worktree:
   ```bash
   git branch -D impl/{slug}/tg{N}-{group-name-slug}
   herdr worktree create --cwd "$(git rev-parse --show-toplevel)" --branch impl/{slug}/tg{N}-{group-name-slug} --base feat/{slug} --no-focus --json
   ```
3. On user-initiated **skip**: delete the sub-branch (it will not be merged):
   ```bash
   git branch -D impl/{slug}/tg{N}-{group-name-slug}
   ```

### No Dangling Worktrees

Every worktree created by `/implement` must be removed before the skill exits — whether
through normal completion, failure, or user interruption. If the lead detects a crash or
unexpected exit, check for leftover worktrees with `git worktree list` and remove them
before resuming.

---

## --plan-file Mode

### Input Parsing Heuristics

When `--plan-file <path>` is provided, parse the file using these heuristics:

1. Each top-level numbered item (e.g., `1.`, `2.`) → task group
2. Sub-items under each numbered item → subtasks for that task group
3. Dependencies are inferred from sequential ordering: group N implicitly depends on group N-1
   (unless the plan explicitly states otherwise with a "Depends on:" annotation)
4. Task group names are derived from the numbered item text

### Temporary Progress File

Progress is tracked in a temporary file instead of FEATURE.md:

```
.tonal-guitar/impl-progress-{timestamp}.md
```

Where `{timestamp}` is the Unix timestamp at skill invocation (e.g., `1709000000`). This
file is written in the current working directory (the repo root, not a feature directory).

### Auto-Disabled Features

The following features are automatically disabled in `--plan-file` mode:

| Feature                | Reason                                           |
| ---------------------- | ------------------------------------------------ |
| `--watch` (oversight)  | No spec.md to check implementation against       |
| `--loop` (compliance)  | No spec.md to run compliance review against      |
| FEATURE.md updates     | No feature directory; no pipeline state to track |
| GitHub Project updates | No feature issue to update                       |
| Branch guard           | Not on a feature branch; no FEATURE.md to read   |

If `--watch` or `--loop` are explicitly passed with `--plan-file`, print a warning and disable them:

```
Warning: --watch and --loop require spec.md and are disabled in --plan-file mode.
```

### No Spec or Research Context for Agents

In `--plan-file` mode, implementer agents receive only the task group content parsed from the
plan file. They do not receive:

- `spec.md` content
- `research.md` content

The agent prompt `{specContent}` and `{researchContent}` placeholders are omitted entirely.
Agents operate from the plan file subtasks alone.

---

## Concurrency

### Cap

v1 hardcodes a maximum of **5 concurrent agents**. This applies to both implementer agents
(dispatched per layer) and gap-fix agents (dispatched during `--loop` iterations).

A `--concurrency` flag may be added in a future version to make this configurable.

### Queue-and-Dispatch Pattern

When a layer contains more than 5 task groups:

1. Dispatch the first 5 agents immediately.
2. Maintain a queue of remaining task groups.
3. As each running agent completes (success or failure), decrement the active count.
4. If the queue is non-empty and the active count is below 5, dequeue the next task group
   and dispatch a new agent.
5. Continue until all task groups in the layer have been dispatched and completed.

The same pattern applies during `--loop` gap dispatch: if more than 5 gaps are found,
queue extras and dispatch them as running gap-fix agents complete.

### Applies To

| Context               | Subject            | Cap |
| --------------------- | ------------------ | --- |
| Layer execution       | Implementer agents | 5   |
| `--loop` gap dispatch | Gap-fix agents     | 5   |

The cap is per-phase, not global. If a layer finishes with 3 agents still running when the
`--loop` gap dispatch begins, those 3 are no longer counted — the gap-fix pool starts fresh
at 0 active agents.
