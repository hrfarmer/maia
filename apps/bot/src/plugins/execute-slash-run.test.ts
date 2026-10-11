import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPluginRunAuditEntry } from "./plugin-run-audit.js";

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

  it("does not use member or role event delivery (separate slash path)", () => {
    assert.notEqual(
      buildPluginRunAuditEntry({
        guildId: "g1",
        pluginId: "demo",
        trigger: "slash",
        memberId: "u1",
        commandName: "ping",
        success: true,
      }).detail?.trigger,
      "member.join",
    );
  });
});
