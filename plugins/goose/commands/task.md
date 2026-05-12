---
description: Delegate a task to Goose with optional model and provider selection
argument-hint: '[--background|--wait] [--model <model>] [--provider <provider>] [what Goose should do]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Delegate a task to Goose for non-interactive execution.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command delegates work to Goose.
- Return Goose's output verbatim to the user.
- Do not paraphrase, summarize, or add commentary before or after it.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- If the raw arguments include `--background`, do not ask. Run in a Claude background task.
- Otherwise, default to foreground.

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--wait` or `--background` yourself.
- `--model` and `--provider` are runtime-selection flags for Goose. Pass them through to the companion script.
- Goose model selection is via the `--model` flag, which sets the `GOOSE_MODEL` env var internally.
- Goose provider selection is via the `--provider` flag, which sets the `GOOSE_PROVIDER` env var internally.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" task "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.

Background flow:
- Launch the task with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" task "$ARGUMENTS"`,
  description: "Goose task",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Goose task started in the background. Check `/goose:status` for progress."
