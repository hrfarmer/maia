import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { jsonError } from "@/lib/api/http";
import {
  CustomCommandConflictError,
  CustomCommandNotFoundError,
  CustomCommandValidationError,
  deleteCustomCommandForGuild,
  updateCustomCommandForGuild,
} from "@/lib/custom-commands/service";
import { DEV_GUILD_ID, devHelpersEnabled } from "@/lib/dev-fixtures";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; commandId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { guildId, commandId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return jsonError("Custom commands are read-only in dev fixtures mode", 501);
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    responseText?: string;
    enabled?: boolean;
  };

  try {
    const result = await updateCustomCommandForGuild(
      guildId,
      commandId,
      { id: access.actor.id, label: access.actor.label },
      body,
    );
    return NextResponse.json({
      command: result.command,
      sync: result.sync,
    });
  } catch (error) {
    if (error instanceof CustomCommandNotFoundError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof CustomCommandValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof CustomCommandConflictError) {
      return jsonError(error.message, 409);
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { guildId, commandId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return jsonError("Custom commands are read-only in dev fixtures mode", 501);
  }

  try {
    const result = await deleteCustomCommandForGuild(
      guildId,
      commandId,
      { id: access.actor.id, label: access.actor.label },
    );
    return NextResponse.json({ sync: result.sync });
  } catch (error) {
    if (error instanceof CustomCommandNotFoundError) {
      return jsonError(error.message, 404);
    }
    throw error;
  }
}
