import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
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
  parseRosterSenderEmailPatch,
  saveSpacelabAdaptRoleLinks,
  saveSpacelabRosterSenderEmailSetting,
} from "@/lib/plugins/spacelab-adapt-roles-service";
import {
  getDevSpacelabAdaptRolesView,
  patchDevSpacelabAdaptRoleLinks,
  patchDevSpacelabGeneralMemberRoleId,
  patchDevSpacelabRosterSenderEmail,
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

  const record =
    body && typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  if (!record) {
    return jsonError("Invalid body", 400);
  }

  const links =
    "links" in record &&
    typeof record.links === "object" &&
    record.links !== null
      ? (record.links as Record<string, unknown>)
      : null;
  const generalMemberRoleIdRaw = record.generalMemberRoleId;
  const hasGeneralMemberRoleId = "generalMemberRoleId" in record;
  const rosterSenderEmailRaw = record.rosterSenderEmail;
  const hasRosterSenderEmail = "rosterSenderEmail" in record;
  if (!links && !hasGeneralMemberRoleId && !hasRosterSenderEmail) {
    return jsonError(
      "Expected links, generalMemberRoleId, and/or rosterSenderEmail",
      400,
    );
  }

  const normalized: Record<string, string | null> = {};
  if (links) {
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
  }

  let generalMemberRoleId: string | null | undefined;
  if (hasGeneralMemberRoleId) {
    if (generalMemberRoleIdRaw === null) {
      generalMemberRoleId = null;
    } else if (typeof generalMemberRoleIdRaw === "string") {
      if (generalMemberRoleIdRaw.trim() === "") {
        return jsonError("Invalid generalMemberRoleId", 400);
      }
      generalMemberRoleId = generalMemberRoleIdRaw;
    } else {
      return jsonError("Invalid generalMemberRoleId", 400);
    }
  }

  let rosterSenderEmail: string | null | undefined;
  if (hasRosterSenderEmail) {
    const parsedSender = parseRosterSenderEmailPatch(rosterSenderEmailRaw);
    if (!parsedSender.ok) {
      return jsonError("Invalid rosterSenderEmail", 400);
    }
    rosterSenderEmail = parsedSender.email;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    if (links) {
      patchDevSpacelabAdaptRoleLinks(normalized);
    }
    if (hasGeneralMemberRoleId) {
      patchDevSpacelabGeneralMemberRoleId(generalMemberRoleId ?? null);
    }
    if (hasRosterSenderEmail) {
      patchDevSpacelabRosterSenderEmail(rosterSenderEmail ?? null);
    }
    return NextResponse.json(getDevSpacelabAdaptRolesView());
  }

  const db = getDb();
  const repo = createDbSpacelabRosterRepository(db, guildId);

  if (links || hasGeneralMemberRoleId) {
    const envRows = await listGuildPluginEnvValues(
      db,
      guildId,
      SPACELAB_ROSTER_PLUGIN_ID,
    );
    const rosterColumn = envRows.find((row) => row.envKey === "ROSTER_COLUMN")
      ?.value;
    if (!rosterColumn) {
      return jsonError("ROSTER_COLUMN is not configured", 400);
    }
  }
  const guildRoles = await listRolesForGuild(guildId);
  const allowedRoleIds = new Set(guildRoles.map((role) => role.id));
  for (const roleId of Object.values(normalized)) {
    if (roleId !== null && !allowedRoleIds.has(roleId)) {
      return jsonError("Role is not in this guild", 400);
    }
  }
  if (
    generalMemberRoleId &&
    !allowedRoleIds.has(generalMemberRoleId)
  ) {
    return jsonError("Role is not in this guild", 400);
  }

  if (links || hasGeneralMemberRoleId) {
    await saveSpacelabAdaptRoleLinks(
      repo,
      normalized,
      hasGeneralMemberRoleId ? (generalMemberRoleId ?? null) : undefined,
    );
  }
  if (hasRosterSenderEmail) {
    await saveSpacelabRosterSenderEmailSetting(
      repo,
      rosterSenderEmail ?? null,
    );
  }
  await enqueuePluginGuildConfigNotification(db, {
    pluginId: SPACELAB_ROSTER_PLUGIN_ID,
    guildId,
    changeType: hasRosterSenderEmail ? "values_saved" : "adapt_roles_saved",
  });
  const view = await buildSpacelabAdaptRolesView(
    repo,
    guildRoles.map((role) => ({ id: role.id, name: role.name })),
  );
  return NextResponse.json(view);
}
