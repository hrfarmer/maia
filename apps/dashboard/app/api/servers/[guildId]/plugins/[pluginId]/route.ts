import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb } from "@maia/db";
import { jsonError } from "@/lib/api/http";
import {
  getGuildPluginsView,
  updateGuildPluginConfig,
} from "@/lib/plugins/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; pluginId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { guildId, pluginId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  const body = (await request.json()) as {
    enabled?: boolean;
    values?: Record<string, string | null>;
    cronExpression?: string | null;
  };

  const db = getDb();
  const result = await updateGuildPluginConfig(db, guildId, pluginId, body);
  if ("error" in result) {
    return jsonError(result.error ?? "Invalid request", 400);
  }

  const view = await getGuildPluginsView(db, guildId);
  const plugin = view.plugins.find((row) => row.pluginId === pluginId);
  return NextResponse.json({ plugin });
}
