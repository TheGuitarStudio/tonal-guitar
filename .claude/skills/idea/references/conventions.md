# Idea Conventions

Shared conventions for the `/idea` skill: GitHub Projects integration patterns, commit protocol,
and naming standards.

---

## GitHub Projects Integration

### Project Config (`.tonal-guitar/project-config.json`)

This file is auto-detected on first run and cached locally (gitignored). It stores IDs needed
to interact with the GitHub Project via the `gh` CLI.

```json
{
  "owner": "{github-username-or-org}",
  "projectNumber": 1,
  "projectId": "PVT_...",
  "fields": {
    "status": {
      "fieldId": "PVTSSF_...",
      "options": {
        "spark": "{option-id}",
        "backlog": "{option-id}",
        "ready": "{option-id}",
        "inProgress": "{option-id}"
      }
    }
  }
}
```

### Auto-Detection Flow

When `project-config.json` doesn't exist:

1. **Find the project:**

   ```bash
   gh project list --owner @me --format json
   ```

   Select the first project (or prompt user if multiple exist).

2. **Get field definitions:**

   ```bash
   gh project field-list {projectNumber} --owner {owner} --format json
   ```

   Find the "Status" field and extract its option IDs by matching option names.

3. **Write config** to `.tonal-guitar/project-config.json`.

### Status Lifecycle

Ideas move through these GitHub Project statuses:

```
Spark → Backlog → Ready → In Progress → Done
```

| Status          | Meaning                               | Triggered By                |
| --------------- | ------------------------------------- | --------------------------- |
| **Spark**       | Raw idea, still brainstorming         | `/idea` (capture)           |
| **Backlog**     | Graduated idea, has feature directory | `/idea --shape`             |
| **Ready**       | Spec complete, ready to implement     | `/feature` Phase 2 complete |
| **In Progress** | Implementation underway               | Manual or automation        |
| **Done**        | Feature shipped                       | Manual                      |

### Common `gh` Commands

**Create a project item (draft issue):**

```bash
gh project item-create {projectNumber} --owner {owner} --title "{title}" --body "{body}" --format json
```

**Set item status:**

```bash
gh project item-edit --project-id {projectId} --id {itemId} --field-id {statusFieldId} --single-select-option-id {optionId}
```

**List project items:**

```bash
gh project item-list {projectNumber} --owner {owner} --format json --limit 100
```

**Convert draft to real issue (when graduating):**

```bash
gh issue create --title "{title}" --body "{body}" --label "feature-spec"
```

**Update an issue body:**

```bash
gh issue edit {issueNumber} --body "{body}"
```

---

## Commit Protocol

| Action          | Commit Message                             | Branch                   |
| --------------- | ------------------------------------------ | ------------------------ |
| Idea capture    | No commit (stored in GitHub Projects only) | N/A                      |
| Idea graduation | `docs(idea): graduate - {title}`           | `feat/{slug}` (worktree) |

### Graduation Commit

When an idea is graduated via `--shape`, commit happens **on the feature branch in the worktree**, not on the current branch. Use `git -C <worktree-path>` so the command works regardless of your current shell directory:

```bash
git -C <worktree-path> add .tonal-guitar/features/{slug}/raw-idea.md
git -C <worktree-path> add .tonal-guitar/features/{slug}/FEATURE.md
git -C <worktree-path> commit -m "docs(idea): graduate - {title}"
git -C <worktree-path> push -u origin feat/{slug}
```

Never use `git add -A` — only stage specific files.

### Worktree Creation

Graduation creates a worktree + branch using workmux. **Do not pass `--prompt` here** — the pane agent would fire immediately and try to read `FEATURE.md` before it's written, hitting a race. Suppress pane commands with `-C`:

```bash
workmux add feat/{slug} --base origin/main -b -C
```

This creates branch `feat/{slug}` from `origin/main` and sets up the worktree (workmux reports the actual path on the `Worktree:` line — capture and reuse it as `<worktree-path>`). The `.env` file is copied automatically. `-b` keeps the current session active; `-C` keeps the pane as a plain shell until you open it.

After writing `raw-idea.md` and `FEATURE.md` and committing, tell the user to run `workmux open feat/{slug}` when they want to start the feature pipeline — the pane will then have access to the populated `FEATURE.md`.

### Issue Body Template (Post-Graduation)

After graduation, the issue body is updated to include branch info:

```markdown
---

> **Branch:** `feat/{slug}`
> **Feature directory:** `.tonal-guitar/features/{slug}/`
```

---

## Naming Conventions

### Slug Derivation

Derive feature slugs from the idea title:

1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove special characters (keep alphanumeric and hyphens)
4. Collapse multiple consecutive hyphens
5. Truncate to 50 characters
6. Trim trailing hyphens

**Examples:**

- "Recurring Lessons & Scheduling" → `recurring-lessons-scheduling`
- "AI-Powered Practice Suggestions" → `ai-powered-practice-suggestions`
- "Document Viewer (PDF/Images)" → `document-viewer-pdf-images`

### Issue Titles

Use clean, readable titles without prefixes:

- "Recurring Lessons & Scheduling" (not "[Feature] Recurring Lessons")
- "Practice Session Timer" (not "FEAT: Practice Session Timer")

### Labels

| Label          | Applied To   | Applied When               |
| -------------- | ------------ | -------------------------- |
| `feature-spec` | Parent issue | Idea graduation            |
| `task-group`   | Sub-issues   | Feature planning (Phase 3) |
