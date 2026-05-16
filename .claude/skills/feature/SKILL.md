---
name: feature
description: Multi-phase feature specification pipeline with research, shaping, and planning. Use this skill when starting a new feature specification, when researching codebase patterns for a planned feature, when writing detailed feature specs with interactive requirements gathering, when breaking features into implementation tasks, or when resuming an in-progress feature pipeline.
argument-hint: '[--from <id> | --resume | --research | --shape | --plan | --review | --loop N | --list | --status]'
---

# Feature Specification Pipeline

Multi-phase feature specification pipeline: **Research → Shape → Plan**. Uses multi-agent teams
for research and planning, interactive sessions for shaping.

## Supporting Files

- For agent prompt templates, see [references/agent-prompts.md](references/agent-prompts.md)
- For state management, commit protocol, and naming, see [references/conventions.md](references/conventions.md)
- For research investigation criteria, see [references/research-criteria.md](references/research-criteria.md)
- For specification quality criteria, see [references/spec-criteria.md](references/spec-criteria.md)
- For external LLM review prompt templates, see [references/review-prompts.md](references/review-prompts.md)

### Templates

- Feature state: [templates/feature-state-template.md](templates/feature-state-template.md)
- Research output: [templates/research-template.md](templates/research-template.md)
- Requirements Q&A: [templates/requirements-template.md](templates/requirements-template.md)
- Decision log: [templates/decisions-template.md](templates/decisions-template.md)
- Specification: [templates/spec-template.md](templates/spec-template.md)
- Task breakdown: [templates/tasks-template.md](templates/tasks-template.md)

## Model Assignment

Use different models for different roles to balance capability and cost:

| Role                           | Model      | Rationale                                                                      |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------ |
| Lead agent (user-facing)       | **opus**   | Deep reasoning for interactive sessions                                        |
| Research agents (Phase 1)      | **sonnet** | Good analysis, 2 run in parallel                                               |
| Spec synthesis agent (Phase 2) | **opus**   | Highest-leverage task — spec quality cascades into planning and implementation |
| Task planning agent (Phase 3)  | **sonnet** | Breaking down specs into tasks                                                 |
| Plan review agent (Phase 3)    | **sonnet** | Verification against spec                                                      |
| `--list` / `--status`          | **haiku**  | Simple data formatting, no deep reasoning                                      |

When spawning background agents via the `Task` tool, set the `model` parameter accordingly.

---

## Arguments

| Flag          | Description                                                        |
| ------------- | ------------------------------------------------------------------ |
| _(none)_      | Start new feature from scratch (interactive → full pipeline)       |
| `--from <id>` | Start from existing GitHub issue or graduated idea                 |
| `--resume`    | Resume in-progress pipeline (detect from branch or scan features/) |
| `--research`  | Run Phase 1 only                                                   |
| `--shape`     | Run Phase 2 only (requires Phase 1)                                |
| `--plan`      | Run Phase 3 only (requires Phase 2)                                |
| `--review`    | Generate external review prompt for the latest completed phase     |
| `--loop N`    | Re-run the current/specified phase N times (refine iteratively)    |
| `--list`      | List features from GitHub Projects (Backlog/Ready/In Progress)     |
| `--status`    | Show detailed pipeline status of current feature                   |

---

## Execution

### Step 0: Config Check

Same as `/idea` Step 0 — verify `.tonal-guitar/project-config.json` exists, auto-detect if not.
See [references/conventions.md](references/conventions.md) for the full config check procedure.

### Step 1: Parse Arguments

Determine the run mode from `$ARGUMENTS`:

- **No args** → `mode = "full"` (interactive start → all phases)
- **`--from <id>`** → `mode = "from"`, `issueId = <id>`
- **`--resume`** → `mode = "resume"`
- **`--research`** → `mode = "research-only"`
- **`--shape`** → `mode = "shape-only"`
- **`--plan`** → `mode = "plan-only"`
- **`--review`** → `mode = "review"`
- **`--loop N`** → modifier on current mode, `loopCount = N`
- **`--list`** → `mode = "list"`
- **`--status`** → `mode = "status"`

### Step 1.5: Branch Guard

**Skip for:** `--list` (reads from GitHub, not local files)

For all other modes, enforce that the current branch matches the feature's branch:

1. Detect the active feature (from args, branch name, or FEATURE.md scan).
2. Read the feature's `FEATURE.md` and extract the `Branch` field.
3. Check current branch: `git branch --show-current`
4. If current branch does NOT match the feature's `Branch` value:
   - **Block execution** with a clear error:

     ```
     This feature lives on branch `feat/{slug}`.
     You are on `{current-branch}`.

     Switch to the feature worktree:
       cd ../GuitarStudio/{slug}/

     Or if you don't have a local worktree, create one:
       /tree add {slug}
     ```

   - Exit without making changes.

**Note:** For `mode = "full"` and `mode = "from"` when the feature does not yet exist, the guard is deferred until after worktree creation (Step 2 handles creating the branch first).

---

### Step 2: Detect or Create Feature

Based on the mode, determine the active feature:

#### `mode = "full"` (no args)

1. Interactive session: ask the user what feature they want to specify.
2. Read product context: `docs/product/roadmap.md`, `docs/product/mission.md`.
3. Derive a slug from the feature title.
4. Create worktree + branch:
   ```bash
   workmux add feat/{slug} --base origin/main -b --prompt "Read FEATURE.md and continue the current pipeline phase."
   ```
5. Create `.tonal-guitar/features/{slug}/FEATURE.md` **in the worktree** using [templates/feature-state-template.md](templates/feature-state-template.md). Set `Branch: feat/{slug}`.
6. Create a GitHub issue for tracking:
   ```bash
   gh issue create --title "{Feature Name}" --body "Feature specification in progress.\n\n> **Branch:** \`feat/{slug}\`\n> **Feature directory:** \`.tonal-guitar/features/{slug}/\`" --label "feature-spec"
   ```
7. Add the issue to the GitHub Project and set status to "Backlog".
8. Commit on the feature branch (in the worktree):
   ```bash
   cd ../GuitarStudio/{slug}
   git add .tonal-guitar/features/{slug}/FEATURE.md
   git commit -m "docs(feature): init - {feature-name}"
   ```
9. Push the branch:
   ```bash
   git push -u origin feat/{slug}
   ```
10. Tell the user: "Feature initialized. Worktree at `../GuitarStudio/{slug}/`, branch `feat/{slug}` pushed. All subsequent `/feature` work should happen from that worktree."
11. Proceed to Phase 1.

#### `mode = "from"` (`--from <id>`)

1. Fetch the issue content:
   ```bash
   gh issue view {id} --json title,body,number
   ```
2. Check if a feature directory already exists for this issue (scan FEATURE.md files for matching issue number).
3. If a directory exists (e.g., from `/idea --shape`):
   - Read FEATURE.md and extract the `Branch` field.
   - Check if a local worktree exists for this branch. If not, create one from the remote:
     ```bash
     git fetch origin feat/{slug}
     workmux add feat/{slug} --base origin/feat/{slug} -b --prompt "Read FEATURE.md and continue the current pipeline phase."
     ```
   - The branch guard (Step 1.5) enforces you're on the correct branch before proceeding.
4. If no directory exists:
   - Derive slug from issue title.
   - Create worktree + branch:
     ```bash
     workmux add feat/{slug} --base origin/main -b --prompt "Read FEATURE.md and continue the current pipeline phase."
     ```
   - Create `.tonal-guitar/features/{slug}/FEATURE.md` **in the worktree** with origin set to `--from #{id}` and `Branch: feat/{slug}`.
   - Commit on the feature branch:
     ```bash
     cd ../GuitarStudio/{slug}
     git add .tonal-guitar/features/{slug}/FEATURE.md
     git commit -m "docs(feature): init - {feature-name}"
     ```
   - Push the branch:
     ```bash
     git push -u origin feat/{slug}
     ```
   - Update the issue body to include branch info:

     ```markdown
     ---

     > **Branch:** `feat/{slug}`
     > **Feature directory:** `.tonal-guitar/features/{slug}/`
     ```

5. Proceed to Phase 1.

#### `mode = "resume"` (`--resume`)

1. Check git branch name — look for a feature directory matching the branch slug.
2. If no match, scan `.tonal-guitar/features/*/FEATURE.md` for in-progress features (first unchecked `[ ]` phase).
3. If multiple in-progress features, present a selection to the user.
4. Read the FEATURE.md, find the first unchecked phase, resume from there.

#### `mode = "research-only" | "shape-only" | "plan-only"`

1. Detect the active feature (same as resume — scan FEATURE.md files).
2. Verify prerequisites:
   - `--shape` requires Phase 1 (Research) to be complete.
   - `--plan` requires Phase 2 (Shape) to be complete.
3. Run only the specified phase.

#### `mode = "list"` (`--list`)

1. Query GitHub Project items:
   ```bash
   gh project item-list {projectNumber} --owner {owner} --format json --limit 100
   ```
2. Filter items with "Backlog", "Ready", or "In Progress" status that have the `feature-spec` label.
3. Display a formatted table:
   ```
   # | Title                    | Status      | Pipeline
   --|--------------------------|-------------|----------
   1 | {title}                  | Backlog     | Research pending
   2 | {title}                  | Ready       | Complete
   ```
4. For pipeline status, read the corresponding FEATURE.md if the feature directory exists.

#### `mode = "status"` (`--status`)

1. Detect the active feature.
2. Read and display the full FEATURE.md content.
3. Show which artifacts exist and their sizes.
4. Show review status if any reviews exist.

#### `mode = "review"` (`--review`)

See [External Review Integration](#external-review-integration) below.

---

### Step 3: Phase 1 — Research (Multi-Agent)

**Team:** `feature-research`

1. Update FEATURE.md: Phase 1 → in-progress.

2. Read the feature context:
   - `raw-idea.md` (if exists, from `/idea` graduation)
   - Issue body from GitHub
   - FEATURE.md for origin and context

3. **Search conversation history:** Use `episodic-memory:search-conversations` to find past conversations about this feature area. Include any relevant prior decisions or context in the research brief.

4. Read [references/research-criteria.md](references/research-criteria.md) for investigation focus areas.

5. Read [references/agent-prompts.md](references/agent-prompts.md) for the research agent prompt templates.

6. Create team `feature-research`. Create two tasks:

   | Task              | Agent Type                   | Focus                                                                    |
   | ----------------- | ---------------------------- | ------------------------------------------------------------------------ |
   | Codebase Research | `feature-dev:code-architect` | Explore code for relevant patterns, models, routers, components, schemas |
   | Product Research  | `feature-dev:code-architect` | Read product docs, roadmap, related specs, GitHub Project context        |

7. Spawn both agents in background using prompts from [references/agent-prompts.md](references/agent-prompts.md).

8. When both complete, merge results into `.tonal-guitar/features/{slug}/research.md` using [templates/research-template.md](templates/research-template.md).

9. Commit:

   ```bash
   git add .tonal-guitar/features/{slug}/research.md .tonal-guitar/features/{slug}/FEATURE.md
   git commit -m "docs(feature): research - {feature-name}"
   ```

10. Update FEATURE.md: Phase 1 → complete, increment loop count if looping.

11. Shutdown team (send shutdown requests → wait → TeamDelete).

12. **Checkpoint:** If running full pipeline, present research summary and ask:
    "Continue to Phase 2 (Shape)? Options: continue / review externally / re-run / stop"

    | Response     | Action                                         |
    | ------------ | ---------------------------------------------- |
    | **continue** | Proceed to Phase 2                             |
    | **review**   | Run `--review` flow, then stop                 |
    | **re-run**   | Re-run Phase 1 with refined focus              |
    | **stop**     | Save state, user resumes later with `--resume` |

---

### Step 4: Phase 2 — Shape (Interactive + Synthesis Agent)

1. Update FEATURE.md: Phase 2 → in-progress.

2. Present the research summary from `research.md` to the user.

3. Check for review feedback in `reviews/research-review.md`. If it exists, present a summary of the feedback and note areas to address.

4. **Interactive requirements discussion:**
   - Follow a structured Q&A format (see [templates/requirements-template.md](templates/requirements-template.md))
   - Cover: user stories, data model questions, UI/UX approach, integration points, edge cases
   - Reference research findings to ground the discussion
   - Capture answers in `.tonal-guitar/features/{slug}/requirements.md`

5. **Technical decisions:**
   - Present key technical options based on research
   - Discuss trade-offs with the user
   - Capture each decision in `.tonal-guitar/features/{slug}/decisions.md` using [templates/decisions-template.md](templates/decisions-template.md)
   - Use sequential IDs: D-001, D-002, etc.

6. **Specification synthesis:**
   Once the requirements discussion converges, spawn a single **Specification Synthesis Agent** (`feature-dev:code-architect`):
   - Agent reads: research.md, requirements.md, decisions.md
   - Agent produces: `spec.md` following the spec format in [templates/spec-template.md](templates/spec-template.md)
   - The spec follows the project's canonical format: Goal, User Stories, Specific Requirements (by layer), Existing Code to Leverage, Visual Design, Out of Scope

7. Present the spec draft to the user for review and refinement.

8. Finalize and commit:

   ```bash
   git add .tonal-guitar/features/{slug}/requirements.md
   git add .tonal-guitar/features/{slug}/decisions.md
   git add .tonal-guitar/features/{slug}/spec.md
   git add .tonal-guitar/features/{slug}/FEATURE.md
   git commit -m "docs(feature): shape - {feature-name}"
   ```

9. Move GitHub Project item to "Ready" status:

   ```bash
   gh project item-edit --project-id {projectId} --id {itemId} --field-id {statusFieldId} --single-select-option-id {readyOptionId}
   ```

10. Update FEATURE.md: Phase 2 → complete.

11. **Checkpoint:** If running full pipeline, present spec summary and ask:
    "Continue to Phase 3 (Plan)? Options: continue / review externally / re-run / stop"

---

### Step 5: Phase 3 — Plan (Multi-Agent)

**Team:** `feature-plan`

1. Update FEATURE.md: Phase 3 → in-progress.

2. Check for review feedback in `reviews/spec-review.md`. If it exists, incorporate into planning context.

3. Read [references/agent-prompts.md](references/agent-prompts.md) for the planning agent prompt templates.

4. Create team `feature-plan`. Create two tasks with dependencies:

   | Task          | Agent Type                   | Focus                                | Blocked By    |
   | ------------- | ---------------------------- | ------------------------------------ | ------------- |
   | Task Planning | `feature-dev:code-architect` | Break spec into task groups by layer | —             |
   | Plan Review   | `feature-dev:code-reviewer`  | Verify completeness against spec     | Task Planning |

5. Spawn task-planner agent with spec.md and research.md.

6. After task-planner completes, spawn plan-reviewer agent with spec.md and the generated tasks.

7. Resolve any gaps flagged by the reviewer:
   - If minor gaps: update tasks.md directly.
   - If significant gaps: present to user for guidance.

8. Finalize `.tonal-guitar/features/{slug}/tasks.md` using [templates/tasks-template.md](templates/tasks-template.md):
   - Tasks grouped by layer: DB → Validation → API → UI → Testing
   - Each task group has: dependencies, subtasks, acceptance criteria
   - Follows the project's canonical task format

9. Create GitHub sub-issues for each task group:

   ```bash
   gh issue create --title "[{Feature Name}] Task Group {N}: {Group Name}" --body "{body}" --label "task-group"
   ```

   **Critical:** Each sub-issue body MUST include `**Parent:** #{parent_issue_number}` on its own line. The `pr-merged.yml` workflow uses this reference to automatically close sub-issues when the parent PR merges. Use the exact `{Feature Name}` from the parent issue title for the `[{Feature Name}]` prefix in sub-issue titles.

10. Commit:

    ```bash
    git add .tonal-guitar/features/{slug}/tasks.md .tonal-guitar/features/{slug}/FEATURE.md
    git commit -m "docs(feature): plan - {feature-name}"
    ```

11. Update FEATURE.md: Phase 3 → complete.

12. Shutdown team.

13. Present final summary: feature pipeline complete, list all artifacts and GitHub issues created.

14. **Next step suggestion:** Tell the user:
    ```
    Feature specification complete. Next step:
      /implement          — Run layered multi-agent implementation from tasks.md
      /implement --dry-run — Preview the execution plan first
    ```

---

## External Review Integration

### `--review` Flow

1. **Detect phase:** Read FEATURE.md, find the latest completed phase.

2. **Generate review prompt:** Based on the phase, read the appropriate template from [references/review-prompts.md](references/review-prompts.md). Replace `{slug}` with the feature slug.

3. **Output the prompt:** Display the prompt to the user in a fenced code block (copyable). The prompt references file paths for the reviewer to read — do NOT embed the file contents into the prompt.

4. **Tell the user:**

   ```
   Copy this prompt and paste it into another Claude Code session, ChatGPT, Gemini, or another LLM.
   The prompt tells the reviewer which file to read and where to save their review.
   ```

5. **Return.** The user pastes the prompt elsewhere, gets feedback saved to the review file.

### Integrating Review Feedback

When the next phase runs (or the current phase is re-run), the lead agent checks for review files:

- Phase 2 checks `reviews/research-review.md`
- Phase 3 checks `reviews/spec-review.md`
- Re-runs check `reviews/{current-phase}-review.md`

If a review file exists:

- Read the review content
- Present a summary of the feedback to the user
- For re-runs: incorporate feedback into agent prompts
- For next phases: include as additional context

---

## Looping (`--loop N`)

Re-run a phase iteratively to refine output.

**Behavior:**

- `/feature --shape --loop 2` — Run Shape phase twice
- Each iteration builds on the previous output
- Each loop iteration:
  1. Increments the loop count in FEATURE.md artifacts table
  2. Appends a `## Loop {N}` entry to FEATURE.md Loop History
  3. Presents a diff of what changed
  4. Asks user to confirm or adjust before next iteration
- Loop count resets when moving to next phase

**Phase-specific loop behavior:**

| Phase    | What Happens Per Loop                                                          |
| -------- | ------------------------------------------------------------------------------ |
| Research | Re-research with refined focus based on gaps found                             |
| Shape    | Re-read requirements + decisions, refine spec, run synthesis agent again       |
| Plan     | Re-generate tasks incorporating feedback or spec changes, re-run plan reviewer |

---

## Resumption

When `/feature --resume` is invoked:

1. Scan `.tonal-guitar/features/*/FEATURE.md` for features with unchecked phases
2. If current git branch matches a feature slug, prefer that feature
3. Parse `## Pipeline Progress` checkboxes in FEATURE.md
4. Find the first unchecked `[ ]` phase
5. Resume execution from that phase
6. All existing artifacts are preserved — agents read them as context

---

## Notes

- Feature artifacts live on the feature branch (`feat/{slug}`), not on main
- Each feature gets a dedicated worktree at `../GuitarStudio/{slug}/`
- The branch guard (Step 1.5) prevents accidental work on the wrong branch
- The `project-config.json` is gitignored — auto-detected per developer
- Each phase can be run independently with phase flags (`--research`, `--shape`, `--plan`)
- Interactive checkpoints pause between phases by default
- Phase flags skip checkpoints (user explicitly chose one phase)
- The `--review` flow is opt-in and non-blocking — the pipeline works without external reviews
