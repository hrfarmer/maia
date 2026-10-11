import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { SYNTHETIC_LAB_ROSTER_EXPORT } from "@maia/plugins";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

function mockUpsertChain(onValues: (row: Record<string, unknown>) => void) {
  return () => ({
    values: () => ({
      onConflictDoUpdate: async () => {
        onValues({});
      },
    }),
  });
}

describe("plugin spacelab cycle API", () => {
  it("reads and writes cycle state for an enabled guild", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    let storedRow: Record<string, unknown> | null = null;
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {
        query: {
          spacelabGuildCycleState: {
            findFirst: async () => storedRow,
          },
        },
        insert: () => ({
          values: (row: Record<string, unknown>) => ({
            onConflictDoUpdate: async () => {
              storedRow = row;
            },
          }),
        }),
      } as unknown as Db,
      assertGuildApiAccess: async () => ({ pluginId: "spacelab-roster" }),
    });
    await api.listen();

    const put = await fetch(
      `${api.url()}/v1/guilds/guild-1/spacelab-roster/cycle-state`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lastError: "archive_move_failed",
          pendingArchiveMessageIds: ["msg-1"],
        }),
      },
    );
    assert.equal(put.status, 200);

    const get = await fetch(
      `${api.url()}/v1/guilds/guild-1/spacelab-roster/cycle-state`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(get.status, 200);
    const body = (await get.json()) as {
      lastError?: string;
      pendingArchiveMessageIds?: string[];
    };
    assert.equal(body.lastError, "archive_move_failed");
    assert.deepEqual(body.pendingArchiveMessageIds, ["msg-1"]);

    await api.close();
  });

  it("ingests a roster message body for the plugin process", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    let ingested = false;
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {
        query: {
          guildPluginEnvValues: {
            findMany: async () => [{ envKey: "ROSTER_COLUMN", value: "Subteam" }],
          },
          spacelabGuildRosterState: { findFirst: async () => null },
          spacelabReconcileFailures: { findMany: async () => [] },
        },
        insert: mockUpsertChain(() => {
          ingested = true;
        }),
        delete: () => ({
          where: async () => undefined,
        }),
      } as unknown as Db,
      assertGuildApiAccess: async () => ({ pluginId: "spacelab-roster" }),
    });
    await api.listen();

    const response = await fetch(
      `${api.url()}/v1/guilds/guild-1/spacelab-roster/ingest-message`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageBody: SYNTHETIC_LAB_ROSTER_EXPORT }),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(ingested, true);

    await api.close();
  });
});
