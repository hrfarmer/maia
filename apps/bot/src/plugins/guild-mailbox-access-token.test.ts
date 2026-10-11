import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { decryptWithAuthSecret, encryptWithAuthSecret } from "@maia/crypto";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/microsoft";
import type { RefreshGuildMailboxAccessTokenDeps } from "./guild-mailbox-access-token.js";

const storedRows = new Map<
  string,
  { guildId: string; pluginId: string; encryptedRefreshToken: string }
>();
const upsertCalls: Array<{
  guildId: string;
  pluginId: string;
  encryptedRefreshToken: string;
}> = [];

function testDeps(): RefreshGuildMailboxAccessTokenDeps {
  return {
    getGuildPluginOauthTokenRow: async (_db, guildId, pluginId) => {
      const row = storedRows.get(`${guildId}:${pluginId}`);
      return row
        ? { ...row, updatedAt: new Date("2026-01-01T00:00:00.000Z") }
        : null;
    },
    upsertGuildPluginOauthRefreshToken: async (_db, input) => {
      upsertCalls.push(input);
      storedRows.set(`${input.guildId}:${input.pluginId}`, input);
    },
  };
}

describe("guild mailbox access token refresh", () => {
  before(() => {
    process.env.AUTH_SECRET = "test-auth-secret-at-least-32-characters";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_TOKEN_URL = "https://fake.microsoft/token";
    storedRows.clear();
    upsertCalls.length = 0;
  });

  it("returns a short-lived access token from a fake Microsoft token endpoint", async () => {
    const { refreshGuildMailboxAccessToken } = await import(
      "./guild-mailbox-access-token.js"
    );
    storedRows.set("guild-a:spacelab-roster", {
      guildId: "guild-a",
      pluginId: SPACELAB_ROSTER_PLUGIN_ID,
      encryptedRefreshToken: encryptWithAuthSecret(
        "refresh-original",
        process.env.AUTH_SECRET,
      ),
    });
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), "https://fake.microsoft/token");
      const body = String(init?.body ?? "");
      assert.match(body, /grant_type=refresh_token/);
      assert.match(body, /refresh_token=refresh-original/);
      assert.match(body, /client_id=client-id/);
      assert.match(body, /client_secret=client-secret/);
      return new Response(
        JSON.stringify({
          access_token: "graph-access-token",
          expires_in: 3599,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const result = await refreshGuildMailboxAccessToken(
      {} as never,
      "guild-a",
      SPACELAB_ROSTER_PLUGIN_ID,
      fetchImpl as typeof fetch,
      testDeps(),
    );
    assert.equal(result.accessToken, "graph-access-token");
    assert.equal(result.expiresIn, 3599);
    assert.equal(upsertCalls.length, 0);
  });

  it("stores a rotated refresh token encrypted when Microsoft returns a new one", async () => {
    const { refreshGuildMailboxAccessToken } = await import(
      "./guild-mailbox-access-token.js"
    );
    storedRows.set("guild-b:spacelab-roster", {
      guildId: "guild-b",
      pluginId: SPACELAB_ROSTER_PLUGIN_ID,
      encryptedRefreshToken: encryptWithAuthSecret(
        "refresh-old",
        process.env.AUTH_SECRET,
      ),
    });
    upsertCalls.length = 0;
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh-new",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    await refreshGuildMailboxAccessToken(
      {} as never,
      "guild-b",
      SPACELAB_ROSTER_PLUGIN_ID,
      fetchImpl as typeof fetch,
      testDeps(),
    );
    assert.equal(upsertCalls.length, 1);
    assert.equal(
      decryptWithAuthSecret(
        upsertCalls[0]!.encryptedRefreshToken,
        process.env.AUTH_SECRET,
      ),
      "refresh-new",
    );
  });

  it("fails when the guild has no connected mailbox", async () => {
    const {
      refreshGuildMailboxAccessToken,
      MailboxNotConnectedError,
    } = await import("./guild-mailbox-access-token.js");
    await assert.rejects(
      () =>
        refreshGuildMailboxAccessToken(
          {} as never,
          "guild-missing",
          SPACELAB_ROSTER_PLUGIN_ID,
          fetch,
          testDeps(),
        ),
      MailboxNotConnectedError,
    );
  });

  it("surfaces Microsoft refresh failures without touching Discord", async () => {
    const {
      refreshGuildMailboxAccessToken,
      MailboxTokenRefreshError,
    } = await import("./guild-mailbox-access-token.js");
    storedRows.set("guild-c:spacelab-roster", {
      guildId: "guild-c",
      pluginId: SPACELAB_ROSTER_PLUGIN_ID,
      encryptedRefreshToken: encryptWithAuthSecret(
        "refresh-bad",
        process.env.AUTH_SECRET,
      ),
    });
    upsertCalls.length = 0;
    const fetchImpl = async () =>
      new Response("invalid_grant", { status: 400 });
    await assert.rejects(
      () =>
        refreshGuildMailboxAccessToken(
          {} as never,
          "guild-c",
          SPACELAB_ROSTER_PLUGIN_ID,
          fetchImpl as typeof fetch,
          testDeps(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof MailboxTokenRefreshError);
        assert.match(String(error.message), /Microsoft token refresh failed/);
        return true;
      },
    );
    assert.equal(upsertCalls.length, 0);
  });
});
