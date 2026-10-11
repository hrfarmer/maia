import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPluginRunAuditEntry,
  formatPluginLogLine,
} from "./plugin-run-audit.js";

describe("plugin run audit", () => {
  it("records plugin, guild, and cron with no user label", () => {
    const entry = buildPluginRunAuditEntry({
      guildId: "111",
      pluginId: "role-sync",
      trigger: "cron",
      success: true,
    });
    assert.deepEqual(entry.detail, { trigger: "cron" });
    assert.equal(entry.actorLabel, undefined);
  });

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

  it("records slash runs with member and command in detail", () => {
    const entry = buildPluginRunAuditEntry({
      guildId: "111",
      pluginId: "slash-demo",
      trigger: "slash",
      memberId: "999",
      commandName: "ping",
      success: true,
    });
    assert.deepEqual(entry.detail, {
      trigger: "slash",
      memberId: "999",
      command: "ping",
    });
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
