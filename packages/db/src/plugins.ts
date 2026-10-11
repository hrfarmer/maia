import { desc, eq } from "drizzle-orm";
import type { PluginSlashCommand } from "@maia/plugins";
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
  displayName: string | null;
  lifetime: string | null;
  subscribedEvents: string[];
  errorMessage: string | null;
  command: string[] | null;
  environment: Array<{
    key: string;
    required: boolean;
    secret: boolean;
  }> | null;
  invocationTimeLimitMs: number | null;
  maxConcurrentInvocations: number | null;
  slashCommands: PluginSlashCommand[] | null;
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
  displayName?: string | null;
  lifetime?: string | null;
  subscribedEvents?: string[];
  errorMessage?: string | null;
  command?: string[] | null;
  environment?: Array<{
    key: string;
    required: boolean;
    secret: boolean;
  }> | null;
  invocationTimeLimitMs?: number | null;
  maxConcurrentInvocations?: number | null;
  slashCommands?: PluginSlashCommand[] | null;
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
        displayName: plugin.displayName ?? null,
        lifetime: plugin.lifetime ?? null,
        subscribedEvents: JSON.stringify(plugin.subscribedEvents ?? []),
        errorMessage: plugin.errorMessage ?? null,
        commandJson: plugin.command
          ? JSON.stringify(plugin.command)
          : null,
        environmentJson: plugin.environment
          ? JSON.stringify(plugin.environment)
          : null,
        invocationTimeLimitMs: plugin.invocationTimeLimitMs ?? null,
        maxConcurrentInvocations: plugin.maxConcurrentInvocations ?? null,
        slashCommandsJson: plugin.slashCommands
          ? JSON.stringify(plugin.slashCommands)
          : null,
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
      displayName: plugin.displayName ?? null,
      lifetime: plugin.lifetime ?? null,
      subscribedEvents: plugin.subscribedEvents ?? [],
      errorMessage: plugin.errorMessage ?? null,
      command: plugin.command ?? null,
      environment: plugin.environment ?? null,
      invocationTimeLimitMs: plugin.invocationTimeLimitMs ?? null,
      maxConcurrentInvocations: plugin.maxConcurrentInvocations ?? null,
      slashCommands: plugin.slashCommands ?? null,
    })),
  };
}

function parseSubscribedEvents(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
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
      displayName: plugin.displayName,
      lifetime: plugin.lifetime,
      subscribedEvents: parseSubscribedEvents(plugin.subscribedEvents),
      errorMessage: plugin.errorMessage,
      command: parseJsonStringArray(plugin.commandJson),
      environment: parseEnvironmentJson(plugin.environmentJson),
      invocationTimeLimitMs: plugin.invocationTimeLimitMs,
      maxConcurrentInvocations: plugin.maxConcurrentInvocations,
      slashCommands: parseSlashCommandsJson(plugin.slashCommandsJson),
    })),
  };
}

function parseSlashCommandsJson(
  raw: string | null,
): PluginSlashCommand[] | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as PluginSlashCommand[];
  } catch {
    return null;
  }
}

function parseJsonStringArray(raw: string | null): string[] | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

function parseEnvironmentJson(
  raw: string | null,
): Array<{ key: string; required: boolean; secret: boolean }> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const result: Array<{ key: string; required: boolean; secret: boolean }> =
      [];
    for (const item of parsed) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.key !== "string") {
        continue;
      }
      result.push({
        key: record.key,
        required: record.required === true,
        secret: record.secret === true,
      });
    }
    return result;
  } catch {
    return null;
  }
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
