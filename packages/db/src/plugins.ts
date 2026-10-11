import { desc, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  botRuntimeState,
  discoveredPlugins,
  pluginScans,
} from "./schema.js";

export type PluginScanTrigger = "startup" | "refresh";

export interface DiscoveredPluginRecord {
  id: string;
  directoryName: string;
  status: "ok" | "error";
  pluginId: string | null;
  name: string | null;
  version: string | null;
  errorMessage: string | null;
}

export interface PluginScanRecord {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  trigger: PluginScanTrigger;
  scanError: string | null;
  plugins: DiscoveredPluginRecord[];
}

export interface PersistDiscoveredPluginInput {
  directoryName: string;
  status: "ok" | "error";
  pluginId?: string | null;
  name?: string | null;
  version?: string | null;
  errorMessage?: string | null;
}

const BOT_STATE_ID = "default";

async function ensureBotRuntimeState(db: Db) {
  await db
    .insert(botRuntimeState)
    .values({ id: BOT_STATE_ID })
    .onConflictDoNothing();
}

export async function requestPluginScanRefresh(db: Db): Promise<Date> {
  await ensureBotRuntimeState(db);
  const requestedAt = new Date();
  await db
    .update(botRuntimeState)
    .set({ pluginRefreshRequestedAt: requestedAt })
    .where(eq(botRuntimeState.id, BOT_STATE_ID));
  return requestedAt;
}

export async function getPluginRefreshRequestedAt(
  db: Db,
): Promise<Date | null> {
  const row = await db.query.botRuntimeState.findFirst({
    where: eq(botRuntimeState.id, BOT_STATE_ID),
  });
  return row?.pluginRefreshRequestedAt ?? null;
}

export async function clearPluginRefreshRequest(db: Db) {
  await ensureBotRuntimeState(db);
  await db
    .update(botRuntimeState)
    .set({ pluginRefreshRequestedAt: null })
    .where(eq(botRuntimeState.id, BOT_STATE_ID));
}

export async function persistPluginScan(
  db: Db,
  input: {
    trigger: PluginScanTrigger;
    scanError?: string | null;
    plugins: PersistDiscoveredPluginInput[];
  },
): Promise<PluginScanRecord> {
  const scanId = crypto.randomUUID();
  const completedAt = new Date();

  await db.insert(pluginScans).values({
    id: scanId,
    completedAt,
    trigger: input.trigger,
    scanError: input.scanError ?? null,
  });

  if (input.plugins.length > 0) {
    await db.insert(discoveredPlugins).values(
      input.plugins.map((plugin) => ({
        id: crypto.randomUUID(),
        scanId,
        directoryName: plugin.directoryName,
        status: plugin.status,
        pluginId: plugin.pluginId ?? null,
        name: plugin.name ?? null,
        version: plugin.version ?? null,
        errorMessage: plugin.errorMessage ?? null,
      })),
    );
  }

  return {
    id: scanId,
    startedAt: completedAt,
    completedAt,
    trigger: input.trigger,
    scanError: input.scanError ?? null,
    plugins: input.plugins.map((plugin) => ({
      id: "",
      directoryName: plugin.directoryName,
      status: plugin.status,
      pluginId: plugin.pluginId ?? null,
      name: plugin.name ?? null,
      version: plugin.version ?? null,
      errorMessage: plugin.errorMessage ?? null,
    })),
  };
}

export async function getLatestPluginScan(
  db: Db,
): Promise<PluginScanRecord | null> {
  const scan = await db.query.pluginScans.findFirst({
    orderBy: [desc(pluginScans.completedAt), desc(pluginScans.startedAt)],
    with: {
      discoveredPlugins: true,
    },
  });

  if (!scan) {
    return null;
  }

  const plugins = [...scan.discoveredPlugins].sort((a, b) =>
    a.directoryName.localeCompare(b.directoryName),
  );

  return {
    id: scan.id,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    trigger: scan.trigger as PluginScanTrigger,
    scanError: scan.scanError,
    plugins: plugins.map((plugin) => ({
      id: plugin.id,
      directoryName: plugin.directoryName,
      status: plugin.status as "ok" | "error",
      pluginId: plugin.pluginId,
      name: plugin.name,
      version: plugin.version,
      errorMessage: plugin.errorMessage,
    })),
  };
}

export function isPluginRefreshPending(
  refreshRequestedAt: Date | null,
  latestScanCompletedAt: Date | null,
): boolean {
  if (!refreshRequestedAt) {
    return false;
  }
  if (!latestScanCompletedAt) {
    return true;
  }
  return refreshRequestedAt.getTime() > latestScanCompletedAt.getTime();
}
