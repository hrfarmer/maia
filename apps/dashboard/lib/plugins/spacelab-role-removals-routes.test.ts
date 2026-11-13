import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import {
  installDiscordFetchMock,
  MOCK_GUILD_ID,
  MOCK_MEMBER_ID,
  MOCK_ROLE_ID,
  managerPermissions,
} from "../moderation/discord-fetch-mock.js";

interface Flag {
  discordUserId: string;
  discordHandle: string;
  roleIds: string[];
  flaggedAt: Date;
}

let flags: Flag[] = [];
const completed: Array<{ userId: string; roleIds: string[] }> = [];
const ignored: Array<{ userId: string; duration: string }> = [];
const audits: Array<{ action: string; success: boolean }> = [];

mock.module("@/lib/api/http", {
  namedExports: {
    jsonError: (message: string, status: number) =>
      Response.json({ error: message }, { status }),
    handleModerationError: (error: unknown) =>
      Response.json(
        { error: error instanceof Error ? error.message : "Unexpected error" },
        { status: 500 },
      ),
  },
});

mock.module("@maia/db", {
  namedExports: {
    getDb: () => ({}),
    recordAuditLog: async (
      _db: unknown,
      entry: { action: string; success: boolean },
    ) => {
      audits.push(entry);
    },
    getSpacelabRoleRemovalFlag: async (
      _db: unknown,
      _guildId: string,
      userId: string,
    ) => flags.find((flag) => flag.discordUserId === userId) ?? null,
    listSpacelabRoleRemovalFlags: async () => flags,
    completeSpacelabRoleRemoval: async (
      _db: unknown,
      _guildId: string,
      userId: string,
      roleIds: string[],
    ) => {
      completed.push({ userId, roleIds });
      flags = flags.filter((flag) => flag.discordUserId !== userId);
    },
    ignoreSpacelabRoleRemoval: async (
      _db: unknown,
      _guildId: string,
      flag: { discordUserId: string },
      duration: string,
    ) => {
      ignored.push({ userId: flag.discordUserId, duration });
      flags = flags.filter((item) => item.discordUserId !== flag.discordUserId);
    },
  },
});

mock.module("@/lib/session-auth", {
  namedExports: {
    requireSessionGuildAccess: async () => ({
      session: { accessToken: "token", user: { id: "1", name: "Manager" } },
      actor: { source: "dashboard" as const, id: "1", label: "Manager" },
    }),
  },
});

mock.module("@/lib/guild-access", {
  namedExports: {
    getUserPermissionsInGuild: async () => managerPermissions(),
    requireUserPermission: () => undefined,
    AccessDeniedError: class AccessDeniedError extends Error {},
    canManageServer: () => true,
  },
});

const memberRolePath = `/guilds/${MOCK_GUILD_ID}/members/${MOCK_MEMBER_ID}/roles/`;

describe("spacelab role removal decision route", () => {
  let restoreFetch: () => void;
  const deletes: string[] = [];

  before(() => {
    process.env.DISCORD_TOKEN = "test-bot-token";
    delete process.env.MAIA_ENABLE_DEV_HELPERS;
    const restoreDiscord = installDiscordFetchMock();
    const discordFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (init?.method === "DELETE" && url.includes(memberRolePath)) {
        deletes.push(url.split(memberRolePath)[1]!);
      }
      return discordFetch(input, init);
    };
    restoreFetch = () => {
      restoreDiscord();
    };
  });

  after(() => {
    restoreFetch();
  });

  beforeEach(async () => {
    deletes.length = 0;
    completed.length = 0;
    ignored.length = 0;
    audits.length = 0;
    flags = [
      {
        discordUserId: MOCK_MEMBER_ID,
        discordHandle: "target",
        roleIds: [MOCK_ROLE_ID, "999999999999999999"],
        flaggedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    await fetch(
      `https://discord.com/api/v10${memberRolePath}${MOCK_ROLE_ID}`,
      { method: "PUT" },
    );
  });

  async function decide(body: unknown) {
    const { POST } = await import(
      "../../app/api/servers/[guildId]/plugins/spacelab-roster/role-removals/[userId]/route.js"
    );
    return POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          userId: MOCK_MEMBER_ID,
        }),
      },
    );
  }

  it("confirm removes the flagged roles from the member in Discord", async () => {
    const response = await decide({ action: "confirm" });
    assert.equal(response.status, 200);
    assert.deepEqual(deletes, [MOCK_ROLE_ID]);
    assert.deepEqual(completed, [
      { userId: MOCK_MEMBER_ID, roleIds: [MOCK_ROLE_ID, "999999999999999999"] },
    ]);
    assert.deepEqual(
      audits.map((entry) => [entry.action, entry.success]),
      [["role.remove", true]],
    );
    const view = (await response.json()) as { flags: unknown[] };
    assert.equal(view.flags.length, 0);
  });

  it("ignore keeps the roles and records the ignore duration", async () => {
    const response = await decide({ action: "ignore", duration: "week" });
    assert.equal(response.status, 200);
    assert.deepEqual(deletes, []);
    assert.deepEqual(completed, []);
    assert.deepEqual(ignored, [{ userId: MOCK_MEMBER_ID, duration: "week" }]);
  });

  it("returns 404 when the member is not flagged", async () => {
    flags = [];
    const response = await decide({ action: "confirm" });
    assert.equal(response.status, 404);
    assert.deepEqual(deletes, []);
  });
});
