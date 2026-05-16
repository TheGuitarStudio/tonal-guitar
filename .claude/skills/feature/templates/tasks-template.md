# Tasks Template

Template for the Phase 3 task breakdown output. Follows the project's canonical task format
as established in `docs/specs/`. Tasks are grouped by layer in dependency order.

---

```markdown
# Task Breakdown: {Feature Name}

## Overview

Total Tasks: {N} Task Groups

{1-2 sentence summary of what this feature implements and its scope.}

## Task List

### Database Layer

#### Task Group 1: {Group Name}

**Dependencies:** None

- [ ] 1.0 {Top-level task description}
  - [ ] 1.1 Write {N} focused tests for {what}
    - {Test case description}
    - {Test case description}
    - Create test file: `{test file path}`
  - [ ] 1.2 {Subtask description}
    - File: `{file path}`
    - {Implementation detail}
    - {Implementation detail}
  - [ ] 1.3 {Subtask description}
  - [ ] 1.4 Ensure tests pass
    - Run ONLY the tests written in 1.1

**Acceptance Criteria:**

- {Criterion 1}
- {Criterion 2}
- The {N} tests written in 1.1 pass

---

### Validation Layer

#### Task Group 2: {Group Name}

**Dependencies:** {None | Task Group 1}

- [ ] 2.0 {Top-level task description}
  - [ ] 2.1 Write {N} focused tests for {what}
  - [ ] 2.2 {Subtask}
  - [ ] 2.3 Ensure tests pass

**Acceptance Criteria:**

- {Criteria}

---

### API Layer

#### Task Group 3: {Group Name}

**Dependencies:** Task Groups 1, 2

- [ ] 3.0 {Top-level task description}
  - [ ] 3.1 Write {N} focused tests
  - [ ] 3.2 {Subtask}
  - [ ] 3.3 Ensure tests pass

**Acceptance Criteria:**

- {Criteria}

---

### Frontend Components

#### Task Group 4: {Group Name}

**Dependencies:** Task Group 3

- [ ] 4.0 {Top-level task description}
  - [ ] 4.1 Write {N} focused tests
  - [ ] 4.2 {Subtask}
  - [ ] 4.3 Ensure tests pass

**Acceptance Criteria:**

- {Criteria}

---

### Frontend Pages

#### Task Group 5: {Group Name}

**Dependencies:** Task Group 4

- [ ] 5.0 {Top-level task description}
  - [ ] 5.1 Write {N} focused tests
  - [ ] 5.2 {Subtask}
  - [ ] 5.3 Ensure tests pass

**Acceptance Criteria:**

- {Criteria}

---

### Testing

#### Task Group 6: Test Review and Gap Analysis

**Dependencies:** Task Groups 1-5

- [ ] 6.0 Review existing tests and fill critical gaps only
  - [ ] 6.1 Review tests from Task Groups 1-5
  - [ ] 6.2 Analyze test coverage gaps for this feature only
  - [ ] 6.3 Write up to 8 additional strategic tests maximum
  - [ ] 6.4 Run feature-specific tests only

**Acceptance Criteria:**

- All feature-specific tests pass
- Critical user workflows are covered
- Testing focused exclusively on this spec's feature requirements

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: {name}** — Foundation database layer
2. **Task Group 2: {name}** — {Can run in parallel with Group 1 if independent}
3. **Task Group 3: {name}** — Depends on Groups 1, 2
4. **Task Group 4: {name}** — Depends on Group 3
5. **Task Group 5: {name}** — Depends on Group 4
6. **Task Group 6: {name}** — Final verification

## Files to Create

| File Path | Task          |
| --------- | ------------- |
| `{path}`  | {task number} |

## Files to Modify

| File Path | Task          |
| --------- | ------------- |
| `{path}`  | {task number} |

## Technical Notes

### {Pattern Category}

{Relevant patterns to follow from existing code:}

- {Convention or pattern with file path reference}
```

---

## Task Breakdown Quality Criteria

1. **Layer ordering** — DB → Validation → API → UI Components → Pages → Testing
2. **Test-first** — Each group starts with writing tests
3. **Specific files** — Every subtask references exact file paths
4. **Dependencies are correct** — Lower layers complete before higher layers
5. **Groups are right-sized** — Completable in one focused session (3-8 subtasks)
6. **Acceptance criteria are testable** — Can verify pass/fail objectively
7. **Patterns referenced** — Technical notes cite existing code to follow
