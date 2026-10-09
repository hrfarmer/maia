import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import { moderationUnban } from "@/lib/moderation/service";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  if (!/^\d{17,20}$/.test(userId)) {
    return jsonError("Invalid user ID", 400);
  }

  try {
    const result = await moderationUnban(guildId, userId, auth.actor);
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
