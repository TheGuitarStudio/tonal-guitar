# Code Review: {BRANCH_NAME}

**Date:** {YYYY-MM-DD} | **Base:** main | **Scope:** {full|refactor|refactor-react|refactor-api|refactor-audio|focus:path|skip-fix}
**Commits:** {N} | **Files Changed:** {N} | **Loop:** 1/{LOOP_COUNT}

## Affected Packages

{list each affected package with file count, e.g.:}

- `apps/web` (N files changed)
- `packages/api` (N files changed)

## Review Progress

- [ ] Phase 1: Setup
- [ ] Phase 2: Lint/Test Fix
- [ ] Phase 3: Architecture Review
- [ ] Phase 4: Architecture Fix
- [ ] Phase 5: Code Simplification Review
- [ ] Phase 6: Code Simplification Fix
- [ ] Phase 7: Specialized Reviews
- [ ] Phase 8: Specialized Fixes
- [ ] Phase 9: Final Verification

Adjust the progress list to only show active phases for the current mode:

- **Full**: all 9 phases
- **Refactor**: phases 1, 2, 5, 6, 9
- **Skip-Fix**: phases 1, 3, 5, 7, 9

## Statistics

- Critical: 0 fixed, 0 remaining | Important: 0 fixed, 0 deferred
- GitHub Issues Created: (none yet)
- Total Commits: 0 | Total Fixes: 0 | Final Status: IN PROGRESS

---

## Phase Section Template

Each review phase adds a section like:

```markdown
## Phase 3: Architecture Review

### apps/web

- CR-004: [Critical] Missing error boundary in `apps/web/src/App.tsx:1` — top-level errors crash the entire app
- CR-005: [Important] Direct Prisma import in `apps/web/src/pages/dashboard.tsx:12` — should go through packages/api

### packages/api

- CR-007: [Important] N+1 query pattern in `packages/api/src/routers/lessons.ts:45` — use Prisma include
```

Each fix phase updates finding statuses:

```markdown
## Phase 4: Architecture Fixes

### Fixed

- CR-004: Fixed in `abc1234` — added ErrorBoundary wrapper
- CR-005: Fixed in `abc1234` — moved query to lessons router

### Deferred

- CR-007: GitHub issue #123 — requires schema change

### Won't Fix

- (none)
```

## Loop Summary Template

When `--loop N` completes a loop, archive with:

```markdown
## Loop 1 Summary

- Findings: 12 total (3 Critical, 5 Important, 4 Suggestion)
- Fixed: 8 | Deferred: 3 | Won't Fix: 1
- Commits: 4
```
