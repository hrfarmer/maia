import { eq } from "drizzle-orm";
import type {
  SavedRosterRow,
  SpacelabRememberedMember,
  SpacelabReconcileFailure,
} from "@maia/plugins";
import type { Db } from "./client.js";
import {
  spacelabAdaptRoleLinks,
  spacelabGuildRosterState,
  spacelabReconcileFailures,
  spacelabRememberedMembers,
} from "./schema.js";
import {
  getSpacelabGeneralMemberRoleId,
  getSpacelabLastAppliedAdaptLinks,
  setSpacelabLastAppliedAdaptLinks,
  listSpacelabAdaptRoleLinks,
} from "./spacelab-roster.js";

export interface SpacelabReconcileState {
  rows: SavedRosterRow[];
  adaptValues: string[];
  parsedAt: Date | null;
  links: Map<string, string>;
  generalMemberRoleId: string | null;
  previousAppliedLinks: Map<string, string>;
  previousAppliedGeneralMemberRoleId: string | null;
  rememberedMembers: SpacelabRememberedMember[];
  failures: SpacelabReconcileFailure[];
}

export function mergeSavedRosterUserIds(
  previousRows: SavedRosterRow[] | undefined,
  nextRows: SavedRosterRow[],
): SavedRosterRow[] {
  const priorByHandle = new Map(
    (previousRows ?? []).map((row) => [row.discordHandle.toLowerCase(), row]),
  );
  return nextRows.map((row) => {
    const prior = priorByHandle.get(row.discordHandle.toLowerCase());
    if (!prior?.discordUserId) {
      return { ...row };
    }
    return { ...row, discordUserId: prior.discordUserId };
  });
}

export async function clearSpacelabReconcileFailures(db: Db, guildId: string) {
  await db
    .delete(spacelabReconcileFailures)
    .where(eq(spacelabReconcileFailures.guildId, guildId));
}

export async function getSpacelabReconcileState(
  db: Db,
  guildId: string,
): Promise<SpacelabReconcileState | null> {
  const rosterRow = await db.query.spacelabGuildRosterState.findFirst({
    where: eq(spacelabGuildRosterState.guildId, guildId),
  });
  if (!rosterRow) {
    return null;
  }
  const roster = {
    rows: JSON.parse(rosterRow.rowsJson) as SavedRosterRow[],
    adaptValues: JSON.parse(rosterRow.adaptValuesJson) as string[],
    parsedAt: rosterRow.parsedAt,
  };
  const [links, generalMemberRoleId, lastApplied, remembered, failures] =
    await Promise.all([
      db.query.spacelabAdaptRoleLinks.findMany({
        where: eq(spacelabAdaptRoleLinks.guildId, guildId),
      }),
      getSpacelabGeneralMemberRoleId(db, guildId),
      getSpacelabLastAppliedAdaptLinks(db, guildId),
      db.query.spacelabRememberedMembers.findMany({
        where: eq(spacelabRememberedMembers.guildId, guildId),
      }),
      db.query.spacelabReconcileFailures.findMany({
        where: eq(spacelabReconcileFailures.guildId, guildId),
      }),
    ]);
  return {
    rows: roster.rows as SavedRosterRow[],
    adaptValues: roster.adaptValues,
    parsedAt: roster.parsedAt,
    links: new Map(links.map((row) => [row.adaptValue, row.discordRoleId])),
    generalMemberRoleId,
    previousAppliedLinks: lastApplied.links,
    previousAppliedGeneralMemberRoleId: lastApplied.generalMemberRoleId,
    rememberedMembers: remembered.map((row) => ({
      discordUserId: row.discordUserId,
      discordHandle: row.discordHandle,
      grantedRoleIds: JSON.parse(row.grantedRoleIdsJson) as string[],
    })),
    failures: failures.map((row) => ({
      memberKey: row.memberKey,
      discordHandle: row.discordHandle,
      attempts: row.attempts,
    })),
  };
}

export async function saveSpacelabReconcileResult(
  db: Db,
  guildId: string,
  input: {
    rows: SavedRosterRow[];
    rememberedMembers: SpacelabRememberedMember[];
    failures: SpacelabReconcileFailure[];
  },
) {
  const existing = await db.query.spacelabGuildRosterState.findFirst({
    where: eq(spacelabGuildRosterState.guildId, guildId),
  });
  if (!existing) {
    return;
  }
  await db
    .update(spacelabGuildRosterState)
    .set({ rowsJson: JSON.stringify(input.rows) })
    .where(eq(spacelabGuildRosterState.guildId, guildId));

  await db
    .delete(spacelabRememberedMembers)
    .where(eq(spacelabRememberedMembers.guildId, guildId));
  if (input.rememberedMembers.length > 0) {
    await db.insert(spacelabRememberedMembers).values(
      input.rememberedMembers.map((member) => ({
        guildId,
        discordUserId: member.discordUserId,
        discordHandle: member.discordHandle,
        grantedRoleIdsJson: JSON.stringify(member.grantedRoleIds ?? []),
      })),
    );
  }

  await clearSpacelabReconcileFailures(db, guildId);
  if (input.failures.length > 0) {
    await db.insert(spacelabReconcileFailures).values(
      input.failures.map((failure) => ({
        guildId,
        memberKey: failure.memberKey,
        discordHandle: failure.discordHandle,
        attempts: failure.attempts,
      })),
    );
  }
}

export async function commitSpacelabLastAppliedAdaptLinksFromCurrent(
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
