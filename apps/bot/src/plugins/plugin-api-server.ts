import http from "node:http";
import type { Db } from "@maia/db";
import {
  loadGuildPluginValuesForApi,
  resolvePluginTokenForGuild,
} from "./plugin-api-access.js";
import type { PluginTokenRegistry } from "./token-registry.js";

export interface PluginApiServerOptions {
  host?: string;
  port: number;
  tokenRegistry: PluginTokenRegistry;
  db: Db;
  assertGuildApiAccess?: (
    token: string,
    guildId: string,
  ) => Promise<{ pluginId: string } | null>;
  loadGuildValues?: (
    guildId: string,
    pluginId: string,
  ) => Promise<Record<string, string>>;
}

function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createPluginApiServer(options: PluginApiServerOptions) {
  const host = options.host ?? "127.0.0.1";

  const assertGuildApiAccess =
    options.assertGuildApiAccess ??
    (async (token, guildId) => {
      const entry = await resolvePluginTokenForGuild(
        options.db,
        options.tokenRegistry,
        token,
        guildId,
      );
      return entry ? { pluginId: entry.pluginId } : null;
    });

  const loadGuildValues =
    options.loadGuildValues ??
    ((guildId, pluginId) =>
      loadGuildPluginValuesForApi(options.db, guildId, pluginId));

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://${host}`);
      const pingMatch = url.pathname.match(/^\/v1\/guilds\/([^/]+)\/ping$/);
      const valuesMatch = url.pathname.match(/^\/v1\/guilds\/([^/]+)\/values$/);

      if (req.method === "GET" && (pingMatch || valuesMatch)) {
        const guildId = (pingMatch ?? valuesMatch)![1];
        const token = readBearerToken(req.headers.authorization);
        if (!token) {
          sendJson(res, 401, { error: "missing_token" });
          return;
        }
        const entry = await assertGuildApiAccess(token, guildId);
        if (!entry) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        if (pingMatch) {
          sendJson(res, 200, { ok: true, pluginId: entry.pluginId });
          return;
        }
        const values = await loadGuildValues(guildId, entry.pluginId);
        sendJson(res, 200, { values });
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    })().catch((error) => {
      console.error("Plugin API request failed", error);
      sendJson(res, 500, { error: "internal_error" });
    });
  });

  return {
    host,
    port: options.port,
    server,
    async listen() {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port, host, () => resolve());
      });
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
    url() {
      const address = server.address();
      if (address && typeof address === "object") {
        return `http://${host}:${address.port}`;
      }
      return `http://${host}:${options.port}`;
    },
  };
}
