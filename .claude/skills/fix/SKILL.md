---
name: fix
description: Bug and code-review issue investigation and fix workflow with batch dispatch and review loop. Use this skill when fixing bugs from GitHub issues, dispatching parallel agents to fix multiple bugs or code-review issues, or processing review feedback on fix PRs.
argument-hint: '<description> | #<id> | --all [--cr] | --cr #<id> | --review [--cr] | --update #<pr> | --status [--cr]'
---

# Bug Fix Pipeline

Investigate, fix, and ship bug fixes and code-review issues. Supports single fixes, batch dispatch with parallel agents,
and a review feedback loop for processing PR comments.

## Supporting Files

- For agent prompt templates, see [references/agent-prompts.md](references/agent-prompts.md)
- For scope assessment, branch naming, PR format, and verification, see [../references/shared-conventions.md](../references/shared-conventions.md)

## Model Assignment

| Role                     | Model      |
| ------------------------ | ---------- |
| Lead agent (interactive) | **opus**   |
| Dispatched fix agents    | **sonnet** |
| Review update agents     | **sonnet** |
| `--status`               | **haiku**  |

## Arguments

| Flag             | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `#<id>`          | Fix a single bug from a GitHub issue                              |
| `<description>`  | Fix a bug from an ad hoc description                              |
| `--all`          | Batch: pull all bug issues, dispatch parallel agents              |
| `--all --cr`     | Batch: pull all code-review issues, dispatch parallel agents      |
| `--cr #<id>`     | Fix a single code-review issue                                    |
| `--review`       | Fetch all open fix PRs with new comments, push updates            |
| `--review --cr`  | Same as `--review` but includes `refactor/` and `chore/` branches |
| `--update #<pr>` | Fetch comments on a specific PR, push fixes                       |
| `--status`       | Dashboard of all in-flight fix branches/PRs                       |
| `--status --cr`  | Same as `--status` but includes `refactor/` and `chore/` branches |

---

## Execution

### Step 0: Config Check

Verify `.tonal-guitar/project-config.json` exists, auto-detect if not.
See [../references/shared-conventions.md](../references/shared-conventions.md).

### Step 1: Parse Arguments

- **`#<id>`** → `mode = "single"`, `issueId = <id>`, `label = "bug"`
- **`<description>`** → `mode = "adhoc"`, `label = "bug"`
- **`--all`** → `mode = "batch"`, `label = "bug"`
- **`--all --cr`** → `mode = "batch"`, `label = "code-review"`
- **`--cr #<id>`** → `mode = "single"`, `issueId = <id>`, `label = "code-review"`
- **`--review`** → `mode = "review-all"`, `label = "bug"`
- **`--review --cr`** → `mode = "review-all"`, `label = "code-review"`
- **`--update #<pr>`** → `mode = "review-single"`, `prNumber = <pr>`
- **`--status`** → `mode = "status"`, `label = "bug"`
- **`--status --cr`** → `mode = "status"`, `label = "code-review"`

---

### Single Fix (`mode = "single"` or `mode = "adhoc"`)

#### Step 2: Investigate

1. Read the issue body (if from issue):

   ```bash
   gh issue view {id} --json title,body,number,labels
   ```

   Or use the ad hoc description directly.

2. Identify affected files from:
   - File paths mentioned in the issue
   - Error stack traces
   - Component/function names referenced

3. Trace the bug:
   - Read the affected files
   - Follow the call chain from the error/symptom
   - Identify the root cause (or flag uncertainty)

4. Assess scope per [shared conventions](../references/shared-conventions.md#scope-assessment):
   - **S:** proceed immediately
   - **M:** show plan, wait for approval
   - **L:** "This is bigger than a bug fix. Consider `/feature --from #{id}`." → stop

5. **Detect issue type** (for `label = "code-review"` issues):

   Scan the issue title and body for keywords to determine type, branch prefix, and commit type:

   | Signal in title/body                                              | Type     | Branch prefix | Commit type |
   | ----------------------------------------------------------------- | -------- | ------------- | ----------- |
   | "race condition", "inconsistency", "fires for", "wrong", "broken" | fix      | `fix/`        | `fix`       |
   | "extract", "split", "DRY", "shared", "replace", "move to"         | refactor | `refactor/`   | `refactor`  |
   | "comment", "misleading", "unused", "clean up", "remove"           | chore    | `chore/`      | `chore`     |
   | "aria", "landmark", "heading hierarchy", "accessible"             | fix      | `fix/`        | `fix`       |
   | Default (unclear)                                                 | fix      | `fix/`        | `fix`       |

   For `label = "bug"` issues, always use `fix/` prefix and `fix` commit type.

#### Step 3: Isolate

1. Derive slug from issue title or description.
2. Determine branch prefix: `fix/` (default), `refactor/`, or `chore/` (see type detection above).
3. Based on scope:
   - **S:** Branch in current checkout:
     ```bash
     git checkout -b {prefix}/{slug}
     ```
   - **M:** Worktree:
     ```bash
     REPO=$(git rev-parse --show-toplevel)
     PANE=$(herdr worktree create --cwd "$REPO" --branch {prefix}/{slug} --base origin/main --no-focus --json \
       | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
     herdr pane run "$PANE" "claude" && herdr wait output "$PANE" --match ">" --timeout 20000
     herdr pane run "$PANE" "Investigate and fix the issue described in the branch name."
     ```

4. Update GitHub Project item status to "In Progress" (if from issue).

#### Step 4: Fix

1. Apply the fix — minimal change addressing root cause.
2. Run existing tests:
   ```bash
   turbo run test --filter=<affected packages>
   ```
3. If the bug scenario is NOT covered by existing tests, add a test.
4. Run full verification:
   ```bash
   turbo run lint typecheck test --filter=<affected packages>
   ```

#### Step 5: Ship

1. Commit:
   ```bash
   git add <specific files>
   git commit -m "{commitType}({scope}): {subject}"
   ```
2. Push:
   ```bash
   git push -u origin {prefix}/{slug}
   ```
3. Create draft PR:

   ```bash
   gh pr create --draft --title "{commitType}: {title}" --body "{body}"
   ```

   PR body includes: root cause, changes, verification results.
   See [shared conventions](../references/shared-conventions.md#pr-format) for format.

4. Report to user: root cause, what changed, PR link.

---

### Batch Dispatch (`mode = "batch"` / `--all` or `--all --cr`)

#### Step 2: Gather

1. Query issues by label:

   ```bash
   gh issue list --label {label} --state open --json number,title,body,labels
   ```

   Where `{label}` is `bug` (for `--all`) or `code-review` (for `--all --cr`).

2. Filter out issues already in progress:

   ```bash
   gh pr list --state open --json headRefName,title
   ```

   Exclude issues that already have an open PR on any matching branch prefix (`fix/`, `refactor/`, `chore/`).

3. For `--all --cr` mode, detect issue type for each issue (see type detection table in Step 2 of Single Fix).

4. Present the list to the user:

   ```
   Found N {label} issues to fix:

   # | Issue                       | Type     | Branch Prefix | Issue #
   --|-----------------------------|---------:|---------------|--------
   1 | {title}                     | fix      | fix/          | #{number}
   2 | {title}                     | refactor | refactor/     | #{number}

   Proceed with all, or pick specific ones? (Enter numbers or "all")
   ```

5. Wait for user selection.

#### Step 3: Dispatch

For each selected issue (max **5 concurrent**, queue the rest):

1. Create worktree:

   ```bash
   REPO=$(git rev-parse --show-toplevel)
   PANE=$(herdr worktree create --cwd "$REPO" --branch {prefix}/{slug} --base origin/main --no-focus --json \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
   herdr pane run "$PANE" "claude" && herdr wait output "$PANE" --match ">" --timeout 20000
   herdr pane run "$PANE" "Investigate and fix the issue described in the branch name."
   ```

2. Read [references/agent-prompts.md](references/agent-prompts.md) for the appropriate agent prompt:
   - `label = "bug"` → Single Fix Agent prompt
   - `label = "code-review"` → Code Review Fix Agent prompt

3. Spawn a **sonnet** agent via the `Task` tool:
   - `subagent_type`: `"general-purpose"`
   - `model`: `"sonnet"`
   - `run_in_background`: `true`
   - Prompt: The agent template filled with issue details (including detected type, prefix, and commit type)
   - The agent works in the worktree directory

4. Track agent progress. As agents complete, dispatch queued issues.

#### Step 4: Results

After all agents complete, present a summary table:

```
# | Issue                       | Type     | Status      | PR     | Confidence | Notes
--|-----------------------------|---------:|-------------|--------|------------|------
1 | {title} (#{number})         | fix      | Fixed       | #{pr}  | High       | -
2 | {title} (#{number})         | refactor | Uncertain   | #{pr}  | Medium     | {reason}
3 | {title} (#{number})         | chore    | Too complex | -      | -          | {findings}
```

Update GitHub Project items accordingly:

- Fixed/Uncertain → "In Review" status
- Too complex → remains at current status

---

### Review Loop — Batch (`mode = "review-all"` / `--review` or `--review --cr`)

1. Fetch all open PRs on relevant branches:
   - `--review` (bug mode): fetch PRs on `fix/` branches
   - `--review --cr` (code-review mode): fetch PRs on `fix/`, `refactor/`, and `chore/` branches

   ```bash
   gh pr list --state open --json number,title,headRefName,reviewDecision
   ```

   Filter results by branch prefix(es) from the JSON output.

2. For each PR, check for review comments:

   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments
   gh api repos/{owner}/{repo}/pulls/{number}/reviews
   ```

3. For PRs with unresolved feedback:
   - Check if a worktree exists for the branch. If not, create one.
   - Read [references/agent-prompts.md](references/agent-prompts.md) for the Review Update Agent prompt.
   - Spawn a **sonnet** agent to address the feedback (max 5 concurrent).

4. Present summary of what was updated.

---

### Review Loop — Single (`mode = "review-single"` / `--update #<pr>`)

1. Fetch the PR and its comments:

   ```bash
   gh pr view {prNumber} --json number,title,headRefName,body
   gh api repos/{owner}/{repo}/pulls/{prNumber}/comments
   gh api repos/{owner}/{repo}/pulls/{prNumber}/reviews
   ```

2. Check out the branch (worktree or current checkout).

3. Address each piece of feedback:
   - Valid suggestions → implement
   - Questions → add clarifying comments
   - Disagreements → note rationale (do not change code)

4. Run verification, commit, push.

5. Report what was changed.

---

### Dashboard (`mode = "status"` / `--status` or `--status --cr`)

1. Fetch PRs on relevant branches:
   - `--status` (bug mode): fetch PRs on `fix/` branches
   - `--status --cr` (code-review mode): fetch PRs on `fix/`, `refactor/`, and `chore/` branches

   ```bash
   gh pr list --state open --json number,title,headRefName,reviewDecision,isDraft
   ```

   Filter results by branch prefix(es) from the JSON output.

2. Display dashboard:

   ```
   # | Issue                      | Branch              | PR   | State             | Comments
   --|----------------------------|---------------------|------|-------------------|----------
   1 | {title}                    | fix/{slug}          | #{n} | {reviewDecision}  | {count}
   2 | {title}                    | refactor/{slug}     | #{n} | {reviewDecision}  | {count}
   ```

3. Highlight PRs needing attention (changes requested, unresolved comments).

---

## Notes

- Single fix mode and `/task` can both handle bugs. `/fix` adds investigation-specific patterns and always attempts to add a missing test.
- Batch mode caps at 5 concurrent agents to manage cost. Agents are queued and dispatched as others finish.
- Review loop works with both GitHub PR review comments and inline code comments.
- Agents report confidence levels (High/Medium/Low) so you can prioritize review attention.
