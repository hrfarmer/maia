import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import {
  getMemberRoleIds,
  moderationSetRoles,
} from "@/lib/moderation/service";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  if (!/^\d{17,20}$/.test(userId)) {
    return jsonError("Invalid user ID", 400);
  }

  try {
    const roleIds = await getMemberRoleIds(guildId, userId);
    return NextResponse.json({ userId, roleIds });
  } catch (error) {
    return handleModerationError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  if (!/^\d{17,20}$/.test(userId)) {
    return jsonError("Invalid user ID", 400);
  }

  let body: { roleIds?: unknown };
  try {
    body = (await request.json()) as { roleIds?: unknown };
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!Array.isArray(body.roleIds) || !body.roleIds.every((id) => typeof id === "string")) {
    return jsonError("roleIds must be an array of strings", 400);
  }

  try {
    const result = await moderationSetRoles(
      guildId,
      userId,
      body.roleIds,
      auth.actor,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
