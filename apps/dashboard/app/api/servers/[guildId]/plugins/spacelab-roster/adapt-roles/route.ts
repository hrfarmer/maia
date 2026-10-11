import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb, listGuildPluginEnvValues } from "@maia/db";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/plugins";
import { jsonError } from "@/lib/api/http";
import {
  buildSpacelabAdaptRolesView,
  createDbSpacelabRosterRepository,
  saveSpacelabAdaptRoleLinks,
} from "@/lib/plugins/spacelab-adapt-roles-service";
import {
  getDevSpacelabAdaptRolesView,
  patchDevSpacelabAdaptRoleLinks,
} from "@/lib/dev-spacelab-adapt-roles";
import { DEV_GUILD_ID, devHelpersEnabled } from "@/lib/dev-fixtures";
import { listRolesForGuild } from "@/lib/moderation/service";
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
    return NextResponse.json(getDevSpacelabAdaptRolesView());
  }

  const db = getDb();
  const repo = createDbSpacelabRosterRepository(db, guildId);
  const roles = await listRolesForGuild(guildId);
  const view = await buildSpacelabAdaptRolesView(
    repo,
    roles.map((role) => ({ id: role.id, name: role.name })),
  );
  return NextResponse.json(view);
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const links =
    body &&
    typeof body === "object" &&
    body !== null &&
    "links" in body &&
    typeof (body as { links: unknown }).links === "object" &&
    (body as { links: unknown }).links !== null
      ? ((body as { links: Record<string, unknown> }).links as Record<
          string,
          unknown
        >)
      : null;
  if (!links) {
    return jsonError("Expected links object", 400);
  }

  const normalized: Record<string, string | null> = {};
  for (const [adaptValue, roleId] of Object.entries(links)) {
    if (roleId === null) {
      normalized[adaptValue] = null;
      continue;
    }
    if (typeof roleId !== "string" || roleId.trim() === "") {
      return jsonError(`Invalid role id for ${adaptValue}`, 400);
    }
    normalized[adaptValue] = roleId;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    patchDevSpacelabAdaptRoleLinks(normalized);
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

  const repo = createDbSpacelabRosterRepository(db, guildId);
  const guildRoles = await listRolesForGuild(guildId);
  const allowedRoleIds = new Set(guildRoles.map((role) => role.id));
  for (const roleId of Object.values(normalized)) {
    if (roleId !== null && !allowedRoleIds.has(roleId)) {
      return jsonError("Role is not in this guild", 400);
    }
  }

  await saveSpacelabAdaptRoleLinks(repo, normalized);
  const view = await buildSpacelabAdaptRolesView(
    repo,
    guildRoles.map((role) => ({ id: role.id, name: role.name })),
  );
  return NextResponse.json(view);
}
