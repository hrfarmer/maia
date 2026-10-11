import {
  buildGuildSlashSyncPlan,
  getCustomCommandSyncStatus,
  getDb,
  listGuildPluginSettingsForGuild,
  recordCustomCommandSyncFailure,
  recordCustomCommandSyncSuccess,
  recordGuildPluginSlashPublishResult,
} from "@maia/db";
import { DiscordApiError, discordFetch } from "@/lib/discord-bot";

function getApplicationId(): string {
  const id =
    process.env.DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!id) {
    throw new Error("DISCORD_CLIENT_ID is not set");
  }
  return id;
}

export interface GuildApplicationCommandSyncResult {
  ok: boolean;
  error?: string;
  syncedAt?: string;
}

export async function syncGuildApplicationCommandsToDiscord(
  guildId: string,
): Promise<GuildApplicationCommandSyncResult> {
  const db = getDb();
  const plan = await buildGuildSlashSyncPlan(db, guildId);
  const slashPluginIds = (
    await listGuildPluginSettingsForGuild(db, guildId)
  )
    .filter((row) => row.slashCommandsEnabled)
    .map((row) => row.pluginId);

  try {
    await discordFetch(
      `/applications/${getApplicationId()}/guilds/${guildId}/commands`,
      {
        method: "PUT",
        body: JSON.stringify(plan.body),
      },
    );
    await recordCustomCommandSyncSuccess(db, guildId);
    for (const pluginId of slashPluginIds) {
      await recordGuildPluginSlashPublishResult(db, {
        guildId,
        pluginId,
        error: null,
        collisions: plan.collisionsByPlugin.get(pluginId) ?? [],
      });
    }
    const status = await getCustomCommandSyncStatus(db, guildId);
    return {
      ok: true,
      syncedAt: status.syncedAt?.toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof DiscordApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Discord sync failed";
    await recordCustomCommandSyncFailure(db, guildId, message);
    for (const pluginId of slashPluginIds) {
      await recordGuildPluginSlashPublishResult(db, {
        guildId,
        pluginId,
        error: message,
        collisions: [],
      });
    }
    return { ok: false, error: message };
  }
}
