---
description: Check whether the local Goose CLI is ready
argument-hint: ''
allowed-tools: Bash(node:*), Bash(npm:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" setup --json $ARGUMENTS
```

If the result says Goose is unavailable:
- Tell the user to install Goose from https://github.com/block/goose.

Output rules:
- Present the final setup output to the user.
