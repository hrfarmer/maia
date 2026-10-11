import type { DiscordGuildMember, DiscordRole } from "./discord-bot.js";

export function sortRoles(roles: DiscordRole[]): DiscordRole[] {
  return [...roles].sort((a, b) => b.position - a.position);
}

export function getBotHighestRole(
  roles: DiscordRole[],
  botMember: DiscordGuildMember,
): DiscordRole | null {
  const botRoleIds = new Set(botMember.roles);
  const botRoles = roles.filter((role) => botRoleIds.has(role.id));
  if (botRoles.length === 0) {
    return null;
  }
  return sortRoles(botRoles)[0];
}

export function assertRoleManageableByBot(
  role: DiscordRole,
  botHighest: DiscordRole | null,
  guildId: string,
) {
  if (role.managed) {
    throw new ModerationError("That role is managed by an integration.");
  }
  if (role.id === guildId) {
    throw new ModerationError("The @everyone role cannot be changed.");
  }
  if (botHighest && role.position >= botHighest.position) {
    throw new ModerationError(
      "That role is at or above Maia's highest role.",
    );
  }
}

export function assertMemberManageableByBot(
  target: DiscordGuildMember,
  botHighest: DiscordRole | null,
  roles: DiscordRole[],
  ownerId: string,
  botUserId: string,
) {
  const userId = target.user?.id;
  if (!userId) {
    throw new ModerationError("Member user record missing.");
  }
  if (userId === botUserId) {
    throw new ModerationError("Maia cannot target itself.");
  }
  if (userId === ownerId) {
    throw new ModerationError("The server owner cannot be moderated.");
  }
  const targetHighest = highestRoleForMember(target, roles);
  if (
    botHighest &&
    targetHighest &&
    targetHighest.position >= botHighest.position
  ) {
    throw new ModerationError(
      "That member's highest role is at or above Maia's highest role.",
    );
  }
}

function highestRoleForMember(
  member: DiscordGuildMember,
  roles: DiscordRole[],
): DiscordRole | null {
  const memberRoles = roles.filter((role) => member.roles.includes(role.id));
  if (memberRoles.length === 0) {
    return null;
  }
  return sortRoles(memberRoles)[0];
}

export class ModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModerationError";
  }
}
