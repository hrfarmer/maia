import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

describe("plugin spacelab enabled guilds API", () => {
  it("returns enabled guild ids for the always-on Space Lab token", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {
        query: {
          guildPluginSettings: {
            findMany: async () => [
              { guildId: "guild-b", enabled: true },
              { guildId: "guild-a", enabled: true },
            ],
          },
        },
      } as unknown as Db,
    });
    await api.listen();

    const response = await fetch(
      `${api.url()}/v1/plugins/spacelab-roster/enabled-guilds`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { guildIds?: string[] };
    assert.deepEqual(body.guildIds, ["guild-a", "guild-b"]);

    await api.close();
  });
});
