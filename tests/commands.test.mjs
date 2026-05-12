import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = path.join(ROOT, "plugins", "goose");

function read(relativePath) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

test("task command uses Bash and delegates to Goose", () => {
  const source = read("commands/task.md");
  assert.match(source, /\bBash\(/);
  assert.match(source, /return Goose's output verbatim to the user/i);
  assert.match(source, /```bash/);
  assert.match(source, /```typescript/);
  assert.match(source, /task "\$ARGUMENTS"/);
  assert.match(source, /\[--model <model>\]/);
  assert.match(source, /\[--provider <provider>\]/);
  assert.match(source, /run_in_background:\s*true/);
  assert.match(source, /command:\s*`node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/goose-companion\.mjs" task "\$ARGUMENTS"`/);
  assert.match(source, /description:\s*"Goose task"/);
  assert.match(source, /Do not call `BashOutput`/);
  assert.match(source, /Return the command stdout verbatim, exactly as-is/i);
});

test("continue is not exposed as a user-facing command", () => {
  const commandFiles = fs.readdirSync(path.join(PLUGIN_ROOT, "commands")).sort();
  assert.deepEqual(commandFiles, [
    "cancel.md",
    "rescue.md",
    "result.md",
    "setup.md",
    "status.md",
    "task.md"
  ]);
});

test("rescue command absorbs continue semantics", () => {
  const rescue = read("commands/rescue.md");
  const agent = read("agents/goose-task.md");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const runtimeSkill = read("skills/goose-cli-runtime/SKILL.md");

  assert.match(rescue, /The final user-visible response must be Goose's output verbatim/i);
  assert.match(rescue, /allowed-tools:\s*Bash\(node:\*\),\s*AskUserQuestion,\s*Agent/);
  assert.match(rescue, /subagent_type: "goose:goose-task"/);
  assert.match(rescue, /do not call `Skill\(goose:goose-task\)`/i);
  assert.doesNotMatch(rescue, /^context:\s*fork\b/m);
  assert.match(rescue, /--background\|--wait/);
  assert.match(rescue, /--resume\|--fresh/);
  assert.match(rescue, /--model <model>/);
  assert.match(rescue, /--provider <provider>/);
  assert.match(rescue, /task-resume-candidate --json/);
  assert.match(rescue, /AskUserQuestion/);
  assert.match(rescue, /Continue current Goose session/);
  assert.match(rescue, /Start a new Goose session/);
  assert.match(rescue, /run the `goose:goose-task` subagent in the background/i);
  assert.match(rescue, /default to foreground/i);
  assert.match(rescue, /Do not forward them to `task`/i);
  assert.match(rescue, /`--model` and `--provider` are runtime-selection flags/i);
  assert.match(rescue, /Leave `--model` unset unless the user explicitly asks for a specific model/i);
  assert.match(rescue, /Leave `--provider` unset unless the user explicitly asks for a specific provider/i);
  assert.match(rescue, /If the user chooses continue, add `--resume`/i);
  assert.match(rescue, /If the user chooses a new thread, add `--fresh`/i);
  assert.match(rescue, /thin forwarder only/i);
  assert.match(rescue, /Return the Goose companion stdout verbatim to the user/i);
  assert.match(rescue, /Do not paraphrase, summarize, rewrite, or add commentary before or after it/i);
  assert.match(rescue, /return that command's stdout as-is/i);
  assert.match(rescue, /Leave `--resume` and `--fresh` in the forwarded request/i);
  assert.match(agent, /--resume/);
  assert.match(agent, /--fresh/);
  assert.match(agent, /thin forwarding wrapper/i);
  assert.match(agent, /prefer foreground for a small, clearly bounded task request/i);
  assert.match(agent, /If the user did not explicitly choose `--background` or `--wait` and the task looks complicated, open-ended, multi-step, or likely to keep Goose running for a long time, prefer background execution/i);
  assert.match(agent, /Use exactly one `Bash` call/i);
  assert.match(agent, /Do not inspect the repository, read files, grep, monitor progress, poll status, fetch results, cancel jobs, summarize output, or do any follow-up work of your own/i);
  assert.match(agent, /Do not call `status`, `result`, or `cancel`/i);
  assert.match(agent, /Leave `--model` unset unless the user explicitly asks for a specific model/i);
  assert.match(agent, /Leave `--provider` unset unless the user explicitly asks for a specific provider/i);
  assert.match(agent, /Return the stdout of the `goose-companion` command exactly as-is/i);
  assert.match(agent, /If the Bash call fails or Goose cannot be invoked, return nothing/i);
  assert.match(runtimeSkill, /only job is to invoke `task` once and return that stdout unchanged/i);
  assert.match(runtimeSkill, /Do not call `setup`, `status`, `result`, or `cancel`/i);
  assert.match(runtimeSkill, /Preserve the user's task text as-is apart from stripping routing flags/i);
  assert.match(runtimeSkill, /If the forwarded request includes `--model`, pass it through to `task`/i);
  assert.match(runtimeSkill, /If the forwarded request includes `--provider`, pass it through to `task`/i);
  assert.match(runtimeSkill, /If the forwarded request includes `--background` or `--wait`, treat that as Claude-side execution control only/i);
  assert.match(runtimeSkill, /Strip it before calling `task`/i);
  assert.match(runtimeSkill, /Do not inspect the repository, read files, grep, monitor progress, poll status, fetch results, cancel jobs, summarize output, or do any follow-up work of your own/i);
  assert.match(runtimeSkill, /If the Bash call fails or Goose cannot be invoked, return nothing/i);
  assert.match(readme, /`goose:goose-task` subagent/i);
  assert.match(readme, /if you do not pass `--model` or `--provider`, Goose uses its own defaults/i);
  assert.match(readme, /--model gpt-4o --provider openai/i);
  assert.match(readme, /follow-up task requests can continue the latest Goose session/i);
  assert.match(readme, /### `\/goose:setup`/);
  assert.match(readme, /### `\/goose:task`/);
  assert.match(readme, /### `\/goose:rescue`/);
  assert.match(readme, /### `\/goose:status`/);
  assert.match(readme, /### `\/goose:result`/);
  assert.match(readme, /### `\/goose:cancel`/);
});

test("result and cancel commands are exposed as deterministic runtime entrypoints", () => {
  const result = read("commands/result.md");
  const cancel = read("commands/cancel.md");
  const resultHandling = read("skills/goose-result-handling/SKILL.md");

  assert.match(result, /disable-model-invocation:\s*true/);
  assert.match(result, /goose-companion\.mjs" result "\$ARGUMENTS"/);
  assert.match(cancel, /disable-model-invocation:\s*true/);
  assert.match(cancel, /goose-companion\.mjs" cancel "\$ARGUMENTS"/);
  assert.match(resultHandling, /do not turn a failed or incomplete Goose run into a Claude-side implementation attempt/i);
  assert.match(resultHandling, /if Goose was never successfully invoked, do not generate a substitute answer at all/i);
});

test("internal docs use task terminology for rescue runs", () => {
  const runtimeSkill = read("skills/goose-cli-runtime/SKILL.md");
  const promptingSkill = read("skills/gpt-5-4-prompting/SKILL.md");
  const promptRecipes = read("skills/gpt-5-4-prompting/references/goose-prompt-recipes.md");

  assert.match(runtimeSkill, /goose-companion\.mjs" task "<raw arguments>"/);
  assert.match(runtimeSkill, /Use `task` for every task request/i);
  assert.match(runtimeSkill, /task --resume-last/i);
  assert.match(promptingSkill, /Use `task` when the task is diagnosis/i);
  assert.match(promptRecipes, /Goose task prompts/i);
  assert.match(promptRecipes, /Use these as starting templates for Goose task prompts/i);
});

test("setup command points users to Goose installation", () => {
  const setup = read("commands/setup.md");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  assert.match(setup, /goose-companion\.mjs" setup --json \$ARGUMENTS/);
  assert.match(readme, /installation page/i);
  assert.match(readme, /\/goose:setup/);
});
