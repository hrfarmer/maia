/**
 * Discord permission flags (same bit positions as discord.js PermissionFlagsBits).
 * Invite set is verified against PermissionFlagsBits in permissions.test.ts.
 */
export const Permission = {
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ManageMessages: 1n << 13n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  ReadMessageHistory: 1n << 16n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
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

export const BOT_INVITE_PERMISSIONS =
  Permission.ViewChannel |
  Permission.SendMessages |
  Permission.AddReactions |
  Permission.ReadMessageHistory |
  Permission.ManageMessages |
  Permission.ManageRoles |
  Permission.KickMembers |
  Permission.BanMembers |
  Permission.ModerateMembers |
  Permission.ManageNicknames;

export const BOT_INVITE_PERMISSIONS_STRING =
  BOT_INVITE_PERMISSIONS.toString();

/** Bit indices set in {@link BOT_INVITE_PERMISSIONS}. */
export const BOT_INVITE_PERMISSION_BITS = [
  1, 2, 6, 10, 11, 13, 16, 27, 28, 40,
] as const;
