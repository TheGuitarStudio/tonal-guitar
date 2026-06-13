---
name: codex
description: Delegate prompts to OpenAI's Codex CLI for second opinions, parallel subtask execution, and isolated diff review. Use this skill when the user wants a second opinion from Codex, wants to run a task in the background with Codex, or wants Codex to make changes in an isolated worktree for diff review.
argument-hint: '[--structured | --diff [--apply]] [--timeout <s>] <prompt>'
---

# Codex Bridge

Delegate prompts to the Codex CLI in the background. Supports three modes: text response, structured JSONL stream, and isolated worktree diff.

## Arguments

| Flag             | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| _(none)_         | Default text mode — run Codex, return text response         |
| `--structured`   | Capture full JSONL event stream, present structured summary |
| `--diff`         | Run Codex in a fresh worktree, present resulting diff       |
| `--diff --apply` | Same as `--diff`, but auto-apply the diff after review      |
| `--timeout <s>`  | Override default 10-minute timeout (in seconds)             |

Usage: `/codex [flags] <prompt text>`

## Prerequisite Check

Before running any mode, verify `codex` is available:

```bash
command -v codex
```

If not found, tell the user:

> Codex CLI is not installed. Install it with: `npm i -g @openai/codex`

Then stop — do not proceed.

## Mode 1: Text (default)

When no flags are provided, run the prompt in text mode.

1. Generate a UUID for this invocation:

   ```bash
   uuidgen | tr '[:upper:]' '[:lower:]'
   ```

2. Run Codex in the background using the Bash tool with `run_in_background: true` and `timeout` set to the configured timeout (default 600000ms):

   ```bash
   codex exec "<prompt>" -o /tmp/codex-response-<uuid>.txt
   ```

3. Wait for completion using `TaskOutput` to check on the background task.

4. Read the output file:

   ```
   /tmp/codex-response-<uuid>.txt
   ```

5. Present the response to the user.

6. Clean up the temp file:
   ```bash
   rm -f /tmp/codex-response-<uuid>.txt
   ```

## Mode 2: Structured (`--structured`)

When `--structured` is provided, capture the full JSONL event stream.

1. Generate a UUID for this invocation:

   ```bash
   uuidgen | tr '[:upper:]' '[:lower:]'
   ```

2. Run Codex in the background using the Bash tool with `run_in_background: true` and `timeout` set to the configured timeout (default 600000ms):

   ```bash
   codex exec "<prompt>" --json > /tmp/codex-structured-<uuid>.jsonl
   ```

3. Wait for completion using `TaskOutput`.

4. Read the JSONL output file. Each line is a JSON event. Extract and organize by event type:
   - **`message` events** with `role: "assistant"` — reasoning and responses
   - **`exec` events** — shell commands executed
   - **`patch` / `write` events** — file modifications

5. Present a structured summary to the user:

   **Reasoning:** Key reasoning steps from assistant messages

   **Commands:** Shell commands executed (with exit codes)

   **File Changes:** Files modified with diff snippets

   **Final Response:** The concluding assistant message

6. Clean up the temp file:
   ```bash
   rm -f /tmp/codex-structured-<uuid>.jsonl
   ```

## Mode 3: Diff (`--diff`)

When `--diff` is provided, run Codex in an isolated worktree and capture the resulting diff.

1. Generate a UUID for this invocation:

   ```bash
   uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8
   ```

2. Set the worktree path:

   ```
   /tmp/codex-worktree-<short-uuid>
   ```

3. Create a temporary worktree from HEAD:

   ```bash
   git worktree add /tmp/codex-worktree-<short-uuid> HEAD --detach
   ```

4. Run Codex in the worktree with full autonomy, in the background using `run_in_background: true` and `timeout` set to the configured timeout (default 600000ms):

   ```bash
   codex exec "<prompt>" --dangerously-bypass-approvals-and-sandbox -C /tmp/codex-worktree-<short-uuid>
   ```

5. Wait for completion using `TaskOutput`.

6. Capture the diff (including untracked files):

   ```bash
   cd /tmp/codex-worktree-<short-uuid> && git add -N . && git diff
   ```

7. Present the diff to the user for review.

8. **If `--apply` was specified**, apply the diff to the current working directory:

   ```bash
   cd /tmp/codex-worktree-<short-uuid> && git diff | git -C <original-repo-path> apply -
   ```

   Report which files were modified.

   **If `--apply` was NOT specified**, ask the user if they want to apply the changes.

9. Clean up the worktree:
   ```bash
   git worktree remove /tmp/codex-worktree-<short-uuid> --force
   ```

## Timeout Handling

- **Default timeout:** 600 seconds (10 minutes), passed as 600000ms to the Bash tool's `timeout` parameter
- **Override:** `/codex --timeout 300 <prompt>` sets a 5-minute timeout (pass 300000ms)
- **On timeout:** Report that Codex timed out. If partial results exist in the output file, present them. Suggest the user retry with `--timeout <higher-value>`. Clean up any temp files or worktrees.

## Error Handling

| Condition              | Action                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| `codex` not in PATH    | Tell user to install: `npm i -g @openai/codex`                             |
| Non-zero exit code     | Read and report the error output from the background task                  |
| Timeout                | Report timeout, present partial results if available, suggest `--timeout`  |
| Worktree cleanup fails | Warn user and provide manual cleanup: `git worktree remove <path> --force` |
| Empty response         | Report that Codex returned no output and suggest rephrasing the prompt     |
