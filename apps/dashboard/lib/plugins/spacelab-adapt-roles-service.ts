import {
  buildSpacelabAdaptRoleRows,
  parseLabRosterMessage,
  type ParsedRosterRow,
  type SpacelabAdaptRoleRowView,
} from "@maia/plugins";
import type { Db } from "@maia/db";
import {
  bumpSpacelabAdaptLinksRevision,
  clearSpacelabReconcileFailures,
  getSpacelabGeneralMemberRoleId,
  getSpacelabGuildRosterState,
  ingestSpacelabLabRosterMessage,
  listSpacelabAdaptRoleLinks,
  setSpacelabAdaptRoleLink,
  setSpacelabGeneralMemberRoleId,
  upsertSpacelabParsedRoster,
} from "@maia/db";

export interface GuildRoleOption {
  id: string;
  name: string;
}

export interface SpacelabAdaptRolesView {
  adaptRoleRows: SpacelabAdaptRoleRowView[];
  guildRoles: GuildRoleOption[];
  parsedAt: string | null;
  generalMemberRoleId: string | null;
  generalMemberRoleMissing: boolean;
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
  const [parsed, linkedRoles, generalMemberRoleId] = await Promise.all([
    repo.getParsedRoster(),
    repo.getLinkedRoles(),
    repo.getGeneralMemberRoleId?.() ?? Promise.resolve(null),
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
  };
}

export async function saveSpacelabAdaptRoleLinks(
  repo: SpacelabRosterRepository,
  links: Record<string, string | null>,
  generalMemberRoleId?: string | null,
) {
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
