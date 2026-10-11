import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { buildAlwaysOnPluginProcessEnvironment } from "@maia/plugins";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

describe("plugin localhost mailbox access token API", () => {
  it("returns an access token for an enabled guild with a connected mailbox", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
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
        return enabledGuilds.has(guildId)
          ? { pluginId: entry.pluginId }
          : null;
      },
      mailboxHandlers: {
        refreshGuildMailboxAccessToken: async () => ({
          accessToken: "short-lived-access",
          expiresIn: 3600,
        }),
      },
    });
    await api.listen();

    const res = await fetch(
      `${api.url()}/v1/guilds/guild-enabled/microsoft/access-token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      accessToken: string;
      expiresIn: number;
    };
    assert.equal(body.accessToken, "short-lived-access");
    assert.equal(body.expiresIn, 3600);
    await api.close();
  });

  it("rejects the call when the plugin is disabled for that guild", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async () => null,
    });
    await api.listen();

    const res = await fetch(
      `${api.url()}/v1/guilds/guild-disabled/microsoft/access-token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(res.status, 403);
    await api.close();
  });

  it("fails when the guild has no connected mailbox", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const { MailboxNotConnectedError } = await import(
      "./guild-mailbox-access-token.js"
    );
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided) => {
        const entry = registry.lookup(provided);
        return entry ? { pluginId: entry.pluginId } : null;
      },
      mailboxHandlers: {
        refreshGuildMailboxAccessToken: async () => {
          throw new MailboxNotConnectedError();
        },
      },
    });
    await api.listen();

    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/microsoft/access-token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "mailbox_not_connected");
    await api.close();
  });

  it("returns an error when Microsoft refresh fails", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const { MailboxTokenRefreshError } = await import(
      "./guild-mailbox-access-token.js"
    );
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided) => {
        const entry = registry.lookup(provided);
        return entry ? { pluginId: entry.pluginId } : null;
      },
      mailboxHandlers: {
        refreshGuildMailboxAccessToken: async () => {
          throw new MailboxTokenRefreshError("Microsoft token refresh failed: 400");
        },
      },
    });
    await api.listen();

    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/microsoft/access-token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "microsoft_token_refresh_failed");
    await api.close();
  });

  it("forbids a guild from reading another guild's token", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "spacelab-roster");
    let requestedGuild: string | null = null;
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "spacelab-roster" }
          : null,
      mailboxHandlers: {
        refreshGuildMailboxAccessToken: async (_db, guildId) => {
          requestedGuild = guildId;
          return { accessToken: "only-guild-a", expiresIn: 60 };
        },
      },
    });
    await api.listen();

    const ok = await fetch(
      `${api.url()}/v1/guilds/guild-a/microsoft/access-token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(ok.status, 200);
    assert.equal(requestedGuild, "guild-a");

    const forbidden = await fetch(
      `${api.url()}/v1/guilds/guild-b/microsoft/access-token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(forbidden.status, 403);
    await api.close();
  });

  it("does not expose Microsoft secrets in the plugin process environment", () => {
    const env = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: "mplg_test",
      pluginUrl: "http://127.0.0.1:3847",
    });
    assert.deepEqual(Object.keys(env).sort(), [
      "MAIA_PLUGIN_TOKEN",
      "MAIA_PLUGIN_URL",
    ]);
    assert.equal(env.MICROSOFT_CLIENT_SECRET, undefined);
    assert.equal(env.MICROSOFT_CLIENT_ID, undefined);
    assert.equal(env.AUTH_SECRET, undefined);
  });
});
