# Task State Template (TASK.md)

Template for the state tracking file created in each task directory.
Replace `{placeholders}` with actual values.

---

```markdown
# Task: {Title}

**Issue:** #{number} | **Started:** {YYYY-MM-DD} | **Size:** {M|L}

## Status

- [ ] Investigate
- [ ] Execute

## Context

- **Origin:** {adhoc | #<id>}
- **Branch:** {prefix}/{slug}
- **Description:** {1-2 sentence summary of what this task accomplishes}

## Investigation

{Findings from the triage/investigation phase: affected packages, approach chosen, patterns discovered, potential risks}

### Files to Change

| File              | Change                            | Status  |
| ----------------- | --------------------------------- | ------- |
| `path/to/file.ts` | {brief description of the change} | pending |

## Plan

{For M-sized: the 3-5 line plan shown at the gate}
{For L-sized: more detailed plan with numbered steps}

1. {Step description}
2. {Step description}
3. {Step description}

## Progress

{Appended during execution: what was done, issues encountered, decisions made along the way}

## Decisions

{Technical decisions made during investigation/execution with brief rationale}
```

---

## Field Reference

### Status Checkboxes

| Checkbox    | Checked When                                           |
| ----------- | ------------------------------------------------------ |
| Investigate | Triage complete, TASK.md populated, plan shown to user |
| Execute     | All files changed, verification passed, PR created     |

### Files to Change — Status Values

| Status        | Meaning                                 |
| ------------- | --------------------------------------- |
| `pending`     | Not yet modified                        |
| `in-progress` | Currently being worked on               |
| `complete`    | Modified, changes committed             |
| `skipped`     | Determined unnecessary during execution |

### Size Field

| Value | Files Changed | Behavior                                    |
| ----- | ------------- | ------------------------------------------- |
| M     | 4-8           | Single TASK.md artifact, worktree isolation |
| L     | 9+            | TASK.md + tasks.md for /implement handoff   |

Note: S-sized tasks (1-3 files) do not create a TASK.md.
