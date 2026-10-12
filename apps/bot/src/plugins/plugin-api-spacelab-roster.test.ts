import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { createPluginApiServer } from "./plugin-api-server.js";
import type { PluginModerationHandlers } from "./plugin-api-moderation.js";
import { PluginTokenRegistry } from "./token-registry.js";

function mockHandlers(
  overrides: Partial<PluginModerationHandlers> = {},
): PluginModerationHandlers {
  return {
    listRolesForGuild: async () => [
      { id: "role-alpha", name: "Alpha", color: 0, managed: false, position: 1 },
    ],
    moderationCreateRole: async () => ({
      ok: true,
      role: {
        id: "2",
        name: "New",
        color: 0,
        managed: false,
        position: 0,
        hoist: false,
        mentionable: false,
      },
    }),
    moderationUpdateRole: async () => ({
      ok: true,
      role: {
        id: "1",
        name: "Renamed",
        color: 0,
        managed: false,
        position: 1,
      },
    }),
    moderationDeleteRole: async () => ({ ok: true }),
    listGuildMembersForModeration: async () => [],
    searchGuildMembersForModeration: async () => [],
    getMemberRoleIds: async () => [],
    moderationSetRoles: async () => {
      throw new Error("replace-all roles must not be called");
    },
    moderationAddRole: async () => ({ ok: true, noop: false }),
    moderationRemoveRole: async () => ({ ok: true, noop: false }),
    moderationKick: async () => ({ ok: true }),
    moderationBan: async () => ({ ok: true }),
    moderationUnban: async () => ({ ok: true }),
    moderationTimeout: async () => ({
      ok: true,
      until: new Date().toISOString(),
    }),
    moderationUntimeout: async () => ({ ok: true, noop: false }),
    moderationNickname: async () => ({ ok: true }),
    ...overrides,
  };
}

describe("plugin spacelab roster reconcile API", () => {
  it("returns saved roster, links, remembered members, and failures for the always-on plugin", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {
        query: {
          spacelabGuildRosterState: {
            findFirst: async () => ({
              rowsJson: JSON.stringify([
                {
                  discordHandle: "user.a",
                  status: "Active",
                  adaptRoleValues: ["Alpha"],
                },
              ]),
              adaptValuesJson: JSON.stringify(["Alpha"]),
              parsedAt: new Date("2026-10-11T12:00:00.000Z"),
            }),
          },
          spacelabAdaptRoleLinks: {
            findMany: async () => [
              { adaptValue: "Alpha", discordRoleId: "role-alpha" },
            ],
          },
          spacelabGuildAdaptSettings: { findFirst: async () => null },
          spacelabRememberedMembers: { findMany: async () => [] },
          spacelabReconcileFailures: { findMany: async () => [] },
        },
      } as unknown as Db,
      assertGuildApiAccess: async (provided, guildId) => {
        const entry = registry.lookup(provided);
        return entry?.kind === "always-on" && guildId === "guild-1"
          ? { pluginId: "spacelab-roster" }
          : null;
      },
      moderationHandlers: mockHandlers(),
    });
    await api.listen();
    const response = await fetch(
      `${api.url()}/v1/guilds/guild-1/spacelab-roster/reconcile-state`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      rows: unknown[];
      links: Record<string, string>;
    };
    assert.equal(body.rows.length, 1);
    assert.equal(body.links.Alpha, "role-alpha");
    await api.close();
  });
});
