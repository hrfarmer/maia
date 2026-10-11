import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb } from "@maia/db";
import { jsonError } from "@/lib/api/http";
import { requestGuildPluginRun } from "@/lib/plugins/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; pluginId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { guildId, pluginId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  const db = getDb();
  const result = await requestGuildPluginRun(db, guildId, pluginId);
  if ("error" in result) {
    return jsonError(result.error ?? "Invalid request", 400);
  }

  return NextResponse.json({ runId: result.runId });
}
