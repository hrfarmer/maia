import {
  canEnableGuildPlugin,
  type PluginEnvironmentKey,
} from "@maia/plugins";
import {
  deleteGuildPluginEnvValue,
  enqueuePluginRun,
  getLatestPluginScan,
  listGuildPluginEnvValuesForGuild,
  listGuildPluginSettingsForGuild,
  setGuildPluginEnabled,
  upsertGuildPluginEnvValue,
  type Db,
} from "@maia/db";
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
      enabled: plugin.pluginId
        ? (enabledByPlugin.get(plugin.pluginId) ?? false)
        : false,
      storedValues: plugin.pluginId
        ? (valuesByPlugin.get(plugin.pluginId) ?? new Map())
        : new Map(),
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
  const existingRows = await listGuildPluginEnvValuesForGuild(db, guildId);
  const existingValues = new Map<string, string>();
  for (const row of existingRows) {
    if (row.pluginId === pluginId) {
      existingValues.set(row.envKey, row.value);
    }
  }

  const { values, enabled } = applyGuildPluginValuePatch({
    environment,
    existingValues,
    patch: input.values ?? {},
    requestedEnabled: input.enabled,
  });

  if (input.enabled === true && !canEnableGuildPlugin(environment, values)) {
    return { error: "All required environment keys must have values" as const };
  }

  for (const entry of environment) {
    const next = values.get(entry.key);
    const prev = existingValues.get(entry.key);
    if (entry.secret && input.values && !(entry.key in input.values)) {
      continue;
    }
    if (next === undefined) {
      if (prev !== undefined) {
        await deleteGuildPluginEnvValue(db, guildId, pluginId, entry.key);
      }
      continue;
    }
    if (entry.secret && next === prev) {
      continue;
    }
    await upsertGuildPluginEnvValue(db, {
      guildId,
      pluginId,
      envKey: entry.key,
      value: next,
    });
  }

  await setGuildPluginEnabled(db, guildId, pluginId, enabled);

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
