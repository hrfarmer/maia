import { NextResponse } from "next/server";
import {
  enqueuePluginGuildConfigNotification,
  getDb,
  listGuildPluginEnvValues,
} from "@maia/db";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/plugins";
import { jsonError } from "@/lib/api/http";
import {
  buildSpacelabAdaptRolesView,
  createDbSpacelabRosterRepository,
  queueSpacelabAdaptForceSync,
} from "@/lib/plugins/spacelab-adapt-roles-service";
import { listRolesForGuild } from "@/lib/moderation/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";
import { Permission } from "@maia/discord";

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

  const db = getDb();
  const envRows = await listGuildPluginEnvValues(
    db,
    guildId,
    SPACELAB_ROSTER_PLUGIN_ID,
  );
  const rosterColumn = envRows.find((row) => row.envKey === "ROSTER_COLUMN")?.value;
  if (!rosterColumn) {
    return jsonError("ROSTER_COLUMN is not configured", 400);
  }

  await queueSpacelabAdaptForceSync(db, guildId);
  await enqueuePluginGuildConfigNotification(db, {
    pluginId: SPACELAB_ROSTER_PLUGIN_ID,
    guildId,
    changeType: "force_sync_requested",
  });

  const repo = createDbSpacelabRosterRepository(db, guildId);
  const guildRoles = await listRolesForGuild(guildId);
  const view = await buildSpacelabAdaptRolesView(
    repo,
    guildRoles.map((role) => ({ id: role.id, name: role.name })),
  );
  return NextResponse.json(view);
}
