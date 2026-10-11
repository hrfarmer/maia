import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModerationError } from "@maia/moderation";
import { createPluginApiServer } from "./plugin-api-server.js";
import { pluginAuditActor } from "./plugin-api-auth.js";
import type { PluginModerationHandlers } from "./plugin-api-moderation.js";
import { PluginTokenRegistry } from "./token-registry.js";
import type { Db } from "@maia/db";

function mockHandlers(
  overrides: Partial<PluginModerationHandlers> = {},
): PluginModerationHandlers {
  return {
    listRolesForGuild: async () => [{ id: "1", name: "Mod", color: 0, managed: false, position: 1 }],
    moderationCreateRole: async () => ({ ok: true, role: { id: "2", name: "New", color: 0, managed: false, position: 0, hoist: false, mentionable: false } }),
    moderationUpdateRole: async () => ({ ok: true, role: { id: "1", name: "Renamed", color: 0, managed: false, position: 1 } }),
    moderationDeleteRole: async () => ({ ok: true }),
    searchGuildMembersForModeration: async (_guildId, query) =>
      query ? [{ user: { id: "9", username: "alice" }, roles: [] }] : [],
    getMemberRoleIds: async () => ["1"],
    moderationSetRoles: async () => ({ ok: true }),
    moderationAddRole: async () => ({ ok: true, noop: false }),
    moderationRemoveRole: async () => ({ ok: true, noop: false }),
    moderationKick: async () => ({ ok: true }),
    moderationBan: async () => ({ ok: true }),
    moderationUnban: async () => ({ ok: true }),
    moderationTimeout: async () => ({ ok: true, until: new Date().toISOString() }),
    moderationUntimeout: async () => ({ ok: true, noop: false }),
    moderationNickname: async () => ({ ok: true }),
    ...overrides,
  };
}

describe("plugin localhost moderation API", () => {
  it("passes a plugin audit actor into moderation handlers", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo-plugin");
    let seenActor: unknown;
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "demo-plugin" }
          : null,
      moderationHandlers: mockHandlers({
        moderationKick: async (_guildId, _userId, _reason, actor) => {
          seenActor = actor;
          return { ok: true };
        },
      }),
    });
    await api.listen();
    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/members/123456789012345678/kick`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "test" }),
      },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(seenActor, pluginAuditActor("demo-plugin"));
    await api.close();
  });

  it("maps hierarchy failures to 400 like the dashboard", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo-plugin");
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "demo-plugin" }
          : null,
      moderationHandlers: mockHandlers({
        moderationKick: async () => {
          throw new ModerationError(
            "That member's highest role is at or above Maia's highest role.",
          );
        },
      }),
    });
    await api.listen();
    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/members/123456789012345678/kick`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /highest role/);
    await api.close();
  });

  it("returns no members without a query and caps search results", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo-plugin");
    let lastQuery = "unset";
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "demo-plugin" }
          : null,
      moderationHandlers: mockHandlers({
        searchGuildMembersForModeration: async (_guildId, query) => {
          lastQuery = query;
          return query ? new Array(25).fill({ user: { id: "1" }, roles: [] }) : [];
        },
      }),
    });
    await api.listen();

    const empty = await fetch(`${api.url()}/v1/guilds/guild-a/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(empty.status, 200);
    const emptyBody = (await empty.json()) as { members: unknown[] };
    assert.deepEqual(emptyBody.members, []);
    assert.equal(lastQuery, "");

    const found = await fetch(
      `${api.url()}/v1/guilds/guild-a/members?query=ali`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(found.status, 200);
    const foundBody = (await found.json()) as { members: unknown[] };
    assert.equal(foundBody.members.length, 25);
    assert.equal(lastQuery, "ali");

    await api.close();
  });

  it("accepts many plugin calls without a Maia request quota", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo-plugin");
    let hits = 0;
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "demo-plugin" }
          : null,
      moderationHandlers: mockHandlers({
        listRolesForGuild: async () => {
          hits += 1;
          return [];
        },
      }),
    });
    await api.listen();
    for (let i = 0; i < 150; i++) {
      const res = await fetch(`${api.url()}/v1/guilds/guild-a/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 200, `request ${i}`);
    }
    assert.equal(hits, 150);
    await api.close();
  });
});
