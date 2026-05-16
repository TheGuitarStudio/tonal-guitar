---
name: bug
description: File bug reports as GitHub issues with project board tracking. Use this skill when filing a bug, reporting an issue, or capturing a problem with screenshots or code snippets. Dispatches a background agent so you can keep working.
argument-hint: '<description>'
---

# Bug Report Filing

File a bug report as a GitHub issue, add it to the project board, and set status to "Backlog".
Runs entirely in the background so the user can keep working.

## Model Assignment

| Role                     | Model      |
| ------------------------ | ---------- |
| Lead agent (interactive) | **opus**   |
| Bug filing agent         | **sonnet** |

---

## Execution

### Step 0: Config Check

Verify `.tonal-guitar/project-config.json` exists, auto-detect if not.
See [../references/shared-conventions.md](../references/shared-conventions.md).

### Step 1: Collect Context

Gather everything the user provided after `/bug`:

- Description text
- Pasted screenshots or images
- Code blocks or HTML snippets
- Error messages or stack traces

All of this becomes the raw material for the bug report.

### Step 2: Dispatch Background Agent

Spawn a **sonnet** `general-purpose` agent with `run_in_background: true`.

The agent prompt must include:

1. The full user input (description, screenshots, code, etc.)
2. The project config values needed for GitHub Project integration
3. Instructions to execute the following steps:

#### Agent Steps

**A. Derive title** — Create a concise, descriptive issue title from the user's description. Format: imperative sentence, no prefix (e.g., "Audio playback stutters when switching tabs").

**B. Format body** — Structure the description as markdown:

```markdown
## Summary

{1-2 sentence summary of the bug}

## Details

{Full description from user input, preserving all context}

{If steps to reproduce are apparent, add:}

## Steps to Reproduce

1. ...
2. ...

{Include all screenshots, code blocks, and error messages verbatim}
```

**C. Create issue:**

```bash
gh issue create --title "{title}" --body "{body}" --label "bug"
```

Capture the issue URL from stdout.

**D. Add to project board:**

```bash
gh project item-add {projectNumber} --owner {owner} --url {issueUrl} --format json
```

Capture the `id` from the JSON response.

**E. Set status to "Backlog":**

```bash
gh project item-edit --project-id {projectId} --id {itemId} --field-id {statusFieldId} --single-select-option-id {backlogOptionId}
```

Config values (from `.tonal-guitar/project-config.json`):

- `owner` → `owner`
- `projectNumber` → `projectNumber`
- `projectId` → `projectId`
- `statusFieldId` → `fields.status.fieldId`
- `backlogOptionId` → `fields.status.options.backlog`

**F. Report result** — Return the issue URL and title so the lead agent can notify the user.

### Step 3: Acknowledge

Immediately tell the user: "Filing bug in the background — you'll be notified when it's created."

Do NOT wait for the agent to finish. The user continues working.
