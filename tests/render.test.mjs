import test from "node:test";
import assert from "node:assert/strict";

import { renderStoredJobResult } from "../plugins/goose/scripts/lib/render.mjs";

test("renderStoredJobResult prefers raw output for task jobs", () => {
  const output = renderStoredJobResult(
    {
      id: "task-123",
      status: "completed",
      title: "Goose Task",
      jobClass: "task",
      threadId: "sess_123"
    },
    {
      threadId: "sess_123",
      rendered: "Handled the requested task.\nTask prompt accepted.\n",
      result: {
        rawOutput: "Handled the requested task.\nTask prompt accepted.\n"
      }
    }
  );

  assert.match(output, /Handled the requested task/);
  assert.match(output, /Goose session ID: sess_123/);
  assert.match(output, /Resume in Goose: goose session resume sess_123/);
});
