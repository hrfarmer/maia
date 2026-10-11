import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { Permission } from "@maia/discord";
import {
  installDiscordFetchMock,
  MOCK_GUILD_ID,
} from "../moderation/discord-fetch-mock.js";
import { apiKeyAuditActor } from "../api/auth-utils.js";

const CHANNEL_ID = "200000000000000010";
const REPLY_ID = "300000000000000099";
const MESSAGE_ID = "300000000000000099";
const OTHER_USER = "200000000000000002";

interface CapturedAudit {
  source: string;
  actorId: string;
  actorLabel?: string;
  action: string;
  success: boolean;
}

const auditEntries: CapturedAudit[] = [];

mock.module("@/lib/api/http", {
  namedExports: {
    authenticateApiKey: async () => ({
      actor: apiKeyAuditActor({ id: "key-1", name: "Notifier" }),
    }),
    jsonError: (message: string, status: number) =>
      Response.json({ error: message }, { status }),
    handleModerationError: (error: unknown) => {
      if (error instanceof Error && error.name === "ModerationError") {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ error: "Unexpected error" }, { status: 500 });
    },
  },
});

mock.module("@maia/db", {
  namedExports: {
    getDb: () => ({}),
    recordAuditLog: async (_db: unknown, entry: CapturedAudit) => {
      auditEntries.push(entry);
    },
  },
});

describe("external /api/v1 message routes", () => {
  let restoreFetch: () => void;

  before(() => {
    process.env.DISCORD_TOKEN = "test-bot-token";
    restoreFetch = installDiscordFetchMock({
      everyonePermissions:
        Permission.ViewChannel |
        Permission.SendMessages |
        Permission.ReadMessageHistory |
        Permission.AddReactions |
        Permission.ManageMessages,
      channels: [{ id: CHANNEL_ID, type: 0, name: "general" }],
      onCreateMessage: (body) => {
        assert.equal(body.content, "Hello");
        assert.equal(body.message_reference?.message_id, REPLY_ID);
        return { id: "400000000000000020", content: body.content };
      },
      onFetchMessage: (_channelId, messageId) => ({
        id: messageId,
        content: "Hello",
        author: { id: OTHER_USER },
      }),
    });
  });

  after(() => {
    restoreFetch();
  });

  it("lists viewable channels for an API key", async () => {
    const { GET } = await import(
      "../../app/api/v1/guilds/[guildId]/channels/route.js"
    );
    const response = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ guildId: MOCK_GUILD_ID }),
    });
    assert.ok(response);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { channels: { id: string }[] };
    assert.equal(body.channels[0]?.id, CHANNEL_ID);
  });

  it("sends a message with an API key audit actor", async () => {
    auditEntries.length = 0;
    const { POST } = await import(
      "../../app/api/v1/guilds/[guildId]/channels/[channelId]/messages/route.js"
    );
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Hello",
          replyToMessageId: REPLY_ID,
        }),
      }),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          channelId: CHANNEL_ID,
        }),
      },
    );
    assert.ok(response);
    assert.equal(response.status, 201);
    const audit = auditEntries.find((entry) => entry.action === "message.send");
    assert.ok(audit);
    assert.equal(audit!.source, "api");
    assert.equal(audit!.actorLabel, "Notifier");
    assert.equal(audit!.success, true);
  });

  it("reads recent messages without audit rows", async () => {
    auditEntries.length = 0;
    const { GET } = await import(
      "../../app/api/v1/guilds/[guildId]/channels/[channelId]/messages/route.js"
    );
    const response = await GET(
      new Request(`http://localhost/api?limit=10`),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          channelId: CHANNEL_ID,
        }),
      },
    );
    assert.ok(response);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { messages: unknown[] };
    assert.ok(body.messages.length > 0);
    assert.equal(auditEntries.length, 0);
  });

  it("deletes a message with an API key audit actor", async () => {
    auditEntries.length = 0;
    const { DELETE } = await import(
      "../../app/api/v1/guilds/[guildId]/channels/[channelId]/messages/[messageId]/route.js"
    );
    const response = await DELETE(new Request("http://localhost/api"), {
      params: Promise.resolve({
        guildId: MOCK_GUILD_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      }),
    });
    assert.ok(response);
    assert.equal(response.status, 200);
    const audit = auditEntries.find((entry) => entry.action === "message.delete");
    assert.ok(audit);
    assert.equal(audit!.source, "api");
    assert.equal(audit!.success, true);
  });

  it("adds and removes bot reactions with audit rows", async () => {
    auditEntries.length = 0;
    const emoji = encodeURIComponent("👍");
    const { PUT, DELETE } = await import(
      "../../app/api/v1/guilds/[guildId]/channels/[channelId]/messages/[messageId]/reactions/[emoji]/route.js"
    );
    const addResponse = await PUT(new Request("http://localhost/api"), {
      params: Promise.resolve({
        guildId: MOCK_GUILD_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        emoji,
      }),
    });
    assert.ok(addResponse);
    assert.equal(addResponse.status, 200);
    const addAudit = auditEntries.find(
      (entry) => entry.action === "message.reaction.add",
    );
    assert.ok(addAudit);
    assert.equal(addAudit!.success, true);

    const removeResponse = await DELETE(new Request("http://localhost/api"), {
      params: Promise.resolve({
        guildId: MOCK_GUILD_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        emoji,
      }),
    });
    assert.ok(removeResponse);
    assert.equal(removeResponse.status, 200);
    const removeAudit = auditEntries.find(
      (entry) => entry.action === "message.reaction.remove",
    );
    assert.ok(removeAudit);
    assert.equal(removeAudit!.success, true);
  });

  it("does not remove another user's reaction", async () => {
    auditEntries.length = 0;
    const emoji = encodeURIComponent("👍");
    const { DELETE } = await import(
      "../../app/api/v1/guilds/[guildId]/channels/[channelId]/messages/[messageId]/reactions/[emoji]/route.js"
    );
    const response = await DELETE(
      new Request(
        `http://localhost/api?userId=${OTHER_USER}`,
      ),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
          emoji,
        }),
      },
    );
    assert.ok(response);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { removed: boolean };
    assert.equal(body.removed, false);
    assert.equal(auditEntries.length, 0);
  });
});
