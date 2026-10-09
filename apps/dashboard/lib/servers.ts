import { getActiveGuildIds, getDb } from "@maia/db";
import {
  fetchUserGuilds,
  filterManageableGuilds,
  guildIconUrl,
  type DiscordPartialGuild,
} from "./discord";
import { DEV_GUILD_ID } from "./dev-fixtures";

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

  const devSession =
    process.env.MAIA_ENABLE_DEV_HELPERS === "1" &&
    accessToken === "dev-access-token";

  let activeIds: Set<string>;
  if (devSession) {
    activeIds = new Set([DEV_GUILD_ID]);
  } else {
    try {
      const db = getDb();
      activeIds = await getActiveGuildIds(db);
    } catch {
      activeIds = new Set();
    }
  }

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
