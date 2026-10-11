import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { buildAlwaysOnPluginProcessEnvironment } from "@maia/plugins";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../..",
);
const mainJs = path.join(
  repoRoot,
  "plugins",
  "spacelab-plugins",
  "main.js",
);

async function startFakeGraphServer() {
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ value: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function spawnSpacelabProcess(env: Record<string, string>) {
  return spawn(process.execPath, [mainJs], {
    env: { ...env, MAIA_SPACELAB_DISABLE_POLL: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function waitForProcessExit(
  child: ReturnType<typeof spawnSpacelabProcess>,
  signal: NodeJS.Signals = "SIGKILL",
) {
  const exit = new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });
  child.kill(signal);
  return exit;
}

describe("Space Lab roster always-on process", () => {
  it("uses only Maia plugin env vars and rejects inherited host secrets", async () => {
    const clean = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: "mplg_test",
      pluginUrl: "http://127.0.0.1:3847",
    });
    assert.deepEqual(Object.keys(clean).sort(), [
      "MAIA_PLUGIN_TOKEN",
      "MAIA_PLUGIN_URL",
    ]);

    const child = spawnSpacelabProcess({
      ...clean,
      DISCORD_TOKEN: "leaked",
    });
    const exitCode = await new Promise<number | null>((resolve) => {
      child.on("close", resolve);
    });
    assert.equal(exitCode, 1);
  });

  it("runs a reconcile pass after values_saved when roster state exists", async () => {
    const graph = await startFakeGraphServer();
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const enabledGuilds = new Set(["guild-1"]);
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {
        query: {
          guildPluginSettings: {
            findMany: async () => [{ guildId: "guild-1", enabled: true }],
          },
          spacelabGuildCycleState: { findFirst: async () => null },
          spacelabGuildRosterState: {
            findFirst: async () => ({
              rowsJson: JSON.stringify([
                {
                  discordHandle: "user.a",
                  status: "Active",
                  adaptRoleValues: ["Alpha"],
                },
              ]),
              adaptValuesJson: JSON.stringify(["Alpha"]),
              parsedAt: new Date(),
            }),
          },
          spacelabAdaptRoleLinks: {
            findMany: async () => [
              { adaptValue: "Alpha", discordRoleId: "role-alpha" },
            ],
          },
          spacelabRememberedMembers: { findMany: async () => [] },
          spacelabReconcileFailures: { findMany: async () => [] },
        },
        update: () => ({
          set: () => ({
            where: async () => undefined,
          }),
        }),
        delete: () => ({
          where: async () => undefined,
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async () => undefined,
          }),
        }),
      } as unknown as Db,
      assertGuildApiAccess: async (provided, guildId) => {
        const entry = registry.lookup(provided);
        if (!entry || entry.kind !== "always-on") {
          return null;
        }
        return enabledGuilds.has(guildId)
          ? { pluginId: entry.pluginId }
          : null;
      },
      loadGuildValues: async () => ({ ROSTER_COLUMN: "Subteam" }),
      mailboxHandlers: {
        refreshGuildMailboxAccessToken: async () => ({
          accessToken: "graph-token",
          expiresIn: 3600,
        }),
      },
      moderationHandlers: {
        listRolesForGuild: async () => [
          { id: "role-alpha", name: "Alpha", color: 0, managed: false, position: 1 },
        ],
        moderationCreateRole: async () => ({ ok: true, role: { id: "x", name: "x", color: 0, managed: false, position: 0, hoist: false, mentionable: false } }),
        moderationUpdateRole: async () => ({ ok: true, role: { id: "x", name: "x", color: 0, managed: false, position: 0 } }),
        moderationDeleteRole: async () => ({ ok: true }),
        searchGuildMembersForModeration: async (_guildId, query) =>
          query === "user.a"
            ? [{ user: { id: "uid-a", username: "user.a" }, roles: [] }]
            : [],
        getMemberRoleIds: async () => [],
        moderationSetRoles: async () => {
          throw new Error("replace-all roles must not be called");
        },
        moderationAddRole: async () => ({ ok: true, noop: false }),
        moderationRemoveRole: async () => ({ ok: true, noop: false }),
        moderationKick: async () => ({ ok: true }),
        moderationBan: async () => ({ ok: true }),
        moderationUnban: async () => ({ ok: true }),
        moderationTimeout: async () => ({ ok: true, until: new Date().toISOString() }),
        moderationUntimeout: async () => ({ ok: true, noop: false }),
        moderationNickname: async () => ({ ok: true }),
      },
    });
    await api.listen();

    const env = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: token,
      pluginUrl: api.url(),
    });
    env.MAIA_GRAPH_BASE_URL = graph.baseUrl;
    const child = spawnSpacelabProcess(env);

    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stdin.write('{"guildId":"guild-1","change":"values_saved"}\n');

    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitForProcessExit(child);

    assert.match(stdout, /"cycle":\{"ok":/);
    await api.close();
    await graph.close();
  });

  it("reads ROSTER_COLUMN from the localhost values API after values_saved", async () => {
    const graph = await startFakeGraphServer();
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const enabledGuilds = new Set(["guild-1"]);
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {
        query: {
          guildPluginSettings: { findMany: async () => [] },
          spacelabGuildCycleState: { findFirst: async () => null },
          spacelabGuildRosterState: { findFirst: async () => null },
        },
      } as unknown as Db,
      assertGuildApiAccess: async (provided, guildId) => {
        const entry = registry.lookup(provided);
        if (!entry || entry.kind !== "always-on") {
          return null;
        }
        return enabledGuilds.has(guildId)
          ? { pluginId: entry.pluginId }
          : null;
      },
      loadGuildValues: async () => ({ ROSTER_COLUMN: "DiscordRoleColumn" }),
      mailboxHandlers: {
        refreshGuildMailboxAccessToken: async () => ({
          accessToken: "graph-token",
          expiresIn: 3600,
        }),
      },
    });
    await api.listen();

    const env = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: token,
      pluginUrl: api.url(),
    });
    env.MAIA_GRAPH_BASE_URL = graph.baseUrl;
    const child = spawnSpacelabProcess(env);

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stdin.write('{"guildId":"guild-1","change":"values_saved"}\n');

    await new Promise((resolve) => setTimeout(resolve, 200));
    await waitForProcessExit(child);

    assert.match(stdout, /"cycle":\{"ok":/);
    await api.close();
    await graph.close();
  });
});
