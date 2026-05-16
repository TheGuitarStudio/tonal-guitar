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

When an idea is graduated via `--shape`, commit happens **on the feature branch in the worktree**, not on the current branch:

```bash
cd ../GuitarStudio/{slug}
git add .tonal-guitar/features/{slug}/raw-idea.md
git add .tonal-guitar/features/{slug}/FEATURE.md
git commit -m "docs(idea): graduate - {title}"
git push -u origin feat/{slug}
```

Never use `git add -A` — only stage specific files.

### Worktree Creation

Graduation creates a worktree + branch using workmux:

```bash
workmux add feat/{slug} --base origin/main -b --prompt "Read FEATURE.md to understand this feature's context."
```

This creates branch `feat/{slug}` from `origin/main` and sets up the worktree at `../GuitarStudio/{slug}/`. The `.env` file is automatically copied. `-b` runs in background so the current session continues.

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
