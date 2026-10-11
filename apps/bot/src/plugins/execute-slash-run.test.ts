import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPluginRunAuditEntry } from "./plugin-run-audit.js";

const botPluginsDir = path.dirname(fileURLToPath(import.meta.url));

describe("plugin slash runs", () => {
  it("records slash trigger audit with member and command", () => {
    const entry = buildPluginRunAuditEntry({
      guildId: "g1",
      pluginId: "demo",
      trigger: "slash",
      memberId: "u1",
      commandName: "ping",
      success: true,
    });
    assert.equal(entry.detail?.trigger, "slash");
    assert.equal(entry.detail?.memberId, "u1");
    assert.equal(entry.detail?.command, "ping");
  });

  it("bypasses member/role event invocation cap (#19)", async () => {
    const slashRun = await readFile(
      path.join(botPluginsDir, "execute-slash-run.ts"),
      "utf8",
    );
    assert.doesNotMatch(slashRun, /PluginEventInvocationConcurrency/);
    assert.doesNotMatch(slashRun, /executePluginEventRun/);
    assert.doesNotMatch(slashRun, /deliverMemberRoleGatewayEvent/);
  });
});
