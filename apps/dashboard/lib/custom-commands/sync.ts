import {
  getCustomCommandSyncStatus,
  getDb,
  listEnabledCustomCommandsForSync,
  recordCustomCommandSyncFailure,
  recordCustomCommandSyncSuccess,
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

export interface GuildCustomCommandSyncResult {
  ok: boolean;
  error?: string;
  syncedAt?: string;
}

export async function syncGuildCustomCommandsToDiscord(
  guildId: string,
): Promise<GuildCustomCommandSyncResult> {
  const db = getDb();
  const commands = await listEnabledCustomCommandsForSync(db, guildId);
  const body = commands.map((command) => ({
    type: 1 as const,
    name: command.name,
    description: command.description,
  }));

  try {
    await discordFetch(
      `/applications/${getApplicationId()}/guilds/${guildId}/commands`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
    await recordCustomCommandSyncSuccess(db, guildId);
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
    return { ok: false, error: message };
  }
}
