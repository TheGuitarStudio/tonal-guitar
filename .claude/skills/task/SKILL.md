---
name: task
description: Adaptive task execution with persistent tracking for M/L-sized work. Handles enhancements, chores, refactors, and quick tasks. S-sized tasks execute immediately; M/L tasks get investigation, GitHub issue tracking, TASK.md state file, and resume capability. Use this skill for any non-bug, non-feature work — from quick fixes to multi-session chores like dependency upgrades.
argument-hint: '<description> | #<id> | --list | --resume | --status'
---

# Adaptive Task Execution

Execute enhancements, chores, refactors, and quick tasks with adaptive scope handling. S-sized tasks
proceed immediately. M/L-sized tasks get persistent tracking via TASK.md, GitHub issue creation,
and session resume capability.

## Supporting Files

- For scope assessment, branch naming, PR format, and verification, see [../references/shared-conventions.md](../references/shared-conventions.md)
- For state management, resume detection, and /implement handoff, see [references/conventions.md](references/conventions.md)
- For TASK.md format, see [templates/task-state-template.md](templates/task-state-template.md)
- For L-sized task plans, see [templates/task-plan-template.md](templates/task-plan-template.md)

## Model Assignment

| Role                          | Model      |
| ----------------------------- | ---------- |
| Lead (interactive)            | **opus**   |
| Helper agents (M-sized tasks) | **sonnet** |
| `--list` / `--status`         | **haiku**  |

## Arguments

| Flag            | Description                                              |
| --------------- | -------------------------------------------------------- |
| `<description>` | Ad hoc task from a description                           |
| `#<id>`         | Task from an existing GitHub issue                       |
| `--list`        | Show open non-bug issues suitable for quick work         |
| `--resume`      | Resume an in-progress task (detects from branch or scan) |
| `--status`      | Show status of current or all in-progress tasks          |

---

## Execution

### Step 0: Config Check

Verify `.tonal-guitar/project-config.json` exists, auto-detect if not.
See [../references/shared-conventions.md](../references/shared-conventions.md).

### Step 1: Parse Arguments

- **`<description>`** → `mode = "adhoc"`, `description = <text>`
- **`#<id>`** → `mode = "issue"`, `issueId = <id>`
- **`--list`** → `mode = "list"`
- **`--resume`** → `mode = "resume"`
- **`--status`** → `mode = "status"`

---

### Step 2: Execute Mode

#### Mode: `list` (`--list`)

1. Query GitHub Project items:
   ```bash
   gh project item-list {projectNumber} --owner {owner} --format json --limit 100
   ```
2. Filter items that are NOT labeled `bug` and have status "Backlog" or "Spark".
3. Display a formatted table:
   ```
   # | Title                    | Status  | Labels
   --|--------------------------|---------|--------
   1 | {title}                  | Backlog | enhancement
   ```
4. If none found: "No open tasks found. Try `/idea --list` for Spark ideas."

#### Mode: `resume` (`--resume`)

Follow the resume detection procedure from [references/conventions.md](references/conventions.md):

1. **Match by current branch**: Extract slug from branch name, check for `.tonal-guitar/tasks/{slug}/TASK.md`.
2. **Scan fallback**: If no match, scan `.tonal-guitar/tasks/*/TASK.md` for unchecked Execute phase.
3. **Branch guard**: Verify current branch matches the TASK.md Branch field.
4. **Determine resume point**:
   - Investigate `[ ]` → Re-run investigation from Step 3
   - Investigate `[x]`, Execute `[ ]` → Resume execution from Step 6, skipping completed files
   - Both `[x]` → Already complete — suggest shipping if PR not yet created

#### Mode: `status` (`--status`)

1. Scan `.tonal-guitar/tasks/*/TASK.md` for all task directories.
2. For each, parse Status checkboxes and Files to Change table.
3. Display:
   ```
   Slug            | Branch              | Size | Phase        | Issue | Files
   ----------------|---------------------|------|--------------|-------|------
   upgrade-prisma  | chore/upgrade-prisma| L    | Executing    | #42   | 3/7
   extract-nav     | refactor/extract-nav| M    | Investigating| #51   | 0/5
   ```
4. If none found: "No in-progress tasks. Start one with `/task <description>`."

#### Mode: `issue` (`#<id>`)

1. Fetch the issue:
   ```bash
   gh issue view {id} --json title,body,number,labels
   ```
2. Proceed to Step 3 (Triage) with the issue content.

#### Mode: `adhoc` (`<description>`)

1. Use the description directly as context.
2. Proceed to Step 3 (Triage).

---

### Step 3: Triage + Investigation

1. Read the issue body or ad hoc description.
2. Identify key terms, component names, file references.
3. Explore relevant code:
   - Grep for key terms across the codebase
   - Read files mentioned in the issue or likely affected
   - Identify which areas are involved (library `src/`, `site/`, `packages/fretboard-ui`)
4. **Document investigation findings** (used for TASK.md in M/L):
   - List of files that need changes with brief description of each change
   - Approach chosen and rationale
   - Any risks or open questions
   - Areas affected (library `src/`, `site/`, `packages/fretboard-ui`)
5. Assess scope per [shared conventions](../references/shared-conventions.md#scope-assessment):
   - **S (1-3 files):** Proceed to Step 5-S (immediate execution)
   - **M (4-8 files):** Proceed to Step 4 (Gate with persistence)
   - **L (9+ files):** Proceed to Step 4 (Gate with persistence + plan generation)

---

### Step 4: Gate (M/L-Sized Tasks)

#### 4a: Create GitHub Issue (adhoc mode only)

If `mode = "adhoc"` and size is M or L:

```bash
gh issue create --title "{title}" --body "{body}" --label "task"
```

Add to GitHub Project and set status to "Backlog":

```bash
gh project item-add {projectNumber} --owner {owner} --url {issueUrl}
```

For `mode = "issue"`: the issue already exists, skip creation.

#### 4b: Create Branch + Worktree

1. Derive a slug from the issue title or description (see [shared conventions](../references/shared-conventions.md#slug-derivation)).
2. Determine branch prefix using `/tree` inference rules:
   - "add", "implement", "create", "build" → `feat/`
   - "fix", "patch", "repair", "resolve" → `fix/`
   - "refactor", "restructure", "simplify" → `refactor/`
   - "update", "upgrade", "bump" → `chore/`
   - "document", "docs" → `docs/`
   - Default → `feat/`
3. Create worktree:
   ```bash
   REPO=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')  # main checkout — herdr rejects linked worktrees
   PANE=$(herdr worktree create --cwd "$REPO" --branch {prefix}{slug} --base origin/main --no-focus --json \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
   herdr pane run "$PANE" "claude" && herdr wait output "$PANE" --match "❯" --timeout 20000
   herdr pane run "$PANE" "Read TASK.md and continue implementation."
   ```

#### 4c: Create TASK.md

1. Create `.tonal-guitar/tasks/{slug}/` directory in the worktree.
2. Write TASK.md using [templates/task-state-template.md](templates/task-state-template.md), populated with:
   - Issue number (from creation or existing issue)
   - Investigation findings from Step 3
   - Files to change table with all identified files
   - Plan (3-5 line summary for M, detailed numbered steps for L)
3. Mark Investigate checkbox as `[x]`.
4. Commit:
   ```bash
   git add .tonal-guitar/tasks/{slug}/TASK.md
   git commit -m "docs(task): init - {slug}"
   ```

#### 4d: Generate tasks.md (L-sized only)

For L-sized tasks, also generate a `/implement`-compatible plan:

1. Use [templates/task-plan-template.md](templates/task-plan-template.md) as the format.
2. Break the work into task groups (2-6 subtasks each) with dependencies.
3. Write to `.tonal-guitar/tasks/{slug}/tasks.md`.
4. Commit:
   ```bash
   git add .tonal-guitar/tasks/{slug}/tasks.md
   git commit -m "docs(task): plan - {slug}"
   ```

#### 4e: Push Branch

```bash
git push -u origin {branch}
```

#### 4f: Update GitHub Project

Set status to "In Progress":

```bash
gh project item-edit --project-id {projectId} --id {itemId} \
  --field-id {statusFieldId} --single-select-option-id {inProgressOptionId}
```

#### 4g: Present Plan + Options

**For M-sized tasks:**

```
Scope: M (~{N} files across {areas})

Plan:
1. {change description}
2. {change description}
3. {change description}

Artifacts saved to .tonal-guitar/tasks/{slug}/TASK.md

Proceed with implementation?
```

Wait for user approval before continuing to Step 6.

**For L-sized tasks:**

```
Scope: L (~{N} files across {areas})

Plan saved to .tonal-guitar/tasks/{slug}/TASK.md
Task breakdown saved to .tonal-guitar/tasks/{slug}/tasks.md

Options:
1. Execute directly — I'll implement step by step in this session
2. Dispatch to /implement — parallel multi-agent execution via:
   /implement --plan-file .tonal-guitar/tasks/{slug}/tasks.md
3. Stop here — resume later with /task --resume
```

- **Option 1:** Continue to Step 6 (sequential execution by lead)
- **Option 2:** Tell user to run `/implement --plan-file` from this worktree. Exit.
- **Option 3:** Save state, exit. User resumes with `/task --resume`.

---

### Step 5-S: Execute (S-Sized)

For S-sized tasks only. No TASK.md, no GitHub issue, no persistence.

1. **Check current branch:**

   ```bash
   git branch --show-current
   ```

2. **If on `main`** — create a worktree (never work directly on main):

   ```bash
   REPO=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')  # main checkout — herdr rejects linked worktrees
   PANE=$(herdr worktree create --cwd "$REPO" --branch {prefix}{slug} --base origin/main --no-focus --json \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
   herdr pane run "$PANE" "claude" && herdr wait output "$PANE" --match "❯" --timeout 20000
   herdr pane run "$PANE" "Implement the task and verify."
   ```

3. **If on a feature/task/fix branch** — work on the current branch. The task becomes
   part of the existing branch's PR. No new branch needed.

4. Implement the changes.
5. Proceed to Step 7 (Verify).

---

### Step 6: Execute (M/L-Sized — Persistent)

1. Implement the changes, following the plan from TASK.md.
2. As each file is completed, update the "Files to Change" table status from `pending` to `complete`.
3. Append progress notes to the "Progress" section of TASK.md for significant milestones or decisions.
4. Guidance skills are auto-loaded by Claude as relevant (backend-api, frontend-components, etc.).
5. Follow project conventions: no `any` types, conventional commits, Zod validation where appropriate.

If the session is interrupted at any point, the TASK.md captures the current state for `/task --resume`.

---

### Step 7: Verify

Run verification per [shared conventions](../references/shared-conventions.md#verification-checklist):

```bash
npm run lint && npm test
```

If files under `site/` changed, also run `npx tsc --noEmit` from `site/`.

If checks fail, attempt to fix. If still failing, note in PR description.

---

### Step 8: Ship

1. **Commit** using conventional commit format:

   ```bash
   git add <specific files>
   git commit -m "{type}({scope}): {subject}"
   ```

2. **Update TASK.md** (M/L only): Mark Execute checkbox as `[x]`, set all file statuses to `complete`.

   ```bash
   git add .tonal-guitar/tasks/{slug}/TASK.md
   git commit -m "docs(task): complete - {slug}"
   ```

3. **Push** the branch:

   ```bash
   git push -u origin {branch}
   ```

4. **Create draft PR:**

   ```bash
   gh pr create --draft --title "{title}" --body "{body}"
   ```

   PR body follows the format in [shared conventions](../references/shared-conventions.md#pr-format).
   For M/L tasks, the PR body must include `Closes #{issueNumber}`.

5. **Report** to user: summary of changes, PR link, verification results.

---

## Notes

- `/task` handles anything that's not a full feature or specifically a bug
- Never commit directly to main — S-sized tasks on main create a new branch; on an existing branch they add to it
- S-sized tasks remain fast and simple — no persistence overhead
- M/L tasks get TASK.md for accountability, resume, and history
- L-sized tasks can hand off to `/implement --plan-file` for parallel agent execution
- For bugs, prefer `/fix` which has investigation-specific patterns and batch mode
- If scope assessment is uncertain, err on the side of showing a plan (treat as M)
- Ad hoc S-sized tasks don't create GitHub issues — the PR is the tracking artifact
- Ad hoc M/L tasks create GitHub issues for project tracking
