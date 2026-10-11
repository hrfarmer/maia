import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

describe("plugin localhost API", () => {
  it("accepts a token only for its guild and binds to loopback", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo");
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "demo" }
          : null,
    });
    await api.listen();
    const address = api.server.address();
    assert.ok(address && typeof address === "object");
    assert.equal(address.address, "127.0.0.1");

    const ok = await fetch(`${api.url()}/v1/guilds/guild-a/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(ok.status, 200);

    const wrongGuild = await fetch(`${api.url()}/v1/guilds/guild-b/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(wrongGuild.status, 403);

    await api.close();
  });

  it("returns guild values for an enabled always-on guild only", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("demo-ao");
    const enabledGuilds = new Set(["guild-enabled"]);
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) => {
        const entry = registry.lookup(provided);
        if (!entry || entry.kind !== "always-on") {
          return null;
        }
        return enabledGuilds.has(guildId) ? { pluginId: entry.pluginId } : null;
      },
      loadGuildValues: async (guildId) =>
        guildId === "guild-enabled"
          ? { WEBHOOK_URL: "https://example.com/hook" }
          : ({} as Record<string, string>),
    });
    await api.listen();

    const ok = await fetch(`${api.url()}/v1/guilds/guild-enabled/values`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { values: Record<string, string> };
    assert.deepEqual(body.values, { WEBHOOK_URL: "https://example.com/hook" });

    const disabled = await fetch(`${api.url()}/v1/guilds/guild-disabled/values`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(disabled.status, 403);

    await api.close();
  });
});
