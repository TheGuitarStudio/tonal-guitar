# Feature Conventions

Shared conventions for the `/feature` skill: state management, commit protocol, naming standards,
and config check procedure.

---

## Config Check (Step 0)

This procedure is shared with the `/idea` skill. Run it at the start of every `/feature` invocation.

1. Check if `.tonal-guitar/project-config.json` exists.
2. If it exists, read and parse it for `projectNumber`, `owner`, `projectId`, and field IDs.
3. If it does NOT exist:

   a. Find the project:

   ```bash
   gh project list --owner @me --format json
   ```

   b. Get field definitions:

   ```bash
   gh project field-list {projectNumber} --owner {owner} --format json
   ```

   c. Extract the "Status" field ID and option IDs for all 6 statuses: "Spark", "Backlog", "Ready", "In Progress", "In Review", and "Done".

   d. Write config to `.tonal-guitar/project-config.json`:

   ```json
   {
     "owner": "{owner}",
     "projectNumber": 1,
     "projectId": "PVT_...",
     "fields": {
       "status": {
         "fieldId": "PVTSSF_...",
         "options": {
           "spark": "{option-id}",
           "backlog": "{option-id}",
           "ready": "{option-id}",
           "inProgress": "{option-id}",
           "inReview": "{option-id}",
           "done": "{option-id}"
         }
       }
     }
   }
   ```

   e. If no project found, warn and exit.

---

## State Management (FEATURE.md)

### Structure

Each feature has a `FEATURE.md` file that tracks pipeline state. See
[templates/feature-state-template.md](../templates/feature-state-template.md) for the full template.

### Key Sections

| Section               | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| **Pipeline Progress** | Checkboxes for each phase — `[x]` complete, `[ ]` pending                  |
| **Context**           | Origin, branch, priority, size metadata                                    |
| **Artifacts**         | Table tracking each phase's output file, status, loop count, review status |
| **Loop History**      | Appended per loop iteration with change summaries                          |
| **Review History**    | Appended per external review with feedback summaries                       |

### Resumption Logic

1. Read FEATURE.md
2. Parse `## Pipeline Progress` for checkboxes
3. Find the first `[ ]` (unchecked) phase
4. Resume from that phase
5. Existing artifacts (research.md, spec.md, etc.) are read as context by agents

### Status Updates

Update FEATURE.md at these points:

| Event           | Update                                                      |
| --------------- | ----------------------------------------------------------- |
| Phase starts    | Phase checkbox stays `[ ]`, artifact status → "in-progress" |
| Phase completes | Phase checkbox → `[x]`, artifact status → "complete"        |
| Loop iteration  | Loop count incremented, Loop History appended               |
| Review saved    | Reviewed column → "yes", Review History appended            |

---

## Branch Guard

Every `/feature` invocation (except `--list`) enforces that the current branch matches the feature's
`Branch` field in FEATURE.md. This prevents accidental commits to the wrong branch.

**Enforcement:**

1. Read FEATURE.md and extract the `Branch` field (e.g., `feat/{slug}`).
2. Check current branch: `git branch --show-current`
3. If they don't match, block with a helpful error message pointing the user to the correct worktree.

**Exceptions:**

- `--list` mode is exempt (reads from GitHub, not local files).
- When creating a new feature (`mode = "full"` or `mode = "from"` with no existing directory), the guard is deferred until after worktree creation.

---

## Commit Protocol

### Branch Policy

All feature commits happen on the feature branch (`feat/{slug}`), never on main. The branch guard
ensures this is enforced before any work begins.

### Commit Messages

| Action           | Message                                    | Branch        |
| ---------------- | ------------------------------------------ | ------------- |
| Feature init     | `docs(feature): init - {feature-name}`     | `feat/{slug}` |
| Phase 1 complete | `docs(feature): research - {feature-name}` | `feat/{slug}` |
| Phase 2 complete | `docs(feature): shape - {feature-name}`    | `feat/{slug}` |
| Phase 3 complete | `docs(feature): plan - {feature-name}`     | `feat/{slug}` |
| Phase 4 complete | `feat(scope): {feature-name}`              | `feat/{slug}` |

### Staging Rules

Always stage specific files — never use `git add -A`:

```bash
# Phase 1
git add .tonal-guitar/features/{slug}/research.md
git add .tonal-guitar/features/{slug}/FEATURE.md

# Phase 2
git add .tonal-guitar/features/{slug}/requirements.md
git add .tonal-guitar/features/{slug}/decisions.md
git add .tonal-guitar/features/{slug}/spec.md
git add .tonal-guitar/features/{slug}/FEATURE.md

# Phase 3
git add .tonal-guitar/features/{slug}/tasks.md
git add .tonal-guitar/features/{slug}/FEATURE.md
```

---

## Naming Conventions

### Feature Slugs

Derive from the feature title:

1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove special characters (keep alphanumeric and hyphens)
4. Collapse multiple consecutive hyphens
5. Truncate to 50 characters
6. Trim trailing hyphens

### Feature Directory Structure

The feature directory exists on the feature branch (`feat/{slug}`), not on main. When working
locally, the worktree is created by `workmux add` — capture the path it reports as
`<worktree-path>` and use it for the rest of the flow.

```
<worktree-path>/                         # Worktree root (reported by workmux on `add`)
└── .tonal-guitar/features/{slug}/
    ├── FEATURE.md          # Pipeline state tracking (includes Branch field)
    ├── raw-idea.md         # From /idea graduation (optional)
    ├── research.md         # Phase 1 output
    ├── requirements.md     # Phase 2: Q&A with user
    ├── decisions.md        # Phase 2: decision log
    ├── spec.md             # Phase 2: synthesized specification
    ├── tasks.md            # Phase 3: implementation task breakdown
    └── reviews/            # External review feedback (optional)
        ├── research-review.md
        ├── spec-review.md
        └── tasks-review.md
```

### GitHub Issue Titles

- **Parent issue:** `{Feature Name}` (clean, no prefix)
- **Sub-issues:** `[{Feature Name}] Task Group {N}: {Group Name}`

### Labels

| Label          | Applied To   | Applied When                    |
| -------------- | ------------ | ------------------------------- |
| `feature-spec` | Parent issue | Feature init or idea graduation |
| `task-group`   | Sub-issues   | Phase 3 task creation           |

### Decision IDs

Sequential per feature in `decisions.md`: D-001, D-002, D-003, etc.

---

## Team Patterns

### Phase 1: Research Team

```
Team: feature-research
├── codebase-researcher (feature-dev:code-architect) — background
└── product-researcher  (feature-dev:code-architect) — background
```

Both agents run in parallel. Lead merges results after both complete.

### Phase 3: Plan Team

```
Team: feature-plan
├── task-planner  (feature-dev:code-architect) — runs first
└── plan-reviewer (feature-dev:code-reviewer)  — blocked by task-planner
```

Sequential: planner runs first, reviewer validates after.

### Team Lifecycle

1. Create team with `TeamCreate`
2. Create tasks with `TaskCreate`
3. Spawn agents with `Task` tool (set `team_name` and `run_in_background: true`)
4. Monitor progress via `TaskList`
5. When all tasks complete, send `shutdown_request` to each agent
6. Clean up with `TeamDelete`

---

## GitHub Project Integration

### Status Transitions

| Event                                | Status Change             | Set By                                 |
| ------------------------------------ | ------------------------- | -------------------------------------- |
| Feature init / idea graduation       | → Backlog                 | `/idea`, `/feature`                    |
| Phase 2 (Shape) complete             | → Ready                   | `/feature`                             |
| Implementation starts (`/implement`) | → In Progress             | `/implement`, `/task`, `/fix`          |
| PR created                           | → In Review               | PostToolUse hook (`post-pr-create.sh`) |
| PR merged to main                    | → Done + close sub-issues | GitHub Action (`pr-merged.yml`)        |

> **Note:** "In Review" and "Done" transitions are fully automated — no per-skill logic needed.

### Project Item Updates

```bash
# Move to Ready after shaping
gh project item-edit --project-id {projectId} --id {itemId} \
  --field-id {statusFieldId} --single-select-option-id {readyOptionId}
```
