import { Permission } from "@maia/discord";
import {
  getDb,
  recordAuditLog,
  type AuditAction,
  type AuditSource,
} from "@maia/db";
import {
  DiscordApiError,
  addMemberRole,
  banMember,
  fetchGuild,
  fetchGuildMember,
  fetchGuildRoles,
  getBotUserId,
  kickMember,
  removeMemberRole,
  setMemberNickname,
  setMemberRoles,
  setMemberTimeout,
  unbanMember,
} from "../discord-bot";
import {
  assertMemberManageableByBot,
  assertRoleManageableByBot,
  getBotHighestRole,
  ModerationError,
} from "./hierarchy";

export interface ModerationActor {
  source: AuditSource;
  id: string;
  label?: string;
}

async function loadGuildContext(guildId: string) {
  const [roles, botUserId, guild] = await Promise.all([
    fetchGuildRoles(guildId),
    getBotUserId(),
    fetchGuild(guildId),
  ]);
  const botMember = await fetchGuildMember(guildId, botUserId);
  const botHighest = getBotHighestRole(roles, botMember);
  return { roles, botMember, botHighest, botUserId, ownerId: guild.owner_id };
}

async function audit(
  actor: ModerationActor,
  guildId: string,
  input: {
    action: AuditAction;
    targetType: "member" | "role" | "ban";
    targetId: string;
    detail?: Record<string, unknown>;
    success: boolean;
    errorMessage?: string;
  },
) {
  await recordAuditLog(getDb(), {
    guildId,
    source: actor.source,
    actorId: actor.id,
    actorLabel: actor.label,
    ...input,
  });
}

function mapDiscordError(error: unknown): never {
  if (error instanceof ModerationError) {
    throw error;
  }
  if (error instanceof DiscordApiError) {
    if (error.status === 404) {
      throw new ModerationError("Discord resource not found.");
    }
    throw new ModerationError(error.message);
  }
  throw error;
}

export async function listRolesForGuild(guildId: string) {
  const roles = await fetchGuildRoles(guildId);
  return roles
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      managed: role.managed,
      position: role.position,
    }));
}

export async function getMemberRoleIds(guildId: string, userId: string) {
  const member = await fetchGuildMember(guildId, userId);
  return member.roles.filter((id) => id !== guildId);
}

export async function moderationAddRole(
  guildId: string,
  userId: string,
  roleId: string,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const role = ctx.roles.find((item) => item.id === roleId);
    if (!role) {
      throw new ModerationError("Role not found.");
    }
    assertRoleManageableByBot(role, ctx.botHighest, guildId);
    const member = await fetchGuildMember(guildId, userId);
    assertMemberManageableByBot(
      member,
      ctx.botHighest,
      ctx.roles,
      ctx.ownerId,
      ctx.botUserId,
    );
    if (member.roles.includes(roleId)) {
      return { ok: true as const, noop: true };
    }
    await addMemberRole(guildId, userId, roleId, actor.label);
    await audit(actor, guildId, {
      action: "role.add",
      targetType: "member",
      targetId: userId,
      detail: { roleId, roleName: role.name },
      success: true,
    });
    return { ok: true as const, noop: false };
  } catch (error) {
    await audit(actor, guildId, {
      action: "role.add",
      targetType: "member",
      targetId: userId,
      detail: { roleId },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationRemoveRole(
  guildId: string,
  userId: string,
  roleId: string,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const role = ctx.roles.find((item) => item.id === roleId);
    if (!role) {
      throw new ModerationError("Role not found.");
    }
    assertRoleManageableByBot(role, ctx.botHighest, guildId);
    const member = await fetchGuildMember(guildId, userId);
    if (!member.roles.includes(roleId)) {
      return { ok: true as const, noop: true };
    }
    await removeMemberRole(guildId, userId, roleId);
    await audit(actor, guildId, {
      action: "role.remove",
      targetType: "member",
      targetId: userId,
      detail: { roleId, roleName: role.name },
      success: true,
    });
    return { ok: true as const, noop: false };
  } catch (error) {
    await audit(actor, guildId, {
      action: "role.remove",
      targetType: "member",
      targetId: userId,
      detail: { roleId },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationSetRoles(
  guildId: string,
  userId: string,
  roleIds: string[],
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const member = await fetchGuildMember(guildId, userId);
    assertMemberManageableByBot(
      member,
      ctx.botHighest,
      ctx.roles,
      ctx.ownerId,
      ctx.botUserId,
    );
    for (const roleId of roleIds) {
      const role = ctx.roles.find((item) => item.id === roleId);
      if (!role) {
        throw new ModerationError(`Unknown role ${roleId}.`);
      }
      assertRoleManageableByBot(role, ctx.botHighest, guildId);
    }
    const unique = [...new Set(roleIds)];
    await setMemberRoles(guildId, userId, unique);
    await audit(actor, guildId, {
      action: "role.set",
      targetType: "member",
      targetId: userId,
      detail: { roleIds: unique },
      success: true,
    });
    return { ok: true as const };
  } catch (error) {
    await audit(actor, guildId, {
      action: "role.set",
      targetType: "member",
      targetId: userId,
      detail: { roleIds },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationKick(
  guildId: string,
  userId: string,
  reason: string | undefined,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const member = await fetchGuildMember(guildId, userId);
    assertMemberManageableByBot(
      member,
      ctx.botHighest,
      ctx.roles,
      ctx.ownerId,
      ctx.botUserId,
    );
    await kickMember(guildId, userId, reason);
    await audit(actor, guildId, {
      action: "member.kick",
      targetType: "member",
      targetId: userId,
      detail: { reason },
      success: true,
    });
    return { ok: true as const };
  } catch (error) {
    await audit(actor, guildId, {
      action: "member.kick",
      targetType: "member",
      targetId: userId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationBan(
  guildId: string,
  userId: string,
  reason: string | undefined,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const member = await fetchGuildMember(guildId, userId);
    assertMemberManageableByBot(
      member,
      ctx.botHighest,
      ctx.roles,
      ctx.ownerId,
      ctx.botUserId,
    );
    await banMember(guildId, userId, reason);
    await audit(actor, guildId, {
      action: "member.ban",
      targetType: "member",
      targetId: userId,
      detail: { reason },
      success: true,
    });
    return { ok: true as const };
  } catch (error) {
    await audit(actor, guildId, {
      action: "member.ban",
      targetType: "member",
      targetId: userId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationUnban(
  guildId: string,
  userId: string,
  actor: ModerationActor,
) {
  try {
    await unbanMember(guildId, userId);
    await audit(actor, guildId, {
      action: "member.unban",
      targetType: "ban",
      targetId: userId,
      success: true,
    });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 404) {
      return { ok: true as const, noop: true };
    }
    await audit(actor, guildId, {
      action: "member.unban",
      targetType: "ban",
      targetId: userId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationTimeout(
  guildId: string,
  userId: string,
  minutes: number,
  reason: string | undefined,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const member = await fetchGuildMember(guildId, userId);
    assertMemberManageableByBot(
      member,
      ctx.botHighest,
      ctx.roles,
      ctx.ownerId,
      ctx.botUserId,
    );
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    await setMemberTimeout(guildId, userId, until, reason);
    await audit(actor, guildId, {
      action: "member.timeout",
      targetType: "member",
      targetId: userId,
      detail: { minutes, until },
      success: true,
    });
    return { ok: true as const, until };
  } catch (error) {
    await audit(actor, guildId, {
      action: "member.timeout",
      targetType: "member",
      targetId: userId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationUntimeout(
  guildId: string,
  userId: string,
  actor: ModerationActor,
) {
  try {
    const member = await fetchGuildMember(guildId, userId);
    if (!member.communication_disabled_until) {
      return { ok: true as const, noop: true };
    }
    await setMemberTimeout(guildId, userId, null);
    await audit(actor, guildId, {
      action: "member.untimeout",
      targetType: "member",
      targetId: userId,
      success: true,
    });
    return { ok: true as const, noop: false };
  } catch (error) {
    await audit(actor, guildId, {
      action: "member.untimeout",
      targetType: "member",
      targetId: userId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export async function moderationNickname(
  guildId: string,
  userId: string,
  nickname: string | null,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadGuildContext(guildId);
    const member = await fetchGuildMember(guildId, userId);
    assertMemberManageableByBot(
      member,
      ctx.botHighest,
      ctx.roles,
      ctx.ownerId,
      ctx.botUserId,
    );
    await setMemberNickname(guildId, userId, nickname, actor.label);
    await audit(actor, guildId, {
      action: "member.nickname",
      targetType: "member",
      targetId: userId,
      detail: { nickname },
      success: true,
    });
    return { ok: true as const };
  } catch (error) {
    await audit(actor, guildId, {
      action: "member.nickname",
      targetType: "member",
      targetId: userId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}

export const ModerationPermissions = Permission;
