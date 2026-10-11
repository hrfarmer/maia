import {
  syncGuildApplicationCommandsToDiscord,
  type GuildApplicationCommandSyncResult,
} from "@/lib/guild-application-commands/sync";

export type GuildCustomCommandSyncResult = GuildApplicationCommandSyncResult;

export async function syncGuildCustomCommandsToDiscord(
  guildId: string,
): Promise<GuildCustomCommandSyncResult> {
  return syncGuildApplicationCommandsToDiscord(guildId);
}
