---
name: reflect
description: Analyze code changes and update tooling (skills, agents, hooks, CLAUDE.md, review skill-map, workflow map) to stay current. Use this skill after completing features, when workflows feel outdated, or when the review skill-map or workflow map needs updating.
argument-hint: '[<description>] | --update'
---

# Tooling Reflection & Update

Analyze what changed and update the developer tooling to stay in sync. No GitHub issues, no project board — just direct analysis and implementation.

## Model Assignment

| Role               | Model     |
| ------------------ | --------- |
| Lead (interactive) | **opus**  |
| `--update`         | **haiku** |

## Arguments

| Flag            | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `<description>` | Analyze + implement tooling updates based on description          |
| _(none)_        | Analyze current branch diff against main, suggest tooling updates |
| `--update`      | Update review skill-map (scan skills, find gaps, apply)           |

---

## Execution

### Step 0: Config Check

Verify `.tonal-guitar/project-config.json` exists, auto-detect if not.
See [../references/shared-conventions.md](../references/shared-conventions.md).

### Step 1: Parse Arguments

- **`--update`** → Jump to [Update Workflow](#update-workflow-update)
- **Has description text** → `mode = "analyze"`, `focus = <description>`
- **No args** → `mode = "analyze"`, `focus = null` (use branch diff)

---

### Step 1b: Branch Guard

`/reflect` should run from `main` so it can analyze what's been merged since the last reflect.

1. Check current branch:
   ```bash
   git branch --show-current
   ```
2. If NOT on `main`:
   > "Switch to main before running `/reflect`. This skill analyzes commits merged to main and creates a worktree for changes."
3. Ensure main is up-to-date:
   ```bash
   git pull origin main
   ```

### Step 2: Gather Context

1. If `focus` is provided (description), use it as the analysis focus.

2. Find the last reflect commit to determine what's new:

   ```bash
   git log --oneline --grep="chore(tooling): reflect" -1
   ```

   If no previous reflect commit found, use the last 10 commits on main.

3. Get commits since last reflect:

   ```bash
   git log {last-reflect-sha}..HEAD --oneline
   ```

4. Get changed files since last reflect:

   ```bash
   git diff {last-reflect-sha}..HEAD --name-only
   ```

5. If no new commits AND no description provided, stop with:
   > "No new commits since last reflect and no description provided. Nothing to analyze."

### Step 3: Scan Tooling Surface

Read all of these to understand the current tooling state:

- **Skills:** `.claude/skills/*/SKILL.md` — parse YAML frontmatter (name, description, argument-hint)
- **Agents:** `.claude/agents/*.md` (if directory exists)
- **Hooks:** `.claude/settings.json` hooks section + any plugin hooks
- **CLAUDE.md:** Skill routing table, conventions, project structure sections
- **Skill map:** `.claude/skills/review/references/skill-map.md`
- **Shared conventions:** `.claude/skills/references/shared-conventions.md`
- **Workflow map:** `docs/workflow-map.html` — the `SKILLS` and `PIPELINES` arrays in the DATA SECTION at the top of the `<script>` block

### Step 4: Analyze Gaps

For each category, compare what changed against what the tooling knows about:

**Skills:**

- Do changed files touch packages/patterns not covered by existing skills?
- Do skill descriptions match current behavior?
- Are argument hints accurate?
- Does any skill need new arguments or modes?

**Agents:**

- Would any repetitive multi-step pattern benefit from a custom agent?
- Do existing agent definitions match current workflows?

**Hooks:**

- Are there new automation opportunities (e.g., post-commit, pre-push)?
- Do existing hooks still match the current workflow?

**CLAUDE.md:**

- Is the skill routing table current? Any new user intents to map?
- Are conventions sections accurate?
- Does the project structure documentation match reality?

**Review Skill Map:**

- Are all affected packages mapped to appropriate skills?
- Any new packages or skills to add?
- Any stale mappings to remove?

**Shared Conventions:**

- Do branch naming, PR format, or commit patterns need updates?
- Are scope assessment rules still accurate?

**Workflow Map** (`docs/workflow-map.html`):

- Does the `SKILLS` array reflect all current workflow skills (name, synopsis, flags, connections, invokedSkills)?
- Are pipeline assignments correct? Any skills moved between pipelines?
- Are cross-skill connections accurate? Any new handoffs or removed links?
- Does the `invokedSkills` field on each entry match current guidance/plugin skill usage?
- Any new skills to add or removed skills to delete from the array?

### Step 4b: CLAUDE.md Audit (Optional)

If the analysis suggests CLAUDE.md may be out of sync, or if the user's description mentions documentation:

1. Run `claude-md-management:claude-md-improver` to audit all CLAUDE.md files against the current codebase.
2. Include any recommended CLAUDE.md updates in the recommendations below.

### Step 5: Present Recommendations

Format recommendations as a structured checklist grouped by category:

```
## Tooling Reflection

Based on {branch diff / description}, here are recommended updates:

### Skills
- [ ] Update `/fix` description to mention... (`.claude/skills/fix/SKILL.md`)
- [ ] Add new argument `--foo` to `/task`

### CLAUDE.md
- [ ] Add routing row for `/reflect --update`
- [ ] Update Feature Workflow section

### Review Skill Map
- [ ] Map `packages/new-pkg` → `relevant-skill`

### No changes needed
- Agents
- Hooks
- Shared conventions

Proceed with all, or pick specific ones?
```

Wait for user to approve all or select specific items.

### Step 6: Create Worktree

Before making any changes, create an isolated worktree off main:

```bash
workmux add chore/reflect-{YYYY-MM-DD} --base origin/main -b --prompt "Implement the approved reflect changes."
```

All changes in Step 7 are made in the worktree, not on main.

### Step 7: Implement Approved Changes

Working in the worktree created in Step 6, for each approved change:

- **Skill updates:** Use Edit tool directly on the SKILL.md file
- **CLAUDE.md updates:** Use Edit tool directly
- **New skills:** Reference `plugin-dev:skill-development` patterns
- **New agents:** Reference `plugin-dev:agent-development` patterns
- **New hooks:** Reference `plugin-dev:hook-development` patterns
- **CLAUDE.md audit:** Reference `claude-md-management:claude-md-improver` patterns
- **Skill map updates:** Edit `.claude/skills/review/references/skill-map.md`
- **Shared conventions:** Edit `.claude/skills/references/shared-conventions.md`
- **Workflow map updates:** Edit the `SKILLS` and `PIPELINES` arrays in the DATA SECTION of `docs/workflow-map.html`. Only modify the data block between the `// DATA SECTION` and `// RENDERER` comments. For each skill, update: `id`, `name`, `pipeline`, `synopsis`, `capabilities`, `flags`, `artifacts`, `models`, `connections`, and `invokedSkills`. Do not touch the renderer code below the data section.

### Step 8: Ship

1. **Commit:**

   ```bash
   git add <specific files changed>
   git commit -m "chore(tooling): reflect - {summary of what was updated}"
   ```

2. **Push and create PR:**

   ```bash
   git push -u origin chore/reflect-{YYYY-MM-DD}
   gh pr create --title "chore(tooling): reflect - {summary}" --body "{PR body with list of changes}"
   ```

3. **Report** to user: summary of changes, PR link, list of updated files.

---

## Update Workflow (`--update`)

Focused mode for maintaining the review skill-map and the workflow map. Moved from `/review --update`.

### Part 1: Review Skill-Map

1. **Scan available skills:**
   - Read all local skill names from `.claude/skills/*/SKILL.md` (parse `name` from YAML frontmatter)
   - Note all plugin skills from the system prompt's skill list
   - Read the current [skill-map.md](../review/references/skill-map.md)

2. **Identify gaps:**
   - Skills installed but not in the skill map
   - Packages with no skills mapped
   - Skills in the map that no longer exist

3. **Process user suggestions** (if provided as additional arguments)

4. **Present recommendations:**
   - Table of suggested additions/removals with rationale
   - Indicate which review phase each skill maps to
   - Ask for confirmation before applying

5. **Apply approved changes:**
   - Update `.claude/skills/review/references/skill-map.md`
   - Optionally update `.claude/skills/review/references/review-criteria.md` if new domains needed

### Part 2: Workflow Map

6. **Scan workflow skills** against the `SKILLS` array in `docs/workflow-map.html`:
   - Read all workflow skill files: `.claude/skills/{idea,feature,implement,review,task,fix,bug,tree,release,dev,reflect}/SKILL.md`
   - For each, extract: name, description/synopsis, argument-hint (flags), referenced skills (connections + invokedSkills)
   - Compare against the existing entries in the `SKILLS` array in the DATA SECTION of `docs/workflow-map.html`

7. **Identify workflow map gaps:**
   - New workflow skills not yet in the map
   - Skills in the map that no longer exist
   - Changed flags, connections, or invokedSkills that need updating
   - Stale synopses that no longer match the SKILL.md description

8. **Apply approved changes:**
   - Edit only the DATA SECTION of `docs/workflow-map.html` (between `// DATA SECTION` and `// RENDERER` comments)
   - Update `SKILLS` entries: `synopsis`, `flags`, `connections`, `invokedSkills`, `capabilities`
   - Update `PIPELINES` if pipeline structure changed
   - Never modify the renderer code below the data section

### Commit

```bash
git add .claude/skills/review/references/skill-map.md docs/workflow-map.html
git commit -m "chore(tooling): update skill-map and workflow map"
```

---

## Notes

- `/reflect` is for system/tooling work only. Product features use `/idea` and `/feature`.
- Always run from `main` — analyzes commits since last reflect, creates worktree for changes.
- Changes go through PR workflow — never committed directly to main.
- `/reflect --update` maintains both the review skill-map and the workflow map.
- Workflow map (`docs/workflow-map.html`) has a DATA SECTION at the top of `<script>` — only edit that block, never the renderer below it.
- The commit message `chore(tooling): reflect - ...` is used as a marker to detect the last reflect run.
