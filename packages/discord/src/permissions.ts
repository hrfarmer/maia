/** Discord permission bitfields (https://discord.com/developers/docs/topics/permissions) */

export const Permission = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  EmbedLinks: 1n << 14n,
  ManageRoles: 1n << 28n,
  ManageNicknames: 1n << 27n,
  ModerateMembers: 1n << 40n,
} as const;

export function hasPermission(
  permissions: bigint,
  required: bigint,
): boolean {
  if ((permissions & Permission.Administrator) === Permission.Administrator) {
    return true;
  }
  return (permissions & required) === required;
}

export function parsePermissionBits(value: string | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

/** Bot invite: view/send, manage roles, kick/ban, timeout, nicknames */
export const BOT_INVITE_PERMISSIONS =
  Permission.ViewChannel |
  Permission.SendMessages |
  Permission.EmbedLinks |
  Permission.ManageRoles |
  Permission.KickMembers |
  Permission.BanMembers |
  Permission.ManageNicknames |
  Permission.ModerateMembers;

export const BOT_INVITE_PERMISSIONS_STRING =
  BOT_INVITE_PERMISSIONS.toString();
