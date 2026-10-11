import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import {
  classifyPluginApiForbidden,
  resolvePluginTokenForGuild,
} from "./plugin-api-access.js";
import { PluginTokenRegistry } from "./token-registry.js";

function mockDb(enabled: boolean | null): Db {
  return {
    query: {
      guildPluginSettings: {
        findFirst: async () =>
          enabled === null ? undefined : { enabled },
      },
    },
  } as unknown as Db;
}

describe("resolvePluginTokenForGuild", () => {
  it("accepts always-on tokens only for enabled guilds", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("demo");

    const enabled = await resolvePluginTokenForGuild(
      mockDb(true),
      registry,
      token,
      "guild-a",
    );
    assert.ok(enabled);

    const disabled = await resolvePluginTokenForGuild(
      mockDb(false),
      registry,
      token,
      "guild-b",
    );
    assert.equal(disabled, null);
  });

  it("classifies revoked always-on tokens", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("demo");
    registry.revoke(token);
    const reason = await classifyPluginApiForbidden(
      mockDb(true),
      registry,
      token,
      "guild-a",
    );
    assert.equal(reason, "revoked_token");
  });
});
