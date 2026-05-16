# Review Conventions

Shared conventions for the review pipeline: finding format, triage rules, dependency ordering,
domain grouping, and commit protocol.

---

## Finding Format

Each finding uses this format:

```
- CR-{NNN}: [{severity}] Description in `file:line` — explanation
```

### Severities

| Severity       | Meaning                                                                                 | Action                    |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| **Critical**   | Must fix before merge. Security vulnerabilities, data loss risks, broken functionality. | Fix now                   |
| **Important**  | Should fix if simple. Code quality, performance, maintainability.                       | Fix if < 20 lines changed |
| **Suggestion** | Nice to have. Style preferences, minor improvements.                                    | Create GitHub issue       |

### Finding Statuses

After triage, each finding is tracked with a status:

| Status        | Meaning                         |
| ------------- | ------------------------------- |
| **Open**      | Not yet addressed               |
| **Fixed**     | Applied in commit `{short-sha}` |
| **Deferred**  | Created GitHub issue #{N}       |
| **Won't Fix** | Justification provided          |

---

## Triage Rules

Applied during fix phases (4, 6, 8):

1. **Critical** → Fix now, in the current phase
2. **Important** → Fix if the change is simple and localized (< 20 lines)
3. **Suggestion** → Create a GitHub issue and mark as Deferred

Create GitHub issues for deferred items:

```bash
gh issue create --title "CR-NNN: {description}" --body "Found during code review of {BRANCH_NAME}

Severity: {severity}
File: {file:line}
Details: {explanation}" --label "code-review"
```

---

## Package Dependency Order

Used for `blockedBy` when creating fix tasks. Lower levels must complete before higher levels.
Tasks at higher levels are blocked by tasks at lower levels **only if both packages are affected**.

```
Level 0: packages/types, packages/audio-core
Level 1: packages/validation, packages/db, packages/ui, packages/audio-web
Level 2: packages/storage, packages/api
Level 3: apps/server, apps/web, apps/audio-playground, apps/tool-lab
```

---

## Domain Grouping

Used for fix phases to group findings into parallel fix tasks.
Fix tasks are ordered: shared → backend/audio (parallel) → frontend.

| Domain   | Packages                                                                      |
| -------- | ----------------------------------------------------------------------------- |
| shared   | packages/types, packages/theory                                               |
| backend  | apps/server, packages/api, packages/db, packages/validation, packages/storage |
| audio    | packages/audio-core, packages/audio-web                                       |
| frontend | apps/web, packages/ui                                                         |

---

## Commit Protocol

After each phase that produces changes:

1. Stage only the modified files and REVIEW.md (never `git add -A`):

   ```bash
   git add <specific-files> .tonal-guitar/features/{BRANCH_NAME}/REVIEW.md
   ```

2. Commit with conventional format:

   ```bash
   git commit -m "chore(review): phase {N} - {phase-name}"
   ```

3. Push to the current branch:
   ```bash
   git push
   ```

### Phase Commit Messages

| Phase | Message                                                   |
| ----- | --------------------------------------------------------- |
| 2     | `chore(review): phase 2 - lint and test fixes`            |
| 3     | `chore(review): phase 3 - architecture review findings`   |
| 4     | `chore(review): phase 4 - architecture fixes`             |
| 5     | `chore(review): phase 5 - simplification review findings` |
| 6     | `chore(review): phase 6 - simplification fixes`           |
| 7     | `chore(review): phase 7 - specialized review findings`    |
| 8     | `chore(review): phase 8 - specialized fixes`              |
| 9     | `chore(review): phase 9 - final verification`             |

---

## CR-NNN ID Assignment

- IDs are assigned sequentially starting from CR-001
- Phase 2 assigns the first batch
- Each subsequent review phase continues from the highest existing ID
- On resumption, parse REVIEW.md for the highest existing CR-NNN and continue from there
