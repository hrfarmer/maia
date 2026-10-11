import { Permission, hasPermission } from "@maia/discord";
import type {
  DiscordGuildChannel,
  DiscordGuildMember,
  DiscordRole,
} from "./discord-bot.js";
import { computeGuildPermissions } from "./role-create.js";

export type { DiscordGuildChannel };

export const PLAIN_TEXT_GUILD_CHANNEL_TYPES = new Set([0, 5]);

type DiscordPermissionOverwrite = NonNullable<
  DiscordGuildChannel["permission_overwrites"]
>[number];

function applyOverwrite(
  permissions: bigint,
  overwrite: DiscordPermissionOverwrite,
): bigint {
  const deny = BigInt(overwrite.deny);
  const allow = BigInt(overwrite.allow);
  return (permissions & ~deny) | allow;
}

function rolePosition(
  roles: DiscordRole[],
  roleId: string,
): number {
  return roles.find((role) => role.id === roleId)?.position ?? -1;
}

function applyChannelOverwrites(
  permissions: bigint,
  channel: DiscordGuildChannel,
  member: DiscordGuildMember,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
): bigint {
  const overwrites = channel.permission_overwrites ?? [];
  let perms = permissions;

  const everyoneOverwrite = overwrites.find(
    (item) => item.type === 0 && item.id === guildId,
  );
  if (everyoneOverwrite) {
    perms = applyOverwrite(perms, everyoneOverwrite);
  }

  const memberRoleIds = new Set(member.roles);
  const roleOverwrites = overwrites
    .filter((item) => item.type === 0 && memberRoleIds.has(item.id))
    .sort(
      (left, right) =>
        rolePosition(roles, left.id) - rolePosition(roles, right.id),
    );
  for (const overwrite of roleOverwrites) {
    perms = applyOverwrite(perms, overwrite);
  }

  const memberOverwrite = overwrites.find(
    (item) => item.type === 1 && item.id === userId,
  );
  if (memberOverwrite) {
    perms = applyOverwrite(perms, memberOverwrite);
  }

  return perms;
}

export function computeChannelPermissions(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): bigint {
  let perms = computeGuildPermissions(member, roles, guildId);
  if ((perms & Permission.Administrator) === Permission.Administrator) {
    return perms;
  }

  const parentChain: DiscordGuildChannel[] = [];
  let parentId = channel.parent_id ?? null;
  while (parentId) {
    const parent = channelsById.get(parentId);
    if (!parent) {
      break;
    }
    parentChain.unshift(parent);
    parentId = parent.parent_id ?? null;
  }

  for (const parent of parentChain) {
    perms = applyChannelOverwrites(
      perms,
      parent,
      member,
      roles,
      guildId,
      userId,
    );
  }

  return applyChannelOverwrites(
    perms,
    channel,
    member,
    roles,
    guildId,
    userId,
  );
}

export function botCanViewChannel(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): boolean {
  const perms = computeChannelPermissions(
    member,
    channel,
    roles,
    guildId,
    userId,
    channelsById,
  );
  return hasPermission(perms, Permission.ViewChannel);
}

export function botCanSendMessages(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): boolean {
  const perms = computeChannelPermissions(
    member,
    channel,
    roles,
    guildId,
    userId,
    channelsById,
  );
  return (
    hasPermission(perms, Permission.ViewChannel) &&
    hasPermission(perms, Permission.SendMessages)
  );
}

function channelPermissions(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): bigint {
  return computeChannelPermissions(
    member,
    channel,
    roles,
    guildId,
    userId,
    channelsById,
  );
}

export function botCanReadMessageHistory(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): boolean {
  const perms = channelPermissions(
    member,
    channel,
    roles,
    guildId,
    userId,
    channelsById,
  );
  return (
    hasPermission(perms, Permission.ViewChannel) &&
    hasPermission(perms, Permission.ReadMessageHistory)
  );
}

export function botCanManageMessages(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): boolean {
  const perms = channelPermissions(
    member,
    channel,
    roles,
    guildId,
    userId,
    channelsById,
  );
  return (
    hasPermission(perms, Permission.ViewChannel) &&
    hasPermission(perms, Permission.ManageMessages)
  );
}

export function botCanAddReactions(
  member: DiscordGuildMember,
  channel: DiscordGuildChannel,
  roles: DiscordRole[],
  guildId: string,
  userId: string,
  channelsById: Map<string, DiscordGuildChannel>,
): boolean {
  const perms = channelPermissions(
    member,
    channel,
    roles,
    guildId,
    userId,
    channelsById,
  );
  return (
    hasPermission(perms, Permission.ViewChannel) &&
    hasPermission(perms, Permission.ReadMessageHistory) &&
    hasPermission(perms, Permission.AddReactions)
  );
}
