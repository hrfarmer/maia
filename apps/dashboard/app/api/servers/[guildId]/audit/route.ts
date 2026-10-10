import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb, listAuditLogs } from "@maia/db";
import { devAudit, devHelpersEnabled, DEV_GUILD_ID } from "@/lib/dev-fixtures";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
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
    return NextResponse.json({ entries: devAudit });
  }

  const db = getDb();
  const entries = await listAuditLogs(db, guildId, 100);
  return NextResponse.json({ entries });
}
