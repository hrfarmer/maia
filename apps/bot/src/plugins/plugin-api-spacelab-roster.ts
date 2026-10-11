import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "@maia/db";
import {
  getSpacelabReconcileState,
  getSpacelabGuildCycleState,
  ingestSpacelabLabRosterMessage,
  listGuildPluginEnvValues,
  saveSpacelabGuildCycleState,
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

  const cycleMatch = url.pathname.match(
    /^\/v1\/guilds\/([^/]+)\/spacelab-roster\/cycle-state$/,
  );
  if (cycleMatch && cycleMatch[1] === guildId) {
    if (req.method === "GET") {
      const state = await getSpacelabGuildCycleState(db, guildId);
      sendJson(res, 200, {
        lastCycleAt: state.lastCycleAt?.toISOString() ?? null,
        lastError: state.lastError,
        lastParsedMessageId: state.lastParsedMessageId,
        pendingArchiveMessageIds: state.pendingArchiveMessageIds,
        adaptLinksRevision: state.adaptLinksRevision,
        lastProcessedAdaptLinksRevision: state.lastProcessedAdaptLinksRevision,
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
        lastCycleAt?: string | null;
        lastError?: string | null;
        lastParsedMessageId?: string | null;
        pendingArchiveMessageIds?: string[];
        lastProcessedAdaptLinksRevision?: number;
      };
      const current = await getSpacelabGuildCycleState(db, guildId);
      await saveSpacelabGuildCycleState(db, guildId, {
        lastCycleAt:
          parsed.lastCycleAt === undefined
            ? current.lastCycleAt
            : parsed.lastCycleAt
              ? new Date(parsed.lastCycleAt)
              : null,
        lastError:
          parsed.lastError === undefined ? current.lastError : parsed.lastError,
        lastParsedMessageId:
          parsed.lastParsedMessageId === undefined
            ? current.lastParsedMessageId
            : parsed.lastParsedMessageId,
        pendingArchiveMessageIds:
          parsed.pendingArchiveMessageIds ?? current.pendingArchiveMessageIds,
        lastProcessedAdaptLinksRevision:
          parsed.lastProcessedAdaptLinksRevision ??
          current.lastProcessedAdaptLinksRevision,
        adaptLinksRevision: current.adaptLinksRevision,
      });
      sendJson(res, 200, { ok: true });
      return true;
    }
    return false;
  }

  const ingestMatch = url.pathname.match(
    /^\/v1\/guilds\/([^/]+)\/spacelab-roster\/ingest-message$/,
  );
  if (ingestMatch && ingestMatch[1] === guildId && req.method === "POST") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    const messageBody = (body as { messageBody?: unknown }).messageBody;
    if (typeof messageBody !== "string") {
      sendJson(res, 400, { error: "messageBody must be a string" });
      return true;
    }
    const envRows = await listGuildPluginEnvValues(db, guildId, pluginId);
    const rosterColumn = envRows.find((row) => row.envKey === "ROSTER_COLUMN")
      ?.value;
    if (!rosterColumn) {
      sendJson(res, 400, { error: "ROSTER_COLUMN is not configured" });
      return true;
    }
    const ingested = await ingestSpacelabLabRosterMessage(
      db,
      guildId,
      messageBody,
      rosterColumn,
    );
    if (!ingested.ok) {
      sendJson(res, 422, { error: "roster_parse_failed" });
      return true;
    }
    sendJson(res, 200, { ok: true });
    return true;
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
