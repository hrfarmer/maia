import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb, requestPluginScanRefresh } from "@maia/db";
import { jsonError } from "@/lib/api/http";
import { DEV_GUILD_ID, devHelpersEnabled } from "@/lib/dev-fixtures";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
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
    return NextResponse.json({
      refresh: {
        requestedAt: new Date().toISOString(),
        pending: false,
      },
    });
  }

  const db = getDb();
  try {
    const requestedAt = await requestPluginScanRefresh(db);
    return NextResponse.json({
      refresh: {
        requestedAt: requestedAt.toISOString(),
        pending: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to request plugin scan";
    return jsonError(message, 500);
  }
}
