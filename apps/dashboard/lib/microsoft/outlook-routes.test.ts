import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { createMicrosoftOAuthState } from "@maia/microsoft";
import {
  installDiscordFetchMock,
  MOCK_GUILD_ID,
  managerPermissions,
} from "../moderation/discord-fetch-mock.js";

const OTHER_GUILD_ID = "800000000000000099";
const MANAGER_ID = "800000000000000008";

const oauthRows = new Map<string, string>();
const envValues = new Map<string, Map<string, string>>();

function tokenKey(guildId: string, pluginId: string) {
  return `${guildId}:${pluginId}`;
}

mock.module("@/lib/api/http", {
  namedExports: {
    jsonError: (message: string, status: number) =>
      Response.json({ error: message }, { status }),
  },
});

mock.module("@/lib/session-auth", {
  namedExports: {
    requireSessionGuildAccess: async (guildId: string) => ({
      session: {
        accessToken: "test-access-token",
        user: { id: MANAGER_ID, name: "Manager" },
      },
      actor: {
        source: "dashboard" as const,
        id: MANAGER_ID,
        label: "Manager",
      },
      guildId,
    }),
  },
});

mock.module("@/auth", {
  namedExports: {
    auth: async () => ({
      accessToken: "test-access-token",
      user: { id: MANAGER_ID, name: "Manager" },
    }),
  },
});

mock.module("@/lib/guild-access", {
  namedExports: {
    getUserPermissionsInGuild: async (_token: string, guildId: string) =>
      guildId === OTHER_GUILD_ID ? 0n : managerPermissions(),
    requireUserPermission: () => undefined,
    AccessDeniedError: class AccessDeniedError extends Error {},
    canManageServer: () => true,
  },
});

mock.module("@maia/db", {
  namedExports: {
    getDb: () => ({}),
    upsertGuildPluginOauthRefreshToken: async (
      _db: unknown,
      input: {
        guildId: string;
        pluginId: string;
        encryptedRefreshToken: string;
      },
    ) => {
      oauthRows.set(
        tokenKey(input.guildId, input.pluginId),
        input.encryptedRefreshToken,
      );
    },
    deleteGuildPluginOauthToken: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
    ) => oauthRows.delete(tokenKey(guildId, pluginId)),
    guildPluginOauthTokenConnected: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
    ) => oauthRows.has(tokenKey(guildId, pluginId)),
    getLatestPluginScan: async () => ({
      plugins: [
        {
          id: "p1",
          directoryName: "spacelab-plugins",
          status: "ok" as const,
          pluginId: "spacelab-roster",
          displayName: "Space Lab roster",
          lifetime: "always-on",
          subscribedEvents: [],
          errorMessage: null,
          environment: [{ key: "ROSTER_COLUMN", required: true, secret: false }],
          slashCommands: [],
        },
        {
          id: "p2",
          directoryName: "role-sync",
          status: "ok" as const,
          pluginId: "role-sync",
          displayName: "Role sync",
          lifetime: "invocation",
          subscribedEvents: [],
          errorMessage: null,
          environment: [],
          slashCommands: [],
        },
      ],
    }),
    listGuildPluginSettingsForGuild: async () => [],
    listGuildPluginEnvValuesForGuild: async (_db: unknown, guildId: string) => {
      const map = envValues.get(guildId);
      if (!map) {
        return [];
      }
      return [...map.entries()].map(([envKey, value]) => ({
        guildId,
        pluginId: "spacelab-roster",
        envKey,
        value,
      }));
    },
  },
});

describe("Outlook mailbox routes (#38)", () => {
  let restoreFetch: () => void;
  let originalFetch: typeof fetch;

  before(() => {
    process.env.AUTH_SECRET = "test-auth-secret-at-least-32-characters";
    process.env.MICROSOFT_CLIENT_ID = "microsoft-client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "microsoft-client-secret";
    process.env.AUTH_URL = "https://maia.aychar.dev";
    process.env.MICROSOFT_TOKEN_URL = "https://fake.microsoft/token";
    oauthRows.clear();
    envValues.clear();
    envValues.set(MOCK_GUILD_ID, new Map([["ROSTER_COLUMN", "Role"]]));
    restoreFetch = installDiscordFetchMock();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://fake.microsoft/token") {
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-for-guild",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;
  });

  after(() => {
    restoreFetch();
    globalThis.fetch = originalFetch;
  });

  it("Connect redirects to Microsoft consumers authorize with Mail.ReadWrite and offline_access", async () => {
    const { GET } = await import(
      "../../app/api/servers/[guildId]/plugins/spacelab-roster/microsoft/connect/route.js"
    );
    const response = await GET(new Request("http://localhost/connect"), {
      params: Promise.resolve({ guildId: MOCK_GUILD_ID }),
    });
    assert.ok(response);
    assert.equal(response.status, 302);
    const location = response.headers.get("location");
    assert.ok(location);
    const url = new URL(location!);
    assert.match(url.pathname, /\/consumers\/oauth2\/v2\.0\/authorize$/);
    assert.equal(url.searchParams.get("scope"), "Mail.ReadWrite offline_access");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://maia.aychar.dev/api/oauth/microsoft/callback",
    );
  });

  it("callback stores encrypted refresh token for the guild and spacelab-roster only", async () => {
    const state = createMicrosoftOAuthState(
      { guildId: MOCK_GUILD_ID, pluginId: "spacelab-roster" },
      process.env.AUTH_SECRET!,
    );
    const { GET } = await import(
      "../../app/api/oauth/microsoft/callback/route.js"
    );
    const response = await GET(
      new Request(
        `https://maia.aychar.dev/api/oauth/microsoft/callback?code=abc&state=${encodeURIComponent(state)}`,
      ),
    );
    assert.ok(response);
    assert.equal(response.status, 302);
    assert.ok(oauthRows.has(tokenKey(MOCK_GUILD_ID, "spacelab-roster")));
    const stored = oauthRows.get(tokenKey(MOCK_GUILD_ID, "spacelab-roster"));
    assert.ok(stored);
    assert.doesNotMatch(stored!, /refresh-for-guild/);
    for (const value of envValues.get(MOCK_GUILD_ID)?.values() ?? []) {
      assert.doesNotMatch(value, /refresh-for-guild/);
    }
  });

  it("one guild connection is not visible to another guild", async () => {
    oauthRows.set(
      tokenKey(MOCK_GUILD_ID, "spacelab-roster"),
      "encrypted-guild-a",
    );
    const { getGuildPluginsView } = await import("../plugins/service.js");
    const viewA = await getGuildPluginsView({} as never, MOCK_GUILD_ID);
    const viewB = await getGuildPluginsView({} as never, OTHER_GUILD_ID);
    const spaceLabA = viewA.plugins.find((p) => p.pluginId === "spacelab-roster");
    const spaceLabB = viewB.plugins.find((p) => p.pluginId === "spacelab-roster");
    assert.equal(spaceLabA?.outlookMailboxConnected, true);
    assert.equal(spaceLabB?.outlookMailboxConnected, false);
    const roleSync = viewA.plugins.find((p) => p.pluginId === "role-sync");
    assert.equal(roleSync?.showOutlookMailboxControl, false);
  });

  it("spacelab-roster can enable with ROSTER_COLUMN and no mailbox connected", async () => {
    oauthRows.clear();
    const { getGuildPluginsView } = await import("../plugins/service.js");
    const view = await getGuildPluginsView({} as never, MOCK_GUILD_ID);
    const spaceLab = view.plugins.find((p) => p.pluginId === "spacelab-roster");
    assert.equal(spaceLab?.canEnable, true);
    assert.equal(spaceLab?.outlookMailboxConnected, false);
    assert.equal(spaceLab?.showOutlookMailboxControl, true);
  });

  it("Disconnect deletes the stored token", async () => {
    oauthRows.set(tokenKey(MOCK_GUILD_ID, "spacelab-roster"), "token");
    const { DELETE } = await import(
      "../../app/api/servers/[guildId]/plugins/spacelab-roster/microsoft/route.js"
    );
    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ guildId: MOCK_GUILD_ID }),
    });
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(oauthRows.has(tokenKey(MOCK_GUILD_ID, "spacelab-roster")), false);
  });

  it("Disconnect does not call Discord (no role changes)", async () => {
    oauthRows.set(tokenKey(MOCK_GUILD_ID, "spacelab-roster"), "token");
    let discordCalls = 0;
    const priorFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("discord.com")) {
        discordCalls += 1;
      }
      return priorFetch(input, init);
    }) as typeof fetch;
    try {
      const { DELETE } = await import(
        "../../app/api/servers/[guildId]/plugins/spacelab-roster/microsoft/route.js"
      );
      await DELETE(new Request("http://localhost"), {
        params: Promise.resolve({ guildId: MOCK_GUILD_ID }),
      });
    } finally {
      globalThis.fetch = priorFetch;
    }
    assert.equal(discordCalls, 0);
  });

  it("does not expose refresh token in plugin environment fields", async () => {
    oauthRows.set(
      tokenKey(MOCK_GUILD_ID, "spacelab-roster"),
      "v1:encrypted.refresh.token",
    );
    envValues.set(
      MOCK_GUILD_ID,
      new Map([["ROSTER_COLUMN", "Role"]]),
    );
    const { getGuildPluginsView } = await import("../plugins/service.js");
    const view = await getGuildPluginsView({} as never, MOCK_GUILD_ID);
    const spaceLab = view.plugins.find((p) => p.pluginId === "spacelab-roster");
    assert.ok(spaceLab);
    assert.deepEqual(
      spaceLab!.environment.map((field) => field.key),
      ["ROSTER_COLUMN"],
    );
    for (const field of spaceLab!.environment) {
      assert.notEqual(field.value, "v1:encrypted.refresh.token");
      assert.equal(field.hasSecretValue, false);
    }
  });
});
