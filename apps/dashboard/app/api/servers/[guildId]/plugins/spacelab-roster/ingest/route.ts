import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb, listGuildPluginEnvValues } from "@maia/db";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/plugins";
import { jsonError } from "@/lib/api/http";
import {
  DEV_GUILD_ID,
  devHelpersEnabled,
} from "@/lib/dev-fixtures";
import {
  getDevSpacelabAdaptRolesView,
  ingestDevSpacelabRosterMessage,
} from "@/lib/dev-spacelab-adapt-roles";
import {
  buildSpacelabAdaptRolesView,
  createDbSpacelabRosterRepository,
  ingestSpacelabRosterMessageForGuild,
} from "@/lib/plugins/spacelab-adapt-roles-service";
import { listRolesForGuild } from "@/lib/moderation/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
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

  const message =
    body &&
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message
      : null;
  if (message === null) {
    return jsonError("Expected message string", 400);
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    const result = ingestDevSpacelabRosterMessage(message);
    if (!result.ok) {
      return jsonError("Roster message could not be parsed", 400);
    }
    return NextResponse.json(getDevSpacelabAdaptRolesView());
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

  const ingest = await ingestSpacelabRosterMessageForGuild(
    db,
    guildId,
    message,
    rosterColumn,
  );
  if (!ingest.ok) {
    return jsonError("Roster message could not be parsed", 400);
  }

  const repo = createDbSpacelabRosterRepository(db, guildId);
  const roles = await listRolesForGuild(guildId);
  const view = await buildSpacelabAdaptRolesView(
    repo,
    roles.map((role) => ({ id: role.id, name: role.name })),
  );
  return NextResponse.json(view);
}
