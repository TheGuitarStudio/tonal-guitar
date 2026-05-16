# Agent Prompt Templates

Templates for spawning review and fix agents. The lead agent fills in the placeholders
before passing the prompt to the Task tool.

---

## Review Agent Prompt

Used for Phase 3 (architecture), Phase 5 (simplification), and Phase 7 (specialized) agents.

```
You are reviewing changes in `{package}` for the `{BRANCH_NAME}` branch.

## Changed Files
{list of changed files with line counts}

## Diff
{git diff output for this package}

## Review Criteria
{relevant sections from review-criteria.md}

## Project Standards
{relevant skill reference content from skill-map.md}

## Instructions
Review these changes for {review-type} issues. For each finding, output a line:
- [{severity}] Description in `file:line` — explanation

Severities:
- Critical: Must fix. Security, data loss, broken functionality.
- Important: Should fix. Quality, performance, maintainability.
- Suggestion: Nice to have. Style, minor improvements.

Focus on the changed code. Do not review unchanged files unless they are directly
affected by the changes (e.g., a function signature change affecting callers).
```

---

## Fix Agent Prompt

Used for Phase 4, Phase 6, and Phase 8 agents.

```
You are fixing code review findings in the {domain} domain for `{BRANCH_NAME}`.

## Findings to Fix
{list of CR-NNN findings with full context}

## Instructions
Fix each finding listed above. For each fix:
1. Read the current file content
2. Apply the minimal change needed
3. Do NOT introduce new features or refactor beyond the finding
4. Do NOT modify files outside the {domain} domain

After all fixes, verify with:
turbo run lint --affected && turbo run typecheck --affected
```

---

## Placeholders

| Placeholder     | Source                                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| `{BRANCH_NAME}` | `git rev-parse --abbrev-ref HEAD`                                                     |
| `{package}`     | The package path being reviewed (e.g., `apps/web`)                                    |
| `{domain}`      | The domain grouping (frontend, backend, audio, shared)                                |
| `{review-type}` | The review focus (architecture, simplification, security, type-safety, accessibility) |
| `{severity}`    | Critical, Important, or Suggestion                                                    |
| Changed files   | `git diff main...HEAD --name-only -- {package}`                                       |
| Diff            | `git diff main...HEAD -- {package}`                                                   |
| Review criteria | Relevant sections from `references/review-criteria.md`                                |
| Skill content   | Read from files listed in `references/skill-map.md`                                   |
