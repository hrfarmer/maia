import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import {
  installDiscordFetchMock,
  MOCK_GUILD_ID,
  MOCK_MEMBER_ID,
  MOCK_ROLE_ID,
  managerPermissions,
} from "./discord-fetch-mock.js";

const MANAGER_ID = "800000000000000008";
const MANAGER_NAME = "Dashboard Manager";

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
    jsonError: (message: string, status: number) =>
      Response.json({ error: message }, { status }),
    handleModerationError: (error: unknown) => {
      if (
        error instanceof Error &&
        error.name === "ModerationError"
      ) {
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

mock.module("@/lib/session-auth", {
  namedExports: {
    requireSessionGuildAccess: async () => ({
      session: {
        accessToken: "test-access-token",
        user: { id: MANAGER_ID, name: MANAGER_NAME },
      },
      actor: {
        source: "dashboard" as const,
        id: MANAGER_ID,
        label: MANAGER_NAME,
      },
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

describe("dashboard moderation API routes", () => {
  let restoreFetch: () => void;

  before(() => {
    process.env.DISCORD_TOKEN = "test-bot-token";
    delete process.env.MAIA_ENABLE_DEV_HELPERS;
    restoreFetch = installDiscordFetchMock();
  });

  after(() => {
    restoreFetch();
  });

  it("creates a role with a dashboard audit actor", async () => {
    auditEntries.length = 0;
    const { POST } = await import(
      "../../app/api/servers/[guildId]/roles/route.js"
    );
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Helper" }),
      }),
      { params: Promise.resolve({ guildId: MOCK_GUILD_ID }) },
    );
    assert.ok(response);
    assert.equal(response.status, 201);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
    const audit = auditEntries.find((entry) => entry.action === "role.create");
    assert.ok(audit);
    assert.equal(audit!.source, "dashboard");
    assert.equal(audit!.actorId, MANAGER_ID);
    assert.equal(audit!.actorLabel, MANAGER_NAME);
    assert.equal(audit!.success, true);
  });

  it("adds and removes a member role with a dashboard audit actor", async () => {
    auditEntries.length = 0;
    const { POST } = await import(
      "../../app/api/servers/[guildId]/members/[userId]/roles/route.js"
    );

    const addResponse = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", roleId: MOCK_ROLE_ID }),
      }),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          userId: MOCK_MEMBER_ID,
        }),
      },
    );
    assert.ok(addResponse);
    assert.equal(addResponse.status, 200);
    const addAudit = auditEntries.find((entry) => entry.action === "role.add");
    assert.ok(addAudit);
    assert.equal(addAudit!.source, "dashboard");
    assert.equal(addAudit!.actorId, MANAGER_ID);

    const removeResponse = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", roleId: MOCK_ROLE_ID }),
      }),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          userId: MOCK_MEMBER_ID,
        }),
      },
    );
    assert.ok(removeResponse);
    assert.equal(removeResponse.status, 200);
    const removeAudit = auditEntries.find(
      (entry) => entry.action === "role.remove",
    );
    assert.ok(removeAudit);
    assert.equal(removeAudit!.source, "dashboard");
    assert.equal(removeAudit!.actorId, MANAGER_ID);
  });

  it("updates a role through @maia/moderation with a dashboard audit actor", async () => {
    auditEntries.length = 0;
    const { moderationUpdateRole } = await import("@maia/moderation");
    const result = await moderationUpdateRole(
      MOCK_GUILD_ID,
      MOCK_ROLE_ID,
      { name: "Renamed" },
      {
        source: "dashboard",
        id: MANAGER_ID,
        label: MANAGER_NAME,
      },
    );
    assert.equal(result.ok, true);
    const audit = auditEntries.find((entry) => entry.action === "role.update");
    assert.ok(audit);
    assert.equal(audit!.source, "dashboard");
    assert.equal(audit!.actorId, MANAGER_ID);
  });

  it("kicks a member through the dashboard actions route", async () => {
    auditEntries.length = 0;
    const { POST } = await import(
      "../../app/api/servers/[guildId]/members/[userId]/actions/route.js"
    );
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", reason: "test" }),
      }),
      {
        params: Promise.resolve({
          guildId: MOCK_GUILD_ID,
          userId: MOCK_MEMBER_ID,
        }),
      },
    );
    assert.ok(response);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
    const audit = auditEntries.find((entry) => entry.action === "member.kick");
    assert.ok(audit);
    assert.equal(audit!.source, "dashboard");
    assert.equal(audit!.actorId, MANAGER_ID);
    assert.equal(audit!.success, true);
  });
});
