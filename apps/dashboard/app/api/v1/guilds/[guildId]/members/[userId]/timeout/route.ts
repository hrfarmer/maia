import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import {
  moderationTimeout,
  moderationUntimeout,
} from "@/lib/moderation/service";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  if (!/^\d{17,20}$/.test(userId)) {
    return jsonError("Invalid user ID", 400);
  }

  let body: { minutes?: unknown; reason?: string };
  try {
    body = (await request.json()) as { minutes?: unknown; reason?: string };
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (typeof body.minutes !== "number" || body.minutes < 1 || body.minutes > 40320) {
    return jsonError("minutes must be between 1 and 40320", 400);
  }

  try {
    const result = await moderationTimeout(
      guildId,
      userId,
      body.minutes,
      body.reason,
      auth.actor,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
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
    const result = await moderationUntimeout(guildId, userId, auth.actor);
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
