import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ModerationError,
  listViewableGuildChannels,
  parseMessageSendInput,
  sendGuildChannelMessage,
  type ModerationActor,
} from "@maia/moderation";
import { isDiscordSnowflake, readJsonBody } from "./plugin-api-auth.js";

export interface PluginMessageHandlers {
  listViewableGuildChannels: typeof listViewableGuildChannels;
  sendGuildChannelMessage: typeof sendGuildChannelMessage;
}

export function defaultPluginMessageHandlers(): PluginMessageHandlers {
  return {
    listViewableGuildChannels,
    sendGuildChannelMessage,
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

  const messagesMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/channels\/([^/]+)\/messages$/,
  );
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
