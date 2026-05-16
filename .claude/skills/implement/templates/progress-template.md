# Progress Template: Phase 4 Implementation Section

Template for the implementation progress section managed by the `/implement` skill in FEATURE.md.

## Usage

- **First run**: SKILL.md Step 4 appends this section to `FEATURE.md` and populates the progress table with all task groups set to `pending`.
- **Subsequent runs** (`--resume`): The existing section is updated in-place. Do NOT append a second copy.
- **`--plan-file` mode**: Progress is written to `.tonal-guitar/impl-progress-{timestamp}.md` in the current directory instead of FEATURE.md. The Phase 4 heading and table format remain the same.

The `## Phase 4: Implement` heading must be byte-identical to what SKILL.md reads when detecting an existing section. Do not alter the heading text.

---

## Phase 4 Section Template

Append the following block verbatim to FEATURE.md on first run. Replace `{layer}`, `TG{N}`, and `{name}` with values parsed from tasks.md.

```markdown
## Phase 4: Implement

| Layer | Task Group  | Status  | Agent | Notes |
| ----- | ----------- | ------- | ----- | ----- |
| 0     | TG1: {name} | pending | -     | -     |
| 0     | TG2: {name} | pending | -     | -     |
| 1     | TG3: {name} | pending | -     | -     |
| 1     | TG4: {name} | pending | -     | -     |
| 2     | TG5: {name} | pending | -     | -     |

### Oversight Reports

### Spec Compliance
```

### Status Values

All 5 valid values for the `Status` column:

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `pending`     | Not yet started. Set at initialization.                                    |
| `in-progress` | Agent dispatched and running. Set in Step 5.4.                             |
| `complete`    | Merged, verified, and confirmed. Set in Step 5.12.                         |
| `failed`      | Agent reported failure and user did not retry. Set on unrecoverable error. |
| `skipped`     | User chose to skip this task group. Downstream dependents may also fail.   |

### Example Rows (All Statuses)

```markdown
| 0 | TG1: Database Schema | complete | sonnet | - |
| 0 | TG2: Validation Schemas | complete | sonnet | - |
| 1 | TG3: API Routes | in-progress | sonnet | - |
| 1 | TG4: Service Layer | failed | sonnet | Lint error in userService.ts |
| 2 | TG5: Frontend Components | skipped | - | TG4 dependency failed |
```

---

## Oversight Reports Subsection Template

Append a bullet after each layer's oversight agent completes (Step 5.12). Do not pre-populate bullets — only append when the layer's oversight run finishes.

```markdown
### Oversight Reports

- **Layer 0**: No concerns. Continued.
- **Layer 1**: {concern summary}
```

Bullet format:

- No concerns: `- **Layer {N}**: No concerns. Continued.`
- Concerns raised: `- **Layer {N}**: {brief summary of the concern}` (user was presented the full list)

---

## Spec Compliance Subsection Template

Append a bullet after each `--loop` iteration completes (Step 7 in SKILL.md). Do not pre-populate bullets.

```markdown
### Spec Compliance

- **Loop 1**: {N} gaps found, {M} fixed.
- **Loop 2**: 0 gaps remaining.
```

Bullet format:

- Gaps found: `- **Loop {N}**: {gaps_found} gaps found, {gaps_fixed} fixed.`
- All resolved: `- **Loop {N}**: 0 gaps remaining.`
- Unresolved after max iterations: `- **Loop {N}**: {N} gaps remaining. Manual resolution required.`

---

## Pipeline Progress Checkbox

On first `/implement` run, append the following line to the existing `## Pipeline Progress` section in FEATURE.md:

```markdown
- [ ] Phase 4: Implement
```

The full Pipeline Progress section will then read:

```markdown
## Pipeline Progress

- [x] Phase 1: Research
- [x] Phase 2: Shape
- [x] Phase 3: Plan
- [ ] Phase 4: Implement
```

The Phase 4 checkbox is checked `[x]` **only when ALL task groups in the Phase 4 table reach `complete` status**. Task groups with `failed` or `skipped` status prevent the checkbox from being checked. The checkbox is updated in Step 8 (Completion) of SKILL.md.
