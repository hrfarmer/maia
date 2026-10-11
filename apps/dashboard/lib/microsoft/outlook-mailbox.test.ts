import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { decryptWithAuthSecret } from "@maia/crypto";

const capturedTokens: Array<{
  guildId: string;
  pluginId: string;
  encryptedRefreshToken: string;
}> = [];

mock.module("@maia/db", {
  namedExports: {
    upsertGuildPluginOauthRefreshToken: async (
      _db: unknown,
      input: {
        guildId: string;
        pluginId: string;
        encryptedRefreshToken: string;
      },
    ) => {
      capturedTokens.push(input);
    },
    deleteGuildPluginOauthToken: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
    ) => {
      capturedTokens.push({
        guildId,
        pluginId,
        encryptedRefreshToken: "__deleted__",
      });
      return true;
    },
  },
});

describe("Outlook mailbox storage", () => {
  before(() => {
    process.env.AUTH_SECRET = "test-auth-secret-at-least-32-characters";
    process.env.MICROSOFT_CLIENT_ID = "client";
    process.env.MICROSOFT_CLIENT_SECRET = "secret";
    process.env.AUTH_URL = "https://maia.aychar.dev";
    capturedTokens.length = 0;
  });

  it("stores refresh token encrypted with AUTH_SECRET, scoped to spacelab-roster", async () => {
    const { storeOutlookRefreshTokenForGuild } = await import(
      "./outlook-mailbox.js"
    );
    capturedTokens.length = 0;
    await storeOutlookRefreshTokenForGuild({} as never, "guild-a", "refresh-plain");
    assert.equal(capturedTokens.length, 1);
    assert.equal(capturedTokens[0]?.pluginId, "spacelab-roster");
    assert.notEqual(capturedTokens[0]?.encryptedRefreshToken, "refresh-plain");
    assert.equal(
      decryptWithAuthSecret(
        capturedTokens[0]!.encryptedRefreshToken,
        process.env.AUTH_SECRET,
      ),
      "refresh-plain",
    );
  });

  it("exchanges authorization code via fake Microsoft token endpoint", async () => {
    const { completeOutlookOAuthCallback } = await import(
      "./outlook-mailbox.js"
    );
    process.env.MICROSOFT_TOKEN_URL = "https://fake.microsoft/token";
    capturedTokens.length = 0;
    const fetchImpl = async (input: RequestInfo | URL) => {
      assert.equal(String(input), "https://fake.microsoft/token");
      return new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh-from-microsoft",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    await completeOutlookOAuthCallback(
      {} as never,
      "guild-b",
      "auth-code",
      fetchImpl as typeof fetch,
    );
    assert.equal(capturedTokens[0]?.guildId, "guild-b");
    assert.equal(
      decryptWithAuthSecret(
        capturedTokens[0]!.encryptedRefreshToken,
        process.env.AUTH_SECRET,
      ),
      "refresh-from-microsoft",
    );
  });

  it("disconnect removes the guild plugin oauth token", async () => {
    const { disconnectOutlookMailbox } = await import("./outlook-mailbox.js");
    capturedTokens.length = 0;
    await disconnectOutlookMailbox({} as never, "guild-c");
    assert.equal(capturedTokens[0]?.guildId, "guild-c");
    assert.equal(capturedTokens[0]?.pluginId, "spacelab-roster");
  });
});
