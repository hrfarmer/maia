import { NextResponse } from "next/server";
import {
  completeSpacelabRoleRemoval,
  getDb,
  getSpacelabRoleRemovalFlag,
  ignoreSpacelabRoleRemoval,
  listSpacelabRoleRemovalFlags,
} from "@maia/db";
import { Permission } from "@maia/discord";
import { handleModerationError, jsonError } from "@/lib/api/http";
import { DEV_GUILD_ID, devHelpersEnabled } from "@/lib/dev-fixtures";
import {
  getDevSpacelabRoleRemovalsView,
  resolveDevSpacelabRoleRemoval,
} from "@/lib/dev-spacelab-role-removals";
import {
  listRolesForGuild,
  moderationRemoveRole,
} from "@/lib/moderation/service";
import {
  buildSpacelabRoleRemovalsView,
  parseSpacelabRoleRemovalDecision,
} from "@/lib/plugins/spacelab-role-removals-view";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const decision = parseSpacelabRoleRemovalDecision(body);
  if (!decision) {
    return jsonError("Invalid action", 400);
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    if (!resolveDevSpacelabRoleRemoval(userId)) {
      return jsonError("Flag not found", 404);
    }
    return NextResponse.json(getDevSpacelabRoleRemovalsView());
  }

  const db = getDb();
  const flag = await getSpacelabRoleRemovalFlag(db, guildId, userId);
  if (!flag) {
    return jsonError("Flag not found", 404);
  }

  try {
    const guildRoles = await listRolesForGuild(guildId);
    if (decision.action === "confirm") {
      const guildRoleIds = new Set(guildRoles.map((role) => role.id));
      for (const roleId of flag.roleIds) {
        if (guildRoleIds.has(roleId)) {
          await moderationRemoveRole(guildId, userId, roleId, access.actor);
        }
      }
      await completeSpacelabRoleRemoval(db, guildId, userId, flag.roleIds);
    } else {
      await ignoreSpacelabRoleRemoval(db, guildId, flag, decision.duration);
    }
    const flags = await listSpacelabRoleRemovalFlags(db, guildId);
    return NextResponse.json(buildSpacelabRoleRemovalsView(flags, guildRoles));
  } catch (error) {
    return handleModerationError(error);
  }
}
