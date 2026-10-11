import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ModerationError,
  addGuildChannelMessageReaction,
  deleteGuildChannelMessage,
  listGuildChannelMessages,
  listViewableGuildChannels,
  parseMessageListQuery,
  parseMessageSendInput,
  parseReactionEmoji,
  parseReactionRemoveQuery,
  removeGuildChannelMessageReaction,
  sendGuildChannelMessage,
  type ModerationActor,
} from "@maia/moderation";
import { isDiscordSnowflake, readJsonBody } from "./plugin-api-auth.js";

export interface PluginMessageHandlers {
  listViewableGuildChannels: typeof listViewableGuildChannels;
  listGuildChannelMessages: typeof listGuildChannelMessages;
  sendGuildChannelMessage: typeof sendGuildChannelMessage;
  deleteGuildChannelMessage: typeof deleteGuildChannelMessage;
  addGuildChannelMessageReaction: typeof addGuildChannelMessageReaction;
  removeGuildChannelMessageReaction: typeof removeGuildChannelMessageReaction;
}

export function defaultPluginMessageHandlers(): PluginMessageHandlers {
  return {
    listViewableGuildChannels,
    listGuildChannelMessages,
    sendGuildChannelMessage,
    deleteGuildChannelMessage,
    addGuildChannelMessageReaction,
    removeGuildChannelMessageReaction,
  };
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function handleMessageError(res: ServerResponse, error: unknown) {
  if (error instanceof ModerationError) {
    sendJson(res, 400, { error: error.message });
    return;
  }
  if (error instanceof Error) {
    sendJson(res, 500, { error: error.message });
    return;
  }
  sendJson(res, 500, { error: "Unexpected error" });
}

export async function tryHandlePluginMessagesRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  guildId: string,
  actor: ModerationActor,
  handlers: PluginMessageHandlers,
): Promise<boolean> {
  const pathname = url.pathname;

  const channelsMatch = pathname.match(/^\/v1\/guilds\/([^/]+)\/channels$/);
  if (channelsMatch && channelsMatch[1] === guildId && req.method === "GET") {
    try {
      const channels = await handlers.listViewableGuildChannels(guildId);
      sendJson(res, 200, { channels });
    } catch (error) {
      handleMessageError(res, error);
    }
    return true;
  }

  const reactionMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/channels\/([^/]+)\/messages\/([^/]+)\/reactions\/([^/]+)$/,
  );
  if (reactionMatch && reactionMatch[1] === guildId) {
    const channelId = reactionMatch[2]!;
    const messageId = reactionMatch[3]!;
    const emojiRaw = reactionMatch[4]!;
    if (!isDiscordSnowflake(channelId) || !isDiscordSnowflake(messageId)) {
      sendJson(res, 400, { error: "Invalid channel or message ID" });
      return true;
    }
    const parsedEmoji = parseReactionEmoji(emojiRaw);
    if (!parsedEmoji.ok) {
      sendJson(res, 400, { error: parsedEmoji.error });
      return true;
    }
    if (req.method === "PUT") {
      try {
        const result = await handlers.addGuildChannelMessageReaction(
          guildId,
          channelId,
          messageId,
          parsedEmoji.emoji,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleMessageError(res, error);
      }
      return true;
    }
    if (req.method === "DELETE") {
      const parsedQuery = parseReactionRemoveQuery(url.searchParams);
      if (!parsedQuery.ok) {
        sendJson(res, 400, { error: parsedQuery.error });
        return true;
      }
      try {
        const result = await handlers.removeGuildChannelMessageReaction(
          guildId,
          channelId,
          messageId,
          parsedEmoji.emoji,
          actor,
          parsedQuery.value,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleMessageError(res, error);
      }
      return true;
    }
  }

  const messageItemMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/channels\/([^/]+)\/messages\/([^/]+)$/,
  );
  if (messageItemMatch && messageItemMatch[1] === guildId && req.method === "DELETE") {
    const channelId = messageItemMatch[2]!;
    const messageId = messageItemMatch[3]!;
    if (!isDiscordSnowflake(channelId) || !isDiscordSnowflake(messageId)) {
      sendJson(res, 400, { error: "Invalid channel or message ID" });
      return true;
    }
    try {
      const result = await handlers.deleteGuildChannelMessage(
        guildId,
        channelId,
        messageId,
        actor,
      );
      sendJson(res, 200, result as Record<string, unknown>);
    } catch (error) {
      handleMessageError(res, error);
    }
    return true;
  }

  const messagesMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/channels\/([^/]+)\/messages$/,
  );
  if (messagesMatch && messagesMatch[1] === guildId && req.method === "GET") {
    const channelId = messagesMatch[2]!;
    if (!isDiscordSnowflake(channelId)) {
      sendJson(res, 400, { error: "Invalid channel ID" });
      return true;
    }
    const parsedQuery = parseMessageListQuery(url.searchParams);
    if (!parsedQuery.ok) {
      sendJson(res, 400, { error: parsedQuery.error });
      return true;
    }
    try {
      const result = await handlers.listGuildChannelMessages(
        guildId,
        channelId,
        parsedQuery.value,
      );
      sendJson(res, 200, result as Record<string, unknown>);
    } catch (error) {
      handleMessageError(res, error);
    }
    return true;
  }
  if (messagesMatch && messagesMatch[1] === guildId && req.method === "POST") {
    const channelId = messagesMatch[2];
    if (!isDiscordSnowflake(channelId)) {
      sendJson(res, 400, { error: "Invalid channel ID" });
      return true;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    const parsed = parseMessageSendInput(body);
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error });
      return true;
    }
    try {
      const result = await handlers.sendGuildChannelMessage(
        guildId,
        channelId,
        parsed.value,
        actor,
      );
      sendJson(res, 201, result as Record<string, unknown>);
    } catch (error) {
      handleMessageError(res, error);
    }
    return true;
  }

  return false;
}
