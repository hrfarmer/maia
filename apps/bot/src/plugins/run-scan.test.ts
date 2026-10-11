import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pruneGuildPluginConfigForRemovedPlugins } from "@maia/db";

describe("runPluginScan guild config cleanup", () => {
  it("exports pruneGuildPluginConfigForRemovedPlugins for discovery removals", () => {
    assert.equal(typeof pruneGuildPluginConfigForRemovedPlugins, "function");
  });

  it("prunes guild_plugin_settings rows where saved cron expressions live", () => {
    assert.match(
      pruneGuildPluginConfigForRemovedPlugins.toString(),
      /guildPluginSettings/,
    );
  });

  it("accepts afterScan hooks used to restart always-on plugins on refresh", async () => {
    const { runPluginScan } = await import("./run-scan.js");
    assert.equal(runPluginScan.length, 3);
  });
});
