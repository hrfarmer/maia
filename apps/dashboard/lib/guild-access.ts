import { Permission, hasPermission, parsePermissionBits } from "@maia/discord";
import { fetchUserGuilds } from "./discord";

export async function getUserPermissionsInGuild(
  accessToken: string,
  guildId: string,
): Promise<bigint | null> {
  const guilds = await fetchUserGuilds(accessToken);
  const guild = guilds.find((item) => item.id === guildId);
  if (!guild) {
    return null;
  }
  return parsePermissionBits(guild.permissions);
}

export function canManageServer(permissions: bigint): boolean {
  return hasPermission(permissions, Permission.ManageGuild);
}

export function requireUserPermission(
  permissions: bigint,
  required: bigint,
  label: string,
): void {
  if (canManageServer(permissions)) {
    return;
  }
  if (!hasPermission(permissions, required)) {
    throw new AccessDeniedError(`Missing ${label} permission`);
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}
