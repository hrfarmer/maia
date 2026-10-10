import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import { moderationKick } from "@/lib/moderation/service";

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

  let reason: string | undefined;
  try {
    const body = (await request.json()) as { reason?: string };
    reason = body.reason;
  } catch {
    reason = undefined;
  }

  try {
    const result = await moderationKick(guildId, userId, reason, auth.actor);
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
