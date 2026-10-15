import { eq, sql } from "drizzle-orm";
import { MAX_RECONCILE_MEMBER_ATTEMPTS } from "@maia/plugins";
import type { Db } from "./client.js";
import {
  spacelabGuildCycleState,
  spacelabReconcileFailures,
} from "./schema.js";

export interface StoredSpacelabCycleState {
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

export interface SpacelabCycleStatusView {
  lastCycleAt: string | null;
  lastError: string | null;
  pendingMembers: Array<{ discordHandle: string }>;
  exhaustedMembers: Array<{ discordHandle: string }>;
}

const defaultCycleState = (): StoredSpacelabCycleState => ({
  lastCycleAt: null,
  lastError: null,
  lastParsedMessageId: null,
  pendingArchiveMessageIds: [],
  lastFailedParseMessageId: null,
  lastFailedParseReceivedAt: null,
  pendingArchiveAttemptsByMessageId: {},
  adaptLinksRevision: 0,
  lastProcessedAdaptLinksRevision: 0,
});

function parsePendingArchiveAttempts(
  raw: string | null | undefined,
): Record<string, number> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parsePendingArchiveIds(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function rowToState(
  row: typeof spacelabGuildCycleState.$inferSelect,
): StoredSpacelabCycleState {
  return {
    lastCycleAt: row.lastCycleAt,
    lastError: row.lastError,
    lastParsedMessageId: row.lastParsedMessageId,
    pendingArchiveMessageIds: parsePendingArchiveIds(
      row.pendingArchiveMessageIdsJson,
    ),
    lastFailedParseMessageId: row.lastFailedParseMessageId ?? null,
    lastFailedParseReceivedAt: row.lastFailedParseReceivedAt ?? null,
    pendingArchiveAttemptsByMessageId: parsePendingArchiveAttempts(
      row.pendingArchiveAttemptsJson,
    ),
    adaptLinksRevision: row.adaptLinksRevision,
    lastProcessedAdaptLinksRevision: row.lastProcessedAdaptLinksRevision,
  };
}

export async function getSpacelabGuildCycleState(
  db: Db,
  guildId: string,
): Promise<StoredSpacelabCycleState> {
  const row = await db.query.spacelabGuildCycleState.findFirst({
    where: eq(spacelabGuildCycleState.guildId, guildId),
  });
  if (!row) {
    return defaultCycleState();
  }
  return rowToState(row);
}

export async function saveSpacelabGuildCycleState(
  db: Db,
  guildId: string,
  patch: Partial<StoredSpacelabCycleState>,
) {
  const current = await getSpacelabGuildCycleState(db, guildId);
  const next: StoredSpacelabCycleState = {
    ...current,
    ...patch,
  };
  await db
    .insert(spacelabGuildCycleState)
    .values({
      guildId,
      lastCycleAt: next.lastCycleAt,
      lastError: next.lastError,
      lastParsedMessageId: next.lastParsedMessageId,
      pendingArchiveMessageIdsJson: JSON.stringify(
        next.pendingArchiveMessageIds,
      ),
      lastFailedParseMessageId: next.lastFailedParseMessageId,
      lastFailedParseReceivedAt: next.lastFailedParseReceivedAt,
      pendingArchiveAttemptsJson: JSON.stringify(
        next.pendingArchiveAttemptsByMessageId,
      ),
      adaptLinksRevision: next.adaptLinksRevision,
      lastProcessedAdaptLinksRevision: next.lastProcessedAdaptLinksRevision,
    })
    .onConflictDoUpdate({
      target: spacelabGuildCycleState.guildId,
      set: {
        lastCycleAt: next.lastCycleAt,
        lastError: next.lastError,
        lastParsedMessageId: next.lastParsedMessageId,
        pendingArchiveMessageIdsJson: JSON.stringify(
          next.pendingArchiveMessageIds,
        ),
        lastFailedParseMessageId: next.lastFailedParseMessageId,
        lastFailedParseReceivedAt: next.lastFailedParseReceivedAt,
        pendingArchiveAttemptsJson: JSON.stringify(
          next.pendingArchiveAttemptsByMessageId,
        ),
        adaptLinksRevision: next.adaptLinksRevision,
        lastProcessedAdaptLinksRevision: next.lastProcessedAdaptLinksRevision,
      },
    });
}

export async function bumpSpacelabAdaptLinksRevision(db: Db, guildId: string) {
  await db
    .insert(spacelabGuildCycleState)
    .values({
      guildId,
      adaptLinksRevision: 1,
    })
    .onConflictDoUpdate({
      target: spacelabGuildCycleState.guildId,
      set: {
        adaptLinksRevision: sql`${spacelabGuildCycleState.adaptLinksRevision} + 1`,
      },
    });
}

export async function buildSpacelabCycleStatusView(
  db: Db,
  guildId: string,
): Promise<SpacelabCycleStatusView> {
  const [cycle, failures] = await Promise.all([
    getSpacelabGuildCycleState(db, guildId),
    db.query.spacelabReconcileFailures.findMany({
      where: eq(spacelabReconcileFailures.guildId, guildId),
    }),
  ]);
  const pendingMembers: Array<{ discordHandle: string }> = [];
  const exhaustedMembers: Array<{ discordHandle: string }> = [];
  for (const failure of failures) {
    const target =
      failure.attempts >= MAX_RECONCILE_MEMBER_ATTEMPTS
        ? exhaustedMembers
        : pendingMembers;
    target.push({ discordHandle: failure.discordHandle });
  }
  pendingMembers.sort((a, b) =>
    a.discordHandle.localeCompare(b.discordHandle),
  );
  exhaustedMembers.sort((a, b) =>
    a.discordHandle.localeCompare(b.discordHandle),
  );
  return {
    lastCycleAt: cycle.lastCycleAt?.toISOString() ?? null,
    lastError: cycle.lastError,
    pendingMembers,
    exhaustedMembers,
  };
}
