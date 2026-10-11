import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { SYNTHETIC_LAB_ROSTER_EXPORT } from "@maia/plugins";
import type { SupervisedPluginProcessHandle } from "@maia/plugins";
import { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import { createPluginApiServer } from "./plugin-api-server.js";
import { resolvePluginTokenForGuild } from "./plugin-api-access.js";
import { PluginTokenRegistry } from "./token-registry.js";
import { demoAlwaysOnPlugin } from "./test-helpers/always-on-plugin.js";

function mockImmediateExitHandle(): SupervisedPluginProcessHandle {
  let exitResult:
    | Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>
    | undefined;
  let releaseExit: (() => void) | undefined;
  return {
    writeStdin() {},
    kill() {
      releaseExit?.();
    },
    waitForExit: () => {
      if (!exitResult) {
        exitResult = new Promise((resolve) => {
          releaseExit = () => resolve({ exitCode: 0, signal: "SIGTERM" });
        });
      }
      return exitResult;
    },
  };
}

function mockSlowExitHandle(): SupervisedPluginProcessHandle & {
  releaseExit: () => void;
} {
  let releaseExit: () => void = () => {};
  const exitPromise = new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    releaseExit = () => resolve({ exitCode: 0, signal: "SIGTERM" });
  });
  return {
    writeStdin() {},
    kill() {},
    waitForExit: () => exitPromise,
    releaseExit: () => releaseExit(),
  };
}

function mockDbForSpacelabCycle(guildId: string, enabled: boolean): Db {
  let rosterStored = false;
  return {
    query: {
      guildPluginSettings: {
        findFirst: async () => ({ enabled }),
        findMany: async () =>
          enabled ? [{ guildId, enabled: true }] : [],
      },
      guildPluginEnvValues: {
        findMany: async () => [{ envKey: "ROSTER_COLUMN", value: "Subteam" }],
      },
      spacelabGuildCycleState: { findFirst: async () => null },
      spacelabGuildRosterState: {
        findFirst: async () =>
          rosterStored
            ? {
                rowsJson: JSON.stringify([]),
                adaptValuesJson: JSON.stringify([]),
                parsedAt: new Date(),
              }
            : null,
      },
      spacelabAdaptRoleLinks: { findMany: async () => [] },
      spacelabRememberedMembers: { findMany: async () => [] },
      spacelabReconcileFailures: { findMany: async () => [] },
    },
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => {
          rosterStored = true;
        },
      }),
    }),
    delete: () => ({
      where: async () => undefined,
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  } as unknown as Db;
}

describe("always-on plugin token through spacelab cycle", () => {
  it("keeps the process token valid through ingest during overlapping supervisor syncs", async () => {
    const registry = new PluginTokenRegistry();
    const guildId = "1542985650251374672";
    const db = mockDbForSpacelabCycle(guildId, true);
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db,
      assertGuildApiAccess: async (token, requestedGuildId) => {
        const entry = await resolvePluginTokenForGuild(
          db,
          registry,
          token,
          requestedGuildId,
        );
        return entry ? { pluginId: entry.pluginId } : null;
      },
    });
    await api.listen();

    let firstHandle:
      | (SupervisedPluginProcessHandle & { releaseExit: () => void })
      | undefined;
    let spawnCount = 0;
    const tokensFromSpawn: string[] = [];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: registry,
      pluginApiUrl: api.url(),
      listAlwaysOnPlugins: async () => [demoAlwaysOnPlugin()],
      spawnSupervised: (input) => {
        tokensFromSpawn.push(input.env.MAIA_PLUGIN_TOKEN);
        spawnCount += 1;
        if (spawnCount === 1) {
          firstHandle = mockSlowExitHandle();
          return firstHandle;
        }
        return mockImmediateExitHandle();
      },
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    const cycleToken = tokensFromSpawn[0];
    assert.ok(cycleToken);

    try {
      const overlappingSync = Promise.all([
        supervisor.syncFromLatestScan({ restartExisting: true }),
        supervisor.syncFromLatestScan({ restartExisting: true }),
      ]);

      const [cycleResponse, ingestResponse] = await Promise.all([
        fetch(
          `${api.url()}/v1/guilds/${guildId}/spacelab-roster/cycle-state`,
          { headers: { Authorization: `Bearer ${cycleToken}` } },
        ),
        fetch(
          `${api.url()}/v1/guilds/${guildId}/spacelab-roster/ingest-message`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cycleToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ messageBody: SYNTHETIC_LAB_ROSTER_EXPORT }),
          },
        ),
      ]);

      assert.equal(cycleResponse.status, 200);
      assert.equal(
        ingestResponse.status,
        200,
        "ingest must stay authorized until the supervised process exits",
      );

      firstHandle?.releaseExit();
      await overlappingSync;
    } finally {
      firstHandle?.releaseExit();
      await supervisor.shutdown();
      await api.close();
    }
  });
});
