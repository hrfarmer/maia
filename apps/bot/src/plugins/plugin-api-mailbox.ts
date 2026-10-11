import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "@maia/db";
import {
  MailboxNotConnectedError,
  MailboxTokenRefreshError,
  refreshGuildMailboxAccessToken,
} from "./guild-mailbox-access-token.js";

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export interface PluginMailboxHandlers {
  refreshGuildMailboxAccessToken: typeof refreshGuildMailboxAccessToken;
}

export function defaultPluginMailboxHandlers(): PluginMailboxHandlers {
  return { refreshGuildMailboxAccessToken };
}

export async function tryHandlePluginMailboxRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  guildId: string,
  pluginId: string,
  db: Db,
  handlers: PluginMailboxHandlers = defaultPluginMailboxHandlers(),
): Promise<boolean> {
  const accessTokenPath = `/v1/guilds/${guildId}/microsoft/access-token`;
  if (url.pathname !== accessTokenPath || req.method !== "GET") {
    return false;
  }

  try {
    const token = await handlers.refreshGuildMailboxAccessToken(
      db,
      guildId,
      pluginId,
    );
    sendJson(res, 200, {
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
    });
  } catch (error) {
    if (error instanceof MailboxNotConnectedError) {
      sendJson(res, 404, { error: error.message });
      return true;
    }
    if (error instanceof MailboxTokenRefreshError) {
      sendJson(res, 502, { error: "microsoft_token_refresh_failed" });
      return true;
    }
    throw error;
  }
  return true;
}
