#!/usr/bin/env bash
# list-skills.sh — Scan all SKILL.md files and output a formatted skill index
# Usage: list-skills.sh [SKILLS_DIR]
# Output: Markdown tables grouped by Executable and Guidance categories

set -euo pipefail

SKILLS_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"

exec_count=0
guid_count=0
executables=""
exec_details=""
guidance_backend=""
guidance_frontend=""
guidance_global=""
guidance_testing=""
guidance_other=""

for skill_file in "$SKILLS_DIR"/*/SKILL.md; do
  [ -f "$skill_file" ] || continue

  dir_name=$(basename "$(dirname "$skill_file")")

  # Skip studio itself
  [ "$dir_name" = "studio" ] && continue

  # Extract YAML frontmatter fields
  name=$(awk '/^---$/{n++; next} n==1 && /^name:/{sub(/^name:[[:space:]]*/, ""); print; exit}' "$skill_file")
  description=$(awk '/^---$/{n++; next} n==1 && /^description:/{sub(/^description:[[:space:]]*/, ""); print; exit}' "$skill_file")

  # Truncate description at ". Use this skill" or ". Use when" for conciseness
  description=$(echo "$description" | sed -E 's/\. Use (this skill |when ).*//')

  # Detect executable vs guidance by checking for "## Arguments" in the body
  if grep -q '^## Arguments' "$skill_file" 2>/dev/null; then
    exec_count=$((exec_count + 1))
    executables="${executables}| \`/${dir_name}\` | ${description} |\n"

    # Extract arguments section (between "## Arguments" and next "##" or end of file)
    args_section=$(awk '/^## Arguments/{found=1; next} found && /^## /{exit} found{print}' "$skill_file")

    exec_details="${exec_details}### \`/${dir_name}\`\n\n${description}\n\n${args_section}\n\n"
  else
    guid_count=$((guid_count + 1))
    # Group guidance skills by prefix
    case "$dir_name" in
      backend-*)
        guidance_backend="${guidance_backend}| ${name} | ${description} |\n"
        ;;
      frontend-*)
        guidance_frontend="${guidance_frontend}| ${name} | ${description} |\n"
        ;;
      global-*)
        guidance_global="${guidance_global}| ${name} | ${description} |\n"
        ;;
      testing-*)
        guidance_testing="${guidance_testing}| ${name} | ${description} |\n"
        ;;
      *)
        guidance_other="${guidance_other}| ${name} | ${description} |\n"
        ;;
    esac
  fi
done

echo "## Executable Skills (${exec_count})"
echo ""
echo "Slash-command skills you invoke directly."
echo ""
echo "| Command | Description |"
echo "|---------|-------------|"
printf '%b' "$executables"
echo ""

echo "## Executable Skill Details"
echo ""
printf '%b' "$exec_details"

echo "## Guidance Skills (${guid_count})"
echo ""
echo "Auto-loaded by Claude when relevant to your task."
echo ""

if [ -n "$guidance_backend" ]; then
  echo "### Backend"
  echo ""
  echo "| Skill | Description |"
  echo "|-------|-------------|"
  printf '%b' "$guidance_backend"
  echo ""
fi

if [ -n "$guidance_frontend" ]; then
  echo "### Frontend"
  echo ""
  echo "| Skill | Description |"
  echo "|-------|-------------|"
  printf '%b' "$guidance_frontend"
  echo ""
fi

if [ -n "$guidance_global" ]; then
  echo "### Global"
  echo ""
  echo "| Skill | Description |"
  echo "|-------|-------------|"
  printf '%b' "$guidance_global"
  echo ""
fi

if [ -n "$guidance_testing" ]; then
  echo "### Testing"
  echo ""
  echo "| Skill | Description |"
  echo "|-------|-------------|"
  printf '%b' "$guidance_testing"
  echo ""
fi

if [ -n "$guidance_other" ]; then
  echo "### Other"
  echo ""
  echo "| Skill | Description |"
  echo "|-------|-------------|"
  printf '%b' "$guidance_other"
  echo ""
fi
