import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { Permission } from "@maia/discord";

const GUILD_ID = "100000000000000001";
const CHANNEL_ID = "200000000000000010";
const MESSAGE_ID = "300000000000000099";
const BOT_ID = "300000000000000003";
const BOT_ROLE = "400000000000000005";

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
              Permission.ViewChannel | Permission.SendMessages
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
      if (path === `/channels/${CHANNEL_ID}/messages` && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          content: string;
          message_reference?: { message_id: string };
        };
        assert.equal(body.content, "Hello");
        assert.equal(body.message_reference?.message_id, MESSAGE_ID);
        return json({ id: "400000000000000020", content: body.content });
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
});
