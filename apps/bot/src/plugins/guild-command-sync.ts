import { REST, Routes } from "discord.js";
import {
  buildGuildSlashSyncPlan,
  getDb,
  listGuildIdsWithSlashPublishing,
  listGuildPluginSettingsForGuild,
  recordCustomCommandSyncFailure,
  recordCustomCommandSyncSuccess,
  recordGuildPluginSlashPublishResult,
  type Db,
} from "@maia/db";

function getApplicationId(): string {
  const id = process.env.DISCORD_CLIENT_ID;
  if (!id) {
    throw new Error("DISCORD_CLIENT_ID is not set");
  }
  return id;
}

export async function syncGuildApplicationCommandsFromBot(
  db: Db,
  guildId: string,
  rest: REST,
) {
  const plan = await buildGuildSlashSyncPlan(db, guildId);
  const slashPluginIds = (await listGuildPluginSettingsForGuild(db, guildId))
    .filter((row) => row.slashCommandsEnabled)
    .map((row) => row.pluginId);

  try {
    await rest.put(Routes.applicationGuildCommands(getApplicationId(), guildId), {
      body: plan.body,
    });
    await recordCustomCommandSyncSuccess(db, guildId);
    for (const pluginId of slashPluginIds) {
      await recordGuildPluginSlashPublishResult(db, {
        guildId,
        pluginId,
        error: null,
        collisions: plan.collisionsByPlugin.get(pluginId) ?? [],
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discord sync failed";
    await recordCustomCommandSyncFailure(db, guildId, message);
    for (const pluginId of slashPluginIds) {
      await recordGuildPluginSlashPublishResult(db, {
        guildId,
        pluginId,
        error: message,
        collisions: [],
      });
    }
  }
}

export async function republishSlashCommandsForAllGuilds(rest: REST) {
  const db = getDb();
  const guildIds = await listGuildIdsWithSlashPublishing(db);
  for (const guildId of guildIds) {
    await syncGuildApplicationCommandsFromBot(db, guildId, rest);
  }
}
