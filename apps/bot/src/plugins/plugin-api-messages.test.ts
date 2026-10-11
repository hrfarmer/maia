import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPluginApiServer } from "./plugin-api-server.js";
import { pluginAuditActor } from "./plugin-api-auth.js";
import type { PluginMessageHandlers } from "./plugin-api-messages.js";
import { PluginTokenRegistry } from "./token-registry.js";
import type { Db } from "@maia/db";

function mockMessageHandlers(
  overrides: Partial<PluginMessageHandlers> = {},
): PluginMessageHandlers {
  return {
    listViewableGuildChannels: async () => [
      { id: "200000000000000010", name: "general", type: 0 },
    ],
    sendGuildChannelMessage: async () => ({
      ok: true,
      message: {
        id: "300000000000000099",
        channelId: "200000000000000010",
        content: "Hello",
      },
    }),
    ...overrides,
  };
}

describe("plugin localhost message API", () => {
  it("lists channels for an authorized plugin token", async () => {
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
      messageHandlers: mockMessageHandlers(),
    });
    await api.listen();
    const res = await fetch(`${api.url()}/v1/guilds/guild-a/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { channels: unknown[] };
    assert.equal(body.channels.length, 1);
    await api.close();
  });

  it("passes a plugin audit actor when sending a message", async () => {
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
      messageHandlers: mockMessageHandlers({
        sendGuildChannelMessage: async (
          _guildId,
          _channelId,
          _input,
          actor,
        ) => {
          seenActor = actor;
          return {
            ok: true,
            message: {
              id: "1",
              channelId: "200000000000000010",
              content: "Hello",
            },
          };
        },
      }),
    });
    await api.listen();
    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/channels/200000000000000010/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "Hello",
          replyToMessageId: "300000000000000099",
        }),
      },
    );
    assert.equal(res.status, 201);
    assert.deepEqual(seenActor, pluginAuditActor("demo-plugin"));
    await api.close();
  });
});
