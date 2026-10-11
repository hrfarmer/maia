import { getGuildPluginSettings, listGuildPluginEnvValues, type Db } from "@maia/db";
import type { PluginTokenRegistry, RegisteredPluginToken } from "./token-registry.js";

export type PluginApiForbiddenReason =
  | "revoked_token"
  | "unknown_token"
  | "guild_not_enabled"
  | "wrong_guild";

export async function classifyPluginApiForbidden(
  db: Db,
  tokenRegistry: PluginTokenRegistry,
  token: string,
  guildId: string,
): Promise<PluginApiForbiddenReason> {
  if (tokenRegistry.wasRecentlyRevoked(token)) {
    return "revoked_token";
  }
  const entry = tokenRegistry.lookup(token);
  if (!entry) {
    return "unknown_token";
  }
  if (entry.kind === "invocation") {
    return entry.guildId === guildId ? "unknown_token" : "wrong_guild";
  }
  try {
    const settings = await getGuildPluginSettings(db, guildId, entry.pluginId);
    if (!settings?.enabled) {
      return "guild_not_enabled";
    }
  } catch {
    return "unknown_token";
  }
  return "unknown_token";
}

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
