import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { handleModerationError } from "@/lib/api/http";
import { devHelpersEnabled, devRoles, DEV_GUILD_ID } from "@/lib/dev-fixtures";
import { listRolesForGuild } from "@/lib/moderation/service";
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
