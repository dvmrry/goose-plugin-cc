import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { writeExecutable } from "./helpers.mjs";

export function installFakeGoose(binDir, behavior = "task-ok") {
  const statePath = path.join(binDir, "fake-goose-state.json");
  const scriptPath = path.join(binDir, "goose");
  const source = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const STATE_PATH = ${JSON.stringify(statePath)};
const BEHAVIOR = ${JSON.stringify(behavior)};

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { nextSessionId: 1, sessions: [], runs: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("goose-cli test");
  process.exit(0);
}
if (args[0] === "run" && args[1] === "-t") {
  const prompt = args[2] || "";
  const state = loadState();
  const sessionId = args.includes("--session") ? args[args.indexOf("--session") + 1] : null;
  const runRecord = {
    id: sessionId || "sess_" + state.nextSessionId++,
    prompt,
    model: process.env.GOOSE_MODEL || null,
    provider: process.env.GOOSE_PROVIDER || null
  };
  state.runs.push(runRecord);
  if (!sessionId) {
    state.sessions.unshift({ id: runRecord.id, name: "Goose Companion Task: " + prompt.slice(0, 20) });
  }
  saveState(state);

  if (BEHAVIOR === "auth-run-fails") {
    console.error("authentication expired; run goose configure");
    process.exit(1);
  }

  if (BEHAVIOR === "slow-task") {
    setTimeout(() => {
      console.log("Handled the requested task.\\nSlow task completed.");
      process.exit(0);
    }, 8000);
    // Keep process alive
    setInterval(() => {}, 1000);
  } else {
    if (prompt.includes("follow up") || prompt.includes("Continue from the current session state")) {
      console.log("Resumed the prior run.\\nFollow-up prompt accepted.");
    } else if (prompt.includes("check auth")) {
      console.log("Handled the requested task.\\nAuth check passed.");
    } else {
      console.log("Handled the requested task.\\nTask prompt accepted.");
    }
    process.exit(0);
  }
}
if (args[0] === "session" && args[1] === "list") {
  const state = loadState();
  console.log(JSON.stringify(state.sessions));
  process.exit(0);
}
if (args[0] === "session" && args[1] === "resume") {
  const state = loadState();
  const sessionId = args[2];
  const session = state.sessions.find((s) => s.id === sessionId);
  if (session) {
    console.log("Resumed session " + sessionId + ".\\nFollow-up prompt accepted.");
  } else {
    console.error("Session not found: " + sessionId);
    process.exit(1);
  }
  process.exit(0);
}
console.error("Unknown command: " + args.join(" "));
process.exit(1);
`;
  writeExecutable(scriptPath, source);

  if (process.platform === "win32") {
    const cmdWrapper = `@echo off\r\nnode "%~dp0goose" %*\r\n`;
    fs.writeFileSync(path.join(binDir, "goose.cmd"), cmdWrapper, "utf8");
  }
}

export function buildEnv(binDir) {
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`
  };
}
