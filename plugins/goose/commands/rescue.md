---
description: Delegate investigation, an explicit fix request, or follow-up rescue work to the Goose task subagent
argument-hint: "[--background|--wait] [--resume|--fresh] [--model <model>] [--provider <provider>] [what Goose should investigate, solve, or continue]"
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Invoke the `goose:goose-task` subagent via the `Agent` tool (`subagent_type: "goose:goose-task"`), forwarding the raw user request as the prompt.
`goose:goose-task` is a subagent, not a skill — do not call `Skill(goose:goose-task)` (no such skill) or `Skill(goose:rescue)` (that re-enters this command and hangs the session). The command runs inline so the `Agent` tool stays in scope; forked general-purpose subagents do not expose it.
The final user-visible response must be Goose's output verbatim.

Raw user request:
$ARGUMENTS

Execution mode:

- If the request includes `--background`, run the `goose:goose-task` subagent in the background.
- If the request includes `--wait`, run the `goose:goose-task` subagent in the foreground.
- If neither flag is present, default to foreground.
- `--background` and `--wait` are execution flags for Claude Code. Do not forward them to `task`, and do not treat them as part of the natural-language task text.
- `--model` and `--provider` are runtime-selection flags. Preserve them for the forwarded `task` call, but do not treat them as part of the natural-language task text.
- If the request includes `--resume`, do not ask whether to continue. The user already chose.
- If the request includes `--fresh`, do not ask whether to continue. The user already chose.
- Otherwise, before starting Goose, check for a resumable task from this Claude session by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" task-resume-candidate --json
```

- If that helper reports `available: true`, use `AskUserQuestion` exactly once to ask whether to continue the current Goose session or start a new one.
- The two choices must be:
  - `Continue current Goose session`
  - `Start a new Goose session`
- If the user is clearly giving a follow-up instruction such as "continue", "keep going", "resume", "apply the top fix", or "dig deeper", put `Continue current Goose session (Recommended)` first.
- Otherwise put `Start a new Goose session (Recommended)` first.
- If the user chooses continue, add `--resume` before routing to the subagent.
- If the user chooses a new thread, add `--fresh` before routing to the subagent.
- If the helper reports `available: false`, do not ask. Route normally.

Operating rules:

- The subagent is a thin forwarder only. It should use one `Bash` call to invoke `node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" task ...` and return that command's stdout as-is.
- Return the Goose companion stdout verbatim to the user.
- Do not paraphrase, summarize, rewrite, or add commentary before or after it.
- Do not ask the subagent to inspect files, monitor progress, poll `/goose:status`, fetch `/goose:result`, call `/goose:cancel`, summarize output, or do follow-up work of its own.
- Leave `--model` unset unless the user explicitly asks for a specific model.
- Leave `--provider` unset unless the user explicitly asks for a specific provider.
- Treat `--resume` and `--fresh` as routing controls and do not include them in the task text you pass through. Leave `--resume` and `--fresh` in the forwarded request.
- `--resume` means add `--resume-last`.
- `--fresh` means do not add `--resume-last`.
- If the user is clearly asking to continue prior Goose work in this repository, such as "continue", "keep going", "resume", "apply the top fix", or "dig deeper", add `--resume-last` unless `--fresh` is present.
- Otherwise forward the task as a fresh `task` run.
- Preserve the user's task text as-is apart from stripping routing flags.
- Return the stdout of the `goose-companion` command exactly as-is.
- If the Bash call fails or Goose cannot be invoked, return nothing.
