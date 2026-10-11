import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planPluginSlashCommandsForGuild } from "@maia/plugins";
import { buildGuildApplicationCommandsBody } from "@maia/discord";

describe("guild plugin slash sync plan", () => {
  it("keeps custom commands alongside plugin slash commands in one body", () => {
    const { discordBody } = planPluginSlashCommandsForGuild({
      customCommandNames: ["custom-a"],
      plugins: [
        {
          pluginId: "demo",
          commands: [
            {
              name: "plugin-cmd",
              description: "From plugin",
              visibility: "public",
              defaultPermission: null,
              options: [],
            },
          ],
        },
      ],
    });
    const body = buildGuildApplicationCommandsBody({
      customCommands: [{ name: "custom-a", description: "Custom" }],
      pluginCommands: discordBody,
    });
    assert.equal(body.length, 2);
    assert.deepEqual(
      body.map((command) => command.name).sort(),
      ["custom-a", "plugin-cmd"],
    );
  });
});
