import {
  GuildMember,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type Role,
} from "discord.js";
import { userFacingError } from "./errors.js";

export function requireGuild(interaction: ChatInputCommandInteraction): Guild {
  if (!interaction.inGuild() || !interaction.guild) {
    throw userFacingError("This command can only be used in a server.");
  }
  return interaction.guild;
}

export function requireMember(
  interaction: ChatInputCommandInteraction,
): GuildMember {
  const member = interaction.member;
  if (!member || !(member instanceof GuildMember)) {
    throw userFacingError("Could not resolve your member profile.");
  }
  return member;
}

export function assertInvokerPermission(
  member: GuildMember,
  permission: bigint,
  label: string,
) {
  if (!member.permissions.has(permission)) {
    throw userFacingError(`You need the **${label}** permission.`);
  }
}

export function getBotMember(guild: Guild): GuildMember {
  const me = guild.members.me;
  if (!me) {
    throw userFacingError("Maia is not fully connected to this server yet.");
  }
  return me;
}

export function assertBotPermission(
  botMember: GuildMember,
  permission: bigint,
  label: string,
) {
  if (!botMember.permissions.has(permission)) {
    throw userFacingError(
      `Maia needs the **${label}** permission to do that.`,
    );
  }
}

export function assertRoleManageable(
  botMember: GuildMember,
  role: Role,
  action: string,
) {
  if (role.managed) {
    throw userFacingError(`That role is managed by an integration and cannot be ${action}.`);
  }
  if (role.id === botMember.guild.id) {
    throw userFacingError(`The @everyone role cannot be ${action}.`);
  }
  if (role.position >= botMember.roles.highest.position) {
    throw userFacingError(
      `That role is at or above Maia's highest role (${botMember.roles.highest.name}).`,
    );
  }
}

export function assertMemberManageable(
  botMember: GuildMember,
  target: GuildMember,
) {
  if (target.id === botMember.id) {
    throw userFacingError("Maia cannot target itself.");
  }
  if (target.id === target.guild.ownerId) {
    throw userFacingError("The server owner cannot be moderated this way.");
  }
  if (
    target.roles.highest.position >= botMember.roles.highest.position &&
    target.guild.ownerId !== botMember.id
  ) {
    throw userFacingError(
      "That member's highest role is at or above Maia's highest role.",
    );
  }
}

export const Perm = PermissionFlagsBits;
