---
name: goose-result-handling
description: Internal guidance for presenting Goose helper output back to the user
user-invocable: false
---

# Goose Result Handling

When the helper returns Goose output:
- Preserve the helper's result structure.
- Use the file paths and line numbers exactly as the helper reports them.
- Preserve output sections when the prompt asked for them, such as observed facts, inferences, open questions, touched files, or next steps.
- If Goose made edits, say so explicitly and list the touched files when the helper provides them.
- For `goose:goose-task`, do not turn a failed or incomplete Goose run into a Claude-side implementation attempt. Report the failure and stop.
- For `goose:goose-task`, if Goose was never successfully invoked, do not generate a substitute answer at all.
- If the helper reports malformed output or a failed Goose run, include the most actionable stderr lines and stop there instead of guessing.
- If the helper reports that setup is required, direct the user to `/goose:setup` and do not improvise alternate setup flows.
