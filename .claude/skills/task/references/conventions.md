# Task Conventions

Task-specific conventions for the `/task` skill: state management, resume detection, /implement handoff,
and commit protocol. For scope assessment, branch naming, PR format, and verification, see
[../../references/shared-conventions.md](../../references/shared-conventions.md).

---

## Artifact Directory

Task artifacts live on the task branch in `.tonal-guitar/tasks/{slug}/`:

```
.tonal-guitar/tasks/{slug}/
  TASK.md         # State tracking (always present for M/L)
  tasks.md        # Optional: /implement-compatible plan (L-sized only)
```

This mirrors the feature artifact pattern (`.tonal-guitar/features/{slug}/`) but is intentionally
lighter — most tasks only need TASK.md.

---

## State Management

### TASK.md Lifecycle

1. **Created** during Step 4 (Gate) after investigation and scope assessment
2. **Investigation phase checked** once TASK.md is populated and plan is shown to user
3. **Updated** during execution — file statuses change from `pending` to `complete`
4. **Execute phase checked** once all files are modified, verification passes, and PR is created
5. **Committed** at each phase transition on the task branch

### Commit Protocol

Task artifacts get their own commits, separate from implementation commits:

```bash
# After TASK.md creation (investigation complete)
git add .tonal-guitar/tasks/{slug}/TASK.md
git commit -m "docs(task): init - {slug}"

# After tasks.md creation (L-sized only)
git add .tonal-guitar/tasks/{slug}/tasks.md
git commit -m "docs(task): plan - {slug}"

# After execution complete
git add .tonal-guitar/tasks/{slug}/TASK.md
git commit -m "docs(task): complete - {slug}"
```

Implementation commits follow the normal convention: `{type}({scope}): {subject}`

---

## Resume Detection

When `/task --resume` is invoked:

### Step 1: Match by Current Branch

1. Run `git branch --show-current` to get the current branch name
2. Extract the slug from the branch name (strip prefix like `chore/`, `refactor/`, etc.)
3. Check if `.tonal-guitar/tasks/{slug}/TASK.md` exists on the current branch
4. If found, resume from that TASK.md

### Step 2: Scan for In-Progress Tasks (fallback)

If no match on the current branch:

1. List all directories under `.tonal-guitar/tasks/`
2. For each, read TASK.md and check the Status checkboxes
3. Collect tasks where Execute is unchecked (`- [ ] Execute`)
4. If one found: switch to its branch and resume
5. If multiple found: present a selection to the user
6. If none found: "No in-progress tasks found."

### Step 3: Determine Resume Point

Read the matched TASK.md:

| State                            | Resume From                                               |
| -------------------------------- | --------------------------------------------------------- |
| Investigate `[ ]`, Execute `[ ]` | Re-run investigation (something failed during init)       |
| Investigate `[x]`, Execute `[ ]` | Begin execution — read plan, check file statuses          |
| Investigate `[x]`, Execute `[x]` | Already complete — suggest shipping if PR not yet created |

During execution resume, scan the "Files to Change" table:

- Skip files with status `complete`
- Resume from the first `pending` file

---

## /implement Handoff (L-Sized Tasks)

When an L-sized task chooses "Dispatch to /implement":

### Generating tasks.md

1. Use [../templates/task-plan-template.md](../templates/task-plan-template.md) as the format
2. Generate task groups from the investigation findings
3. Each task group should be completable by a single agent in one session
4. Dependencies flow from shared/foundational code to dependent code
5. Write to `.tonal-guitar/tasks/{slug}/tasks.md`

### Handoff

1. Tell the user to run: `/implement --plan-file .tonal-guitar/tasks/{slug}/tasks.md`
2. `/implement`'s `--plan-file` mode handles:
   - Parsing numbered items into task groups
   - Creating sub-branches under `impl/{slug}/`
   - Dispatching parallel agents per layer
   - Merging back with verification
3. `/implement` tracks its own progress in `.tonal-guitar/impl-progress-{timestamp}.md`
4. After `/implement` completes, the user runs `/task --resume` to:
   - Update TASK.md Execute checkbox to `[x]`
   - Run final verification
   - Ship (push + PR)

### What /implement Does NOT Do

- Does not update TASK.md (only FEATURE.md or its own progress file)
- Does not create the PR (that's `/task`'s job)
- Does not update GitHub Project status (automated hooks handle In Review/Done)

---

## GitHub Issue Creation (Ad Hoc M/L Tasks)

When a task originates from an ad hoc description (not an existing issue) and is M or L-sized:

```bash
gh issue create --title "{title}" --body "$(cat <<'EOF'
{description}

---
Created by `/task` — tracking artifact at `.tonal-guitar/tasks/{slug}/TASK.md`
EOF
)" --label "task"
```

Then add to GitHub Project:

```bash
gh project item-add {projectNumber} --owner {owner} --url {issueUrl}
```

S-sized ad hoc tasks do NOT create GitHub issues — the PR remains the sole tracking artifact.

---

## Branch Guard

For `--resume` mode, verify the user is on the correct branch:

1. Read TASK.md, extract the `Branch` field from the Context section
2. Check `git branch --show-current`
3. If mismatch:

   ```
   This task lives on branch `{branch}`.
   You are on `{current-branch}`.

   Switch to the task worktree or checkout the branch.
   ```

Skip the branch guard for: `--list` (reads from GitHub), `--status` (reads from multiple branches),
new task creation (branch doesn't exist yet), and S-sized tasks (no TASK.md).
