# Task Plan Template (tasks.md)

Simplified task breakdown for L-sized `/task` work. Compatible with `/implement --plan-file`.
Only generated for L-sized tasks (9+ files). M-sized tasks use the inline plan in TASK.md.

Replace `{placeholders}` with actual values.

---

```markdown
# Task Plan: {Title}

## Overview

Total Tasks: {N} Task Groups
{1-2 sentence summary of what this task accomplishes and its scope.}

## Task List

#### Task Group 1: {Group Name}

**Dependencies:** None

- [ ] 1.1 {Subtask description}
  - File: `{file path}`
  - {Implementation detail}
- [ ] 1.2 {Subtask description}
- [ ] 1.3 Verify: `turbo run lint typecheck --filter=<pkg>`

**Acceptance Criteria:**

- {Criterion 1}
- {Criterion 2}

---

#### Task Group 2: {Group Name}

**Dependencies:** {None | Task Group 1}

- [ ] 2.1 {Subtask description}
- [ ] 2.2 {Subtask description}
- [ ] 2.3 Verify: `turbo run lint typecheck --filter=<pkg>`

**Acceptance Criteria:**

- {Criteria}

---

## Execution Order

1. **Task Group 1: {name}** — {brief rationale}
2. **Task Group 2: {name}** — Depends on Group 1

## Files to Modify

| File Path | Task                |
| --------- | ------------------- |
| `{path}`  | {task group number} |
```

---

## Differences from Feature tasks-template.md

| Aspect                  | Feature tasks.md                           | Task tasks.md                        |
| ----------------------- | ------------------------------------------ | ------------------------------------ |
| Layer headings          | Required (Database Layer, API Layer, etc.) | Optional — use if helpful            |
| Test-first subtasks     | Required (each group starts with tests)    | Optional — include when relevant     |
| Test Review group       | Required (final task group)                | Omitted — verification is inline     |
| Technical Notes section | Required                                   | Optional — include for complex tasks |
| Files to Create section | Required                                   | Omitted — use Files to Modify only   |

## Quality Criteria

1. **Groups are right-sized** — Completable in one focused session (2-6 subtasks)
2. **Dependencies are correct** — Groups that modify shared code go first
3. **Specific files** — Subtasks reference exact file paths
4. **Acceptance criteria are testable** — Can verify pass/fail objectively
5. **Verification included** — Each group ends with a verify step
