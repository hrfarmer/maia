import {
  buildSpacelabAdaptRoleRows,
  isValidRosterSenderEmail,
  parseLabRosterMessage,
  trimRosterSenderEmail,
  type ParsedRosterRow,
  type SpacelabAdaptRoleRowView,
} from "@maia/plugins";
import type { Db } from "@maia/db";
import {
  bumpSpacelabAdaptLinksRevision,
  clearSpacelabReconcileFailures,
  getSpacelabForceSyncState,
  getSpacelabGeneralMemberRoleId,
  getSpacelabGuildRosterState,
  getSpacelabRosterSenderEmail,
  queueSpacelabForceSync,
  ingestSpacelabLabRosterMessage,
  listSpacelabAdaptRoleLinks,
  setSpacelabAdaptRoleLink,
  setSpacelabGeneralMemberRoleId,
  setSpacelabRosterSenderEmail,
  setSpacelabLastAppliedAdaptLinks,
  upsertSpacelabParsedRoster,
} from "@maia/db";

export interface GuildRoleOption {
  id: string;
  name: string;
}

export interface SpacelabForceSyncView {
  pending: boolean;
  requestedAt: string | null;
  completedAt: string | null;
  ok: boolean | null;
  error: string | null;
}

export interface SpacelabAdaptRolesView {
  adaptRoleRows: SpacelabAdaptRoleRowView[];
  guildRoles: GuildRoleOption[];
  parsedAt: string | null;
  generalMemberRoleId: string | null;
  generalMemberRoleMissing: boolean;
  rosterSenderEmail: string | null;
  forceSync: SpacelabForceSyncView;
}

export interface SpacelabRosterRepository {
  getParsedRoster(): Promise<{
    rows: ParsedRosterRow[];
    adaptValues: string[];
    parsedAt: Date;
  } | null>;
  saveParsedRoster(input: {
    rows: ParsedRosterRow[];
    adaptValues: string[];
  }): Promise<void>;
  getLinkedRoles(): Promise<Map<string, string>>;
  setLinkedRole(adaptValue: string, discordRoleId: string | null): Promise<void>;
  getGeneralMemberRoleId?(): Promise<string | null>;
  setGeneralMemberRoleId?(discordRoleId: string | null): Promise<void>;
  getRosterSenderEmail?(): Promise<string | null>;
  setRosterSenderEmail?(email: string | null): Promise<void>;
  snapshotLastAppliedAdaptLinksBeforeChange?(): Promise<void>;
  getForceSyncState?(): Promise<import("@maia/db").SpacelabForceSyncState>;
  clearReconcileFailures?(): Promise<void>;
  bumpAdaptLinksRevision?(): Promise<void>;
}

export function createDbSpacelabRosterRepository(
  db: Db,
  guildId: string,
): SpacelabRosterRepository {
  return {
    async getParsedRoster() {
      return getSpacelabGuildRosterState(db, guildId);
    },
    async saveParsedRoster(input) {
      await upsertSpacelabParsedRoster(db, guildId, input);
    },
    async getLinkedRoles() {
      const rows = await listSpacelabAdaptRoleLinks(db, guildId);
      return new Map(rows.map((row) => [row.adaptValue, row.discordRoleId]));
    },
    async setLinkedRole(adaptValue, discordRoleId) {
      await setSpacelabAdaptRoleLink(db, guildId, adaptValue, discordRoleId);
    },
    async getGeneralMemberRoleId() {
      return getSpacelabGeneralMemberRoleId(db, guildId);
    },
    async setGeneralMemberRoleId(discordRoleId) {
      await setSpacelabGeneralMemberRoleId(db, guildId, discordRoleId);
    },
    async getRosterSenderEmail() {
      return getSpacelabRosterSenderEmail(db, guildId);
    },
    async setRosterSenderEmail(email) {
      await setSpacelabRosterSenderEmail(db, guildId, email);
    },
    async snapshotLastAppliedAdaptLinksBeforeChange() {
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
    },
    async getForceSyncState() {
      return getSpacelabForceSyncState(db, guildId);
    },
    async clearReconcileFailures() {
      await clearSpacelabReconcileFailures(db, guildId);
    },
    async bumpAdaptLinksRevision() {
      await bumpSpacelabAdaptLinksRevision(db, guildId);
    },
  };
}

export async function ingestSpacelabRosterMessage(
  repo: SpacelabRosterRepository,
  message: string,
  rosterColumn: string,
): Promise<{ ok: true } | { ok: false }> {
  const parsed = parseLabRosterMessage(message, rosterColumn);
  if (!parsed.ok) {
    return { ok: false };
  }
  await repo.saveParsedRoster({
    rows: parsed.rows,
    adaptValues: parsed.adaptRoleValues,
  });
  return { ok: true };
}

export async function buildSpacelabAdaptRolesView(
  repo: SpacelabRosterRepository,
  guildRoles: GuildRoleOption[],
): Promise<SpacelabAdaptRolesView> {
  const [parsed, linkedRoles, generalMemberRoleId, rosterSenderEmail, forceSyncState] =
    await Promise.all([
      repo.getParsedRoster(),
      repo.getLinkedRoles(),
      repo.getGeneralMemberRoleId?.() ?? Promise.resolve(null),
      repo.getRosterSenderEmail?.() ?? Promise.resolve(null),
      repo.getForceSyncState?.() ??
        Promise.resolve({
          forceSyncPending: false,
          lastForceSyncRequestedAt: null,
          lastForceSyncCompletedAt: null,
          lastForceSyncOk: null,
          lastForceSyncError: null,
        }),
    ]);
  const guildRoleIds = new Set(guildRoles.map((role) => role.id));
  const adaptRoleRows = buildSpacelabAdaptRoleRows({
    currentAdaptValues: parsed?.adaptValues ?? [],
    linkedRoles,
    guildRoleIds,
  });
  return {
    adaptRoleRows,
    guildRoles: [...guildRoles].sort((a, b) => a.name.localeCompare(b.name)),
    parsedAt: parsed?.parsedAt.toISOString() ?? null,
    generalMemberRoleId,
    generalMemberRoleMissing: Boolean(
      generalMemberRoleId && !guildRoleIds.has(generalMemberRoleId),
    ),
    rosterSenderEmail,
    forceSync: {
      pending: forceSyncState.forceSyncPending,
      requestedAt: forceSyncState.lastForceSyncRequestedAt?.toISOString() ?? null,
      completedAt:
        forceSyncState.lastForceSyncCompletedAt?.toISOString() ?? null,
      ok: forceSyncState.lastForceSyncOk,
      error: forceSyncState.lastForceSyncError,
    },
  };
}

export async function queueSpacelabAdaptForceSync(db: Db, guildId: string) {
  await queueSpacelabForceSync(db, guildId);
}

export async function saveSpacelabRosterSenderEmailSetting(
  repo: SpacelabRosterRepository,
  rosterSenderEmail: string | null,
) {
  await repo.setRosterSenderEmail?.(rosterSenderEmail);
}

export function parseRosterSenderEmailPatch(
  raw: unknown,
): { ok: true; email: string | null } | { ok: false } {
  if (raw === null) {
    return { ok: true, email: null };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const trimmed = trimRosterSenderEmail(raw);
  if (trimmed === "") {
    return { ok: true, email: null };
  }
  if (!isValidRosterSenderEmail(trimmed)) {
    return { ok: false };
  }
  return { ok: true, email: trimmed };
}

export async function saveSpacelabAdaptRoleLinks(
  repo: SpacelabRosterRepository,
  links: Record<string, string | null>,
  generalMemberRoleId?: string | null,
) {
  if (
    Object.keys(links).length > 0 ||
    generalMemberRoleId !== undefined
  ) {
    await repo.snapshotLastAppliedAdaptLinksBeforeChange?.();
  }
  for (const [adaptValue, discordRoleId] of Object.entries(links)) {
    await repo.setLinkedRole(adaptValue, discordRoleId);
  }
  if (generalMemberRoleId !== undefined) {
    await repo.setGeneralMemberRoleId?.(generalMemberRoleId);
  }
  await repo.clearReconcileFailures?.();
  await repo.bumpAdaptLinksRevision?.();
}

export async function ingestSpacelabRosterMessageForGuild(
  db: Db,
  guildId: string,
  message: string,
  rosterColumn: string,
) {
  return ingestSpacelabLabRosterMessage(db, guildId, message, rosterColumn);
}
