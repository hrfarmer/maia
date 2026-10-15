import {
  isLabRosterExportMessage,
  labRosterNotRecognizedReason,
  parseLabRosterMessage,
} from "./parse.js";
import type { GraphMailboxClient, GraphMailboxMessage } from "./graph-mailbox.js";
import { GraphMoveMessageError } from "./graph-mailbox.js";
import {
  fetchGuildMailboxAccessToken,
  fetchGuildRosterColumn,
  fetchGuildRosterSenderEmail,
  fetchSpacelabCycleState,
  ingestSpacelabRosterMessageViaApi,
  saveSpacelabCycleState,
  type MaiaSpacelabPluginApiConfig,
  type SpacelabCycleState,
} from "./maia-spacelab-plugin-api.js";
import {
  resolveGraphMessageFromAddress,
  rosterSenderEmailMatches,
} from "./roster-sender-email.js";
import { fetchSpacelabReconcileState } from "./maia-discord-role-api.js";
import { runSpacelabGuildReconcile } from "./run-spacelab-reconcile.js";
import type { SpacelabReconcilePassMode } from "./types.js";

export const MAX_PENDING_ARCHIVE_ATTEMPTS = 5;

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
  rosterSenderEmail: string | null,
): string | undefined {
  if (messages.length === 0) {
    return undefined;
  }
  const newest = newestInboxMessage(messages);
  if (!newest) {
    return undefined;
  }
  if (isLabRosterExportMessage(newest.bodyContent, rosterColumn)) {
    if (
      rosterSenderEmail &&
      !rosterSenderEmailMatches(
        rosterSenderEmail,
        resolveGraphMessageFromAddress(newest),
      )
    ) {
      return "sender_mismatch";
    }
    return undefined;
  }
  return labRosterNotRecognizedReason(newest.bodyContent, rosterColumn) ?? "not_roster";
}

function inboxMessagesForRosterSender(
  messages: GraphMailboxMessage[],
  rosterSenderEmail: string | null,
): GraphMailboxMessage[] {
  if (!rosterSenderEmail) {
    return messages;
  }
  return messages.filter((message) =>
    rosterSenderEmailMatches(
      rosterSenderEmail,
      resolveGraphMessageFromAddress(message),
    ),
  );
}

function logRosterParseFailed(reason: string) {
  console.log(JSON.stringify({ spacelabRosterCycle: { event: "roster_parse_failed", reason } }));
}

function logArchiveGaveUp(messageId: string, attempts: number) {
  console.log(
    JSON.stringify({
      spacelabRosterCycle: {
        event: "archive_gave_up",
        messageId,
        attempts,
      },
    }),
  );
}

export function shouldAttemptRosterParse(
  newestRoster: GraphMailboxMessage,
  cycleState: SpacelabCycleState,
  savedRosterRowCount: number,
): boolean {
  if (
    newestRoster.id === cycleState.lastParsedMessageId &&
    savedRosterRowCount > 0
  ) {
    return false;
  }
  if (
    newestRoster.id === cycleState.lastFailedParseMessageId &&
    newestRoster.receivedDateTime === cycleState.lastFailedParseReceivedAt
  ) {
    return false;
  }
  if (
    cycleState.lastFailedParseReceivedAt &&
    newestRoster.receivedDateTime < cycleState.lastFailedParseReceivedAt
  ) {
    return false;
  }
  return true;
}

async function archiveMessagesBestEffort(
  graph: GraphMailboxClient,
  accessToken: string,
  messageIds: string[],
  priorAttempts: Record<string, number>,
): Promise<{
  archived: string[];
  stillPending: string[];
  attemptsByMessageId: Record<string, number>;
}> {
  const archived: string[] = [];
  const stillPending: string[] = [];
  const attemptsByMessageId = { ...priorAttempts };

  for (const messageId of messageIds) {
    if (!messageId) {
      continue;
    }
    try {
      await graph.moveMessageToArchive(accessToken, messageId);
      archived.push(messageId);
      delete attemptsByMessageId[messageId];
    } catch (error) {
      if (error instanceof GraphMoveMessageError && error.status === 404) {
        archived.push(messageId);
        delete attemptsByMessageId[messageId];
        continue;
      }
      const nextAttempts = (attemptsByMessageId[messageId] ?? 0) + 1;
      attemptsByMessageId[messageId] = nextAttempts;
      if (nextAttempts >= MAX_PENDING_ARCHIVE_ATTEMPTS) {
        logArchiveGaveUp(messageId, nextAttempts);
        delete attemptsByMessageId[messageId];
        continue;
      }
      stillPending.push(messageId);
    }
  }

  return { archived, stillPending, attemptsByMessageId };
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
  let cycleState = await fetchSpacelabCycleState(config);

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

  const rosterColumn = await fetchGuildRosterColumn(config);
  if (!rosterColumn) {
    await recordCycleEnd(config, { lastError: "roster_column_not_configured" });
    return { ok: false, skippedReason: "no_roster_column" };
  }

  const rosterSenderEmail = await fetchGuildRosterSenderEmail(config);
  const inboxMessages = await graph.listInboxMessages(accessToken);
  const senderFilteredInbox = inboxMessagesForRosterSender(
    inboxMessages,
    rosterSenderEmail,
  );
  const rosterMessages = rosterMessagesInInbox(
    senderFilteredInbox,
    rosterColumn,
  );
  const newestRoster = rosterMessages[0];

  if (cycleState.pendingArchiveMessageIds.length > 0) {
    const archiveResult = await archiveMessagesBestEffort(
      graph,
      accessToken,
      cycleState.pendingArchiveMessageIds,
      cycleState.pendingArchiveAttemptsByMessageId,
    );
    cycleState = {
      ...cycleState,
      pendingArchiveMessageIds: archiveResult.stillPending,
      pendingArchiveAttemptsByMessageId: archiveResult.attemptsByMessageId,
    };
    await recordCycleEnd(config, {
      lastError: archiveResult.stillPending.length > 0 ? "archive_move_failed" : null,
      pendingArchiveMessageIds: archiveResult.stillPending,
      pendingArchiveAttemptsByMessageId: archiveResult.attemptsByMessageId,
    });
  }

  const reconcileState = await fetchSpacelabReconcileState(config);
  const savedRosterRowCount = reconcileState?.rows.length ?? 0;

  const linksRevisionChanged =
    cycleState.adaptLinksRevision > cycleState.lastProcessedAdaptLinksRevision;
  const hasNewRoster =
    Boolean(newestRoster) &&
    shouldAttemptRosterParse(newestRoster!, cycleState, savedRosterRowCount);

  if (!hasNewRoster) {
    const notRosterReason =
      rosterMessages.length === 0
        ? diagnoseNewestNonRosterInboxMessage(
            inboxMessages,
            rosterColumn,
            rosterSenderEmail,
          )
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
    const parseReason =
      parsed.reason === "roster_no_rows"
        ? "roster_no_rows"
        : parsed.reason === "not_recognized"
          ? "not_recognized"
          : "invalid_row";
    logRosterParseFailed(parseReason);
    await recordCycleEnd(config, {
      lastError: parsed.reason === "roster_no_rows" ? "roster_no_rows" : null,
      lastFailedParseMessageId: newestRoster!.id,
      lastFailedParseReceivedAt: newestRoster!.receivedDateTime,
    });
    return { ok: false, skippedReason: "unparseable_roster" };
  }

  const ingested = await ingestSpacelabRosterMessageViaApi(
    config,
    newestRoster!.bodyContent,
  );
  if (!ingested.ok) {
    logRosterParseFailed("ingest_rejected");
    await recordCycleEnd(config, {
      lastError: null,
      lastFailedParseMessageId: newestRoster!.id,
      lastFailedParseReceivedAt: newestRoster!.receivedDateTime,
    });
    return { ok: false, skippedReason: "unparseable_roster" };
  }

  await runSpacelabGuildReconcile(config, { kind: "full" });

  const newestReceived = newestRoster!.receivedDateTime;
  const toArchive = rosterMessages
    .filter((message) => message.receivedDateTime <= newestReceived)
    .map((message) => message.id);
  const pendingIds = [
    ...new Set([...cycleState.pendingArchiveMessageIds, ...toArchive]),
  ];
  const archiveResult = await archiveMessagesBestEffort(
    graph,
    accessToken,
    pendingIds,
    cycleState.pendingArchiveAttemptsByMessageId,
  );

  await recordCycleEnd(config, {
    lastError: archiveResult.stillPending.length > 0 ? "archive_move_failed" : null,
    lastParsedMessageId: newestRoster!.id,
    lastFailedParseMessageId: null,
    lastFailedParseReceivedAt: null,
    pendingArchiveMessageIds: archiveResult.stillPending,
    pendingArchiveAttemptsByMessageId: archiveResult.attemptsByMessageId,
    lastProcessedAdaptLinksRevision: cycleState.adaptLinksRevision,
  });

  return {
    ok: true,
    archivedMessageIds: archiveResult.archived,
  };
}
