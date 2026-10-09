import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { handleModerationError, jsonError } from "@/lib/api/http";
import {
  devHelpersEnabled,
  devMembers,
  DEV_GUILD_ID,
} from "@/lib/dev-fixtures";
import {
  getMemberRoleIds,
  moderationAddRole,
  moderationRemoveRole,
  moderationSetRoles,
} from "@/lib/moderation/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageRoles,
    "Manage Roles",
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    const member = devMembers.find((item) => item.user.id === userId);
    return NextResponse.json({
      roleIds: member?.roles ?? [],
    });
  }

  try {
    const roleIds = await getMemberRoleIds(guildId, userId);
    return NextResponse.json({ roleIds });
  } catch (error) {
    return handleModerationError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageRoles,
    "Manage Roles",
  );
  if ("error" in access) {
    return access.error;
  }

  const body = (await request.json()) as { roleId?: string; action?: string };
  if (body.action === "add" && body.roleId) {
    if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
      return NextResponse.json({ ok: true, noop: false });
    }
    try {
      return NextResponse.json(
        await moderationAddRole(guildId, userId, body.roleId, access.actor),
      );
    } catch (error) {
      return handleModerationError(error);
    }
  }
  if (body.action === "remove" && body.roleId) {
    if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
      return NextResponse.json({ ok: true, noop: false });
    }
    try {
      return NextResponse.json(
        await moderationRemoveRole(guildId, userId, body.roleId, access.actor),
      );
    } catch (error) {
      return handleModerationError(error);
    }
  }
  if (body.action === "set" && Array.isArray((body as { roleIds?: string[] }).roleIds)) {
    const roleIds = (body as { roleIds: string[] }).roleIds;
    if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
      return NextResponse.json({ ok: true });
    }
    try {
      return NextResponse.json(
        await moderationSetRoles(guildId, userId, roleIds, access.actor),
      );
    } catch (error) {
      return handleModerationError(error);
    }
  }

  return jsonError("Invalid action", 400);
}
