import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "@maia/db";
import {
  getSpacelabReconcileState,
  saveSpacelabReconcileResult,
} from "@maia/db";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/plugins";
import { readJsonBody } from "./plugin-api-auth.js";

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function tryHandlePluginSpacelabRosterRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  guildId: string,
  pluginId: string,
  db: Db,
): Promise<boolean> {
  if (pluginId !== SPACELAB_ROSTER_PLUGIN_ID) {
    return false;
  }

  const stateMatch = url.pathname.match(
    /^\/v1\/guilds\/([^/]+)\/spacelab-roster\/reconcile-state$/,
  );
  if (!stateMatch || stateMatch[1] !== guildId) {
    return false;
  }

  if (req.method === "GET") {
    const state = await getSpacelabReconcileState(db, guildId);
    if (!state) {
      sendJson(res, 404, { error: "no_roster" });
      return true;
    }
    sendJson(res, 200, {
      rows: state.rows,
      links: Object.fromEntries(state.links.entries()),
      rememberedMembers: state.rememberedMembers,
      failures: state.failures,
    });
    return true;
  }

  if (req.method === "PUT") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    const parsed = body as {
      rows?: unknown;
      rememberedMembers?: unknown;
      failures?: unknown;
    };
    if (!Array.isArray(parsed.rows)) {
      sendJson(res, 400, { error: "rows must be an array" });
      return true;
    }
    if (!Array.isArray(parsed.rememberedMembers)) {
      sendJson(res, 400, { error: "rememberedMembers must be an array" });
      return true;
    }
    if (!Array.isArray(parsed.failures)) {
      sendJson(res, 400, { error: "failures must be an array" });
      return true;
    }

    await saveSpacelabReconcileResult(db, guildId, {
      rows: parsed.rows as Parameters<
        typeof saveSpacelabReconcileResult
      >[2]["rows"],
      rememberedMembers: parsed.rememberedMembers as Parameters<
        typeof saveSpacelabReconcileResult
      >[2]["rememberedMembers"],
      failures: parsed.failures as Parameters<
        typeof saveSpacelabReconcileResult
      >[2]["failures"],
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}
