import http from "node:http";
import type { PluginTokenRegistry } from "./token-registry.js";

export interface PluginApiServerOptions {
  host?: string;
  port: number;
  tokenRegistry: PluginTokenRegistry;
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

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}`);
    const match = url.pathname.match(/^\/v1\/guilds\/([^/]+)\/ping$/);
    if (req.method === "GET" && match) {
      const guildId = match[1];
      const token = readBearerToken(req.headers.authorization);
      if (!token) {
        sendJson(res, 401, { error: "missing_token" });
        return;
      }
      const entry = options.tokenRegistry.assertGuildAccess(token, guildId);
      if (!entry) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, pluginId: entry.pluginId });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
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
