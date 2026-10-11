import {
  canEnableGuildPlugin,
  isValidCronExpression,
  type PluginEnvironmentKey,
} from "@maia/plugins";
import {
  deleteGuildPluginEnvValue,
  enqueuePluginGuildConfigNotification,
  enqueuePluginRun,
  getGuildPluginSettings,
  getLatestPluginScan,
  listGuildPluginEnvValuesForGuild,
  listGuildPluginSettingsForGuild,
  setGuildPluginCronExpression,
  setGuildPluginEnabled,
  setGuildPluginSlashCommandsEnabled,
  upsertGuildPluginEnvValue,
  type Db,
} from "@maia/db";
import { syncGuildApplicationCommandsToDiscord } from "@/lib/guild-application-commands/sync";
import type { PluginSlashCollision } from "@maia/plugins";
import { planAlwaysOnConfigNotifications } from "./always-on-notify";
import { applyGuildPluginValuePatch, mergeGuildPluginRow } from "./guild-view";

export async function getGuildPluginsView(db: Db, guildId: string) {
  const scan = await getLatestPluginScan(db);
  if (!scan) {
    return { scan: null, plugins: [] as ReturnType<typeof mergeGuildPluginRow>[] };
  }

  const [settings, values] = await Promise.all([
    listGuildPluginSettingsForGuild(db, guildId),
    listGuildPluginEnvValuesForGuild(db, guildId),
  ]);

  const enabledByPlugin = new Map(
    settings.map((row) => [row.pluginId, row.enabled]),
  );
  const cronByPlugin = new Map(
    settings.map((row) => [row.pluginId, row.cronExpression ?? null]),
  );
  const slashEnabledByPlugin = new Map(
    settings.map((row) => [row.pluginId, row.slashCommandsEnabled]),
  );
  const slashErrorByPlugin = new Map(
    settings.map((row) => [row.pluginId, row.slashPublishError ?? null]),
  );
  const slashCollisionsByPlugin = new Map<string, PluginSlashCollision[]>();
  for (const row of settings) {
    if (!row.slashCollisionNotes) {
      slashCollisionsByPlugin.set(row.pluginId, []);
      continue;
    }
    try {
      const parsed = JSON.parse(row.slashCollisionNotes) as PluginSlashCollision[];
      slashCollisionsByPlugin.set(
        row.pluginId,
        Array.isArray(parsed) ? parsed : [],
      );
    } catch {
      slashCollisionsByPlugin.set(row.pluginId, []);
    }
  }
  const valuesByPlugin = new Map<string, Map<string, string>>();
  for (const row of values) {
    const map = valuesByPlugin.get(row.pluginId) ?? new Map<string, string>();
    map.set(row.envKey, row.value);
    valuesByPlugin.set(row.pluginId, map);
  }

  const plugins = scan.plugins.map((plugin) =>
    mergeGuildPluginRow({
      plugin: {
        id: plugin.id,
        directoryName: plugin.directoryName,
        status: plugin.status,
        pluginId: plugin.pluginId,
        displayName: plugin.displayName,
        lifetime: plugin.lifetime,
        subscribedEvents: plugin.subscribedEvents,
        errorMessage: plugin.errorMessage,
        environment: plugin.environment,
      },
      slashCommands: plugin.slashCommands ?? [],
      enabled: plugin.pluginId
        ? (enabledByPlugin.get(plugin.pluginId) ?? false)
        : false,
      storedValues: plugin.pluginId
        ? (valuesByPlugin.get(plugin.pluginId) ?? new Map())
        : new Map(),
      cronExpression: plugin.pluginId
        ? (cronByPlugin.get(plugin.pluginId) ?? null)
        : null,
      slashCommandsEnabled: plugin.pluginId
        ? (slashEnabledByPlugin.get(plugin.pluginId) ?? false)
        : false,
      slashPublishError: plugin.pluginId
        ? (slashErrorByPlugin.get(plugin.pluginId) ?? null)
        : null,
      slashCollisionNotes: plugin.pluginId
        ? (slashCollisionsByPlugin.get(plugin.pluginId) ?? [])
        : [],
    }),
  );

  return { scan, plugins };
}

export async function updateGuildPluginConfig(
  db: Db,
  guildId: string,
  pluginId: string,
  input: {
    enabled?: boolean;
    values?: Record<string, string | null>;
    cronExpression?: string | null;
    slashCommandsEnabled?: boolean;
  },
) {
  const scan = await getLatestPluginScan(db);
  const discovered = scan?.plugins.find(
    (plugin) => plugin.pluginId === pluginId && plugin.status === "ok",
  );
  if (!discovered) {
    return { error: "Plugin not found" as const };
  }

  const environment = (discovered.environment ?? []) as PluginEnvironmentKey[];
  const previousSettings = await getGuildPluginSettings(db, guildId, pluginId);
  const previousEnabled = previousSettings?.enabled ?? false;
  const existingRows = await listGuildPluginEnvValuesForGuild(db, guildId);
  const existingValues = new Map<string, string>();
  for (const row of existingRows) {
    if (row.pluginId === pluginId) {
      existingValues.set(row.envKey, row.value);
    }
  }
  let valuesChanged = false;

  const { values, enabled } = applyGuildPluginValuePatch({
    environment,
    existingValues,
    patch: input.values ?? {},
    requestedEnabled: input.enabled,
  });

  if (input.enabled === true && !canEnableGuildPlugin(environment, values)) {
    return { error: "All required environment keys must have values" as const };
  }

  if (input.cronExpression !== undefined) {
    if (discovered.lifetime !== "invocation") {
      return { error: "Cron is only available for invocation plugins" as const };
    }
    if (input.cronExpression === null || input.cronExpression.trim() === "") {
      await setGuildPluginCronExpression(db, guildId, pluginId, null);
    } else if (!isValidCronExpression(input.cronExpression)) {
      return { error: "Invalid cron expression" as const };
    } else {
      await setGuildPluginCronExpression(
        db,
        guildId,
        pluginId,
        input.cronExpression.trim(),
      );
    }
  }

  for (const entry of environment) {
    const next = values.get(entry.key);
    const prev = existingValues.get(entry.key);
    if (entry.secret && input.values && !(entry.key in input.values)) {
      continue;
    }
    if (next === undefined) {
      if (prev !== undefined) {
        valuesChanged = true;
        await deleteGuildPluginEnvValue(db, guildId, pluginId, entry.key);
      }
      continue;
    }
    if (entry.secret && next === prev) {
      continue;
    }
    if (next !== prev) {
      valuesChanged = true;
    }
    await upsertGuildPluginEnvValue(db, {
      guildId,
      pluginId,
      envKey: entry.key,
      value: next,
    });
  }

  await setGuildPluginEnabled(db, guildId, pluginId, enabled);

  const previousSlashEnabled = previousSettings?.slashCommandsEnabled ?? false;
  let nextSlashEnabled = previousSlashEnabled;
  if (input.slashCommandsEnabled !== undefined) {
    if (input.slashCommandsEnabled && !enabled) {
      return { error: "Enable the plugin before publishing slash commands" as const };
    }
    if (
      input.slashCommandsEnabled &&
      (discovered.slashCommands?.length ?? 0) === 0
    ) {
      return { error: "Plugin has no slash commands to publish" as const };
    }
    nextSlashEnabled = input.slashCommandsEnabled;
    await setGuildPluginSlashCommandsEnabled(
      db,
      guildId,
      pluginId,
      nextSlashEnabled,
    );
  } else if (!enabled) {
    nextSlashEnabled = false;
    await setGuildPluginSlashCommandsEnabled(db, guildId, pluginId, false);
  }

  const shouldSyncSlash =
    input.slashCommandsEnabled !== undefined ||
    previousEnabled !== enabled ||
    valuesChanged;
  if (shouldSyncSlash) {
    await syncGuildApplicationCommandsToDiscord(guildId);
  }

  for (const changeType of planAlwaysOnConfigNotifications({
    lifetime: discovered.lifetime,
    previousEnabled,
    nextEnabled: enabled,
    valuesChanged,
  })) {
    await enqueuePluginGuildConfigNotification(db, {
      pluginId,
      guildId,
      changeType,
    });
  }

  return { ok: true as const };
}

export async function requestGuildPluginRun(
  db: Db,
  guildId: string,
  pluginId: string,
) {
  const { plugins } = await getGuildPluginsView(db, guildId);
  const plugin = plugins.find((row) => row.pluginId === pluginId);
  if (!plugin) {
    return { error: "Plugin not found" as const };
  }
  if (!plugin.canRunNow) {
    return { error: "Plugin is not enabled for a manual run" as const };
  }
  const runId = await enqueuePluginRun(db, guildId, pluginId);
  return { runId };
}
