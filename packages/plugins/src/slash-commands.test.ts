import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePluginSlashCommands,
  planPluginSlashCommandsForGuild,
  pluginSlashCommandToDiscordPayload,
  slashRunTimeLimitMs,
} from "./slash-commands.js";

describe("plugin slash commands", () => {
  it("defaults visibility to public", () => {
    const commands = parsePluginSlashCommands([
      { name: "ping", description: "Ping" },
    ]);
    assert.equal(commands[0]?.visibility, "public");
  });

  it("skips colliding names and keeps other plugin commands", () => {
    const plan = planPluginSlashCommandsForGuild({
      customCommandNames: ["custom-a"],
      plugins: [
        {
          pluginId: "demo",
          commands: [
            { name: "hello", description: "Bad", visibility: "public", defaultPermission: null, options: [] },
            { name: "ok", description: "Ok", visibility: "public", defaultPermission: null, options: [] },
            { name: "custom-a", description: "Dup", visibility: "public", defaultPermission: null, options: [] },
          ],
        },
      ],
    });
    assert.equal(plan.discordBody.length, 1);
    assert.equal(plan.discordBody[0]?.name, "ok");
    const collisions = plan.collisionsByPlugin.get("demo");
    assert.equal(collisions?.length, 2);
  });

  it("includes default_member_permissions when declared", () => {
    const commands = parsePluginSlashCommands([
      {
        name: "admin-only",
        description: "Admin",
        defaultPermission: "8",
      },
    ]);
    const payload = pluginSlashCommandToDiscordPayload(commands[0]!);
    assert.equal(payload.default_member_permissions, "8");
  });

  it("caps slash run time at Discord interaction limit", () => {
    assert.equal(slashRunTimeLimitMs(60_000), 60_000);
    assert.equal(slashRunTimeLimitMs(null), 15 * 60 * 1000);
    assert.equal(slashRunTimeLimitMs(20 * 60 * 1000), 15 * 60 * 1000);
  });
});
