import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPluginRunAuditEntry,
  formatPluginLogLine,
} from "./plugin-run-audit.js";

describe("plugin run audit", () => {
  it("records plugin, guild, and run_now with no user label", () => {
    const entry = buildPluginRunAuditEntry({
      guildId: "111",
      pluginId: "role-sync",
      trigger: "run_now",
      success: true,
    });
    assert.equal(entry.source, "plugin");
    assert.equal(entry.actorId, "role-sync");
    assert.equal(entry.actorLabel, undefined);
    assert.equal(entry.action, "plugin.run");
    assert.deepEqual(entry.detail, { trigger: "run_now" });
  });

  it("marks success only when the process exits 0", () => {
    const failed = buildPluginRunAuditEntry({
      guildId: "111",
      pluginId: "role-sync",
      trigger: "run_now",
      success: false,
      errorMessage: "Process exited with code 1",
    });
    assert.equal(failed.success, false);
  });
});

describe("plugin log lines", () => {
  it("tags stdout and stderr with the plugin id", () => {
    assert.equal(
      formatPluginLogLine("demo", "stdout", "hello\n"),
      "[plugin:demo] hello",
    );
    assert.equal(
      formatPluginLogLine("demo", "stderr", "warn\n"),
      "[plugin:demo:stderr] warn",
    );
  });
});
