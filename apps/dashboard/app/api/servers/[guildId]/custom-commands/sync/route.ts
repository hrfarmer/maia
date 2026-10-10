import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { jsonError } from "@/lib/api/http";
import { syncGuildCustomCommandsToDiscord } from "@/lib/custom-commands/sync";
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
      sync: { ok: true, syncedAt: new Date().toISOString() },
    });
  }

  try {
    const sync = await syncGuildCustomCommandsToDiscord(guildId);
    if (!sync.ok) {
      return NextResponse.json({ sync }, { status: 502 });
    }
    return NextResponse.json({ sync });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discord sync failed";
    return jsonError(message, 500);
  }
}
