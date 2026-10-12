import { and, eq } from "drizzle-orm";
import {
  parseLabRosterMessage,
  type ParsedRosterRow,
  type SavedRosterRow,
  SPACELAB_ROSTER_PLUGIN_ID,
} from "@maia/plugins";
import {
  clearSpacelabReconcileFailures,
  mergeSavedRosterUserIds,
} from "./spacelab-reconcile.js";
import type { Db } from "./client.js";
import {
  spacelabAdaptRoleLinks,
  spacelabGuildAdaptSettings,
  spacelabGuildRosterState,
} from "./schema.js";

export interface StoredSpacelabRosterState {
  rows: SavedRosterRow[];
  adaptValues: string[];
  parsedAt: Date;
}

export async function getSpacelabGuildRosterState(
  db: Db,
  guildId: string,
): Promise<StoredSpacelabRosterState | null> {
  const row = await db.query.spacelabGuildRosterState.findFirst({
    where: eq(spacelabGuildRosterState.guildId, guildId),
  });
  if (!row) {
    return null;
  }
  return {
    rows: JSON.parse(row.rowsJson) as SavedRosterRow[],
    adaptValues: JSON.parse(row.adaptValuesJson) as string[],
    parsedAt: row.parsedAt,
  };
}

export async function listSpacelabAdaptRoleLinks(db: Db, guildId: string) {
  return db.query.spacelabAdaptRoleLinks.findMany({
    where: eq(spacelabAdaptRoleLinks.guildId, guildId),
  });
}

export async function getSpacelabGeneralMemberRoleId(
  db: Db,
  guildId: string,
): Promise<string | null> {
  const row = await db.query.spacelabGuildAdaptSettings.findFirst({
    where: eq(spacelabGuildAdaptSettings.guildId, guildId),
  });
  return row?.generalMemberRoleId ?? null;
}

export async function setSpacelabGeneralMemberRoleId(
  db: Db,
  guildId: string,
  generalMemberRoleId: string | null,
) {
  await db
    .insert(spacelabGuildAdaptSettings)
    .values({ guildId, generalMemberRoleId })
    .onConflictDoUpdate({
      target: spacelabGuildAdaptSettings.guildId,
      set: { generalMemberRoleId },
    });
}

export interface SpacelabLastAppliedAdaptLinks {
  links: Map<string, string>;
  generalMemberRoleId: string | null;
}

export async function getSpacelabLastAppliedAdaptLinks(
  db: Db,
  guildId: string,
): Promise<SpacelabLastAppliedAdaptLinks> {
  const row = await db.query.spacelabGuildAdaptSettings.findFirst({
    where: eq(spacelabGuildAdaptSettings.guildId, guildId),
  });
  if (!row) {
    return { links: new Map(), generalMemberRoleId: null };
  }
  const parsed = JSON.parse(row.lastAppliedLinksJson) as Record<string, string>;
  return {
    links: new Map(Object.entries(parsed)),
    generalMemberRoleId: row.lastAppliedGeneralMemberRoleId ?? null,
  };
}

export async function setSpacelabLastAppliedAdaptLinks(
  db: Db,
  guildId: string,
  links: Map<string, string>,
  generalMemberRoleId: string | null,
) {
  await db
    .insert(spacelabGuildAdaptSettings)
    .values({
      guildId,
      lastAppliedLinksJson: JSON.stringify(Object.fromEntries(links)),
      lastAppliedGeneralMemberRoleId: generalMemberRoleId,
    })
    .onConflictDoUpdate({
      target: spacelabGuildAdaptSettings.guildId,
      set: {
        lastAppliedLinksJson: JSON.stringify(Object.fromEntries(links)),
        lastAppliedGeneralMemberRoleId: generalMemberRoleId,
      },
    });
}

export interface SpacelabForceSyncState {
  forceSyncPending: boolean;
  lastForceSyncRequestedAt: Date | null;
  lastForceSyncCompletedAt: Date | null;
  lastForceSyncOk: boolean | null;
  lastForceSyncError: string | null;
}

export async function getSpacelabForceSyncState(
  db: Db,
  guildId: string,
): Promise<SpacelabForceSyncState> {
  const row = await db.query.spacelabGuildAdaptSettings.findFirst({
    where: eq(spacelabGuildAdaptSettings.guildId, guildId),
  });
  if (!row) {
    return {
      forceSyncPending: false,
      lastForceSyncRequestedAt: null,
      lastForceSyncCompletedAt: null,
      lastForceSyncOk: null,
      lastForceSyncError: null,
    };
  }
  return {
    forceSyncPending: row.forceSyncPending,
    lastForceSyncRequestedAt: row.lastForceSyncRequestedAt ?? null,
    lastForceSyncCompletedAt: row.lastForceSyncCompletedAt ?? null,
    lastForceSyncOk: row.lastForceSyncOk ?? null,
    lastForceSyncError: row.lastForceSyncError ?? null,
  };
}

export async function queueSpacelabForceSync(db: Db, guildId: string) {
  const now = new Date();
  await db
    .insert(spacelabGuildAdaptSettings)
    .values({
      guildId,
      forceSyncPending: true,
      lastForceSyncRequestedAt: now,
    })
    .onConflictDoUpdate({
      target: spacelabGuildAdaptSettings.guildId,
      set: {
        forceSyncPending: true,
        lastForceSyncRequestedAt: now,
      },
    });
}

export async function completeSpacelabForceSync(
  db: Db,
  guildId: string,
  input: { ok: boolean; error?: string | null },
) {
  await db
    .insert(spacelabGuildAdaptSettings)
    .values({
      guildId,
      forceSyncPending: false,
      lastForceSyncCompletedAt: new Date(),
      lastForceSyncOk: input.ok,
      lastForceSyncError: input.error ?? null,
    })
    .onConflictDoUpdate({
      target: spacelabGuildAdaptSettings.guildId,
      set: {
        forceSyncPending: false,
        lastForceSyncCompletedAt: new Date(),
        lastForceSyncOk: input.ok,
        lastForceSyncError: input.error ?? null,
      },
    });
}

export async function snapshotSpacelabCurrentAdaptLinksAsLastApplied(
  db: Db,
  guildId: string,
) {
  const [linkRows, generalMemberRoleId] = await Promise.all([
    listSpacelabAdaptRoleLinks(db, guildId),
    getSpacelabGeneralMemberRoleId(db, guildId),
  ]);
  await setSpacelabLastAppliedAdaptLinks(
    db,
    guildId,
    new Map(linkRows.map((row) => [row.adaptValue, row.discordRoleId])),
    generalMemberRoleId,
  );
}

export async function upsertSpacelabParsedRoster(
  db: Db,
  guildId: string,
  input: { rows: SavedRosterRow[]; adaptValues: string[] },
) {
  const rowsJson = JSON.stringify(input.rows);
  const adaptValuesJson = JSON.stringify(input.adaptValues);
  await db
    .insert(spacelabGuildRosterState)
    .values({
      guildId,
      rowsJson,
      adaptValuesJson,
    })
    .onConflictDoUpdate({
      target: spacelabGuildRosterState.guildId,
      set: {
        rowsJson,
        adaptValuesJson,
        parsedAt: new Date(),
      },
    });
}

export async function setSpacelabAdaptRoleLink(
  db: Db,
  guildId: string,
  adaptValue: string,
  discordRoleId: string | null,
) {
  if (discordRoleId === null) {
    await db
      .delete(spacelabAdaptRoleLinks)
      .where(
        and(
          eq(spacelabAdaptRoleLinks.guildId, guildId),
          eq(spacelabAdaptRoleLinks.adaptValue, adaptValue),
        ),
      );
    return;
  }
  await db
    .insert(spacelabAdaptRoleLinks)
    .values({
      guildId,
      adaptValue,
      discordRoleId,
    })
    .onConflictDoUpdate({
      target: [
        spacelabAdaptRoleLinks.guildId,
        spacelabAdaptRoleLinks.adaptValue,
      ],
      set: { discordRoleId },
    });
}

export async function ingestSpacelabLabRosterMessage(
  db: Db,
  guildId: string,
  message: string,
  rosterColumn: string,
): Promise<{ ok: true } | { ok: false }> {
  const parsed = parseLabRosterMessage(message, rosterColumn);
  if (!parsed.ok) {
    return { ok: false };
  }
  const prior = await getSpacelabGuildRosterState(db, guildId);
  const rows = mergeSavedRosterUserIds(prior?.rows, parsed.rows);
  await upsertSpacelabParsedRoster(db, guildId, {
    rows,
    adaptValues: parsed.adaptRoleValues,
  });
  await clearSpacelabReconcileFailures(db, guildId);
  return { ok: true };
}

export { SPACELAB_ROSTER_PLUGIN_ID };
