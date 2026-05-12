import { readJsonFile } from "./fs.mjs";
import { binaryAvailable, runCommand } from "./process.mjs";

const TASK_THREAD_PREFIX = "Goose Companion Task";
const DEFAULT_CONTINUE_PROMPT =
  "Continue from the current session state. Pick the next highest-value step and follow through until the task is resolved.";

function cleanGooseStderr(stderr) {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith("WARNING: proceeding, even though we could not update PATH:"))
    .join("\n");
}

export function getGooseAvailability(cwd) {
  return binaryAvailable("goose", ["--version"], { cwd });
}

export function getSessionRuntimeStatus() {
  return {
    mode: "direct",
    label: "direct startup",
    detail: "Goose runs directly via CLI.",
    endpoint: null
  };
}

function shorten(text, limit = 72) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

export function buildTaskThreadName(prompt) {
  const excerpt = shorten(prompt, 56);
  return excerpt ? `${TASK_THREAD_PREFIX}: ${excerpt}` : TASK_THREAD_PREFIX;
}

export function buildPersistentTaskThreadName(prompt) {
  return buildTaskThreadName(prompt);
}

export async function runGooseTask(cwd, options = {}) {
  const availability = getGooseAvailability(cwd);
  if (!availability.available) {
    throw new Error(
      "Goose CLI is not installed. Install it from https://github.com/block/goose, then rerun `/goose:setup`."
    );
  }

  const env = { ...process.env };
  if (options.model) {
    env.GOOSE_MODEL = options.model;
  }
  if (options.provider) {
    env.GOOSE_PROVIDER = options.provider;
  }

  const args = ["run", "-t", options.prompt || options.defaultPrompt || ""];
  if (options.resumeSessionId) {
    args.push("--session", options.resumeSessionId);
  }

  const result = runCommand("goose", args, { cwd, env });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(cleanGooseStderr(result.stderr) || `goose run exited with status ${result.status}`);
  }

  return {
    status: 0,
    stdout: result.stdout,
    stderr: cleanGooseStderr(result.stderr),
    sessionId: options.resumeSessionId || null
  };
}

export async function findLatestGooseSession(cwd) {
  const availability = getGooseAvailability(cwd);
  if (!availability.available) {
    throw new Error(
      "Goose CLI is not installed. Install it from https://github.com/block/goose, then rerun `/goose:setup`."
    );
  }

  const result = runCommand("goose", ["session", "list", "--json"], { cwd });
  if (result.error || result.status !== 0) {
    return null;
  }

  try {
    const sessions = JSON.parse(result.stdout);
    if (Array.isArray(sessions) && sessions.length > 0) {
      const latest = sessions[0];
      return { id: latest.id || latest.session_id || null };
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

export function parseStructuredOutput(rawOutput, fallback = {}) {
  if (!rawOutput) {
    return {
      parsed: null,
      parseError: fallback.failureMessage ?? "Goose did not return a final structured message.",
      rawOutput: rawOutput ?? "",
      ...fallback
    };
  }

  try {
    return {
      parsed: JSON.parse(rawOutput),
      parseError: null,
      rawOutput,
      ...fallback
    };
  } catch (error) {
    return {
      parsed: null,
      parseError: error.message,
      rawOutput,
      ...fallback
    };
  }
}

export function readOutputSchema(schemaPath) {
  return readJsonFile(schemaPath);
}

export { DEFAULT_CONTINUE_PROMPT, TASK_THREAD_PREFIX };
