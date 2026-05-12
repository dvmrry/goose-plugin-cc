---
description: Cancel an active background Goose job in this repository
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/goose-companion.mjs" cancel "$ARGUMENTS"`
