import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import {
  moderationAddRole,
  moderationRemoveRole,
} from "@/lib/moderation/service";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string; roleId: string }>;
}

function validateSnowflakes(userId: string, roleId: string) {
  if (!/^\d{17,20}$/.test(userId) || !/^\d{17,20}$/.test(roleId)) {
    return jsonError("Invalid user or role ID", 400);
  }
  return null;
}

export async function PUT(request: Request, context: RouteContext) {
  const { guildId, userId, roleId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  const invalid = validateSnowflakes(userId, roleId);
  if (invalid) {
    return invalid;
  }

  try {
    const result = await moderationAddRole(guildId, userId, roleId, auth.actor);
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { guildId, userId, roleId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  const invalid = validateSnowflakes(userId, roleId);
  if (invalid) {
    return invalid;
  }

  try {
    const result = await moderationRemoveRole(
      guildId,
      userId,
      roleId,
      auth.actor,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
