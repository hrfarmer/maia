import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPluginProcess } from "./process-runner.js";

const node = process.execPath;

describe("runPluginProcess", () => {
  it("runs without a shell, uses cwd, and passes stdin", async () => {
    const logs: string[] = [];
    const result = await runPluginProcess(
      {
        cwd: process.cwd(),
        command: [node, "-e", "process.stdout.write(process.env.TEST_KEY)"],
        env: { TEST_KEY: "guild-value" },
        stdin: '{"guildId":"1","trigger":"run_now"}\n',
        timeLimitMs: 5_000,
      },
      {
        onStdout(chunk) {
          logs.push(chunk);
        },
        onStderr() {},
      },
    );

    assert.equal(result.timedOut, false);
    assert.equal(result.exitCode, 0);
    assert.equal(logs.join(""), "guild-value");
  });

  it("kills the process when it exceeds the invocation time limit", async () => {
    const result = await runPluginProcess(
      {
        cwd: process.cwd(),
        command: [node, "-e", "setTimeout(() => {}, 5000)"],
        env: {},
        stdin: "",
        timeLimitMs: 50,
      },
      { onStdout() {}, onStderr() {} },
    );

    assert.equal(result.timedOut, true);
  });

  it("does not inherit the bot environment", async () => {
    process.env.MAIA_BOT_SECRET_SHOULD_NOT_LEAK = "leak";
    const result = await runPluginProcess(
      {
        cwd: process.cwd(),
        command: [
          node,
          "-e",
          "process.exit(process.env.MAIA_BOT_SECRET_SHOULD_NOT_LEAK ? 1 : 0)",
        ],
        env: {},
        stdin: "",
        timeLimitMs: 5_000,
      },
      { onStdout() {}, onStderr() {} },
    );
    delete process.env.MAIA_BOT_SECRET_SHOULD_NOT_LEAK;
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);
  });
});
