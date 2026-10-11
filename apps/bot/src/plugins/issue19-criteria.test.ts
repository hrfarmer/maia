import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const botPluginsDir = path.dirname(fileURLToPath(import.meta.url));

describe("issue #19 run now bypasses event cap", () => {
  it("manual and cron runs use the run queue without event concurrency", async () => {
    const runtimeLoop = await readFile(
      path.join(botPluginsDir, "runtime-loop.ts"),
      "utf8",
    );
    const executeRun = await readFile(
      path.join(botPluginsDir, "execute-run.ts"),
      "utf8",
    );
    assert.doesNotMatch(runtimeLoop, /PluginEventInvocationConcurrency/);
    assert.doesNotMatch(executeRun, /PluginEventInvocationConcurrency/);
  });

  it("member and role invocation runs do not write run-audit rows", async () => {
    const executeEvent = await readFile(
      path.join(botPluginsDir, "execute-event-run.ts"),
      "utf8",
    );
    assert.doesNotMatch(executeEvent, /recordAuditLog/);
  });
});
