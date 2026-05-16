# Feature State Template (FEATURE.md)

Template for the pipeline state tracking file created in each feature directory.
Replace `{placeholders}` with actual values.

---

```markdown
# Feature: {Feature Name}

**Issue:** #{number} | **Started:** {YYYY-MM-DD}

## Pipeline Progress

- [ ] Phase 1: Research
- [ ] Phase 2: Shape
- [ ] Phase 3: Plan
- [ ] Phase 4: Implement

## Context

- **Origin:** {/idea #{id} | manual | --from #{id}}
- **Branch:** {feat/{slug}}
- **Priority:** {P0|P1|P2|unset}
- **Size:** {XS|S|M|L|XL|unset}

## Artifacts

| Phase     | File        | Status  | Loops | Reviewed |
| --------- | ----------- | ------- | ----- | -------- |
| Research  | research.md | pending | 0     | no       |
| Shape     | spec.md     | pending | 0     | no       |
| Plan      | tasks.md    | pending | 0     | no       |
| Implement | FEATURE.md  | pending | 0     | no       |

## Loop History

{Appended per loop iteration — what changed and why}

## Review History

{Appended per external review — summary of feedback and what was incorporated}
```
