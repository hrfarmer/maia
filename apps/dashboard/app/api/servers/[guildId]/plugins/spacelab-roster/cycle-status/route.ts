import { buildSpacelabCycleStatusView, getDb } from "@maia/db";
import { requireSessionGuildAccess } from "@/lib/session-auth";
import { Permission } from "@maia/discord";
import { DEV_GUILD_ID, devHelpersEnabled } from "@/lib/dev-fixtures";
import { getDevSpacelabCycleStatus } from "@/lib/dev-spacelab-cycle";

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
    return Response.json(getDevSpacelabCycleStatus());
  }

  const db = getDb();
  const view = await buildSpacelabCycleStatusView(db, guildId);
  return Response.json(view);
}
