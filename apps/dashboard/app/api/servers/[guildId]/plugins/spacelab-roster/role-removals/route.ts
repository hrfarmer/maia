import { NextResponse } from "next/server";
import { getDb, listSpacelabRoleRemovalFlags } from "@maia/db";
import { Permission } from "@maia/discord";
import { handleModerationError } from "@/lib/api/http";
import { DEV_GUILD_ID, devHelpersEnabled } from "@/lib/dev-fixtures";
import { getDevSpacelabRoleRemovalsView } from "@/lib/dev-spacelab-role-removals";
import { listRolesForGuild } from "@/lib/moderation/service";
import { buildSpacelabRoleRemovalsView } from "@/lib/plugins/spacelab-role-removals-view";
import { requireSessionGuildAccess } from "@/lib/session-auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ guildId: string }> },
) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return NextResponse.json(getDevSpacelabRoleRemovalsView());
  }

  try {
    const [flags, guildRoles] = await Promise.all([
      listSpacelabRoleRemovalFlags(getDb(), guildId),
      listRolesForGuild(guildId),
    ]);
    return NextResponse.json(buildSpacelabRoleRemovalsView(flags, guildRoles));
  } catch (error) {
    return handleModerationError(error);
  }
}
