import { and, eq } from "drizzle-orm";
import {
  parseLabRosterMessage,
  type ParsedRosterRow,
  SPACELAB_ROSTER_PLUGIN_ID,
} from "@maia/plugins";
import type { Db } from "./client.js";
import {
  spacelabAdaptRoleLinks,
  spacelabGuildRosterState,
} from "./schema.js";

export interface StoredSpacelabRosterState {
  rows: ParsedRosterRow[];
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
    rows: JSON.parse(row.rowsJson) as ParsedRosterRow[],
    adaptValues: JSON.parse(row.adaptValuesJson) as string[],
    parsedAt: row.parsedAt,
  };
}

export async function listSpacelabAdaptRoleLinks(db: Db, guildId: string) {
  return db.query.spacelabAdaptRoleLinks.findMany({
    where: eq(spacelabAdaptRoleLinks.guildId, guildId),
  });
}

export async function upsertSpacelabParsedRoster(
  db: Db,
  guildId: string,
  input: { rows: ParsedRosterRow[]; adaptValues: string[] },
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
  await upsertSpacelabParsedRoster(db, guildId, {
    rows: parsed.rows,
    adaptValues: parsed.adaptRoleValues,
  });
  return { ok: true };
}

export { SPACELAB_ROSTER_PLUGIN_ID };
