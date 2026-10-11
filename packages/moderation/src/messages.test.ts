import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { Permission } from "@maia/discord";

const GUILD_ID = "100000000000000001";
const CHANNEL_ID = "200000000000000010";
const MESSAGE_ID = "300000000000000099";
const OTHER_USER = "200000000000000002";
const BOT_ID = "300000000000000003";
const BOT_ROLE = "400000000000000005";

let reactionDeleteCalls = 0;

interface CapturedAudit {
  source: string;
  actorId: string;
  actorLabel?: string;
  action: string;
  targetType: string;
  targetId: string;
  success: boolean;
  detail?: Record<string, unknown>;
}

const auditEntries: CapturedAudit[] = [];

mock.module("@maia/db", {
  namedExports: {
    getDb: () => ({}),
    recordAuditLog: async (_db: unknown, entry: CapturedAudit) => {
      auditEntries.push(entry);
    },
  },
});

describe("guild channel messages", () => {
  let restoreFetch: () => void;

  before(() => {
    process.env.DISCORD_TOKEN = "test-bot-token";
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.includes("discord.com/api/v10")) {
        return original(input, init);
      }
      const path = (url.split("discord.com/api/v10")[1] ?? "").split("?")[0];
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });

      if (path === "/users/@me") {
        return json({ id: BOT_ID });
      }
      if (path === `/guilds/${GUILD_ID}/roles`) {
        return json([
          {
            id: GUILD_ID,
            name: "@everyone",
            color: 0,
            position: 0,
            managed: false,
            permissions: (
              Permission.ViewChannel |
              Permission.SendMessages |
              Permission.ReadMessageHistory |
              Permission.AddReactions |
              Permission.ManageMessages
            ).toString(),
          },
          {
            id: BOT_ROLE,
            name: "Maia",
            color: 0,
            position: 1,
            managed: false,
            permissions: "0",
          },
        ]);
      }
      if (path === `/guilds/${GUILD_ID}/members/${BOT_ID}`) {
        return json({
          user: { id: BOT_ID, username: "maia" },
          roles: [GUILD_ID, BOT_ROLE],
        });
      }
      if (path === `/guilds/${GUILD_ID}/channels`) {
        return json([
          {
            id: CHANNEL_ID,
            type: 0,
            name: "general",
          },
        ]);
      }
      if (
        path === `/channels/${CHANNEL_ID}/messages` &&
        (init?.method ?? "GET") === "GET"
      ) {
        const limit = new URL(url).searchParams.get("limit");
        assert.equal(limit, "25");
        return json([
          { id: MESSAGE_ID, content: "Earlier" },
          { id: "400000000000000020", content: "Latest" },
        ]);
      }
      if (path === `/channels/${CHANNEL_ID}/messages` && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          content: string;
          message_reference?: { message_id: string };
        };
        assert.equal(body.content, "Hello");
        assert.equal(body.message_reference?.message_id, MESSAGE_ID);
        return json({ id: "400000000000000020", content: body.content });
      }
      if (
        path === `/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}` &&
        (init?.method ?? "GET") === "GET"
      ) {
        return json({
          id: MESSAGE_ID,
          content: "Earlier",
          author: { id: OTHER_USER },
        });
      }
      if (
        path === `/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}` &&
        init?.method === "DELETE"
      ) {
        return new Response(null, { status: 204 });
      }
      if (
        path ===
          `/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}/reactions/${encodeURIComponent("👍")}/@me` &&
        init?.method === "PUT"
      ) {
        return new Response(null, { status: 204 });
      }
      if (
        path ===
          `/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}/reactions/${encodeURIComponent("👍")}/@me` &&
        init?.method === "DELETE"
      ) {
        reactionDeleteCalls += 1;
        return new Response(null, { status: 204 });
      }
      return json({ message: "not found" }, 404);
    };
    restoreFetch = () => {
      globalThis.fetch = original;
    };
  });

  after(() => {
    restoreFetch();
  });

  it("lists viewable text channels", async () => {
    const { listViewableGuildChannels } = await import("./messages.js");
    const channels = await listViewableGuildChannels(GUILD_ID);
    assert.deepEqual(channels, [
      { id: CHANNEL_ID, name: "general", type: 0 },
    ]);
  });

  it("sends a message with audit metadata", async () => {
    auditEntries.length = 0;
    const { sendGuildChannelMessage } = await import("./messages.js");
    const result = await sendGuildChannelMessage(
      GUILD_ID,
      CHANNEL_ID,
      { content: "Hello", replyToMessageId: MESSAGE_ID },
      { source: "api", id: "key-1", label: "Notifier" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.message.channelId, CHANNEL_ID);
    const audit = auditEntries.find((entry) => entry.action === "message.send");
    assert.ok(audit);
    assert.equal(audit!.source, "api");
    assert.equal(audit!.actorLabel, "Notifier");
    assert.equal(audit!.success, true);
    assert.equal(audit!.targetType, "message");
  });

  it("lists recent messages without writing audit rows", async () => {
    auditEntries.length = 0;
    const { listGuildChannelMessages } = await import("./messages.js");
    const result = await listGuildChannelMessages(GUILD_ID, CHANNEL_ID, {
      limit: 25,
    });
    assert.equal(result.ok, true);
    assert.equal(result.messages.length, 2);
    assert.equal(auditEntries.length, 0);
  });

  it("deletes a message with audit metadata", async () => {
    auditEntries.length = 0;
    const { deleteGuildChannelMessage } = await import("./messages.js");
    const result = await deleteGuildChannelMessage(
      GUILD_ID,
      CHANNEL_ID,
      MESSAGE_ID,
      { source: "plugin", id: "demo-plugin", label: "Demo" },
    );
    assert.equal(result.ok, true);
    const audit = auditEntries.find((entry) => entry.action === "message.delete");
    assert.ok(audit);
    assert.equal(audit!.source, "plugin");
    assert.equal(audit!.success, true);
  });

  it("adds and removes the bot reaction with audit metadata", async () => {
    auditEntries.length = 0;
    reactionDeleteCalls = 0;
    const {
      addGuildChannelMessageReaction,
      removeGuildChannelMessageReaction,
    } = await import("./messages.js");
    await addGuildChannelMessageReaction(
      GUILD_ID,
      CHANNEL_ID,
      MESSAGE_ID,
      "👍",
      { source: "api", id: "key-1", label: "Notifier" },
    );
    const addAudit = auditEntries.find(
      (entry) => entry.action === "message.reaction.add",
    );
    assert.ok(addAudit);
    assert.equal(addAudit!.success, true);

    const removed = await removeGuildChannelMessageReaction(
      GUILD_ID,
      CHANNEL_ID,
      MESSAGE_ID,
      "👍",
      { source: "api", id: "key-1", label: "Notifier" },
    );
    assert.equal(removed.removed, true);
    assert.equal(reactionDeleteCalls, 1);
    const removeAudit = auditEntries.find(
      (entry) => entry.action === "message.reaction.remove",
    );
    assert.ok(removeAudit);
    assert.equal(removeAudit!.success, true);
  });

  it("does not remove another user's reaction", async () => {
    auditEntries.length = 0;
    reactionDeleteCalls = 0;
    const { removeGuildChannelMessageReaction } = await import("./messages.js");
    const result = await removeGuildChannelMessageReaction(
      GUILD_ID,
      CHANNEL_ID,
      MESSAGE_ID,
      "👍",
      { source: "api", id: "key-1", label: "Notifier" },
      { userId: OTHER_USER },
    );
    assert.equal(result.removed, false);
    assert.equal(reactionDeleteCalls, 0);
    assert.equal(auditEntries.length, 0);
  });
});
