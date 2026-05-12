# Goose plugin for Claude Code

Use Goose from inside Claude Code to delegate tasks.

This plugin is for Claude Code users who want an easy way to start using Goose from the workflow
they already have.

## What You Get

- `/goose:task` to delegate a task to Goose with optional model/provider selection
- `/goose:rescue`, `/goose:status`, `/goose:result`, and `/goose:cancel` to delegate work and manage background jobs

## Requirements

- **Goose CLI installed.** See https://github.com/block/goose for installation instructions.
- **Node.js 18.18 or later**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add dvmrry/goose-plugin-cc
```

Install the plugin:

```bash
/plugin install goose@dvmrry-goose
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/goose:setup
```

`/goose:setup` will tell you whether Goose is ready. If Goose is missing, it will direct you to the installation page.

After install, you should see:

- the slash commands listed below
- the `goose:goose-task` subagent in `/agents`

One simple first run is:

```bash
/goose:task --background "say hello"
/goose:status
/goose:result
```

## Usage

### `/goose:task`

Delegates a task to Goose for non-interactive execution.

Use it when you want:

- Goose to investigate a bug
- Goose to try a fix
- Goose to continue a previous task
- Goose to run against a specific backend model or provider

> [!NOTE]
> Depending on the task and the model you choose these tasks might take a long time and it's generally recommended to force the task to be in the background.

It supports `--background`, `--wait`, `--model`, and `--provider`.

Examples:

```bash
/goose:task investigate why the tests started failing
/goose:task fix the failing test with the smallest safe patch
/goose:task --model gpt-4o --provider openai investigate the flaky integration test
/goose:task --background investigate the regression
```

You can also just ask for a task to be delegated to Goose:

```text
Ask Goose to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--model` or `--provider`, Goose uses its own defaults or environment variables.
- follow-up task requests can continue the latest Goose session in the repo

### `/goose:rescue`

Same as `/goose:task` but routes through the `goose:goose-task` subagent for longer-running or more complex work.

It supports `--background`, `--wait`, `--resume`, and `--fresh`. If you omit `--resume` and `--fresh`, the plugin can offer to continue the latest task for this repo.

### `/goose:status`

Shows running and recent Goose jobs for the current repository.

Examples:

```bash
/goose:status
/goose:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/goose:result`

Shows the final stored Goose output for a finished job.
When available, it also includes the Goose session ID so you can reopen that run directly in Goose with `goose session resume <session-id>`.

Examples:

```bash
/goose:result
/goose:result task-abc123
```

### `/goose:cancel`

Cancels an active background Goose job.

Examples:

```bash
/goose:cancel
/goose:cancel task-abc123
```

### `/goose:setup`

Checks whether Goose is installed.

## Goose Integration

The Goose plugin delegates through your local [Goose CLI](https://github.com/block/goose).

### Common Configurations

Goose backend and model are configurable via environment variables or `goose configure`:

- `GOOSE_PROVIDER` — the provider to use (e.g. `ollama`, `openai`, `anthropic`)
- `GOOSE_MODEL` — the model name to use
- `OLLAMA_HOST` — endpoint for Ollama provider
- `OPENAI_HOST` — endpoint for OpenAI provider
- `OPENAI_API_KEY` — API key for OpenAI provider
- `ANTHROPIC_API_KEY` — API key for Anthropic provider

### Moving The Work Over To Goose

Delegated tasks can also be directly resumed inside Goose by running `goose session resume <session-id>` either with the specific session ID you received from running `/goose:result` or `/goose:status` or by selecting it from the list.

This way you can review the Goose work or continue the work there.

## FAQ

### Do I need a separate Goose account for this plugin?

If you already have Goose configured on this machine, that setup should work immediately here too. This plugin uses your local Goose CLI configuration.

### Does the plugin use a separate Goose runtime?

No. This plugin delegates through your local [Goose CLI](https://github.com/block/goose) on the same machine.

That means:

- it uses the same Goose install you would use directly
- it uses the same local configuration state
- it uses the same repository checkout and machine-local environment

### Will it use the same Goose config I already have?

Yes. If you already use Goose, the plugin picks up the same configuration.
