import { NextResponse } from "next/server";
import {
  parseMessageSendInput,
  sendGuildChannelMessage,
} from "@/lib/moderation/service";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";

interface RouteContext {
  params: Promise<{ guildId: string; channelId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId, channelId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = parseMessageSendInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  try {
    const result = await sendGuildChannelMessage(
      guildId,
      channelId,
      parsed.value,
      auth.actor,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleModerationError(error);
  }
}
