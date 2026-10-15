import type { SpacelabReconcilePassMode } from "./types.js";

export interface SpacelabCycleState {
  lastCycleAt: Date | null;
  lastError: string | null;
  lastParsedMessageId: string | null;
  pendingArchiveMessageIds: string[];
  lastFailedParseMessageId: string | null;
  lastFailedParseReceivedAt: string | null;
  pendingArchiveAttemptsByMessageId: Record<string, number>;
  adaptLinksRevision: number;
  lastProcessedAdaptLinksRevision: number;
}

export interface MaiaSpacelabPluginApiConfig {
  pluginUrl: string;
  pluginToken: string;
  guildId: string;
  fetchImpl?: typeof fetch;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type MailboxAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "not_connected" | "refresh_failed" };

export async function fetchGuildMailboxAccessToken(
  config: MaiaSpacelabPluginApiConfig,
): Promise<MailboxAccessTokenResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/microsoft/access-token`,
    { headers: authHeaders(config.pluginToken) },
  );
  if (response.status === 404) {
    return { ok: false, reason: "not_connected" };
  }
  if (response.status === 502) {
    return { ok: false, reason: "refresh_failed" };
  }
  if (!response.ok) {
    throw new Error(`access_token_failed:${response.status}`);
  }
  const body = (await response.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error("access_token_missing");
  }
  return { ok: true, accessToken: body.accessToken };
}

export async function fetchGuildRosterColumn(
  config: MaiaSpacelabPluginApiConfig,
): Promise<string | null> {
  const values = await fetchGuildPluginValues(config);
  const column = values?.ROSTER_COLUMN;
  return typeof column === "string" && column.length > 0 ? column : null;
}

export async function fetchGuildRosterSenderEmail(
  config: MaiaSpacelabPluginApiConfig,
): Promise<string | null> {
  const values = await fetchGuildPluginValues(config);
  const sender = values?.ROSTER_SENDER_EMAIL;
  if (typeof sender !== "string") {
    return null;
  }
  const trimmed = sender.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchGuildPluginValues(
  config: MaiaSpacelabPluginApiConfig,
): Promise<Record<string, string> | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/values`,
    { headers: authHeaders(config.pluginToken) },
  );
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { values?: Record<string, string> };
  return body.values ?? null;
}

export async function fetchSpacelabCycleState(
  config: MaiaSpacelabPluginApiConfig,
): Promise<SpacelabCycleState> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/spacelab-roster/cycle-state`,
    { headers: authHeaders(config.pluginToken) },
  );
  if (!response.ok) {
    throw new Error(`cycle_state_failed:${response.status}`);
  }
  const body = (await response.json()) as {
    lastCycleAt?: string | null;
    lastError?: string | null;
    lastParsedMessageId?: string | null;
    pendingArchiveMessageIds?: string[];
    lastFailedParseMessageId?: string | null;
    lastFailedParseReceivedAt?: string | null;
    pendingArchiveAttemptsByMessageId?: Record<string, number>;
    adaptLinksRevision?: number;
    lastProcessedAdaptLinksRevision?: number;
  };
  return {
    lastCycleAt: body.lastCycleAt ? new Date(body.lastCycleAt) : null,
    lastError: body.lastError ?? null,
    lastParsedMessageId: body.lastParsedMessageId ?? null,
    pendingArchiveMessageIds: body.pendingArchiveMessageIds ?? [],
    lastFailedParseMessageId: body.lastFailedParseMessageId ?? null,
    lastFailedParseReceivedAt: body.lastFailedParseReceivedAt ?? null,
    pendingArchiveAttemptsByMessageId:
      body.pendingArchiveAttemptsByMessageId ?? {},
    adaptLinksRevision: body.adaptLinksRevision ?? 0,
    lastProcessedAdaptLinksRevision: body.lastProcessedAdaptLinksRevision ?? 0,
  };
}

export async function saveSpacelabCycleState(
  config: MaiaSpacelabPluginApiConfig,
  patch: Partial<SpacelabCycleState>,
) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/spacelab-roster/cycle-state`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(config.pluginToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lastCycleAt: patch.lastCycleAt?.toISOString() ?? undefined,
        lastError: patch.lastError,
        lastParsedMessageId: patch.lastParsedMessageId,
        pendingArchiveMessageIds: patch.pendingArchiveMessageIds,
        lastFailedParseMessageId: patch.lastFailedParseMessageId,
        lastFailedParseReceivedAt: patch.lastFailedParseReceivedAt,
        pendingArchiveAttemptsByMessageId: patch.pendingArchiveAttemptsByMessageId,
        lastProcessedAdaptLinksRevision: patch.lastProcessedAdaptLinksRevision,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`save_cycle_state_failed:${response.status}`);
  }
}

export async function ingestSpacelabRosterMessageViaApi(
  config: MaiaSpacelabPluginApiConfig,
  messageBody: string,
): Promise<{ ok: true } | { ok: false }> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/spacelab-roster/ingest-message`,
    {
      method: "POST",
      headers: {
        ...authHeaders(config.pluginToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messageBody }),
    },
  );
  if (response.status === 422) {
    return { ok: false };
  }
  if (!response.ok) {
    throw new Error(`ingest_message_failed:${response.status}`);
  }
  return { ok: true };
}

export async function fetchSpacelabEnabledGuildIds(
  config: Pick<MaiaSpacelabPluginApiConfig, "pluginUrl" | "pluginToken" | "fetchImpl">,
): Promise<string[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/plugins/spacelab-roster/enabled-guilds`,
    { headers: authHeaders(config.pluginToken) },
  );
  if (!response.ok) {
    throw new Error(`enabled_guilds_failed:${response.status}`);
  }
  const body = (await response.json()) as { guildIds?: string[] };
  return body.guildIds ?? [];
}

export type { SpacelabReconcilePassMode };
