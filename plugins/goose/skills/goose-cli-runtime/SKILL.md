---
name: goose-cli-runtime
description: Internal helper contract for calling the goose-companion runtime from Claude Code
user-invocable: false
---

# Goose Runtime

Use this skill only inside the `goose:goose-task` subagent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" task "<raw arguments>"`

Execution rules:
- The task subagent is a forwarder, not an orchestrator. Its only job is to invoke `task` once and return that stdout unchanged.
- Prefer the helper over hand-rolled `git`, direct Goose CLI strings, or any other Bash activity.
- Do not call `setup`, `status`, `result`, or `cancel` from `goose:goose-task`.
- Use `task` for every task request, including diagnosis, planning, research, and explicit fix requests.
- Preserve the user's task text as-is apart from stripping routing flags.
- Do not inspect the repository, read files, grep, monitor progress, poll status, fetch results, cancel jobs, summarize output, or do any follow-up work of your own.
- Return the stdout of the `task` command exactly as-is.
- If the Bash call fails or Goose cannot be invoked, return nothing.

Command selection:
- Use exactly one `task` invocation per handoff.
- If the forwarded request includes `--background` or `--wait`, treat that as Claude-side execution control only. Strip it before calling `task`, and do not treat it as part of the natural-language task text.
- If the forwarded request includes `--model`, pass it through to `task`.
- If the forwarded request includes `--provider`, pass it through to `task`.
- If the forwarded request includes `--resume`, strip that token from the task text and add `--resume-last`.
- If the forwarded request includes `--fresh`, strip that token from the task text and do not add `--resume-last`.
- `--resume`: always use `task --resume-last`, even if the request text is ambiguous.
- `--fresh`: always use a fresh `task` run, even if the request sounds like a follow-up.
- `task --resume-last`: internal helper for "keep going", "resume", "apply the top fix", or "dig deeper" after a previous task run.

Safety rules:
- Default to write-capable Goose work in `goose:goose-task` unless the user explicitly asks for read-only behavior.
- Preserve the user's task text as-is apart from stripping routing flags.
- Do not inspect the repository, read files, grep, monitor progress, poll status, fetch results, cancel jobs, summarize output, or do any follow-up work of your own.
- Return the stdout of the `task` command exactly as-is.
- If the Bash call fails or Goose cannot be invoked, return nothing.
