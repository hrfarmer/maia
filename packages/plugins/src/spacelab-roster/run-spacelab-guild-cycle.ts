import {
  isLabRosterExportMessage,
  labRosterNotRecognizedReason,
  parseLabRosterMessage,
} from "./parse.js";
import type { GraphMailboxClient, GraphMailboxMessage } from "./graph-mailbox.js";
import {
  fetchGuildMailboxAccessToken,
  fetchGuildRosterColumn,
  fetchSpacelabCycleState,
  ingestSpacelabRosterMessageViaApi,
  saveSpacelabCycleState,
  type MaiaSpacelabPluginApiConfig,
} from "./maia-spacelab-plugin-api.js";
import { runSpacelabGuildReconcile } from "./run-spacelab-reconcile.js";
import type { SpacelabReconcilePassMode } from "./types.js";

export interface RunSpacelabGuildCycleResult {
  ok: boolean;
  skippedReason?:
    | "mailbox_not_connected"
    | "token_refresh_failed"
    | "pending_archive"
    | "no_roster_column"
    | "unparseable_roster"
    | "no_new_roster";
  notRosterReason?: string;
  archivedMessageIds?: string[];
}

function sortRosterMessages(messages: GraphMailboxMessage[]): GraphMailboxMessage[] {
  return [...messages].sort((a, b) =>
    b.receivedDateTime.localeCompare(a.receivedDateTime),
  );
}

function rosterMessagesInInbox(
  messages: GraphMailboxMessage[],
  rosterColumn: string,
): GraphMailboxMessage[] {
  return sortRosterMessages(
    messages.filter((message) =>
      isLabRosterExportMessage(message.bodyContent, rosterColumn),
    ),
  );
}

function newestInboxMessage(
  messages: GraphMailboxMessage[],
): GraphMailboxMessage | undefined {
  return sortRosterMessages(messages)[0];
}

function diagnoseNewestNonRosterInboxMessage(
  messages: GraphMailboxMessage[],
  rosterColumn: string,
): string | undefined {
  if (messages.length === 0) {
    return undefined;
  }
  const newest = newestInboxMessage(messages);
  if (!newest) {
    return undefined;
  }
  if (isLabRosterExportMessage(newest.bodyContent, rosterColumn)) {
    return undefined;
  }
  return labRosterNotRecognizedReason(newest.bodyContent, rosterColumn) ?? "not_roster";
}

async function archiveMessages(
  graph: GraphMailboxClient,
  accessToken: string,
  messageIds: string[],
): Promise<{ archived: string[]; failed: string[] }> {
  const archived: string[] = [];
  const failed: string[] = [];
  for (const messageId of messageIds) {
    try {
      await graph.moveMessageToArchive(accessToken, messageId);
      archived.push(messageId);
    } catch {
      failed.push(messageId);
    }
  }
  return { archived, failed };
}

async function recordCycleEnd(
  config: MaiaSpacelabPluginApiConfig,
  patch: Parameters<typeof saveSpacelabCycleState>[1],
) {
  await saveSpacelabCycleState(config, {
    lastCycleAt: new Date(),
    ...patch,
  });
}

export async function runSpacelabGuildCycle(input: {
  config: MaiaSpacelabPluginApiConfig;
  graph: GraphMailboxClient;
  forceFullPass?: boolean;
}): Promise<RunSpacelabGuildCycleResult> {
  const { config, graph } = input;
  const cycleState = await fetchSpacelabCycleState(config);

  const tokenResult = await fetchGuildMailboxAccessToken(config);
  if (!tokenResult.ok) {
    const lastError =
      tokenResult.reason === "not_connected"
        ? "mailbox_not_connected"
        : "microsoft_token_refresh_failed";
    await recordCycleEnd(config, { lastError });
    return {
      ok: false,
      skippedReason:
        tokenResult.reason === "not_connected"
          ? "mailbox_not_connected"
          : "token_refresh_failed",
    };
  }
  const accessToken = tokenResult.accessToken;

  if (cycleState.pendingArchiveMessageIds.length > 0) {
    const { failed } = await archiveMessages(
      graph,
      accessToken,
      cycleState.pendingArchiveMessageIds,
    );
    if (failed.length > 0) {
      await recordCycleEnd(config, {
        lastError: "archive_move_failed",
        pendingArchiveMessageIds: failed,
      });
      return { ok: false, skippedReason: "pending_archive" };
    }
    await recordCycleEnd(config, {
      lastError: null,
      pendingArchiveMessageIds: [],
    });
    return { ok: true, skippedReason: "pending_archive", archivedMessageIds: [] };
  }

  const rosterColumn = await fetchGuildRosterColumn(config);
  if (!rosterColumn) {
    await recordCycleEnd(config, { lastError: "roster_column_not_configured" });
    return { ok: false, skippedReason: "no_roster_column" };
  }

  const inboxMessages = await graph.listInboxMessages(accessToken);
  const rosterMessages = rosterMessagesInInbox(inboxMessages, rosterColumn);
  const newestRoster = rosterMessages[0];

  const linksRevisionChanged =
    cycleState.adaptLinksRevision > cycleState.lastProcessedAdaptLinksRevision;
  const hasNewRoster =
    Boolean(newestRoster) &&
    newestRoster!.id !== cycleState.lastParsedMessageId;

  if (!hasNewRoster) {
    const notRosterReason =
      rosterMessages.length === 0
        ? diagnoseNewestNonRosterInboxMessage(inboxMessages, rosterColumn)
        : undefined;
    if (input.forceFullPass || linksRevisionChanged) {
      const mode: SpacelabReconcilePassMode = { kind: "full" };
      await runSpacelabGuildReconcile(config, mode);
      await recordCycleEnd(config, {
        lastError: null,
        lastProcessedAdaptLinksRevision: cycleState.adaptLinksRevision,
      });
      return { ok: true, skippedReason: "no_new_roster", notRosterReason };
    }

    await runSpacelabGuildReconcile(config, { kind: "retry-failures-only" });
    await recordCycleEnd(config, { lastError: null });
    return { ok: true, skippedReason: "no_new_roster", notRosterReason };
  }

  const parsed = parseLabRosterMessage(newestRoster!.bodyContent, rosterColumn);
  if (!parsed.ok) {
    await recordCycleEnd(config, { lastError: null });
    return { ok: false, skippedReason: "unparseable_roster" };
  }

  const ingested = await ingestSpacelabRosterMessageViaApi(
    config,
    newestRoster!.bodyContent,
  );
  if (!ingested.ok) {
    await recordCycleEnd(config, { lastError: null });
    return { ok: false, skippedReason: "unparseable_roster" };
  }

  await runSpacelabGuildReconcile(config, { kind: "full" });

  const newestReceived = newestRoster!.receivedDateTime;
  const toArchive = rosterMessages
    .filter((message) => message.receivedDateTime <= newestReceived)
    .map((message) => message.id);
  const { failed } = await archiveMessages(graph, accessToken, toArchive);

  await recordCycleEnd(config, {
    lastError: failed.length > 0 ? "archive_move_failed" : null,
    lastParsedMessageId: newestRoster!.id,
    pendingArchiveMessageIds: failed,
    lastProcessedAdaptLinksRevision: cycleState.adaptLinksRevision,
  });

  return {
    ok: true,
    archivedMessageIds: toArchive.filter((id) => !failed.includes(id)),
  };
}
