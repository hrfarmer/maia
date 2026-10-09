import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import { moderationNickname } from "@/lib/moderation/service";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  if (!/^\d{17,20}$/.test(userId)) {
    return jsonError("Invalid user ID", 400);
  }

  let body: { nickname?: unknown };
  try {
    body = (await request.json()) as { nickname?: unknown };
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const nickname =
    body.nickname === null
      ? null
      : typeof body.nickname === "string"
        ? body.nickname.trim() || null
        : undefined;

  if (nickname === undefined) {
    return jsonError("nickname must be a string or null", 400);
  }

  try {
    const result = await moderationNickname(
      guildId,
      userId,
      nickname,
      auth.actor,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
