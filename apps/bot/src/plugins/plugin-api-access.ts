import { getGuildPluginSettings, listGuildPluginEnvValues, type Db } from "@maia/db";
import type { PluginTokenRegistry, RegisteredPluginToken } from "./token-registry.js";

export async function resolvePluginTokenForGuild(
  db: Db,
  tokenRegistry: PluginTokenRegistry,
  token: string,
  guildId: string,
): Promise<RegisteredPluginToken | null> {
  const entry = tokenRegistry.lookup(token);
  if (!entry) {
    return null;
  }
  if (entry.kind === "invocation") {
    return entry.guildId === guildId ? entry : null;
  }
  const settings = await getGuildPluginSettings(db, guildId, entry.pluginId);
  if (!settings?.enabled) {
    return null;
  }
  return entry;
}

export async function loadGuildPluginValuesForApi(
  db: Db,
  guildId: string,
  pluginId: string,
): Promise<Record<string, string>> {
  const rows = await listGuildPluginEnvValues(db, guildId, pluginId);
  const values: Record<string, string> = {};
  for (const row of rows) {
    values[row.envKey] = row.value;
  }
  return values;
}
