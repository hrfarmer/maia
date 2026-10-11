import { and, desc, eq, isNull, notInArray } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  guildPluginEnvValues,
  guildPluginSettings,
  pluginRunRequests,
  pluginScans,
} from "./schema.js";

export interface StoredPluginEnvironmentKey {
  key: string;
  required: boolean;
  secret: boolean;
}

export interface LatestRunnablePlugin {
  pluginId: string;
  directoryName: string;
  lifetime: string;
  command: string[];
  environment: StoredPluginEnvironmentKey[];
  invocationTimeLimitMs: number | null;
}

function parseJsonArray<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getLatestOkPluginsByPluginId(
  db: Db,
): Promise<Map<string, LatestRunnablePlugin>> {
  const scan = await db.query.pluginScans.findFirst({
    orderBy: [desc(pluginScans.completedAt), desc(pluginScans.startedAt)],
    with: { discoveredPlugins: true },
  });
  if (!scan) {
    return new Map();
  }

  const map = new Map<string, LatestRunnablePlugin>();
  for (const row of scan.discoveredPlugins) {
    if (row.status !== "ok" || !row.pluginId) {
      continue;
    }
    map.set(row.pluginId, {
      pluginId: row.pluginId,
      directoryName: row.directoryName,
      lifetime: row.lifetime ?? "invocation",
      command: parseJsonArray<string[]>(row.commandJson, []),
      environment: parseJsonArray<StoredPluginEnvironmentKey[]>(
        row.environmentJson,
        [],
      ),
      invocationTimeLimitMs: row.invocationTimeLimitMs,
    });
  }
  return map;
}

export async function pruneGuildPluginConfigForRemovedPlugins(
  db: Db,
  activePluginIds: string[],
) {
  if (activePluginIds.length === 0) {
    await db.delete(guildPluginSettings);
    await db.delete(guildPluginEnvValues);
    await db.delete(pluginRunRequests);
    return;
  }

  await db
    .delete(guildPluginSettings)
    .where(notInArray(guildPluginSettings.pluginId, activePluginIds));
  await db
    .delete(guildPluginEnvValues)
    .where(notInArray(guildPluginEnvValues.pluginId, activePluginIds));
  await db
    .delete(pluginRunRequests)
    .where(notInArray(pluginRunRequests.pluginId, activePluginIds));
}

export async function getGuildPluginSettings(
  db: Db,
  guildId: string,
  pluginId: string,
) {
  return db.query.guildPluginSettings.findFirst({
    where: and(
      eq(guildPluginSettings.guildId, guildId),
      eq(guildPluginSettings.pluginId, pluginId),
    ),
  });
}

export async function listGuildPluginEnvValues(
  db: Db,
  guildId: string,
  pluginId: string,
) {
  return db.query.guildPluginEnvValues.findMany({
    where: and(
      eq(guildPluginEnvValues.guildId, guildId),
      eq(guildPluginEnvValues.pluginId, pluginId),
    ),
  });
}

export async function listGuildPluginEnvValuesForGuild(
  db: Db,
  guildId: string,
) {
  return db.query.guildPluginEnvValues.findMany({
    where: eq(guildPluginEnvValues.guildId, guildId),
  });
}

export async function listGuildPluginSettingsForGuild(db: Db, guildId: string) {
  return db.query.guildPluginSettings.findMany({
    where: eq(guildPluginSettings.guildId, guildId),
  });
}

export async function upsertGuildPluginEnvValue(
  db: Db,
  input: {
    guildId: string;
    pluginId: string;
    envKey: string;
    value: string;
  },
) {
  await db
    .insert(guildPluginEnvValues)
    .values({
      guildId: input.guildId,
      pluginId: input.pluginId,
      envKey: input.envKey,
      value: input.value,
    })
    .onConflictDoUpdate({
      target: [
        guildPluginEnvValues.guildId,
        guildPluginEnvValues.pluginId,
        guildPluginEnvValues.envKey,
      ],
      set: { value: input.value },
    });
}

export async function deleteGuildPluginEnvValue(
  db: Db,
  guildId: string,
  pluginId: string,
  envKey: string,
) {
  await db
    .delete(guildPluginEnvValues)
    .where(
      and(
        eq(guildPluginEnvValues.guildId, guildId),
        eq(guildPluginEnvValues.pluginId, pluginId),
        eq(guildPluginEnvValues.envKey, envKey),
      ),
    );
}

export async function setGuildPluginEnabled(
  db: Db,
  guildId: string,
  pluginId: string,
  enabled: boolean,
) {
  await db
    .insert(guildPluginSettings)
    .values({ guildId, pluginId, enabled })
    .onConflictDoUpdate({
      target: [guildPluginSettings.guildId, guildPluginSettings.pluginId],
      set: { enabled },
    });
}

export async function enqueuePluginRun(
  db: Db,
  guildId: string,
  pluginId: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(pluginRunRequests).values({
    id,
    guildId,
    pluginId,
  });
  return id;
}

export async function claimNextPluginRunRequest(db: Db) {
  const row = await db.query.pluginRunRequests.findFirst({
    where: isNull(pluginRunRequests.startedAt),
    orderBy: [pluginRunRequests.requestedAt],
  });
  if (!row) {
    return null;
  }

  const [claimed] = await db
    .update(pluginRunRequests)
    .set({ startedAt: new Date() })
    .where(
      and(
        eq(pluginRunRequests.id, row.id),
        isNull(pluginRunRequests.startedAt),
      ),
    )
    .returning();

  return claimed ?? null;
}

export async function completePluginRunRequest(db: Db, id: string) {
  await db
    .update(pluginRunRequests)
    .set({ completedAt: new Date() })
    .where(eq(pluginRunRequests.id, id));
}

export async function deleteAllGuildPluginConfigForPlugin(
  db: Db,
  pluginId: string,
) {
  await db
    .delete(guildPluginSettings)
    .where(eq(guildPluginSettings.pluginId, pluginId));
  await db
    .delete(guildPluginEnvValues)
    .where(eq(guildPluginEnvValues.pluginId, pluginId));
  await db
    .delete(pluginRunRequests)
    .where(eq(pluginRunRequests.pluginId, pluginId));
}
