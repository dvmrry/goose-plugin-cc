import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { buildEnv, installFakeGoose } from "./fake-goose-fixture.mjs";
import { initGitRepo, makeTempDir, run } from "./helpers.mjs";
import { resolveStateDir } from "../plugins/goose/scripts/lib/state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = path.join(ROOT, "plugins", "goose");
const SCRIPT = path.join(PLUGIN_ROOT, "scripts", "goose-companion.mjs");

async function waitFor(predicate, { timeoutMs = 5000, intervalMs = 50 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for condition.");
}

test("setup reports ready when fake goose is installed", () => {
  const binDir = makeTempDir();
  installFakeGoose(binDir);

  const result = run("node", [SCRIPT, "setup", "--json"], {
    cwd: ROOT,
    env: buildEnv(binDir)
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ready, true);
  assert.equal(payload.goose.available, true);
});

test("task runs successfully", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const result = run("node", [SCRIPT, "task", "check auth preflight"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handled the requested task/);
});

test("task reports error when the run is rejected", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir, "auth-run-fails");
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const result = run("node", [SCRIPT, "task", "check failed auth"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /authentication expired/);
});

test("task --resume-last resumes the latest persisted task session", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const firstRun = run("node", [SCRIPT, "task", "initial task"], {
    cwd: repo,
    env: buildEnv(binDir)
  });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const result = run("node", [SCRIPT, "task", "--resume-last", "follow up"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Resumed the prior run/);
});

test("task-resume-candidate returns the latest task from the current session", () => {
  const workspace = makeTempDir();
  const stateDir = resolveStateDir(workspace);
  const jobsDir = path.join(stateDir, "jobs");
  fs.mkdirSync(jobsDir, { recursive: true });

  fs.writeFileSync(
    path.join(stateDir, "state.json"),
    `${JSON.stringify(
      {
        version: 1,
        config: {},
        jobs: [
          {
            id: "task-current",
            status: "completed",
            title: "Goose Task",
            jobClass: "task",
            sessionId: "sess-current",
            threadId: "sess_current",
            summary: "Investigate the flaky test",
            updatedAt: "2026-03-24T20:00:00.000Z"
          },
          {
            id: "task-other-session",
            status: "completed",
            title: "Goose Task",
            jobClass: "task",
            sessionId: "sess-other",
            threadId: "sess_other",
            summary: "Old task run",
            updatedAt: "2026-03-24T20:05:00.000Z"
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = run("node", [SCRIPT, "task-resume-candidate", "--json"], {
    cwd: workspace,
    env: {
      ...process.env,
      GOOSE_COMPANION_SESSION_ID: "sess-current"
    }
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.available, true);
  assert.equal(payload.sessionId, "sess-current");
  assert.equal(payload.candidate.id, "task-current");
  assert.equal(payload.candidate.threadId, "sess_current");
});

test("task --resume-last does not resume a task from another Claude session", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const otherEnv = {
    ...buildEnv(binDir),
    GOOSE_COMPANION_SESSION_ID: "sess-other"
  };
  const currentEnv = {
    ...buildEnv(binDir),
    GOOSE_COMPANION_SESSION_ID: "sess-current"
  };

  const firstRun = run("node", [SCRIPT, "task", "initial task"], {
    cwd: repo,
    env: otherEnv
  });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const candidate = run("node", [SCRIPT, "task-resume-candidate", "--json"], {
    cwd: repo,
    env: currentEnv
  });
  assert.equal(candidate.status, 0, candidate.stderr);
  assert.equal(JSON.parse(candidate.stdout).available, false);

  const resume = run("node", [SCRIPT, "task", "--resume-last", "follow up"], {
    cwd: repo,
    env: currentEnv
  });
  assert.equal(resume.status, 1);
  assert.match(resume.stderr, /No previous Goose task session was found for this repository\./);
});

test("task --resume-last ignores running tasks from other Claude sessions", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const stateDir = resolveStateDir(repo);
  fs.mkdirSync(path.join(stateDir, "jobs"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "state.json"),
    `${JSON.stringify(
      {
        version: 1,
        config: {},
        jobs: [
          {
            id: "task-other-running",
            status: "running",
            title: "Goose Task",
            jobClass: "task",
            sessionId: "sess-other",
            threadId: "sess_other",
            summary: "Other session active task",
            updatedAt: "2026-03-24T20:05:00.000Z"
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const env = {
    ...buildEnv(binDir),
    GOOSE_COMPANION_SESSION_ID: "sess-current"
  };
  const status = run("node", [SCRIPT, "status", "--json"], {
    cwd: repo,
    env
  });
  assert.equal(status.status, 0, status.stderr);
  assert.deepEqual(JSON.parse(status.stdout).running, []);

  const resume = run("node", [SCRIPT, "task", "--resume-last", "follow up"], {
    cwd: repo,
    env
  });
  assert.equal(resume.status, 1);
  assert.match(resume.stderr, /No previous Goose task session was found for this repository\./);
});

test("write task output focuses on the Goose result without generic follow-up hints", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const result = run("node", [SCRIPT, "task", "--write", "change the readme"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handled the requested task/);
  assert.doesNotMatch(result.stdout, /Review changes/);
});

test("cancel terminates a running background task worker", async () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir, "slow-task");
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const bg = run("node", [SCRIPT, "task", "--background", "slow work"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.equal(bg.status, 0, bg.stderr);
  assert.match(bg.stdout, /started in the background/);
  const jobIdMatch = bg.stdout.match(/task-[a-z0-9-]+/);
  assert.ok(jobIdMatch);
  const jobId = jobIdMatch[0];

  await waitFor(() => {
    const st = run("node", [SCRIPT, "status", jobId, "--json"], {
      cwd: repo,
      env: buildEnv(binDir)
    });
    if (st.status !== 0) return false;
    const parsed = JSON.parse(st.stdout);
    return parsed.job.status === "running";
  });

  const cancel = run("node", [SCRIPT, "cancel", jobId, "--json"], {
    cwd: repo,
    env: buildEnv(binDir)
  });
  assert.equal(cancel.status, 0, cancel.stderr);
  const cancelPayload = JSON.parse(cancel.stdout);
  assert.equal(cancelPayload.status, "cancelled");
});

test("status with --wait eventually returns a completed job", async () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const result = run("node", [SCRIPT, "task", "quick task"], {
    cwd: repo,
    env: buildEnv(binDir)
  });
  assert.equal(result.status, 0, result.stderr);

  const stateDir = resolveStateDir(repo);
  const state = JSON.parse(fs.readFileSync(path.join(stateDir, "state.json"), "utf8"));
  const jobId = state.jobs[0].id;

  const waitResult = run("node", [SCRIPT, "status", jobId, "--wait", "--timeout-ms", "5000", "--json"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.equal(waitResult.status, 0, waitResult.stderr);
  const payload = JSON.parse(waitResult.stdout);
  assert.equal(payload.job.status, "completed");
});

test("result returns stored output for a finished job", () => {
  const repo = makeTempDir();
  const binDir = makeTempDir();
  installFakeGoose(binDir);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  run("git", ["add", "README.md"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const taskResult = run("node", [SCRIPT, "task", "do something"], {
    cwd: repo,
    env: buildEnv(binDir)
  });
  assert.equal(taskResult.status, 0, taskResult.stderr);

  const result = run("node", [SCRIPT, "result", "--json"], {
    cwd: repo,
    env: buildEnv(binDir)
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.job);
  assert.ok(payload.storedJob);
});
