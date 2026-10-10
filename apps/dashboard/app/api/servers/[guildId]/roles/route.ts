import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { handleModerationError, jsonError } from "@/lib/api/http";
import { devHelpersEnabled, devRoles, DEV_GUILD_ID } from "@/lib/dev-fixtures";
import { parseRoleCreateInput } from "@/lib/moderation/role-create";
import {
  listRolesForGuild,
  moderationCreateRole,
} from "@/lib/moderation/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageRoles,
    "Manage Roles",
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return NextResponse.json({ roles: devRoles });
  }

  try {
    const roles = await listRolesForGuild(guildId);
    return NextResponse.json({ roles });
  } catch (error) {
    return handleModerationError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageRoles,
    "Manage Roles",
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

  const parsed = parseRoleCreateInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    const role = {
      id: `${Date.now()}`.slice(-18).padStart(18, "9"),
      name: parsed.value.name,
      color: parsed.value.color ?? 0,
      managed: false,
      position: 0,
    };
    return NextResponse.json({ ok: true, role }, { status: 201 });
  }

  try {
    const result = await moderationCreateRole(
      guildId,
      parsed.value,
      access.actor,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleModerationError(error);
  }
}
