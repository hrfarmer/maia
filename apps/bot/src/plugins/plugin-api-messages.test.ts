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
    listGuildChannelMessages: async () => ({
      ok: true,
      messages: [
        {
          id: "300000000000000099",
          channelId: "200000000000000010",
          content: "Hello",
        },
      ],
    }),
    sendGuildChannelMessage: async () => ({
      ok: true,
      message: {
        id: "300000000000000099",
        channelId: "200000000000000010",
        content: "Hello",
      },
    }),
    deleteGuildChannelMessage: async () => ({ ok: true }),
    addGuildChannelMessageReaction: async () => ({ ok: true }),
    removeGuildChannelMessageReaction: async () => ({
      ok: true,
      removed: true,
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

  it("lists messages for an authorized plugin token", async () => {
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
    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/channels/200000000000000010/messages?limit=5`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { messages: unknown[] };
    assert.equal(body.messages.length, 1);
    await api.close();
  });

  it("passes a plugin audit actor when deleting a message", async () => {
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
        deleteGuildChannelMessage: async (
          _guildId,
          _channelId,
          _messageId,
          actor,
        ) => {
          seenActor = actor;
          return { ok: true };
        },
      }),
    });
    await api.listen();
    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/channels/200000000000000010/messages/300000000000000099`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(seenActor, pluginAuditActor("demo-plugin"));
    await api.close();
  });

  it("does not remove another user's reaction via userId query", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo-plugin");
    let seenUserId: string | undefined = "pending";
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) =>
        registry.assertGuildAccess(provided, guildId)
          ? { pluginId: "demo-plugin" }
          : null,
      messageHandlers: mockMessageHandlers({
        removeGuildChannelMessageReaction: async (
          _guildId,
          _channelId,
          _messageId,
          _emoji,
          _actor,
          options,
        ) => {
          seenUserId = options?.userId;
          return { ok: true, removed: false };
        },
      }),
    });
    await api.listen();
    const emoji = encodeURIComponent("👍");
    const res = await fetch(
      `${api.url()}/v1/guilds/guild-a/channels/200000000000000010/messages/300000000000000099/reactions/${emoji}?userId=200000000000000002`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(res.status, 200);
    assert.equal(seenUserId, "200000000000000002");
    const body = (await res.json()) as { removed: boolean };
    assert.equal(body.removed, false);
    await api.close();
  });
});
