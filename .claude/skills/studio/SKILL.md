---
name: studio
description: Dynamic skill index — discover all available project skills, both executable slash commands and auto-loaded guidance skills. Use this skill when looking for available skills, when unsure which skill to use, or when exploring project capabilities.
disable-model-invocation: true
argument-hint: '[--commands | --guidance | <skill-name>]'
---

# Tonal Guitar Skills

!`.claude/skills/studio/scripts/list-skills.sh .claude/skills`!

---

## Instructions

Present the skill index above based on `$ARGUMENTS`:

### No arguments (default)

Show the **Executable Skills** summary table and **Guidance Skills** sections. Omit the **Executable Skill Details** section for brevity.

### `--commands`

Show the **Executable Skills** summary table and the **Executable Skill Details** section (which includes arguments/flags for each command). Omit the **Guidance Skills** section.

### `--guidance`

Show only the **Guidance Skills** section with all category groups.

### `<skill-name>` (e.g., `dev`, `review`, `frontend-components`)

Look up a specific skill by reading its SKILL.md file:

1. Use the Read tool to read `.claude/skills/<skill-name>/SKILL.md`
2. If the file exists, present the skill's full details: name, description, arguments (if any), and usage instructions
3. If the file does not exist, list the available skill directory names that are most similar and suggest the closest match
