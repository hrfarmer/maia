import http from "node:http";
import type { Db } from "@maia/db";
import {
  loadGuildPluginValuesForApi,
  resolvePluginTokenForGuild,
} from "./plugin-api-access.js";
import {
  pluginAuditActor,
  readBearerToken,
} from "./plugin-api-auth.js";
import {
  defaultPluginMailboxHandlers,
  tryHandlePluginMailboxRequest,
  type PluginMailboxHandlers,
} from "./plugin-api-mailbox.js";
import {
  defaultPluginMessageHandlers,
  tryHandlePluginMessagesRequest,
  type PluginMessageHandlers,
} from "./plugin-api-messages.js";
import {
  defaultPluginModerationHandlers,
  tryHandlePluginModerationRequest,
  type PluginModerationHandlers,
} from "./plugin-api-moderation.js";
import type { SlashReplyRegistry } from "./slash-reply-registry.js";
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
  moderationHandlers?: PluginModerationHandlers;
  slashReplies?: SlashReplyRegistry;
  messageHandlers?: PluginMessageHandlers;
  mailboxHandlers?: PluginMailboxHandlers;
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

function extractGuildId(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/guilds\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
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

  const moderationHandlers =
    options.moderationHandlers ?? defaultPluginModerationHandlers();

  const messageHandlers =
    options.messageHandlers ?? defaultPluginMessageHandlers();

  const mailboxHandlers =
    options.mailboxHandlers ?? defaultPluginMailboxHandlers();

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://${host}`);
      const guildId = extractGuildId(url.pathname);
      if (!guildId) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      const pingMatch = url.pathname === `/v1/guilds/${guildId}/ping`;
      const valuesMatch = url.pathname === `/v1/guilds/${guildId}/values`;
      const slashReplyMatch = url.pathname === `/v1/guilds/${guildId}/slash-reply`;
      const needsAuth =
        pingMatch ||
        valuesMatch ||
        slashReplyMatch ||
        url.pathname.startsWith(`/v1/guilds/${guildId}/`);

      if (!needsAuth) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

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

      if (pingMatch && req.method === "GET") {
        sendJson(res, 200, { ok: true, pluginId: entry.pluginId });
        return;
      }
      if (valuesMatch && req.method === "GET") {
        const values = await loadGuildValues(guildId, entry.pluginId);
        sendJson(res, 200, { values });
        return;
      }

      if (slashReplyMatch && req.method === "POST" && options.slashReplies) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        let body: { replyToken?: string; text?: string };
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            replyToken?: string;
            text?: string;
          };
        } catch {
          sendJson(res, 400, { error: "invalid_json" });
          return;
        }
        if (!body.replyToken || typeof body.text !== "string") {
          sendJson(res, 400, { error: "invalid_body" });
          return;
        }
        const pending = options.slashReplies.get(body.replyToken);
        if (
          !pending ||
          pending.guildId !== guildId ||
          pending.pluginId !== entry.pluginId
        ) {
          sendJson(res, 404, { error: "no_pending_slash" });
          return;
        }
        await pending.editReply(body.text);
        pending.replySent = true;
        sendJson(res, 200, { ok: true });
        return;
      }

      const actor = pluginAuditActor(entry.pluginId);
      const handled = await tryHandlePluginModerationRequest(
        req,
        res,
        url,
        guildId,
        actor,
        moderationHandlers,
      );
      if (handled) {
        return;
      }

      const messageHandled = await tryHandlePluginMessagesRequest(
        req,
        res,
        url,
        guildId,
        actor,
        messageHandlers,
      );
      if (messageHandled) {
        return;
      }

      const mailboxHandled = await tryHandlePluginMailboxRequest(
        req,
        res,
        url,
        guildId,
        entry.pluginId,
        options.db,
        mailboxHandlers,
      );
      if (mailboxHandled) {
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
