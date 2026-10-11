import { NextResponse } from "next/server";
import { deleteGuildChannelMessage } from "@/lib/moderation/service";
import {
  authenticateApiKey,
  handleModerationError,
} from "@/lib/api/http";

interface RouteContext {
  params: Promise<{ guildId: string; channelId: string; messageId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { guildId, channelId, messageId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const result = await deleteGuildChannelMessage(
      guildId,
      channelId,
      messageId,
      auth.actor,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
