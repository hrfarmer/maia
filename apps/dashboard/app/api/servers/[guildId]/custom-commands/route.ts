import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import {
  getCustomCommandSyncStatus,
  getDb,
  listGuildCustomCommands,
} from "@maia/db";
import { jsonError } from "@/lib/api/http";
import {
  createCustomCommandForGuild,
  CustomCommandConflictError,
  CustomCommandValidationError,
} from "@/lib/custom-commands/service";
import { DEV_GUILD_ID, devCustomCommands, devHelpersEnabled } from "@/lib/dev-fixtures";
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
    return NextResponse.json({
      commands: devCustomCommands,
      sync: { syncedAt: new Date().toISOString(), syncError: null },
    });
  }

  const db = getDb();
  const [commands, sync] = await Promise.all([
    listGuildCustomCommands(db, guildId),
    getCustomCommandSyncStatus(db, guildId),
  ]);

  return NextResponse.json({
    commands,
    sync: {
      syncedAt: sync.syncedAt?.toISOString() ?? null,
      syncError: sync.syncError,
    },
  });
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

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return jsonError("Custom commands are read-only in dev fixtures mode", 501);
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    responseText?: string;
    ephemeral?: boolean;
  };

  try {
    const result = await createCustomCommandForGuild(
      guildId,
      { id: access.actor.id, label: access.actor.label },
      {
        name: body.name ?? "",
        description: body.description ?? "",
        responseText: body.responseText ?? "",
        ephemeral: body.ephemeral,
      },
    );
    return NextResponse.json({
      command: result.command,
      sync: result.sync,
    });
  } catch (error) {
    if (error instanceof CustomCommandValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof CustomCommandConflictError) {
      return jsonError(error.message, 409);
    }
    throw error;
  }
}
