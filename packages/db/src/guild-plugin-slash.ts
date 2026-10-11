import { and, eq } from "drizzle-orm";
import {
  canEnableGuildPlugin,
  planPluginSlashCommandsForGuild,
  type PluginSlashCommand,
  type PluginSlashCollision,
} from "@maia/plugins";
import { buildGuildApplicationCommandsBody } from "@maia/discord";
import type { Db } from "./client.js";
import { listEnabledCustomCommandsForSync } from "./custom-commands.js";
import {
  getLatestOkPluginsByPluginId,
  listGuildPluginEnvValuesForGuild,
  listGuildPluginSettingsForGuild,
} from "./guild-plugins.js";
import { getLatestPluginScan } from "./plugins.js";
import { guildPluginSettings } from "./schema.js";

export interface GuildSlashSyncPlan {
  body: ReturnType<typeof buildGuildApplicationCommandsBody>;
  collisionsByPlugin: Map<string, PluginSlashCollision[]>;
}

export async function buildGuildSlashSyncPlan(
  db: Db,
  guildId: string,
): Promise<GuildSlashSyncPlan> {
  const customCommands = await listEnabledCustomCommandsForSync(db, guildId);
  const scan = await getLatestPluginScan(db);
  const settings = await listGuildPluginSettingsForGuild(db, guildId);
  const envValues = await listGuildPluginEnvValuesForGuild(db, guildId);
  const valuesByPlugin = new Map<string, Map<string, string>>();
  for (const row of envValues) {
    const map = valuesByPlugin.get(row.pluginId) ?? new Map<string, string>();
    map.set(row.envKey, row.value);
    valuesByPlugin.set(row.pluginId, map);
  }

  const pluginsForPublish: Array<{
    pluginId: string;
    commands: PluginSlashCommand[];
  }> = [];

  if (scan) {
    for (const plugin of scan.plugins) {
      if (plugin.status !== "ok" || !plugin.pluginId) {
        continue;
      }
      const setting = settings.find((row) => row.pluginId === plugin.pluginId);
      if (!setting?.slashCommandsEnabled) {
        continue;
      }
      const environment = plugin.environment ?? [];
      const valueMap = valuesByPlugin.get(plugin.pluginId) ?? new Map();
      const effectivelyEnabled =
        setting.enabled && canEnableGuildPlugin(environment, valueMap);
      if (!effectivelyEnabled) {
        continue;
      }
      const slashCommands = plugin.slashCommands ?? [];
      if (slashCommands.length === 0) {
        continue;
      }
      pluginsForPublish.push({
        pluginId: plugin.pluginId,
        commands: slashCommands,
      });
    }
  }

  const { discordBody, collisionsByPlugin } = planPluginSlashCommandsForGuild({
    customCommandNames: customCommands.map((command) => command.name),
    plugins: pluginsForPublish,
  });

  return {
    body: buildGuildApplicationCommandsBody({
      customCommands,
      pluginCommands: discordBody,
    }),
    collisionsByPlugin,
  };
}

export async function setGuildPluginSlashCommandsEnabled(
  db: Db,
  guildId: string,
  pluginId: string,
  enabled: boolean,
) {
  const existing = await db.query.guildPluginSettings.findFirst({
    where: and(
      eq(guildPluginSettings.guildId, guildId),
      eq(guildPluginSettings.pluginId, pluginId),
    ),
  });
  if (existing) {
    await db
      .update(guildPluginSettings)
      .set({ slashCommandsEnabled: enabled })
      .where(
        and(
          eq(guildPluginSettings.guildId, guildId),
          eq(guildPluginSettings.pluginId, pluginId),
        ),
      );
    return;
  }
  await db.insert(guildPluginSettings).values({
    guildId,
    pluginId,
    enabled: false,
    slashCommandsEnabled: enabled,
  });
}

export async function recordGuildPluginSlashPublishResult(
  db: Db,
  input: {
    guildId: string;
    pluginId: string;
    error: string | null;
    collisions: PluginSlashCollision[];
  },
) {
  await db
    .update(guildPluginSettings)
    .set({
      slashPublishError: input.error,
      slashCollisionNotes:
        input.collisions.length > 0 ? JSON.stringify(input.collisions) : null,
    })
    .where(
      and(
        eq(guildPluginSettings.guildId, input.guildId),
        eq(guildPluginSettings.pluginId, input.pluginId),
      ),
    );
}

export async function clearGuildPluginSlashPublishErrorsForGuild(
  db: Db,
  guildId: string,
  pluginIds: string[],
) {
  for (const pluginId of pluginIds) {
    await recordGuildPluginSlashPublishResult(db, {
      guildId,
      pluginId,
      error: null,
      collisions: [],
    });
  }
}

export async function listGuildIdsWithSlashPublishing(db: Db): Promise<string[]> {
  const rows = await db.query.guildPluginSettings.findMany({
    where: eq(guildPluginSettings.slashCommandsEnabled, true),
    columns: { guildId: true },
  });
  return [...new Set(rows.map((row) => row.guildId))];
}

export interface ResolvedPluginSlashCommand {
  pluginId: string;
  directoryName: string;
  lifetime: string;
  command: PluginSlashCommand;
  invocationTimeLimitMs: number | null;
  processCommand: string[];
  environment: Array<{ key: string; required: boolean; secret: boolean }>;
}

export async function resolvePluginSlashCommand(
  db: Db,
  guildId: string,
  commandName: string,
): Promise<ResolvedPluginSlashCommand | null> {
  const scan = await getLatestPluginScan(db);
  if (!scan) {
    return null;
  }
  const settings = await listGuildPluginSettingsForGuild(db, guildId);
  const envValues = await listGuildPluginEnvValuesForGuild(db, guildId);
  const valuesByPlugin = new Map<string, Map<string, string>>();
  for (const row of envValues) {
    const map = valuesByPlugin.get(row.pluginId) ?? new Map<string, string>();
    map.set(row.envKey, row.value);
    valuesByPlugin.set(row.pluginId, map);
  }

  const runnable = await getLatestOkPluginsByPluginId(db);

  for (const plugin of scan.plugins) {
    if (plugin.status !== "ok" || !plugin.pluginId) {
      continue;
    }
    const setting = settings.find((row) => row.pluginId === plugin.pluginId);
    if (!setting?.slashCommandsEnabled || !setting.enabled) {
      continue;
    }
    const environment = plugin.environment ?? [];
    const valueMap = valuesByPlugin.get(plugin.pluginId) ?? new Map();
    if (!canEnableGuildPlugin(environment, valueMap)) {
      continue;
    }
    const slashCommands = plugin.slashCommands ?? [];
    if (slashCommands.length === 0) {
      continue;
    }
    const match = slashCommands.find((command) => command.name === commandName);
    if (!match) {
      continue;
    }
    const runnablePlugin = runnable.get(plugin.pluginId);
    if (!runnablePlugin) {
      continue;
    }
    return {
      pluginId: plugin.pluginId,
      directoryName: plugin.directoryName,
      lifetime: plugin.lifetime ?? "invocation",
      command: match,
      invocationTimeLimitMs: plugin.invocationTimeLimitMs,
      processCommand: runnablePlugin.command,
      environment,
    };
  }
  return null;
}
