import { BOT_INVITE_PERMISSIONS_STRING, Permission } from "@maia/discord";

export const MANAGE_GUILD = Permission.ManageGuild;

export interface DiscordPartialGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

const devGuildFixtures: DiscordPartialGuild[] = [
  {
    id: "123456789012345678",
    name: "Northwatch",
    icon: null,
    owner: false,
    permissions: "32",
  },
  {
    id: "987654321098765432",
    name: "Relay Station",
    icon: null,
    owner: false,
    permissions: "32",
  },
];

export async function fetchUserGuilds(
  accessToken: string,
): Promise<DiscordPartialGuild[]> {
  if (
    process.env.MAIA_ENABLE_DEV_HELPERS === "1" &&
    accessToken === "dev-access-token"
  ) {
    return devGuildFixtures;
  }

  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Discord API error: ${response.status}`);
  }

  return response.json() as Promise<DiscordPartialGuild[]>;
}

export function filterManageableGuilds(guilds: DiscordPartialGuild[]) {
  return guilds.filter((guild) => {
    const permissions = BigInt(guild.permissions);
    return (permissions & MANAGE_GUILD) === MANAGE_GUILD;
  });
}

export function guildIconUrl(guild: DiscordPartialGuild, size = 64) {
  if (!guild.icon) {
    return null;
  }
  const extension = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=${size}`;
}

export function botInviteUrl(guildId: string) {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_DISCORD_CLIENT_ID is not set");
  }
  const permissions = BOT_INVITE_PERMISSIONS_STRING;
  const params = new URLSearchParams({
    client_id: clientId,
    permissions,
    scope: "bot applications.commands",
    guild_id: guildId,
    disable_guild_select: "true",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
