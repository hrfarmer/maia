import { getActiveGuildIds, getDb } from "@maia/db";
import {
  fetchUserGuilds,
  filterManageableGuilds,
  guildIconUrl,
  type DiscordPartialGuild,
} from "./discord";

export interface ServerListItem {
  id: string;
  name: string;
  iconUrl: string | null;
  maiaPresent: boolean;
}

export async function getManagedServersForUser(
  accessToken: string,
): Promise<ServerListItem[]> {
  const guilds = filterManageableGuilds(await fetchUserGuilds(accessToken));
  const db = getDb();
  const activeIds = await getActiveGuildIds(db);

  return guilds
    .map((guild) => toListItem(guild, activeIds.has(guild.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toListItem(
  guild: DiscordPartialGuild,
  maiaPresent: boolean,
): ServerListItem {
  return {
    id: guild.id,
    name: guild.name,
    iconUrl: guildIconUrl(guild),
    maiaPresent,
  };
}
