import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "@maia/db";
import { listEnabledGuildIdsForPlugin } from "@maia/db";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/plugins";
import { readBearerToken } from "./plugin-api-auth.js";
import type { PluginTokenRegistry } from "./token-registry.js";

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function tryHandlePluginSpacelabEnabledGuildsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  db: Db,
  tokenRegistry: PluginTokenRegistry,
): Promise<boolean> {
  if (
    url.pathname !== "/v1/plugins/spacelab-roster/enabled-guilds" ||
    req.method !== "GET"
  ) {
    return false;
  }

  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    sendJson(res, 401, { error: "missing_token" });
    return true;
  }
  const entry = tokenRegistry.lookup(token);
  if (
    !entry ||
    entry.kind !== "always-on" ||
    entry.pluginId !== SPACELAB_ROSTER_PLUGIN_ID
  ) {
    sendJson(res, 403, { error: "forbidden" });
    return true;
  }

  const guildIds = await listEnabledGuildIdsForPlugin(
    db,
    SPACELAB_ROSTER_PLUGIN_ID,
  );
  sendJson(res, 200, { guildIds });
  return true;
}
