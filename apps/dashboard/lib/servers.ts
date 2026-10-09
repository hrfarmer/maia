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

const DEV_PRESENT_GUILD_ID = "987654321098765432";

export async function getManagedServersForUser(
  accessToken: string,
): Promise<ServerListItem[]> {
  const guilds = filterManageableGuilds(await fetchUserGuilds(accessToken));

  let activeIds: Set<string>;
  const devSession =
    process.env.MAIA_ENABLE_DEV_HELPERS === "1" &&
    accessToken === "dev-access-token";

  if (devSession) {
    activeIds = new Set([DEV_PRESENT_GUILD_ID]);
  } else {
    const db = getDb();
    activeIds = await getActiveGuildIds(db);
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
