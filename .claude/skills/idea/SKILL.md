---
name: idea
description: Lightweight idea capture and brainstorming backed by GitHub Projects. Use this skill for capturing feature ideas as GitHub Project "Spark" items, listing existing ideas, brainstorming to refine ideas, or graduating ideas into the feature specification pipeline.
argument-hint: '[--list | --reflect [<id>] | --shape <id>]'
---

# Idea Capture & Brainstorming

Lightweight idea capture and brainstorming workflow backed by GitHub Projects ("Spark" status).

The pipeline: **capture** (`/idea`) → **brainstorm** (`/idea --reflect`) → **graduate** (`/idea --shape`)

## Supporting Files

- For GitHub Projects integration patterns and commit protocol, see [references/conventions.md](references/conventions.md)
- For structured brainstorming protocol, see [references/brainstorm-guide.md](references/brainstorm-guide.md)
- For issue body template, see [templates/idea-issue-template.md](templates/idea-issue-template.md)

## Arguments

| Flag             | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| _(none / text)_  | Quick capture → extract title, store raw text as GitHub "Spark" item |
| `--list`         | List all Spark ideas from GitHub Projects                            |
| `--reflect`      | Brainstorm the next unrefined Spark idea (or pick from list)         |
| `--reflect <id>` | Brainstorm a specific idea, update issue body with refined content   |
| `--shape <id>`   | Graduate idea → create feature directory + move to "Backlog"         |

---

## Execution

### Step 0: Config Check

1. Check if `.tonal-guitar/project-config.json` exists.
2. If it exists, read it and extract `projectNumber`, `owner`, and field IDs.
3. If it does NOT exist, auto-detect:

   a. Run to find the project:

   ```bash
   gh project list --owner @me --format json
   ```

   b. Run to get field IDs (especially "Status" field and its option IDs for "Spark", "Backlog", "Ready", "In Progress"):

   ```bash
   gh project field-list {projectNumber} --owner {owner} --format json
   ```

   c. Write the detected config to `.tonal-guitar/project-config.json`:

   ```json
   {
     "owner": "{owner}",
     "projectNumber": {N},
     "projectId": "{globalProjectId}",
     "fields": {
       "status": {
         "fieldId": "...",
         "options": {
           "spark": "...",
           "backlog": "...",
           "ready": "...",
           "inProgress": "..."
         }
       }
     }
   }
   ```

   d. If no project is found, warn the user and exit: "No GitHub Project found. Create one at https://github.com/users/{owner}/projects and re-run."

### Step 1: Parse Arguments

Determine the run mode from `$ARGUMENTS`:

- **No flags (bare text or empty)** → `mode = "capture"`
- **`--list`** → `mode = "list"`
- **`--reflect`** (no id) → `mode = "reflect-next"`
- **`--reflect <id>`** → `mode = "reflect"`, `targetId = <id>`
- **`--shape <id>`** → `mode = "shape"`, `targetId = <id>`

---

### Step 2: Execute Mode

#### Mode: `capture` (default — no flags)

Quick, low-friction idea capture. No brainstorming — just get it into GitHub Projects fast.

1. If `$ARGUMENTS` contains text, use that as the raw idea description.
   If `$ARGUMENTS` is empty, ask the user: "What's the idea?" and use their response.

2. **Extract a title** from the raw text:
   - Generate a concise title (3-8 words) that captures the core concept
   - Use clean, readable phrasing — no prefixes like "[Feature]" or "FEAT:"
   - Examples: "Dashboard Calendar View for Sessions", "Drag-and-Drop Watch Queue"

3. Create a draft issue in the GitHub Project with the extracted title and the user's raw text as the body:

   ```bash
   gh project item-create {projectNumber} --owner {owner} --title "{title}" --body "{rawText}" --format json
   ```

4. Set the status to "Spark":

   ```bash
   gh project item-edit --project-id {projectId} --id {itemId} --field-id {statusFieldId} --single-select-option-id {sparkOptionId}
   ```

5. Report to the user:
   - "Captured: **{title}** (Spark #{N})"
   - "Use `/idea --reflect #{N}` to brainstorm, or `/idea --shape #{N}` to graduate to a feature."

---

#### Mode: `list` (`--list`)

1. Query all project items:

   ```bash
   gh project item-list {projectNumber} --owner {owner} --format json --limit 100
   ```

2. Filter items with "Spark" status.

3. Display a formatted table:

   ```
   # | Title                    | Created
   --|--------------------------|----------
   1 | {title}                  | {date}
   2 | {title}                  | {date}
   ```

4. If no Spark items exist, tell the user: "No Spark ideas found. Run `/idea` to capture a new one."

---

#### Mode: `reflect-next` (`--reflect` with no id)

Pick the next idea to brainstorm, or let the user choose.

1. Fetch all Spark items from GitHub Projects (same as `--list`).

2. If no Spark items exist: "No Spark ideas to reflect on. Run `/idea` to capture one first."

3. If exactly one Spark item exists: proceed to brainstorm it (jump to `reflect` mode with that item's id).

4. If multiple Spark items exist: present the list and ask the user which one to brainstorm. Then proceed to `reflect` mode with the chosen id.

---

#### Mode: `reflect` (`--reflect <id>`)

Interactive brainstorming session to refine a captured idea into a structured spec.

1. Fetch the idea content from GitHub:

   ```bash
   gh project item-list {projectNumber} --owner {owner} --format json
   ```

   Find the item matching `<id>` and read its body.

2. Read [references/brainstorm-guide.md](references/brainstorm-guide.md) for the structured brainstorming protocol.

3. Read product context:
   - `docs/product/roadmap.md` for current roadmap and priorities
   - `docs/product/mission.md` for product mission and values

4. Present the current idea state to the user.

5. Run an interactive brainstorming session following the protocol:
   - Explore the problem space: what pain point does this address?
   - Discuss user stories: who benefits, how?
   - Consider scope: is this a feature, enhancement, or experiment?
   - Assess feasibility: what existing code/patterns support this?
   - Explore alternatives: are there simpler approaches?

6. Synthesize the discussion into a structured idea using [templates/idea-issue-template.md](templates/idea-issue-template.md).

7. Present the draft to the user for confirmation.

8. Update the issue body with the refined content:
   - If the item is a draft issue, update via project item edit.
   - If it has been converted to a real issue, update via:
     ```bash
     gh issue edit {issueNumber} --body "{updatedBody}"
     ```

9. Report: "Idea #{N} refined. Use `/idea --shape #{N}` to graduate to a feature, or `/idea --reflect #{N}` to continue brainstorming."

---

#### Mode: `shape` (`--shape <id>`)

1. Fetch the idea content from GitHub (same as reflect).

2. **Check if the idea has been brainstormed.** If the body is still raw text (not structured with the idea template sections like "## Problem", "## Proposed Solution"), warn the user:
   - "This idea hasn't been brainstormed yet. Run `/idea --reflect #{id}` first to refine it, or continue with `--shape` to graduate as-is."
   - If the user confirms, proceed. Otherwise, exit.

3. Derive a slug from the title: lowercase, replace spaces with hyphens, remove special characters, truncate to 50 chars.

4. Derive the branch name: `feat/{slug}`

5. Create worktree + branch. herdr opens a plain shell workspace (no agent fires), so there's no race with `FEATURE.md` not existing until step 7:

   ```bash
   REPO=$(git rev-parse --show-toplevel)
   herdr worktree create --cwd "$REPO" --branch feat/{slug} --base origin/main --no-focus --json
   ```

   - `--no-focus` keeps the current session focused so it continues.
   - herdr does not auto-launch an agent; the worktree's root pane is a plain shell until you open it. This avoids a race where an agent reads `FEATURE.md` before it's written.

   Capture the worktree path from the JSON (`result.worktree.path`). Use it as `<worktree-path>` in subsequent steps. The feature directory lives at `<worktree-path>/.tonal-guitar/features/{slug}/`.

6. Create the feature directory at `<worktree-path>/.tonal-guitar/features/{slug}/`.

7. Create `raw-idea.md` with the idea content from the GitHub item (in the worktree feature directory).

8. Create `FEATURE.md` using the feature state template (see `.claude/skills/feature/templates/feature-state-template.md`). Set:
   - All pipeline phases unchecked
   - Origin: `/idea #{id}`
   - Branch: `feat/{slug}`
   - All artifact statuses to "pending"

9. If the project item is a draft issue, convert to a real issue:

   ```bash
   gh issue create --title "{title}" --body "{body}" --label "feature-spec"
   ```

   Then link the new issue to the project item.

10. Move the project item from "Spark" to "Backlog":

    ```bash
    gh project item-edit --project-id {projectId} --id {itemId} --field-id {statusFieldId} --single-select-option-id {backlogOptionId}
    ```

11. Update the issue body to include branch and feature directory info:

    ```markdown
    ---

    > **Branch:** `feat/{slug}`
    > **Feature directory:** `.tonal-guitar/features/{slug}/`
    ```

12. Commit **on the feature branch** (in the worktree). Use `git -C` so this works without changing directory:

    ```bash
    git -C <worktree-path> add .tonal-guitar/features/{slug}/
    git -C <worktree-path> commit -m "docs(idea): graduate - {title}"
    ```

13. Push the branch:

    ```bash
    git -C <worktree-path> push -u origin feat/{slug}
    ```

14. Tell the user: "Idea graduated. Worktree at `<worktree-path>`, branch `feat/{slug}` pushed to GitHub. Open it when you're ready with `/tree --open feat/{slug}` (or `herdr worktree open --branch feat/{slug} --focus`) and start Claude there — now that FEATURE.md exists it'll read correctly. Then run `/feature --from #{issueNumber}` from that worktree."

---

## Notes

- **Capture is instant** — `/idea` with text gets it into GitHub Projects with zero friction.
- **Brainstorming is opt-in** — `/idea --reflect` is the interactive session to refine raw ideas.
- **Shape checks for refinement** — `--shape` warns if an idea hasn't been brainstormed yet, encouraging the capture → brainstorm → graduate pipeline.
- This skill does not have resumption logic — each invocation is a standalone operation.
- For continuing the feature pipeline after graduation, use `/feature --resume`.
- The `project-config.json` file is gitignored — each developer auto-detects their own project config on first run.
