import { NextResponse } from "next/server";
import {
  addGuildChannelMessageReaction,
  parseReactionEmoji,
  parseReactionRemoveQuery,
  removeGuildChannelMessageReaction,
} from "@/lib/moderation/service";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";

interface RouteContext {
  params: Promise<{
    guildId: string;
    channelId: string;
    messageId: string;
    emoji: string;
  }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const { guildId, channelId, messageId, emoji: emojiRaw } =
    await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  const parsedEmoji = parseReactionEmoji(emojiRaw);
  if (!parsedEmoji.ok) {
    return jsonError(parsedEmoji.error, 400);
  }

  try {
    const result = await addGuildChannelMessageReaction(
      guildId,
      channelId,
      messageId,
      parsedEmoji.emoji,
      auth.actor,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { guildId, channelId, messageId, emoji: emojiRaw } =
    await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  const parsedEmoji = parseReactionEmoji(emojiRaw);
  if (!parsedEmoji.ok) {
    return jsonError(parsedEmoji.error, 400);
  }

  const parsedQuery = parseReactionRemoveQuery(
    new URL(request.url).searchParams,
  );
  if (!parsedQuery.ok) {
    return jsonError(parsedQuery.error, 400);
  }

  try {
    const result = await removeGuildChannelMessageReaction(
      guildId,
      channelId,
      messageId,
      parsedEmoji.emoji,
      auth.actor,
      parsedQuery.value,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleModerationError(error);
  }
}
